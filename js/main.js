import { config, THEMES, LIMITS, STAGE_LIST } from "./config.js";
import {
  reducedMotion, clampText, validTheme, validDob,
  parseParams, buildShareUrl, storageGet, storageSet, storageRemove,
  ageParts, qs, qsa, setText, createEl, vibrate, toast
} from "./util.js";
import {
  unlock as unlockAudioCtx, startMusic, stopMusic, attachOptionalTrack,
  chime, tapCut, sparkle, swell, pop, isMuted, setMuted, toggleMute
} from "./audio.js";
import { initFx, celebrate, confetti, firework } from "./fx.js";
import { mountBook } from "./book.js";
import { mountDisplayCake, fillBalloons, mountCutter, blowController } from "./cake.js";
import { mountSky } from "./sky.js";

const STAGES = STAGE_LIST;
const CONTENT_KEY = "afterglow_content";
const MODE_KEY = "afterglow_mode";
const GEN_INDEX = 0;

let stageIndex = 0;
let content = { ...config };
let audioReady = false;
let bookCleanup = null;
let skyCleanup = null;
let cutCtl = null;
let ageTimer = null;
let typeTimer = null;

const els = {
  app: qs("#app"),
  stages: qs("#stages"),
  progressFill: qs("#progress-fill"),
  progressCount: qs("#progress-count"),
  muteBtn: qs("#mute-btn"),
  themeBtn: qs("#theme-btn"),
  modeBtn: qs("#mode-btn"),
  skipBtn: qs("#skip-btn"),
  loader: qs("#loader"),
};

/* ---------------- stage machine ---------------- */

function showStage(i) {
  if (i < 0 || i >= STAGES.length) return;
  stageIndex = i;
  qsa("#stages > section").forEach((s) => s.classList.remove("active"));
  const section = qs("#stage-" + STAGES[i]);
  if (section) section.classList.add("active");
  const pct = ((i + 1) / STAGES.length) * 100;
  if (els.progressFill) els.progressFill.style.width = pct + "%";
  setText(els.progressCount, (i + 1) + " / " + STAGES.length);
  window.scrollTo(0, 0);
}

function go(i) {
  showStage(i);
  chime();
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
    default: break;
  }
}

function leaveStage(name) {
  if (name === "storybook" && bookCleanup) { bookCleanup(); bookCleanup = null; }
  if (name === "wish" && skyCleanup) { skyCleanup(); skyCleanup = null; }
  if (name === "message" && ageTimer) { clearInterval(ageTimer); ageTimer = null; }
}

/* ---------------- audio / chrome ---------------- */

function ensureAudio() {
  if (audioReady) return;
  audioReady = true;
  unlockAudioCtx().then(() => {
    if (content.musicSrc) attachOptionalTrack(content.musicSrc);
    startMusic();
  }).catch(() => {});
  if (els.loader) els.loader.style.display = "none";
}

function applyTheme() {
  document.documentElement.setAttribute("data-theme", content.theme || "rose");
  const mode = storageGet(MODE_KEY, "dark");
  document.documentElement.setAttribute("data-mode", mode);
  if (els.themeBtn) setText(els.themeBtn, "Theme");
  if (els.modeBtn) setText(els.modeBtn, "Mode");
}

function syncMuteButton() {
  if (els.muteBtn) setText(els.muteBtn, isMuted() ? "Unmute" : "Mute");
}

if (els.muteBtn) {
  els.muteBtn.addEventListener("click", () => {
    toggleMute();
    syncMuteButton();
    pop();
  });
}

if (els.themeBtn) {
  els.themeBtn.addEventListener("click", () => {
    const idx = THEMES.indexOf(content.theme);
    content.theme = THEMES[(idx + 1) % THEMES.length];
    storageSet(CONTENT_KEY, content);
    applyTheme();
  });
}

if (els.modeBtn) {
  els.modeBtn.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-mode") || "dark";
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-mode", next);
    storageSet(MODE_KEY, next);
  });
}

if (els.skipBtn) {
  els.skipBtn.addEventListener("click", () => go(STAGES.length - 1));
}

