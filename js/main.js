import { config, THEMES, LIMITS, STAGE_LIST } from "./config.js";
import {
  reducedMotion, isLowPower, clampText, validTheme, validDob,
  parseParams, buildShareUrl, storageGet, storageSet, storageRemove,
  ageParts, qs, qsa, setText, createEl, vibrate, toast, copyText,
  pad2, sleep
} from "./util.js";
import { initAudio, playChime, playTapCut, playSparkle, playSwell, setMute, toggleMute, musicReady } from "./audio.js";
import { initFx, celebrate, confetti, firework, crumbs } from "./fx.js";
import { mountBook } from "./book.js";
import { mountDisplayCake, fillBalloons, mountCutter, blowController } from "./cake.js";
import { mountSky } from "./sky.js";

const STAGES = STAGE_LIST;
let stageIdx = 0;
let content = { ...config };
let audioStarted = false;
let rafId = null;
let lastTime = 0;
let ageInterval = null;

const els = {
  app: qs("#app"), stages: qs("#stages"), progressFill: qs("#progress-fill"),
  progressCount: qs("#progress-count"), muteBtn: qs("#mute-btn"),
  themeBtn: qs("#theme-btn"), modeBtn: qs("#mode-btn"), skipBtn: qs("#skip-btn"),
  loader: qs("#loader"), rotateGate: qs("#rotate-gate"),
};

function setStage(i) {
  stageIdx = i;
  qsa("#stages > section").forEach(s => s.classList.remove("active"));
  const s = qs(`#stage-${STAGES[i]}`);
  if (s) s.classList.add("active");
  const pct = ((i + 1) / STAGES.length) * 100;
  els.progressFill.style.width = `${pct}%`;
  setText(els.progressCount, `${i + 1} / ${STAGES.length}`);
  playChime();
}

function go(i) {
  if (i < 0 || i >= STAGES.length) return;
  setStage(i);
  setupStage(STAGES[i]);
}

function setupStage(name) {
  switch (name) {
    case "generator": setupGenerator(); break;
    case "gift": setupGift(); break;
    case "key": setupKey(); break;
    case "storybook": setupStorybook(); break;
    case "cake": setupCake(); break;
    case "blow": setupBlow(); break;
    case "cut": setupCut(); break;
    case "celebration": setupCelebration(); break;
    case "message": setupMessage(); break;
    case "wish": setupWish(); break;
    case "finale": setupFinale(); break;
  }
}

function unlockAudio() {
  if (audioStarted) return;
  audioStarted = true;
  initAudio().catch(() => {});
}

function onFirstTap() {
  unlockAudio();
  if (els.loader) els.loader.style.display = "none";
}

els.app.addEventListener("pointerdown", onFirstTap, { once: true, passive: true });
els.skipBtn.addEventListener("click", () => go(STAGES.length - 1));
function setupGenerator() {
  const nameInp = qs("#gen-name"), fromInp = qs("#gen-from"), msgInp = qs("#gen-msg");
  const themeSel = qs("#gen-theme"), dobInp = qs("#gen-dob");
  const preview = qs("#gen-preview"), linkInp = qs("#gen-link");
  const goBtn = qs("#gen-go"), copyBtn = qs("#gen-copy");

  THEMES.forEach(t => {
    const o = document.createElement("option");
    o.value = t; setText(o, t.charAt(0).toUpperCase() + t.slice(1));
    themeSel.appendChild(o);
  });
  themeSel.value = content.theme || "rose";

  function updatePreview() {
    const n = clampText(nameInp.value, LIMITS.name) || "Alex";
    const f = clampText(fromInp.value, LIMITS.from) || "Someone";
    const m = clampText(msgInp.value, LIMITS.message) || "Happy Birthday!";
    setText(preview, `For ${n}\nfrom ${f}\n“${m}”`);
  }

  [nameInp, fromInp, msgInp, dobInp].forEach(inp => inp.addEventListener("input", updatePreview));
  themeSel.addEventListener("change", () => { content.theme = themeSel.value; updatePreview(); });

  updatePreview();

  goBtn.addEventListener("click", () => {
    const n = clampText(nameInp.value, LIMITS.name) || "Alex";
    const f = clampText(fromInp.value, LIMITS.from) || "Someone";
    const m = clampText(msgInp.value, LIMITS.message) || "Happy Birthday!";
    const t = validTheme(themeSel.value) ? themeSel.value : "rose";
    const d = validDob(dobInp.value) ? dobInp.value : "";

    content = { ...config, name: n, from: f, message: m, dob: d, theme: t };
    storageSet("birthday-content", content);

    const url = buildShareUrl(location.origin + location.pathname, { name: n, from: f, msg: m, dob: d, theme: t });
    setText(linkInp, url);
    linkInp.style.display = "block";
    copyBtn.style.display = "inline-block";

    go(0);
  });

  copyBtn.addEventListener("click", async () => {
    const url = linkInp.value;
    try { await navigator.clipboard.writeText(url); toast("Link copied"); }
    catch { linkInp.select(); document.execCommand("copy"); toast("Link copied"); }
  });
}

