import { reducedMotion, setText, vibrate } from "./util.js";
import { crumbs } from "./fx.js";
import { tapCut } from "./audio.js";

export function cakeMarkup(withCandles = true) {
  const wrap = document.createElement("div");
  wrap.className = "cake-slice";
  wrap.innerHTML = `
    <div class="cake-layer"></div>
    <div class="cake-layer"></div>
    <div class="cake-icing"><div class="cake-drip"></div><div class="cake-drip"></div><div class="cake-drip"></div></div>
    <div class="cake-plate"></div>
  `;
  if (withCandles) {
    for (let i = 0; i < 4; i++) {
      const c = document.createElement("div");
      c.className = "candle lit";
      c.style.left = `${20 + i * 22}%`;
      c.innerHTML = `<div class="flame"></div>`;
      wrap.appendChild(c);
    }
  }
  return wrap;
}

export function fillBalloons(row, name) {
  row.innerHTML = "";
  const letters = name.trim().slice(0, 10);
  for (const ch of letters) {
    const b = document.createElement("div");
    b.className = "balloon";
    setText(b, ch);
    row.appendChild(b);
  }
}

export function mountDisplayCake(slot, withCandles = true) {
  slot.innerHTML = "";
  const cake = cakeMarkup(withCandles);
  slot.appendChild(cake);
  return slot.querySelectorAll(".candle");
}