if (els.app) {
  els.app.addEventListener("pointerdown", () => ensureAudio(), { once: true, passive: true });
}

/* ---------------- stage 0: generator ---------------- */

function setupGenerator() {
  const nameInp = qs("#gen-name");
  const fromInp = qs("#gen-from");
  const msgInp = qs("#gen-msg");
  const themeSel = qs("#gen-theme");
  const dobInp = qs("#gen-dob");
  const preview = qs("#gen-preview");
  const goBtn = qs("#gen-go");
  const copyBtn = qs("#gen-copy");

  if (!nameInp) return;

  if (nameInp.value !== content.name) nameInp.value = content.name || "";
  if (fromInp.value !== content.from) fromInp.value = content.from || "";
  if (msgInp.value !== content.message) msgInp.value = content.message || "";
  if (themeSel) themeSel.value = validTheme(content.theme);
  if (dobInp && content.dob) dobInp.value = content.dob;

  function refresh() {
    if (!preview) return;
    const n = clampText(nameInp.value, LIMITS.name) || "Recipient";
    const f = clampText(fromInp.value, LIMITS.from) || "Sender";
    const m = clampText(msgInp.value, LIMITS.message) || "Happy Birthday!";
    setText(preview, "For " + n + " from " + f + " - " + m);
  }

  [nameInp, fromInp, msgInp, dobInp].forEach((el) => {
    if (el) el.addEventListener("input", refresh);
  });
  if (themeSel) themeSel.addEventListener("change", refresh);
  refresh();

  function collect() {
    const t = themeSel ? validTheme(themeSel.value) : "rose";
    const d = dobInp ? validDob(dobInp.value) : "";
    return {
      name: clampText(nameInp.value, LIMITS.name) || "Recipient",
      from: clampText(fromInp.value, LIMITS.from) || "Sender",
      message: clampText(msgInp.value, LIMITS.message) || "Happy Birthday!",
      dob: d,
      theme: t,
    };
  }

  if (goBtn) {
    goBtn.addEventListener("click", () => {
      const next = collect();
      content = { ...config, ...next, pages: content.pages, favorites: content.favorites, timeline: content.timeline, finalWish: content.finalWish };
      storageSet(CONTENT_KEY, content);
      applyTheme();
      go(GEN_INDEX + 1);
    });
  }

  if (copyBtn) {
    copyBtn.addEventListener("click", async () => {
      const next = collect();
      const url = buildShareUrl({
        name: next.name, from: next.from, message: next.message,
        dob: next.dob, theme: next.theme,
        pages: content.pages, favorites: content.favorites,
        timeline: content.timeline, finalWish: content.finalWish,
      });
      try {
        await navigator.clipboard.writeText(url);
        toast("Link copied");
      } catch (err) {
        toast("Copy failed - link is in the address bar");
      }
    });
  }
}

/* ---------------- stage 1: gift ---------------- */

function setupGift() {
  const hit = qs("#gift-hit");
  if (!hit) return;
  hit.addEventListener("click", () => {
    sparkle();
    setTimeout(() => go(2), 650);
  }, { once: true });
}

/* ---------------- stage 2: key ---------------- */

function setupKey() {
  const hit = qs("#key-hit");
  if (!hit) return;
  hit.addEventListener("click", () => {
    sparkle();
    setTimeout(() => go(3), 650);
  }, { once: true });
}

/* ---------------- stage 3: storybook ---------------- */

function setupStorybook() {
  const book = qs("#book");
  if (!book) return;
  const texts = (content.pages || []).map((p) => clampText(p, LIMITS.page)).filter(Boolean);
  if (!texts.length) return;
  if (bookCleanup) bookCleanup();
  bookCleanup = mountBook(book, texts, () => {
    setTimeout(() => go(4), 500);
  });
}

/* ---------------- stage 4: cake ---------------- */

function setupCake() {
  const slot = qs("#cake-display");
  const row = qs("#balloon-row");
  if (row) fillBalloons(row, content.name || "You");
  if (slot) mountDisplayCake(slot, true);
  const btn = qs("#cake-continue");
  if (btn) btn.addEventListener("click", () => go(5), { once: true });
}