function applyTheme() {
  document.documentElement.setAttribute("data-theme", content.theme);
  const mode = storageGet("birthday-mode", "dark");
  document.documentElement.setAttribute("data-mode", mode);
  setText(els.themeBtn, `Theme: ${content.theme.charAt(0).toUpperCase() + content.theme.slice(1)}`);
  setText(els.modeBtn, `Mode: ${mode.charAt(0).toUpperCase() + mode.slice(1)}`);
}

els.themeBtn.addEventListener("click", () => {
  const idx = THEMES.indexOf(content.theme);
  content.theme = THEMES[(idx + 1) % THEMES.length];
  storageSet("birthday-content", content);
  applyTheme();
});

els.modeBtn.addEventListener("click", () => {
  const mode = document.documentElement.getAttribute("data-mode") === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-mode", mode);
  storageSet("birthday-mode", mode);
  setText(els.modeBtn, `Mode: ${mode.charAt(0).toUpperCase() + mode.slice(1)}`);
});
function setupGift() {
  const hit = qs("#gift-hit");
  hit.addEventListener("click", () => {
    playSparkle();
    setTimeout(() => go(1), 700);
  }, { once: true });
}

function setupKey() {
  const hit = qs("#key-hit");
  hit.addEventListener("click", () => {
    playChime();
    setTimeout(() => go(2), 700);
  }, { once: true });
}

function setupStorybook() {
  const book = qs("#book");
  const texts = content.pages.map(p => clampText(p, LIMITS.page));
  let pageIdx = 0;
  let timer = null;

  function render() {
    book.innerHTML = "";
    const front = document.createElement("div");
    front.className = "page front";
    setText(front, texts[pageIdx] || texts[0]);
    const back = document.createElement("div");
    back.className = "page back";
    setText(back, texts[Math.min(pageIdx + 1, texts.length - 1)] || texts[texts.length - 1]);
    book.appendChild(front);
    book.appendChild(back);
  }

  function nextPage() {
    pageIdx++;
    if (pageIdx >= texts.length - 1) {
      book.style.transform = "rotateY(-180deg)";
      clearTimeout(timer);
      setTimeout(() => go(3), 700);
      return;
    }
    render();
    book.style.transform = `rotateY(${-pageIdx * 45}deg)`;
  }

  render();
  book.addEventListener("click", () => { clearTimeout(timer); nextPage(); }, { once: false });

  timer = setInterval(nextPage, 4000);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) clearTimeout(timer);
  });
}
let cakeCandles = null;
function setupCake() {
  const slot = qs("#cake-display");
  const row = qs("#balloon-row");
  fillBalloons(row, content.name);
  cakeCandles = mountDisplayCake(slot, true);
  qs("#cake-continue").addEventListener("click", () => go(4), { once: true });
}

let blowCtrl = null;
function setupBlow() {
  const display = qs("#blow-display");
  display.innerHTML = "";
  const candles = mountDisplayCake(display, true);
  const prompt = qs("#blow-prompt");
  const hint = qs("#blow-hint");
  blowCtrl = blowController(candles, {
    onAllOut: () => go(5),
    prompt, hint
  });
}

let cutter = null;
function setupCut() {
  const world = qs("#cake-world");
  const canvas = qs("#cut-canvas");
  const hint = qs("#cut-hint");
  const done = qs("#cut-done");

  world.innerHTML = "";
  const cake = document.createElement("div");
  cake.className = "cake-piece";
  cake.style.clipPath = "polygon(0 0, 100% 0, 100% 100%, 0 100%)";
  world.appendChild(cake);

  cutter = mountCutter({ world, canvas, hint, onFinished: () => {} });

  done.addEventListener("click", () => {
    playSparkle();
    go(6);
  }, { once: true });
}
function setupCelebration() {
  const title = qs("#wave-title");
  const name = content.name;
  const html = name.split("").map((ch, i) => `<span style="--i:${i}">${ch}</span>`).join("");
  title.innerHTML = "";
  const wrapper = document.createElement("div");
  wrapper.className = "wave-title-wrap";
  wrapper.innerHTML = html;
  title.replaceWith(wrapper);
  qs("#cele-sub").textContent = `Happy Birthday, ${name}`;
  qs("#cele-continue").addEventListener("click", () => go(7), { once: true });
  if (!reducedMotion) celebrate();
}

