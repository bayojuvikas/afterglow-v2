import { LIMITS } from './config.js';
import { clampText, qs, setText, storageGet, storageSet, reducedMotion } from './util.js';
import { sparkle, swell } from './audio.js';

const STAR_STORAGE_KEY = 'afterglow_stars';

function clampToScreen(v, max) {
  if (v < 0) return 0;
  if (v > max) return max;
  return v;
}

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function dist2(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return dx * dx + dy * dy;
}

function dist(x1, y1, x2, y2) {
  return Math.sqrt(dist2(x1, y1, x2, y2));
}

function now() {
  return performance.now ? performance.now() : Date.now();
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function quadraticBezier(p0x, p0y, p1x, p1y, p2x, p2y, t) {
  const oneMinusT = 1 - t;
  const x = oneMinusT * oneMinusT * p0x + 2 * oneMinusT * t * p1x + t * t * p2x;
  const y = oneMinusT * oneMinusT * p0y + 2 * oneMinusT * t * p1y + t * t * p2y;
  return { x, y };
}

function randBetween(min, max) {
  return Math.random() * (max - min) + min;
}

export function mountSky({ onTick } = {}) {
  let canvas = null;
  let ctx = null;
  let rafId = null;
  let running = true;
  let dpr = 1;
  let width = 0;
  let height = 0;
  let starsField = [];
  let wishes = [];
  let particles = [];
  let launch = null;
  let reviewTimer = null;
  let approvedTimer = null;
  let currentWishStar = null;
  let mode = 'idle'; // idle | sending | review | approved
  let statusText = '';
  let footerText = 'Stars are saved on this device only.';
  let textarea = null;
  let counterEl = null;
  let sendBtn = null;
  let statusEl = null;
  let footerEl = null;
  let sheet = null;
  let sheetText = null;
  let sheetDelete = null;
  let sheetClose = null;
  let activeWishId = null;
  let reduced = reducedMotion();
  let keyboardOffset = 0;
  let tickCallback = typeof onTick === 'function' ? onTick : () => {};

  function loadWishes() {
    try {
      const data = storageGet(STAR_STORAGE_KEY, []);
      if (Array.isArray(data)) {
        wishes = data.filter((w) => w && typeof w.id === 'string' && typeof w.text === 'string' && typeof w.x === 'number' && typeof w.y === 'number');
      }
    } catch (e) {
      wishes = [];
    }
    if (wishes.length > 20) {
      wishes = wishes.slice(wishes.length - 20);
    }
  }

  function saveWishes() {
    try {
      storageSet(STAR_STORAGE_KEY, wishes);
    } catch (e) {
      // ignore
    }
  }

  function generateId() {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  function initStarsField() {
    starsField = [];
    const count = Math.min(80, Math.max(20, Math.floor((width * height) / 15000)));
    for (let i = 0; i < count; i++) {
      starsField.push({
        x: Math.random(),
        y: Math.random(),
        r: randBetween(0.5, 1.5),
        tw: randBetween(0.5, 1.5),
        phase: Math.random() * Math.PI * 2,
        speed: randBetween(0.0002, 0.0008)
      });
    }
  }

  function ensureCanvas() {
    if (canvas) return;
    canvas = qs('#sky-canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'sky-canvas';
      canvas.className = 'sky-canvas';
      canvas.style.position = 'absolute';
      canvas.style.top = '0';
      canvas.style.left = '0';
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.pointerEvents = 'none';
      const root = qs('.sky-root') || document.body;
      root.appendChild(canvas);
    }
    ctx = canvas.getContext('2d');
    resize();
  }

  function resize() {
    if (!canvas || !ctx) return;
    dpr = window.devicePixelRatio || 1;
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.scale(dpr, dpr);
    initStarsField();
    wishes.forEach((w) => {
      w._px = w.x * width;
      w._py = w.y * height;
    });
    if (currentWishStar) {
      currentWishStar._px = currentWishStar.x * width;
      currentWishStar._py = currentWishStar.y * height;
    }
  }

  function updateKeyboardOffset() {
    keyboardOffset = 0;
    if (window.visualViewport) {
      const vv = window.visualViewport;
      const diff = window.innerHeight - vv.height;
      keyboardOffset = diff > 0 ? diff : 0;
    }
  }

  function positionInput() {
    if (!textarea) return;
    updateKeyboardOffset();
    const margin = 16 + (safeAreaBottom() || 0);
    const offset = keyboardOffset > 0 ? keyboardOffset + 8 : margin;
    textarea.style.bottom = offset + 'px';
    if (counterEl) {
      counterEl.style.bottom = (offset + (sendBtn ? sendBtn.offsetHeight : 44) + 8) + 'px';
    }
    if (sendBtn) {
      sendBtn.style.bottom = margin + 'px';
    }
    if (statusEl) {
      statusEl.style.bottom = (margin + (sendBtn ? sendBtn.offsetHeight : 44) + 12) + 'px';
    }
    if (footerEl) {
      const fh = footerEl.offsetHeight || 20;
      footerEl.style.bottom = (margin + fh + 4) + 'px';
    }
  }

  function safeAreaBottom() {
    try {
      const val = getComputedStyle(document.documentElement).getPropertyValue('--safe-bottom');
      const n = parseInt(val);
      return isNaN(n) ? 0 : n;
    } catch (e) {
      return 0;
    }
  }

  function clearTimers() {
    if (reviewTimer) {
      clearTimeout(reviewTimer);
      reviewTimer = null;
    }
    if (approvedTimer) {
      clearTimeout(approvedTimer);
      approvedTimer = null;
    }
  }

  function setMode(newMode) {
    mode = newMode;
  }

  function emitParticlesFromText(text, startX, startY) {
    particles = [];
    const max = reduced ? 10 : 40;
    const len = Math.min(text.length, 80);
    for (let i = 0; i < max; i++) {
      particles.push({
        x: startX + randBetween(-10, 10),
        y: startY + randBetween(-10, 10),
        vx: randBetween(-40, 40),
        vy: randBetween(-40, 40),
        life: randBetween(0.4, 0.8),
        maxLife: randBetween(0.4, 0.8),
        size: randBetween(1, 2),
        alpha: 1
      });
    }
  }

  function startLaunch(text, startX, startY, targetX, targetY) {
    const cx = (startX + targetX) / 2;
    const cy = Math.min(startY, targetY) - 80 - Math.random() * 60;
    launch = {
      text,
      p0x: startX,
      p0y: startY,
      p1x: cx,
      p1y: cy,
      p2x: targetX,
      p2y: targetY,
      t: 0,
      speed: reduced ? 0.02 : 0.01,
      duration: reduced ? 0.5 : 1.2,
      trail: [],
      time: 0
    };
  }

  function createWishStar(text, xFrac, yFrac) {
    const wish = {
      id: generateId(),
      text,
      x: xFrac,
      y: yFrac,
      ts: Date.now()
    };
    wish._px = wish.x * width;
    wish._py = wish.y * height;
    wishes.push(wish);
    if (wishes.length > 20) {
      wishes.shift();
    }
    saveWishes();
    return wish;
  }

  function findNearestStars(targetX, targetY, count) {
    const list = [];
    wishes.forEach((w) => {
      if (!w._px && w.x !== undefined) {
        w._px = w.x * width;
        w._py = w.y * height;
      }
      const d = dist(targetX, targetY, w._px || 0, w._py || 0);
      list.push({ w, d });
    });
    list.sort((a, b) => a.d - b.d);
    return list.slice(1, 1 + count).map((item) => item.w);
  }

  function drawBackground() {
    if (!ctx) return;
    const g = ctx.createLinearGradient(0, 0, 0, height);
    g.addColorStop(0, '#061826');
    g.addColorStop(1, '#0b1f33');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
  }

  function drawStarField(t) {
    if (!ctx) return;
    ctx.save();
    for (let i = 0; i < starsField.length; i++) {
      const s = starsField[i];
      const a = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(s.phase + t * s.speed));
      ctx.globalAlpha = a;
      ctx.beginPath();
      const px = s.x * width;
      const py = s.y * height;
      ctx.arc(px, py, s.r, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }
    ctx.restore();
  }

  function drawWishes(t) {
    if (!ctx) return;
    ctx.save();
    wishes.forEach((w) => {
      if (w._px === undefined) {
        w._px = w.x * width;
        w._py = w.y * height;
      }
      const pulse = 0.8 + 0.2 * Math.sin(t * 0.0015 + w.x * 10 + w.y * 5);
      ctx.globalAlpha = 0.9 * pulse;
      const r = 2 + pulse * 1.5;
      ctx.beginPath();
      ctx.arc(w._px, w._py, r, 0, Math.PI * 2);
      const g = ctx.createRadialGradient(w._px, w._py, 0, w._px, w._py, r * 3);
      g.addColorStop(0, 'rgba(255,255,255,0.9)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.shadowColor = 'rgba(255,255,255,0.6)';
      ctx.shadowBlur = 6 * pulse;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(w._px, w._py, 1.5, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  function drawParticles(t) {
    if (!ctx || particles.length === 0) return;
    ctx.save();
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= (16 / 1000);
      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }
      const k = 1 - p.life / p.maxLife;
      p.x += p.vx * 0.016;
      p.y += p.vy * 0.016;
      p.vy += 10 * 0.016;
      ctx.globalAlpha = Math.max(0, 1 - k);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawLaunch(t) {
    if (!ctx || !launch) return;
    ctx.save();
    launch.time += 16 / 1000;
    launch.t = Math.min(1, launch.time / launch.duration);
    const pt = quadraticBezier(launch.p0x, launch.p0y, launch.p1x, launch.p1y, launch.p2x, launch.p2y, launch.t);
    launch.trail.push({ x: pt.x, y: pt.y, t: launch.t });
    if (launch.trail.length > 30) launch.trail.shift();
    // trail
    for (let i = 0; i < launch.trail.length; i++) {
      const tr = launch.trail[i];
      const a = (i / launch.trail.length) * 0.5;
      ctx.globalAlpha = a;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(tr.x, tr.y, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // point
    const pulse = 0.9 + 0.1 * Math.sin(t * 0.005);
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 3 * pulse, 0, Math.PI * 2);
    const g2 = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, 10);
    g2.addColorStop(0, 'rgba(255,255,255,1)');
    g2.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g2;
    ctx.fill();
    ctx.restore();
    if (launch.t >= 1) {
      const fx = pt.x;
      const fy = pt.y;
      const xFrac = clampToScreen(fx / width, 1);
      const yFrac = clampToScreen(fy / height, 1);
      const newWish = createWishStar(launch.text, xFrac, yFrac);
      launch = null;
      particles = [];
      currentWishStar = newWish;
      setMode('review');
      setStatus('Your wish is being reviewed by the universe...');
      if (typeof swell === 'function') swell();
      reviewTimer = setTimeout(() => {
        setMode('approved');
        setStatus('Your wish has been approved. It\'s shining now.');
        if (typeof sparkle === 'function') sparkle();
        clearTimers();
      }, 2500);
    }
  }

  function drawCurrentStar(t) {
    if (!ctx || !currentWishStar) return;
    if (currentWishStar._px === undefined) {
      currentWishStar._px = currentWishStar.x * width;
      currentWishStar._py = currentWishStar.y * height;
    }
    const cx = currentWishStar._px;
    const cy = currentWishStar._py;
    ctx.save();
    if (mode === 'review') {
      const pulse = 0.9 + 0.1 * Math.sin(t * 0.004);
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, 4 * pulse, 0, Math.PI * 2);
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 14);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fill();
    } else if (mode === 'approved') {
      const pulse = 0.8 + 0.2 * Math.sin(t * 0.002);
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, 5 * pulse, 0, Math.PI * 2);
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 18);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.shadowColor = 'rgba(255,255,255,0.8)';
      ctx.shadowBlur = 10 * pulse;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx, cy, 2, 0, Math.PI * 2);
      ctx.fill();
      // constellations to nearest up to 3
      const nearest = findNearestStars(cx, cy, 3);
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.4;
      nearest.forEach((nw) => {
        if (nw._px === undefined) {
          nw._px = nw.x * width;
          nw._py = nw.y * height;
        }
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(nw._px, nw._py);
        ctx.stroke();
      });
    }
    ctx.restore();
  }

  function draw() {
    if (!running) return;
    const t = now();
    drawBackground();
    drawStarField(t);
    drawWishes(t);
    drawParticles(t);
    drawLaunch(t);
    drawCurrentStar(t);
    tickCallback({ mode, wishesCount: wishes.length });
    rafId = requestAnimationFrame(draw);
  }

  function startDraw() {
    if (rafId) return;
    rafId = requestAnimationFrame(draw);
  }

  function stopDraw() {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  function setStatus(s) {
    statusText = s || '';
    if (statusEl) setText(statusEl, statusText);
  }

  function hideInputUI() {
    if (textarea) textarea.style.display = 'none';
    if (counterEl) counterEl.style.display = 'none';
    if (sendBtn) sendBtn.style.display = 'none';
    if (statusEl) statusEl.style.display = 'block';
    if (footerEl) footerEl.style.display = 'block';
    positionInput();
  }

  function showInputUI() {
    if (textarea) textarea.style.display = 'flex';
    if (counterEl) counterEl.style.display = 'block';
    if (sendBtn) sendBtn.style.display = 'flex';
    if (statusEl) statusEl.style.display = 'block';
    if (footerEl) footerEl.style.display = 'block';
    positionInput();
    if (textarea) textarea.focus();
  }

  function updateCounter() {
    const v = textarea ? textarea.value : '';
    const len = v.length;
    const max = (LIMITS && LIMITS.wishMax) || 140;
    if (counterEl) setText(counterEl, len + ' / ' + max);
    if (sendBtn) sendBtn.disabled = len === 0;
  }

  function randomSkyPosAwayFrom(x, y, box) {
    let tries = 0;
    while (tries < 50) {
      const rx = Math.random();
      const ry = Math.random();
      const px = rx * width;
      const py = ry * height;
      // avoid box
      const inBox = box && px >= box.left && px <= box.right && py >= box.top && py <= box.bottom;
      if (inBox) {
        tries++;
        continue;
      }
      // avoid existing stars (min distance)
      let tooClose = false;
      for (let i = 0; i < wishes.length; i++) {
        const w = wishes[i];
        const wpx = (w._px !== undefined ? w._px : w.x * width);
        const wpy = (w._py !== undefined ? w._py : w.y * height);
        if (dist2(px, py, wpx, wpy) < 30 * 30) {
          tooClose = true;
          break;
        }
      }
      if (!tooClose) {
        return { x: rx, y: ry, px, py };
      }
      tries++;
    }
    return { x: Math.random(), y: Math.random() };
  }

  function handleSend() {
    if (!textarea) return;
    const raw = textarea.value;
    if (!raw || raw.trim().length === 0) return;
    const text = clampText(raw, (LIMITS && LIMITS.wishMax) || 140);
    const rect = textarea.getBoundingClientRect();
    const startX = rect.left + rect.width / 2;
    const startY = rect.top + rect.height / 2;
    const box = {
      left: rect.left - 20,
      right: rect.right + 20,
      top: rect.top - 20,
      bottom: rect.bottom + 20
    };
    const target = randomSkyPosAwayFrom(startX, startY, box);
    textarea.value = '';
    updateCounter();
    emitParticlesFromText(text, startX, startY);
    setMode('sending');
    hideInputUI();
    setStatus('');
    if (reduced) {
      // immediate
      const w = createWishStar(text, target.x, target.y);
      currentWishStar = w;
      setMode('review');
      setStatus('Your wish is being reviewed by the universe...');
      if (typeof swell === 'function') swell();
      reviewTimer = setTimeout(() => {
        setMode('approved');
        setStatus('Your wish has been approved. It\'s shining now.');
        if (typeof sparkle === 'function') sparkle();
      }, 2500);
    } else {
      startLaunch(text, startX, startY, target.px !== undefined ? target.px : target.x * width, target.py !== undefined ? target.py : target.y * height);
      if (typeof sparkle === 'function') sparkle();
    }
  }

  function openSheet(wishId) {
    activeWishId = wishId;
    const w = wishes.find((x) => x.id === wishId);
    if (sheet && sheetText) {
      setText(sheetText, w ? w.text : '');
      sheet.classList.add('active');
    }
  }

  function closeSheet() {
    if (sheet) sheet.classList.remove('active');
    activeWishId = null;
  }

  function deleteActiveWish() {
    if (!activeWishId) return;
    const idx = wishes.findIndex((x) => x.id === activeWishId);
    if (idx >= 0) {
      wishes.splice(idx, 1);
      saveWishes();
    }
    if (currentWishStar && currentWishStar.id === activeWishId) {
      currentWishStar = null;
      setMode('idle');
      setStatus('');
      showInputUI();
    }
    closeSheet();
  }

  function handleCanvasClick(e) {
    const x = e.clientX;
    const y = e.clientY;
    let hit = null;
    for (let i = wishes.length - 1; i >= 0; i--) {
      const w = wishes[i];
      if (w._px === undefined) {
        w._px = w.x * width;
        w._py = w.y * height;
      }
      if (dist2(x, y, w._px, w._py) < 20 * 20) {
        hit = w;
        break;
      }
    }
    if (hit) {
      openSheet(hit.id);
    }
  }

  function buildUI() {
    const root = document.createElement('div');
    root.className = 'sky-root';
    root.style.position = 'absolute';
    root.style.inset = '0';
    root.style.pointerEvents = 'none';
    root.style.zIndex = '10';

    // textarea
    textarea = document.createElement('textarea');
    textarea.className = 'sky-input glass';
    textarea.rows = 2;
    textarea.placeholder = 'Make a wish. The universe is listening.';
    textarea.setAttribute('aria-label', 'Make a wish. The universe is listening.');
    textarea.maxLength = (LIMITS && LIMITS.wishMax) || 140;
    textarea.style.position = 'fixed';
    textarea.style.left = '50%';
    textarea.style.transform = 'translateX(-50%)';
    textarea.style.width = 'calc(100% - 32px)';
    textarea.style.maxWidth = '480px';
    textarea.style.minHeight = '64px';
    textarea.style.padding = '12px 14px';
    textarea.style.borderRadius = '16px';
    textarea.style.border = '1px solid rgba(255,255,255,0.25)';
    textarea.style.background = 'rgba(255,255,255,0.15)';
    textarea.style.backdropFilter = 'blur(16px)';
    textarea.style.webkitBackdropFilter = 'blur(16px)';
    textarea.style.color = '#ffffff';
    textarea.style.fontSize = '16px';
    textarea.style.boxShadow = '0 10px 60px -20px rgba(0,0,0,0.5)';
    textarea.style.pointerEvents = 'auto';
    textarea.style.resize = 'none';

    // counter
    counterEl = document.createElement('div');
    counterEl.className = 'sky-counter';
    counterEl.style.position = 'fixed';
    counterEl.style.left = '50%';
    counterEl.style.transform = 'translateX(-50%)';
    counterEl.style.color = 'rgba(255,255,255,0.8)';
    counterEl.style.fontSize = '14px';
    counterEl.style.textAlign = 'center';
    counterEl.style.pointerEvents = 'none';
    counterEl.style.textShadow = '0 2px 10px rgba(0,0,0,0.4)';

    // send button
    sendBtn = document.createElement('button');
    sendBtn.className = 'sky-send';
    sendBtn.type = 'button';
    sendBtn.textContent = 'Send';
    sendBtn.style.position = 'fixed';
    sendBtn.style.left = '50%';
    sendBtn.style.transform = 'translateX(-50%)';
    sendBtn.style.width = 'calc(100% - 32px)';
    sendBtn.style.maxWidth = '480px';
    sendBtn.style.height = '48px';
    sendBtn.style.minHeight = '44px';
    sendBtn.style.borderRadius = '999px';
    sendBtn.style.border = '1px solid rgba(255,255,255,0.3)';
    sendBtn.style.background = 'rgba(255,255,255,0.2)';
    sendBtn.style.backdropFilter = 'blur(16px)';
    sendBtn.style.webkitBackdropFilter = 'blur(16px)';
    sendBtn.style.color = '#ffffff';
    sendBtn.style.fontSize = '16px';
    sendBtn.style.fontWeight = '600';
    sendBtn.style.boxShadow = '0 10px 60px -20px rgba(0,0,0,0.5)';
    sendBtn.style.pointerEvents = 'auto';
    sendBtn.style.touchAction = 'manipulation';
    sendBtn.disabled = true;

    // status
    statusEl = document.createElement('div');
    statusEl.className = 'sky-status';
    statusEl.style.position = 'fixed';
    statusEl.style.left = '50%';
    statusEl.style.transform = 'translateX(-50%)';
    statusEl.style.width = 'calc(100% - 32px)';
    statusEl.style.maxWidth = '480px';
    statusEl.style.textAlign = 'center';
    statusEl.style.color = '#ffffff';
    statusEl.style.fontSize = '16px';
    statusEl.style.pointerEvents = 'none';
    statusEl.style.textShadow = '0 2px 10px rgba(0,0,0,0.4)';
    statusEl.style.padding = '0 8px';

    // footer
    footerEl = document.createElement('div');
    footerEl.className = 'sky-footer';
    setText(footerEl, footerText);
    footerEl.style.position = 'fixed';
    footerEl.style.left = '50%';
    footerEl.style.transform = 'translateX(-50%)';
    footerEl.style.width = 'calc(100% - 32px)';
    footerEl.style.maxWidth = '480px';
    footerEl.style.textAlign = 'center';
    footerEl.style.color = 'rgba(255,255,255,0.7)';
    footerEl.style.fontSize = '12px';
    footerEl.style.pointerEvents = 'none';
    footerEl.style.textShadow = '0 2px 10px rgba(0,0,0,0.4)';
    footerEl.style.padding = '0 8px';

    // sheet
    sheet = document.createElement('div');
    sheet.className = 'sky-sheet';
    sheet.style.position = 'fixed';
    sheet.style.left = '0';
    sheet.style.right = '0';
    sheet.style.bottom = '0';
    sheet.style.transform = 'translateY(100%)';
    sheet.style.transition = 'transform 0.3s ease-out';
    sheet.style.background = 'rgba(10,20,40,0.95)';
    sheet.style.backdropFilter = 'blur(16px)';
    sheet.style.webkitBackdropFilter = 'blur(16px)';
    sheet.style.borderTopLeftRadius = '20px';
    sheet.style.borderTopRightRadius = '20px';
    sheet.style.padding = '20px 16px calc(16px + env(safe-area-inset-bottom, 0px))';
    sheet.style.boxShadow = '0 -10px 60px -20px rgba(0,0,0,0.8)';
    sheet.style.pointerEvents = 'auto';
    sheet.style.zIndex = '20';
    sheet.style.maxWidth = '480px';
    sheet.style.margin = '0 auto';

    sheetText = document.createElement('div');
    sheetText.className = 'sky-sheet-text';
    sheetText.style.color = '#ffffff';
    sheetText.style.fontSize = '16px';
    sheetText.style.lineHeight = '1.5';
    sheetText.style.marginBottom = '16px';
    sheetText.style.wordBreak = 'break-word';
    sheetText.style.whiteSpace = 'pre-wrap';

    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.gap = '12px';
    actions.style.justifyContent = 'flex-end';

    sheetDelete = document.createElement('button');
    sheetDelete.className = 'sky-sheet-delete';
    sheetDelete.type = 'button';
    sheetDelete.textContent = 'Delete';
    sheetDelete.style.padding = '10px 16px';
    sheetDelete.style.borderRadius = '999px';
    sheetDelete.style.border = '1px solid rgba(255,80,80,0.4)';
    sheetDelete.style.background = 'rgba(255,80,80,0.2)';
    sheetDelete.style.color = '#ffffff';
    sheetDelete.style.fontSize = '14px';
    sheetDelete.style.pointerEvents = 'auto';
    sheetDelete.style.touchAction = 'manipulation';

    sheetClose = document.createElement('button');
    sheetClose.className = 'sky-sheet-close';
    sheetClose.type = 'button';
    sheetClose.textContent = 'Close';
    sheetClose.style.padding = '10px 16px';
    sheetClose.style.borderRadius = '999px';
    sheetClose.style.border = '1px solid rgba(255,255,255,0.3)';
    sheetClose.style.background = 'rgba(255,255,255,0.2)';
    sheetClose.style.color = '#ffffff';
    sheetClose.style.fontSize = '14px';
    sheetClose.style.pointerEvents = 'auto';
    sheetClose.style.touchAction = 'manipulation';

    actions.appendChild(sheetDelete);
    actions.appendChild(sheetClose);
    sheet.appendChild(sheetText);
    sheet.appendChild(actions);

    root.appendChild(textarea);
    root.appendChild(counterEl);
    root.appendChild(sendBtn);
    root.appendChild(statusEl);
    root.appendChild(footerEl);
    document.body.appendChild(root);
    document.body.appendChild(sheet);

    // events
    textarea.addEventListener('input', updateCounter, { passive: true });
    textarea.addEventListener('focus', positionInput, { passive: true });
    textarea.addEventListener('blur', positionInput, { passive: true });
    sendBtn.addEventListener('click', handleSend);
    sendBtn.addEventListener('touchend', (e) => { e.preventDefault(); handleSend(); }, { passive: false });
    if (canvas) {
      canvas.addEventListener('click', handleCanvasClick);
      canvas.addEventListener('touchend', (e) => { e.preventDefault(); handleCanvasClick({ clientX: e.changedTouches[0].clientX, clientY: e.changedTouches[0].clientY }); }, { passive: false });
    }
    sheetDelete.addEventListener('click', deleteActiveWish);
    sheetClose.addEventListener('click', closeSheet);
    sheet.addEventListener('click', (e) => { if (e.target === sheet) closeSheet(); });
    window.addEventListener('resize', () => { resize(); positionInput(); });
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', positionInput);
      window.visualViewport.addEventListener('scroll', positionInput);
    }
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        stopDraw();
      } else {
        startDraw();
      }
    });

    updateCounter();
    positionInput();
    setStatus(statusText);
  }

  function init() {
    loadWishes();
    ensureCanvas();
    buildUI();
    resize();
    startDraw();
    showInputUI();
    if (reduced) {
      // ensure reduced motion state
    }
  }

  init();

  function cleanup() {
    running = false;
    clearTimers();
    stopDraw();
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    const root = qs('.sky-root');
    if (root && root.parentNode) root.parentNode.removeChild(root);
    if (sheet && sheet.parentNode) sheet.parentNode.removeChild(sheet);
    if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
    canvas = null;
    ctx = null;
  }

  return cleanup;
}
