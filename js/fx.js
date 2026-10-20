/**
 * fx.js — shared particle and effects engine for Afterglow.
 *
 * One shared requestAnimationFrame loop drives two canvas layers:
 *   bg-canvas  slow floating background lights
 *   fx-canvas  bursts: confetti, fireworks, crumbs, text dust, star bursts
 *
 * Node-safe: every browser/DOM reference is guarded with `typeof`.
 * Honors prefers-reduced-motion (skips particle effects) and pauses the
 * loop when the tab is hidden (visibilitychange).
 */

import { isLowPower, reducedMotion } from "./util.js";

/* ------------------------------------------------------------------ *
 * Canvas refs
 * ------------------------------------------------------------------ */

let bgCanvas = null;
let fxCanvas = null;
let bgCtx = null;
let fxCtx = null;
let width = 0;
let height = 0;

/* ------------------------------------------------------------------ *
 * Capabilities / limits
 * ------------------------------------------------------------------ */

function isLowPowerDevice() {
  if (typeof navigator === "undefined") return false;
  try {
    return Boolean(isLowPower());
  } catch {
    return false;
  }
}

const LOW_POWER = isLowPowerDevice();
const MAX_PARTICLES = LOW_POWER ? 50 : 90;
const TO_RAD = Math.PI / 180;

/* ------------------------------------------------------------------ *
 * Particles
 * ------------------------------------------------------------------ */

const particles = [];
let tickCallbacks = [];
let rafId = null;
let lastTime = null;

function random(min, max) {
  return Math.random() * (max - min) + min;
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function spawnable(count) {
  const room = MAX_PARTICLES - particles.length;
  return Math.max(0, Math.min(count, room));
}

function createParticle(opts = {}) {
  return {
    x: Number(opts.x) || 0,
    y: Number(opts.y) || 0,
    vx: Number(opts.vx) || 0,
    vy: Number(opts.vy) || 0,
    ax: Number(opts.ax) || 0,
    ay: Number(opts.ay) || 0,
    gravity: Number(opts.gravity) || 0,
    drag: Number(opts.drag) || 1,
    life: Number(opts.life) || 1,
    maxLife: Number(opts.maxLife) || 1,
    color: opts.color || "#ffffff",
    size: Number(opts.size) || 2,
    type: opts.type || "dot", // "dot" | "rect" | "star"
    rotate: Number(opts.rotate) || 0,
    rotSpeed: Number(opts.rotSpeed) || 0,
    alpha: Number(opts.alpha) || 1,
    fade: opts.fade !== false,
    trail: Boolean(opts.trail),
    history: opts.trail ? [] : null,
    _rocket: Boolean(opts._rocket),
    _targetY: opts._targetY,
    _burstColor: opts._burstColor,
  };
}

function updateParticle(p, dt) {
  p.vx = (p.vx + p.ax * dt) * p.drag;
  p.vy = (p.vy + (p.ay + p.gravity) * dt) * p.drag;
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  p.rotate += p.rotSpeed * dt;
  p.life -= dt;
  if (p.fade) p.alpha = Math.max(0, p.life / p.maxLife);
  if (p.trail && p.history) {
    p.history.push({ x: p.x, y: p.y });
    if (p.history.length > 10) p.history.shift();
  }
  if (
    p._rocket &&
    p._targetY != null &&
    p.y <= p._targetY
  ) {
    burstRadial(p.x, p.y, p._burstColor || "#fff", LOW_POWER ? 8 : 14);
    p.life = 0;
  }
}

function burstRadial(x, y, color, n) {
  const room = spawnable(n);
  for (let i = 0; i < room; i += 1) {
    const angle = random(0, Math.PI * 2);
    const speed = random(1, 4.5);
    particles.push(createParticle({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      gravity: 0.12,
      drag: 0.96,
      life: random(0.9, 1.8),
      size: random(1.5, 3.5),
      type: "dot",
      color,
      trail: true,
    }));
  }
}

/* ------------------------------------------------------------------ *
 * Background lights
 * ------------------------------------------------------------------ */

const bgLights = [];
const BG_COLORS = [
  "rgba(255, 209, 102, 0.14)",
  "rgba(239, 71, 111, 0.12)",
  "rgba(6, 214, 160, 0.12)",
  "rgba(166, 124, 82, 0.14)",
  "rgba(255, 255, 255, 0.10)",
];

function initBgLights() {
  bgLights.length = 0;
  const count = reducedMotion() ? 2 : LOW_POWER ? 12 : 20;
  for (let i = 0; i < count; i += 1) {
    bgLights.push({
      cx: random(0, width),
      baseY: random(0, height),
      radius: random(45, 120),
      color: pick(BG_COLORS),
      speed: random(0.0007, 0.0022),
      phase: random(0, Math.PI * 2),
      range: random(25, 95),
    });
  }
}

function drawBgLight(ctx, l) {
  const x = l.cx + Math.sin(l.phase) * l.range;
  const y = l.baseY + Math.cos(l.phase * 0.65) * l.range * 0.5;
  const g = ctx.createRadialGradient(x, y, 0, x, y, l.radius);
  g.addColorStop(0, l.color);
  g.addColorStop(1, "transparent");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, l.radius, 0, Math.PI * 2);
  ctx.fill();
}