export function mountCutter({ world, canvas, hint, onFinished }) {
  const ctx = canvas.getContext("2d");
  const cx = canvas.parentElement;
  let pieces = [{ el: null, poly: [[0,0],[1,0],[1,1],[0,1]] }];
  let cakeRect = null;
  let trail = [];
  let active = false;

  function resize() {
    canvas.width = cx.clientWidth;
    canvas.height = cx.clientHeight;
    cakeRect = cx.getBoundingClientRect();
    redraw();
  }
  resize();
  window.addEventListener("resize", resize);

  function cross(d, q, p) { return d.x * (q.y - p.y) - d.y * (q.x - p.x); }

  function clip(poly, p, d, keep) {
    const out = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      const da = keep(cross(d, a, p)), db = keep(cross(d, b, p));
      if (da) out.push(a);
      if (da !== db) {
        const t = cross(d, a, p) / (cross(d, a, p) - cross(d, b, p));
        out.push({ x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) });
      }
    }
    return out;
  }

  function split(poly, p, d) {
    const A = clip(poly, p, d, v => v >= 0);
    const B = clip(poly, p, d, v => v < 0);
    return [A, B].filter(p => p.length >= 3);
  }

  function norm(d) { return { x: -d.y, y: d.x }; }

  function redraw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, cakeRect.height / 2);
    ctx.lineTo(canvas.width, cakeRect.height / 2);
    ctx.stroke();
    if (trail.length > 1) {
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(trail[0].x, trail[0].y);
      for (const t of trail) ctx.lineTo(t.x, t.y);
      ctx.stroke();
    }
  }

  cx.addEventListener("pointerdown", (e) => {
    active = true;
    trail = [{ x: e.clientX, y: e.clientY }];
    cx.setPointerCapture(e.pointerId);
    redraw();
  }, { passive: false });

  cx.addEventListener("pointermove", (e) => {
    if (!active) return;
    trail.push({ x: e.clientX, y: e.clientY });
    if (trail.length > 40) trail.shift();
    redraw();
  }, { passive: false });

  cx.addEventListener("pointerup", (e) => {
    if (!active) return;
    active = false;
    cx.releasePointerCapture(e.pointerId);
    trail.push({ x: e.clientX, y: e.clientY });

    const start = trail[0];
    const end = trail[trail.length - 1];
    const len = Math.hypot(end.x - start.x, end.y - start.y);
    const minLen = cakeRect.width * 0.4;

    if (len < minLen) {
      setText(hint, "Try a longer swipe across the cake.");
      trail = [];
      redraw();
      return;
    }

    const p = { x: start.x - cakeRect.left, y: start.y - cakeRect.top };
    const d = { x: end.x - start.x, y: end.y - start.y };
    const mag = Math.hypot(d.x, d.y) || 1;
    d.x /= mag; d.y /= mag;

    tapCut(len / 1000);
    vibrate(20);

    const next = [];
    for (const piece of pieces) {
      const poly = piece.poly.map(({x,y}) => ({x: x * cakeRect.width, y: y * cakeRect.height}));
      const [A, B] = split(poly, p, d);
      if (A.length >= 3) next.push({ el: piece.el, poly: A.map(({x,y}) => [x/cakeRect.width, y/cakeRect.height]) });
      if (B.length >= 3) {
        const el = piece.el.cloneNode(true);
        el.style.clipPath = `polygon(${B.map(([x,y]) => `${x*100}% ${y*100}%`).join(",")})`;
        world.appendChild(el);
        const n = norm(d);
        const nx = n.x * 18, ny = n.y * 18;
        el.animate([
          { transform: `translate(0,0) rotate(0deg)` },
          { transform: `translate(${nx}px,${ny}px) rotate(${2 + Math.random() * 2}deg)` }
        ], { duration: 500, fill: "forwards", easing: "cubic-bezier(0.22,1,0.36,1)" });
        next.push({ el, poly: B.map(([x,y]) => [x/cakeRect.width, y/cakeRect.height]) });
      }
    }
    pieces = next.slice(0, 4);

    if (pieces.length >= 4 || true) {
      setText(hint, "Cut complete. Tap Done to serve a slice.");
    }
    trail = [];
    redraw();
  });

  return { resize };
}
export function blowController(candles, { onAllOut, prompt, hint }) {
  let stream = null;
  let analyser = null;
  let raf = null;
  let blownOut = 0;
  const threshold = 0.5;
  const holdMs = 300;
  let holdStart = 0;
  const btn = document.getElementById("blow-btn");

  async function startMic() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      if (ac.state === "suspended") await ac.resume();
      const src = ac.createMediaStreamSource(stream);
      analyser = ac.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
    } catch (err) {
      setText(prompt, "Mic unavailable — tap the flames instead.");
      setText(hint, "Tap each flame to blow it out.");
      btn.style.display = "none";
      for (const c of candles) {
        c.addEventListener("click", () => extinguish(c));
      }
    }
  }

  function extinguish(c) {
    if (c.classList.contains("out")) return;
    c.classList.replace("lit", "out");
    blownOut++;
    if (blownOut >= candles.length) {
      finish();
    }
  }

  function loop() {
    if (!analyser) return;
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);
    const rms = Math.sqrt(data.reduce((s, v) => s + v * v, 0) / data.length) / 255;
    if (rms > threshold) {
      if (!holdStart) holdStart = performance.now();
      if (performance.now() - holdStart > holdMs) {
        const next = candles[blownOut];
        if (next) extinguish(next);
        holdStart = performance.now();
      }
    } else {
      holdStart = 0;
    }
    raf = requestAnimationFrame(loop);
  }

  function finish() {
    if (raf) cancelAnimationFrame(raf);
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      stream = null;
    }
    analyser = null;
    setText(prompt, "All candles out.");
    setText(hint, "A wish rises with the smoke.");
    setTimeout(() => {
      const smoke = document.createElement("div");
      smoke.style.cssText = "position:absolute;top:-20px;left:50%;width:4px;height:40px;background:rgba(255,255,255,0.35);border-radius:50%;filter:blur(2px);transform:translateX(-50%) scaleY(0);transform-origin:bottom;animation:smoke 1.2s ease-out forwards";
      document.getElementById("blow-display").appendChild(smoke);
      if (onAllOut) setTimeout(onAllOut, 1200);
    }, 300);
  }

  btn.addEventListener("click", async () => {
    setText(prompt, "Blow into your phone...");
    setText(hint, "Hold steady breath on the flames.");
    await startMic();
    loop();
  });

  return { release: finish };
}

const style = document.createElement("style");
style.textContent = "@keyframes smoke { to { transform: translateX(-50%) translateY(-60px) scaleY(1.5); opacity: 0; } }";
document.head.appendChild(style);