function startAgeCountdown() {
  if (!content.dob) return;
  const dob = new Date(content.dob + "T00:00:00");
  function tick() {
    const now = new Date();
    const parts = ageParts(dob, now);
    const totalDays = Math.floor((now - dob) / 86400000);
    const totalHours = Math.floor((now - dob) / 3600000);
    const next = new Date(now.getFullYear(), dob.getMonth(), dob.getDate());
    if (next < now) next.setFullYear(next.getFullYear() + 1);
    const daysLeft = Math.ceil((next - now) / 86400000);
    const isToday = parts.years * 12 + parts.months === 0 && parts.days === 0 && now.getMonth() === dob.getMonth() && now.getDate() === dob.getDate();
    const line = isToday
      ? `Today is your birthday! ${parts.years} years old`
      : `${parts.years}y ${parts.mo}m ${parts.d}d — ${daysLeft} days until your birthday`;
    setText(qs("#age-line"), line);
    if (isToday && ageInterval) { celebrate(); }
  }
  tick();
  ageInterval = setInterval(tick, 1000);
}

function setupMessage() {
  const msg = qs("#typed-msg");
  const text = content.message;
  let idx = 0;
  let skipping = false;
  const caret = document.createElement("span");
  caret.className = "caret";
  msg.appendChild(caret);

  function type() {
    if (skipping) { setText(msg, text); msg.appendChild(caret); return; }
    if (idx < text.length) {
      setText(msg, text.slice(0, idx + 1));
      msg.appendChild(caret);
      idx++;
      setTimeout(type, 35);
    }
  }
  type();

  msg.addEventListener("click", () => { skipping = true; }, { once: true });

  startAgeCountdown();

  const grid = qs("#fame-grid");
  content.favorites.forEach(fav => {
    const card = document.createElement("div");
    card.className = "fame-card";
    const lab = document.createElement("div"); lab.className = "label"; setText(lab, clampText(fav.label, LIMITS.favoriteLabel));
    const txt = document.createElement("div"); txt.className = "text"; setText(txt, clampText(fav.text, LIMITS.favoriteText));
    card.appendChild(lab); card.appendChild(txt); grid.appendChild(card);
  });

  const tl = qs("#timeline");
  content.timeline.forEach(item => {
    const it = document.createElement("div"); it.className = "timeline-item";
    const d = document.createElement("div"); d.className = "date"; setText(d, clampText(item.date, LIMITS.timelineDate));
    const t = document.createElement("div"); t.className = "title"; setText(t, clampText(item.title, LIMITS.timelineTitle));
    const x = document.createElement("div"); x.className = "text"; setText(x, clampText(item.text, LIMITS.timelineText));
    it.appendChild(d); it.appendChild(t); it.appendChild(x); tl.appendChild(it);
  });

  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) e.target.classList.add("reveal"); });
  }, { threshold: 0.15 });
  qsa(".timeline-item").forEach(it => io.observe(it));

  const cont = qs("#msg-continue");
  cont.classList.add("sticky");
  cont.addEventListener("click", () => go(8), { once: true });
}
function setupWish() {
  const sky = qs("#sky-canvas");
  const wishUi = qs("#wish-ui");
  const wishText = qs("#wish-text");
  const wishCount = qs("#wish-count");
  const wishStatus = qs("#wish-status");
  const wishSend = qs("#wish-send");
  const wishContinue = qs("#wish-continue");
  const sheet = qs("#wish-sheet");
  const sheetText = qs("#sheet-text");
  const sheetDelete = qs("#sheet-delete");
  const sheetClose = qs("#sheet-close");

  mountSky({
    container: qs("#app"),
    canvas: sky,
    onStarTap: (star) => {
      setText(sheetText, star.text);
      sheet.style.display = "flex";
    }
  });

  wishText.addEventListener("input", () => {
    const len = wishText.value.length;
    setText(wishCount, `${len} / ${LIMITS.wish}`);
    wishSend.disabled = len === 0;
    if (len > LIMITS.wish) wishText.value = wishText.value.slice(0, LIMITS.wish);
  });

  let activeStar = null;
  wishSend.addEventListener("click", async () => {
    const wish = wishText.value.trim();
    if (!wish) return;
    wishSend.disabled = true;
    playSparkle();

    const stars = storageGet("birthday-stars", []);
    if (stars.length >= 20) {
      setText(wishStatus, "The sky is full (20 wishes max).");
      return;
    }

    const rect = wishUi.getBoundingClientRect();
    const startX = rect.left + rect.width / 2;
    const startY = rect.top;

    let attempts = 0;
    let tx, ty;
    do {
      tx = Math.random() * window.innerWidth;
      ty = Math.random() * (window.innerHeight * 0.6);
      attempts++;
    } while (
      Math.hypot(tx - startX, ty - startY) < 180 &&
      attempts < 50
    );

    activeStar = { id: Date.now(), text: wish, x: tx / window.innerWidth, y: ty / window.innerHeight, ts: Date.now() };

    setText(wishStatus, "Your wish is being reviewed by the universeâ€¦");

    if (reducedMotion) {
      playSwell();
      setText(wishStatus, "Your wish has been approved. It's shining now.");
      stars.push(activeStar);
      storageSet("birthday-stars", stars);
      mountSky({ container: qs("#app"), canvas: sky, stars, onStarTap: (s) => { setText(sheetText, s.text); sheet.style.display = "flex"; } });
      wishContinue.style.display = "block";
      return;
    }

    const particles = [];
    const steps = 40;
    for (let i = 0; i < steps; i++) {
      particles.push({ x: startX, y: startY, life: 1 });
    }

    let frame = 0;
    function fly() {
      frame++;
      const t = Math.min(frame / steps, 1);
      const bx = startX + (tx - startX) * t;
      const by = startY + (ty - startY) * t - 200 * t * (1 - t);
      particles.forEach(p => { p.x = bx + (Math.random() - 0.5) * 6; p.y = by + (Math.random() - 0.5) * 6; p.life = 1 - t; });
      if (t < 1) { rafId = requestAnimationFrame(fly); } else {
        playSwell();
        setText(wishStatus, "Your wish has been approved. It's shining now.");
        stars.push(activeStar);
        storageSet("birthday-stars", stars);
        mountSky({ container: qs("#app"), canvas: sky, stars, onStarTap: (s) => { setText(sheetText, s.text); sheet.style.display = "flex"; } });
        wishContinue.style.display = "block";
      }
    }
    rafId = requestAnimationFrame(fly);
  });

  sheetDelete.addEventListener("click", () => {
    if (!activeStar) return;
    let stars = storageGet("birthday-stars", []);
    stars = stars.filter(s => s.id !== activeStar.id);
    storageSet("birthday-stars", stars);
    mountSky({ container: qs("#app"), canvas: sky, stars, onStarTap: (s) => { setText(sheetText, s.text); sheet.style.display = "flex"; } });
    sheet.style.display = "none";
    activeStar = null;
    playSparkle();
  });

  sheetClose.addEventListener("click", () => { sheet.style.display = "none"; });

  wishContinue.addEventListener("click", () => go(9), { once: true });
}