/* ------------------------------------------------------------------ *
 * Shapes
 * ------------------------------------------------------------------ */

function starPath(ctx, cx, cy, outer, inner, points) {
  const step = Math.PI / points;
  let rot = -Math.PI / 2;
  ctx.beginPath();
  ctx.moveTo(cx + Math.cos(rot) * outer, cy + Math.sin(rot) * outer);
  for (let i = 0; i < points; i += 1) {
    rot += step;
    ctx.lineTo(cx + Math.cos(rot) * inner, cy + Math.sin(rot) * inner);
    rot += step;
    ctx.lineTo(cx + Math.cos(rot) * outer, cy + Math.sin(rot) * outer);
  }
  ctx.closePath();
}

function drawParticle(ctx, p) {
  ctx.save();
  ctx.globalAlpha = p.alpha;
  ctx.strokeStyle = p.color;
  ctx.fillStyle = p.color;
  ctx.lineCap = "round";

  if (p.trail && p.history && p.history.length > 1) {
    ctx.beginPath();
    ctx.lineWidth = Math.max(0.5, p.size * 0.45);
    ctx.moveTo(p.history[0].x, p.history[0].y);
    for (let i = 1; i < p.history.length; i += 1) {
      ctx.lineTo(p.history[i].x, p.history[i].y);
    }
    ctx.globalAlpha = p.alpha * 0.45;
    ctx.stroke();
  }

  ctx.translate(p.x, p.y);
  ctx.rotate(p.rotate);
  const s = p.size;
  if (p.type === "rect") {
    ctx.fillRect(-s / 2, -s / 2, s, s);
  } else if (p.type === "star") {
    starPath(ctx, 0, 0, s, s * 0.42, 5);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(0.5, s / 2), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/* ------------------------------------------------------------------ *
 * Effects
 * ------------------------------------------------------------------ */

const CONFETTI_COLORS = ["#ffd166", "#ef476f", "#06d6a0", "#118ab2", "#ffffff", "#f4a261"];
const FIREWORK_COLORS = ["#ffd166", "#ef476f", "#06d6a0", "#8338ec", "#f4a261", "#ffffff"];

export function confetti(n = 30) {
  if (reducedMotion()) return;
  const count = spawnable(Math.min(Math.max(1, Math.trunc(n)), 70));
  if (count <= 0) return;
  const cx = width / 2;
  const cy = height * 0.55;
  for (let i = 0; i < count; i += 1) {
    const angle = random(0, Math.PI * 2);
    const speed = random(1.5, 7);
    particles.push(createParticle({
      x: cx,
      y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - random(0.5, 3),
      gravity: 0.9,
      drag: 0.96,
      life: random(1.1, 2.6),
      size: random(4, 11),
      type: "rect",
      color: pick(CONFETTI_COLORS),
      rotate: random(0, 360) * TO_RAD,
      rotSpeed: random(-0.8, 0.8),
    }));
  }
  ensureLoop();
}

export function firework(x, y) {
  if (reducedMotion()) return;
  if (spawnable(1) <= 0) return;
  const color = pick(FIREWORK_COLORS);
  particles.push(createParticle({
    x,
    y: height,
    vx: random(-0.4, 0.4),
    vy: -random(4.5, 8),
    gravity: 0.1,
    drag: 0.995,
    life: random(0.9, 1.6),
    size: 3,
    type: "dot",
    color,
    _rocket: true,
    _targetY: random(height * 0.12, height * 0.34),
    _burstColor: color,
  }));
  ensureLoop();
}

export function crumbs(x, y, n = 12) {
  if (reducedMotion()) return;
  const count = spawnable(Math.min(Math.max(1, Math.trunc(n)), 40));
  if (count <= 0) return;
  const colors = ["#a67c52", "#8d6e63", "#bfa28a", "#d7ccc8", "#efebe9"];
  for (let i = 0; i < count; i += 1) {
    const angle = random(0, Math.PI * 2);
    const speed = random(0.4, 2.4);
    particles.push(createParticle({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - random(0.3, 1.6),
      gravity: 0.55,
      drag: 0.985,
      life: random(0.7, 1.6),
      size: random(1.5, 3.5),
      type: "dot",
      color: pick(colors),
      rotate: random(0, 360) * TO_RAD,
      rotSpeed: random(-0.5, 0.5),
    }));
  }
  ensureLoop();
}

export function textDust(x, y, n = 16, color) {
  if (reducedMotion()) return;
  const count = spawnable(Math.min(Math.max(1, Math.trunc(n)), 40));
  if (count <= 0) return;
  const c = color || "#ffffff";
  for (let i = 0; i < count; i += 1) {
    const angle = random(0, Math.PI * 2);
    const speed = random(0.25, 1.8);
    particles.push(createParticle({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - random(0, 0.9),
      gravity: 0.1,
      drag: 0.975,
      life: random(0.8, 1.9),
      size: random(2, 5),
      type: pick(["dot", "rect", "star"]),
      color: c,
      rotate: random(0, 360) * TO_RAD,
      rotSpeed: random(-0.6, 0.6),
    }));
  }
  ensureLoop();
}

export function starBurst(x, y) {
  if (reducedMotion()) return;
  const count = spawnable(LOW_POWER ? 8 : 14);
  if (count <= 0) return;
  const colors = ["#ffffff", "#ffd166", "#06d6a0", "#ef476f", "#118ab2"];
  for (let i = 0; i < count; i += 1) {
    const angle = random(0, Math.PI * 2);
    const speed = random(1, 4.5);
    particles.push(createParticle({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      gravity: 0.04,
      drag: 0.95,
      life: random(0.6, 1.2),
      size: random(3, 7),
      type: "star",
      color: pick(colors),
      rotate: random(0, 360) * TO_RAD,
      rotSpeed: random(-0.9, 0.9),
      trail: true,
    }));
  }
  ensureLoop();
}

export function celebrate() {
  if (reducedMotion()) return;
  confetti(LOW_POWER ? 25 : 45);
  const bursts = LOW_POWER ? 2 : 4;
  for (let i = 0; i < bursts; i += 1) {
    setTimeout(() => {
      firework(random(width * 0.25, width * 0.75), random(height * 0.1, height * 0.35));
    }, i * 350);
  }
}

/* ------------------------------------------------------------------ *
 * Shared tick loop
 * ------------------------------------------------------------------ */

function ensureLoop() {
  if (rafId != null) return;
  lastTime = null;
  if (typeof requestAnimationFrame === "function") {
    rafId = requestAnimationFrame(loop);
  }
}

function stopLoop() {
  if (rafId != null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}

function onVisibilityChange() {
  if (typeof document === "undefined") return;
  if (document.hidden) {
    stopLoop();
  } else {
    ensureLoop();
  }
}

function loop(now) {
  if (typeof document !== "undefined" && document.hidden) {
    stopLoop();
    return;
  }
  if (lastTime === null) lastTime = now;
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const p = particles[i];
    updateParticle(p, dt);
    if (p.life <= 0) particles.splice(i, 1);
  }

  for (const cb of tickCallbacks) {
    try {
      cb(dt);
    } catch {
      /* observer callbacks must never break the frame */
    }
  }

  draw();
  rafId = requestAnimationFrame(loop);
}

/* ------------------------------------------------------------------ *
 * Drawing
 * ------------------------------------------------------------------ */

function draw() {
  if (!bgCtx || !fxCtx) return;
  bgCtx.clearRect(0, 0, width, height);
  fxCtx.clearRect(0, 0, width, height);
  for (const l of bgLights) drawBgLight(bgCtx, l);
  for (let i = 0; i < particles.length; i += 1) drawParticle(fxCtx, particles[i]);
}

/* ------------------------------------------------------------------ *
 * Public API
 * ------------------------------------------------------------------ */

export function onTick(fn) {
  if (typeof fn !== "function") return () => {};
  tickCallbacks.push(fn);
  return () => {
    const index = tickCallbacks.indexOf(fn);
    if (index >= 0) tickCallbacks.splice(index, 1);
  };
}

function resize() {
  if (!bgCanvas || !fxCanvas) return;
  width = Math.max(1, Math.floor(window.innerWidth || 0));
  height = Math.max(1, Math.floor(window.innerHeight || 0));
  bgCanvas.width = width;
  bgCanvas.height = height;
  fxCanvas.width = width;
  fxCanvas.height = height;
}

function onResize() {
  resize();
  initBgLights();
}

export function initFx(bgSelector = "#bg-canvas", fxSelector = "#fx-canvas") {
  const api = { onTick, resize };
  if (typeof document === "undefined" || typeof window === "undefined") return api;
  bgCanvas = document.querySelector(bgSelector);
  fxCanvas = document.querySelector(fxSelector);
  if (!bgCanvas || !fxCanvas) return api;
  bgCtx = bgCanvas.getContext("2d");
  fxCtx = fxCanvas.getContext("2d");
  resize();
  initBgLights();
  ensureLoop();
  if (typeof window.addEventListener === "function") {
    window.addEventListener("resize", onResize, { passive: true });
    document.addEventListener("visibilitychange", onVisibilityChange, { passive: true });
  }
  api.bgCanvas = bgCanvas;
  api.fxCanvas = fxCanvas;
  api.bgCtx = bgCtx;
  api.fxCtx = fxCtx;
  return api;
}