/* ---------------- stage 5: blow ---------------- */

function setupBlow() {
  const display = qs("#blow-display");
  if (!display) return;
  display.innerHTML = "";
  const candles = mountDisplayCake(display, true);
  const prompt = qs("#blow-prompt");
  const hint = qs("#blow-hint");
  const btn = qs("#blow-btn");
  if (btn) {
    btn.addEventListener("click", () => {
      setText(prompt, "Blow into your phone...");
      setText(hint, "Hold a steady breath toward the flames");
    }, { once: true });
  }
  blowController(candles, {
    onAllOut: () => go(6),
    prompt: prompt,
    hint: hint,
  });
}

/* ---------------- stage 6: cut ---------------- */

function setupCut() {
  const world = qs("#cake-world");
  const canvas = qs("#cut-canvas");
  const hint = qs("#cut-hint");
  const done = qs("#cut-done");
  if (!world || !canvas) return;

  world.innerHTML = "";
  const cake = createEl("div", "cake-piece");
  cake.style.clipPath = "polygon(0 0, 100% 0, 100% 100%, 0 100%)";
  world.appendChild(cake);

  if (cutCtl && cutCtl.resize) cutCtl.resize();
  cutCtl = mountCutter({ world: world, canvas: canvas, hint: hint, onFinished: () => {} });

  if (done) {
    done.addEventListener("click", () => {
      sparkle();
      go(7);
    }, { once: true });
  }
}

/* ---------------- stage 7: celebration ---------------- */

function setupCelebration() {
  const title = qs("#wave-title");
  const name = content.name || "Recipient";
  if (title) {
    title.innerHTML = "";
    name.split("").forEach((ch, i) => {
      const span = createEl("span", "wave-letter");
      span.style.setProperty("--i", String(i));
      setText(span, ch === " " ? "\u00a0" : ch);
      title.appendChild(span);
    });
  }
  const sub = qs("#cele-sub");
  setText(sub, "Happy Birthday, " + name);
  const btn = qs("#cele-continue");
  if (btn) btn.addEventListener("click", () => go(8), { once: true });
  if (!reducedMotion()) {
    celebrate();
    setTimeout(() => confetti(24), 400);
    setTimeout(() => firework(window.innerWidth * 0.3, window.innerHeight * 0.3), 900);
    setTimeout(() => firework(window.innerWidth * 0.7, window.innerHeight * 0.25), 1300);
  }
}

/* ---------------- stage 8: message ---------------- */

function setupMessage() {
  const msg = qs("#typed-msg");
  const text = content.message || "Happy Birthday!";
  if (msg) {
    msg.innerHTML = "";
    const caret = createEl("span", "caret");
    let i = 0;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      if (typeTimer) clearTimeout(typeTimer);
      msg.innerHTML = "";
      setText(msg, text);
    };
    const step = () => {
      if (done) return;
      i += 1;
      msg.innerHTML = "";
      setText(msg, text.slice(0, i));
      msg.appendChild(caret);
      if (i >= text.length) { done = true; return; }
      typeTimer = setTimeout(step, 32);
    };
    step();
    msg.addEventListener("click", finish, { once: true });
  }

  startAgeTicker();

  const grid = qs("#fame-grid");
  if (grid) {
    grid.innerHTML = "";
    (content.favorites || []).forEach((fav) => {
      const card = createEl("div", "fame-card");
      const lab = createEl("div", "label", clampText(fav.label, LIMITS.favoriteLabel));
      const txt = createEl("div", "text", clampText(fav.text, LIMITS.favoriteText));
      card.appendChild(lab);
      card.appendChild(txt);
      grid.appendChild(card);
    });
  }

  const tl = qs("#timeline");
  if (tl) {
    tl.innerHTML = "";
    (content.timeline || []).forEach((item) => {
      const wrap = createEl("div", "timeline-item");
      wrap.appendChild(createEl("div", "date", clampText(item.date, LIMITS.timelineDate)));
      wrap.appendChild(createEl("div", "title", clampText(item.title, LIMITS.timelineTitle)));
      wrap.appendChild(createEl("div", "text", clampText(item.text, LIMITS.timelineText)));
      tl.appendChild(wrap);
    });
  }

  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) entry.target.classList.add("reveal");
      });
    }, { threshold: 0.15 });
    qsa(".timeline-item").forEach((el) => io.observe(el));
  } else {
    qsa(".timeline-item").forEach((el) => el.classList.add("reveal"));
  }

  const cont = qs("#msg-continue");
  if (cont) {
    cont.classList.add("sticky");
    cont.addEventListener("click", () => go(9), { once: true });
  }
}