function setupFinale() {
  setText(qs("#final-wish"), content.finalWish);
  setText(qs("#final-from"), `â€” ${content.from}`);
  const link = buildShareUrl(location.origin + location.pathname, { name: content.name, from: content.from, msg: content.message, dob: content.dob, theme: content.theme });
  setText(qs("#final-link"), link);

  qs("#final-copy").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(link); toast("Link copied"); }
    catch { const inp = qs("#final-link"); inp.select(); document.execCommand("copy"); toast("Link copied"); }
  }, { once: false });

  qs("#final-replay").addEventListener("click", () => {
    go(0);
    setTimeout(() => go(1), 300);
  }, { once: false });
}

function init() {
  const saved = storageGet("birthday-content");
  if (saved) content = { ...config, ...saved };
  applyTheme();

  const params = parseParams(location.search);
  if (params.name || params.from || params.msg || params.dob || params.theme) {
    content = { ...config, ...params };
    if (params.theme && validTheme(params.theme)) content.theme = params.theme;
    go(0);
  } else {
    go(0);
  }

  if (content.dob) {
    const dob = new Date(content.dob + "T00:00:00");
    const now = new Date();
    const isToday = now.getMonth() === dob.getMonth() && now.getDate() === dob.getDate() && now.getFullYear() === dob.getFullYear();
    if (isToday) celebrate();
  }

  window.addEventListener("resize", () => {
    if (cutter) cutter.resize();
  });

  document.addEventListener("visibilitychange", () => {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
  });

  document.fonts.ready.then(() => {
    if (els.loader) els.loader.style.display = "none";
  });
}

init();