function startAgeTicker() {
  if (ageTimer) clearInterval(ageTimer);
  const line = qs("#age-line");
  if (!line || !content.dob) { if (line) setText(line, ""); return; }
  function tick() {
    const parts = ageParts(content.dob, new Date());
    if (!parts) { setText(line, ""); return; }
    if (parts.todayIs) {
      setText(line, "Today is your birthday - " + parts.years + " years old - " + parts.totalDays + " days lived");
    } else {
      setText(line, parts.years + "y " + parts.months + "m " + parts.days + "d - " + parts.totalDays + " days lived - " + parts.daysLeft + " days to go");
    }
  }
  tick();
  ageTimer = setInterval(tick, 1000);
}

/* ---------------- stage 9: wish ---------------- */

function setupWish() {
  const host = qs("#wish-stage-host");
  if (!host) return;
  if (skyCleanup) { skyCleanup(); skyCleanup = null; }
  skyCleanup = mountSky({
    container: host,
    onContinue: () => go(10),
  });
}

/* ---------------- stage 10: finale ---------------- */

function setupFinale() {
  setText(qs("#final-wish"), content.finalWish || "Happy Birthday!");
  setText(qs("#final-from"), "- " + (content.from || "Sender"));
  const link = buildShareUrl({
    name: content.name, from: content.from, message: content.message,
    dob: content.dob, theme: content.theme,
    pages: content.pages, favorites: content.favorites,
    timeline: content.timeline, finalWish: content.finalWish,
  });
  const linkEl = qs("#final-link");
  if (linkEl) {
    linkEl.value = link;
    setText(linkEl, link);
  }
  const copyBtn = qs("#final-copy");
  if (copyBtn) {
    copyBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(link);
        toast("Link copied");
      } catch (err) {
        toast("Copy failed");
      }
    });
  }
  const replayBtn = qs("#final-replay");
  if (replayBtn) {
    replayBtn.addEventListener("click", () => {
      go(GEN_INDEX + 1);
    });
  }
}

/* ---------------- boot ---------------- */

function loadContent() {
  const stored = storageGet(CONTENT_KEY);
  if (stored && typeof stored === "object") {
    content = { ...config, ...stored };
  }
  const params = parseParams(config);
  if (params.hasQuery) {
    content = { ...content, ...params };
    if (params.theme) content.theme = validTheme(params.theme);
    if (params.dob) content.dob = params.dob;
    if (params.message) content.message = params.message;
    if (params.name) content.name = params.name;
    if (params.from) content.from = params.from;
  }
}

function boot() {
  loadContent();
  applyTheme();
  syncMuteButton();
  initFx("#bg-canvas", "#fx-canvas");

  const personalized = parseParams(config).hasQuery || storageGet(CONTENT_KEY);
  showStage(personalized ? GEN_INDEX + 1 : GEN_INDEX);
  setupStage(STAGES[personalized ? GEN_INDEX + 1 : GEN_INDEX]);

  if (content.dob) {
    const parts = ageParts(content.dob, new Date());
    if (parts && parts.todayIs && !reducedMotion()) {
      setTimeout(() => celebrate(), 600);
    }
  }

  if (els.loader) {
    const hide = () => { els.loader.style.display = "none"; };
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(hide).catch(hide);
    } else {
      setTimeout(hide, 300);
    }
  }
}

boot();