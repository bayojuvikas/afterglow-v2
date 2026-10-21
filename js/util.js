/**
 * util.js — shared helpers for the Afterglow birthday experience.
 *
 * Pure, dependency-free utilities: environment capability checks, text
 * sanitising, URL + share-payload handling, safe storage, date maths and
 * small DOM helpers.
 *
 * Everything here is defensive: a helper must never throw on a phone, inside
 * an in-app browser (WhatsApp / Instagram), with storage disabled, with a
 * malformed share link or with a malformed base64 payload.
 */

import { LIMITS, THEMES } from "./config.js";

/* ------------------------------------------------------------------ *
 * Environment capabilities
 * ------------------------------------------------------------------ */

const motionQuery =
  typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-reduced-motion: reduce)")
    : null;

/** True when the visitor asked the OS to reduce motion. */
export function reducedMotion() {
  return Boolean(motionQuery && motionQuery.matches);
}

/**
 * Subscribe to reduced-motion preference changes.
 * @param {(event: MediaQueryListEvent) => void} handler
 * @returns {() => void} unsubscribe
 */
export function onReducedMotionChange(handler) {
  if (!motionQuery || typeof handler !== "function") return () => {};
  if (typeof motionQuery.addEventListener === "function") {
    motionQuery.addEventListener("change", handler);
    return () => motionQuery.removeEventListener("change", handler);
  }
  if (typeof motionQuery.addListener === "function") {
    motionQuery.addListener(handler);
    return () => motionQuery.removeListener(handler);
  }
  return () => {};
}

/** Rough "this phone cannot afford a lot of particles" heuristic. */
export function isLowPower() {
  const cores = Number(navigator.hardwareConcurrency) || 4;
  const mem = Number(navigator.deviceMemory) || 4;
  return cores <= 4 || mem <= 2;
}

/* ------------------------------------------------------------------ *
 * Text
 * ------------------------------------------------------------------ */

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/**
 * Strip control characters, collapse whitespace, trim and hard-cap the length.
 * Never returns anything that could break a layout or an attribute.
 * @param {unknown} value
 * @param {number} [max] maximum length; omit for "no limit"
 */
export function clampText(value, max) {
  const text = String(value ?? "")
    .replace(CONTROL_CHARS, "")
    .replace(/\s+/g, " ")
    .trim();
  const limit = Number(max);
  if (!Number.isFinite(limit) || limit < 0) return text;
  return text.slice(0, Math.floor(limit));
}

/**
 * Validate a theme name against the palette list.
 * @param {unknown} theme
 * @param {string} [fallback] used when the theme is missing or unknown
 */
export function validTheme(theme, fallback = "rose") {
  const list = Array.isArray(THEMES) ? THEMES : [];
  const candidate = String(theme ?? "").trim().toLowerCase();
  if (list.includes(candidate)) return candidate;
  const alt = String(fallback ?? "").trim().toLowerCase();
  if (list.includes(alt)) return alt;
  return list[0] ?? "rose";
}

/**
 * Validate a date of birth in YYYY-MM-DD form.
 * Rejects impossible dates (31 Feb), future dates and anything before 1900.
 * @param {unknown} dob
 * @returns {string} "" when invalid
 */
export function validDob(dob) {
  const text = clampText(dob, LIMITS.dob);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return "";
  const [y, m, d] = text.split("-").map(Number);
  if (y < 1900 || m < 1 || m > 12 || d < 1) return "";
  const date = new Date(y, m - 1, d);
  if (Number.isNaN(date.getTime())) return "";
  if (
    date.getFullYear() !== y ||
    date.getMonth() !== m - 1 ||
    date.getDate() !== d
  ) {
    return "";
  }
  if (date.getTime() > Date.now()) return "";
  return text;
}

/* ------------------------------------------------------------------ *
 * Base64 (UTF-8 safe)
 * ------------------------------------------------------------------ */

function encodeUtf8Binary(text) {
  const bytes = [];
  for (const char of String(text)) {
    const code = char.codePointAt(0);
    if (code <= 0x7f) {
      bytes.push(code);
    } else if (code <= 0x7ff) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code <= 0xffff) {
      bytes.push(
        0xe0 | (code >> 12),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f)
      );
    } else {
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f)
      );
    }
  }
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return binary;
}

function decodeUtf8Binary(binary) {
  const bytes = [];
  for (let i = 0; i < binary.length; i += 1) bytes.push(binary.charCodeAt(i) & 0xff);
  let out = "";
  let i = 0;
  while (i < bytes.length) {
    const first = bytes[i];
    let code;
    let extra;
    if (first < 0x80) {
      code = first;
      extra = 0;
    } else if ((first & 0xe0) === 0xc0) {
      code = first & 0x1f;
      extra = 1;
    } else if ((first & 0xf0) === 0xe0) {
      code = first & 0x0f;
      extra = 2;
    } else if ((first & 0xf8) === 0xf0) {
      code = first & 0x07;
      extra = 3;
    } else {
      code = 0xfffd;
      extra = 0;
    }
    if (extra > 0) {
      if (i + extra >= bytes.length) {
        code = 0xfffd;
      } else {
        for (let k = 1; k <= extra; k += 1) {
          const next = bytes[i + k];
          if ((next & 0xc0) !== 0x80) {
            code = 0xfffd;
            break;
          }
          code = (code << 6) | (next & 0x3f);
        }
      }
    }
    i += extra + 1;
    if (code > 0xffff) {
      const adjusted = code - 0x10000;
      out += String.fromCharCode(
        0xd800 + (adjusted >> 10),
        0xdc00 + (adjusted & 0x3ff)
      );
    } else {
      out += String.fromCharCode(code);
    }
  }
  return out;
}

function encodeBase64(text) {
  const binary = encodeUtf8Binary(text);
  if (typeof btoa === "function") return btoa(binary);
  /* c8 ignore next */
  throw new Error("base64 encoder unavailable");
}

function decodeBase64(value) {
  const binary = typeof atob === "function" ? atob(value) : "";
  if (typeof TextDecoder === "function") {
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i) & 0xff;
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  }
  return decodeUtf8Binary(binary);
}

/**
 * Decode the ?d= share payload into a plain object.
 * Any failure (bad base64, bad JSON, oversized payload) yields {}.
 */
export function decodePayload(raw) {
  if (!raw) return {};
  const text = String(raw).trim();
  if (!text) return {};
  if (text.length > LIMITS.payload * 4) return {};
  try {
    const normalized = text
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .replace(/\s/g, "+");
    const json = decodeBase64(normalized);
    if (!json || json.length > LIMITS.payload) return {};
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed;
  } catch {
    return {};
  }
}

/* ------------------------------------------------------------------ *
 * URL parameters
 * ------------------------------------------------------------------ */

function currentUrl() {
  try {
    return new URL(location.href);
  } catch {
    /* c8 ignore next */
    return new URL("https://localhost/");
  }
}

/**
 * Read the personalised values from the URL.
 * Query parameters win over the ?d= payload, which wins over the defaults.
 * @param {Record<string, unknown>} [defaults]
 * @returns {{name: string, from: string, message: string, dob: string, theme: string, hasQuery: boolean}}
 */
export function parseParams(defaults = {}) {
  const base = defaults && typeof defaults === "object" ? { ...defaults } : {};
  const url = currentUrl();
  const params = url.searchParams;
  const payload = decodePayload(params.get("d"));

  const pick = (queryKey, payloadKeys, limit, baseKey) => {
    const fromQuery = params.get(queryKey);
    if (fromQuery != null && fromQuery !== "") return clampText(fromQuery, limit);
    for (const key of payloadKeys) {
      const value = payload[key];
      if (value != null && value !== "") return clampText(value, limit);
    }
    return clampText(base[baseKey], limit);
  };

  const name = pick("name", ["name"], LIMITS.name, "name");
  const from = pick("from", ["from"], LIMITS.from, "from");
  const message = pick("msg", ["msg", "message"], LIMITS.message, "message");
  const dob = validDob(pick("dob", ["dob"], LIMITS.dob, "dob"));
  const theme = validTheme(
    pick("theme", ["theme"], LIMITS.theme, "theme"),
    base.theme ?? "rose"
  );
  const hasQuery = ["name", "from", "msg", "dob", "theme", "d"].some((key) =>
    params.has(key)
  );

  const extras = {};
  if (payload && typeof payload === "object") {
    if (Array.isArray(payload.pages)) {
      extras.pages = payload.pages
        .map((p) => clampText(p, LIMITS.page))
        .filter((p) => p.length > 0)
        .slice(0, 20);
    }
    if (Array.isArray(payload.favorites)) {
      extras.favorites = payload.favorites.slice(0, 20).map((f) => ({
        label: clampText(f && f.label, LIMITS.favoriteLabel),
        text: clampText(f && f.text, LIMITS.favoriteText),
      }));
    }
    if (Array.isArray(payload.timeline)) {
      extras.timeline = payload.timeline.slice(0, 20).map((t) => ({
        date: clampText(t && t.date, LIMITS.timelineDate),
        title: clampText(t && t.title, LIMITS.timelineTitle),
        text: clampText(t && t.text, LIMITS.timelineText),
      }));
    }
    const finalWish = clampText(payload.finalWish, LIMITS.finalWish);
    if (finalWish) extras.finalWish = finalWish;
  }

  return { name, from, message, dob, theme, hasQuery, ...extras };
}

/** True when the URL carries any personalisation (plain params or payload). */
export function hasPersonalizedParams() {
  const params = currentUrl().searchParams;
  return ["name", "from", "msg", "dob", "theme", "d"].some((key) =>
    params.has(key)
  );
}

/**
 * Build a shareable link that carries the personalisation in a ?d= payload.
 * @param {{name?: string, from?: string, message?: string, dob?: string, theme?: string}} data
 * @returns {string}
 */
export function buildShareUrl(data = {}) {
  const source = data && typeof data === "object" ? data : {};
  const url = currentUrl();
  url.search = "";
  url.hash = "";
  const payload = {
    name: clampText(source.name, LIMITS.name),
    from: clampText(source.from, LIMITS.from),
    msg: clampText(source.message ?? source.msg, LIMITS.message),
    dob: validDob(source.dob),
    theme: validTheme(source.theme, "rose"),
    ...(Array.isArray(source.pages)
      ? { pages: source.pages.map((p) => clampText(p, LIMITS.page)).filter((p) => p.length > 0).slice(0, 20) }
      : {}),
    ...(Array.isArray(source.favorites)
      ? {
          favorites: source.favorites.slice(0, 20).map((f) => ({
            label: clampText(f && f.label, LIMITS.favoriteLabel),
            text: clampText(f && f.text, LIMITS.favoriteText),
          })),
        }
      : {}),
    ...(Array.isArray(source.timeline)
      ? {
          timeline: source.timeline.slice(0, 20).map((t) => ({
            date: clampText(t && t.date, LIMITS.timelineDate),
            title: clampText(t && t.title, LIMITS.timelineTitle),
            text: clampText(t && t.text, LIMITS.timelineText),
          })),
        }
      : {}),
    ...(source.finalWish ? { finalWish: clampText(source.finalWish, LIMITS.finalWish) } : {}),
  };
  url.searchParams.set("d", encodeBase64(JSON.stringify(payload)));
  return url.toString();
}

/* ------------------------------------------------------------------ *
 * Storage (always guarded — private mode / in-app browsers can throw)
 * ------------------------------------------------------------------ */

/**
 * @template T
 * @param {string} key
 * @param {T} fallback
 * @returns {T}
 */
export function storageGet(key, fallback = null) {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

/**
 * @param {string} key
 * @param {unknown} value
 * @returns {boolean} true when the value was persisted
 */
export function storageSet(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/** @param {string} key @returns {boolean} */
export function storageRemove(key) {
  try {
    window.localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ *
 * Date maths
 * ------------------------------------------------------------------ */

/**
 * @param {number} year
 * @param {number} monthIndex zero based
 * @returns {number} number of days in that month
 */
export function daysInMonth(year, monthIndex) {
  const y = Number(year);
  const m = Number(monthIndex);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return 30;
  return new Date(y, m + 1, 0).getDate();
}

/**
 * Add years, clamping the day (29 Feb -> 28 Feb in common years).
 * @param {Date} date
 * @param {number} years
 * @returns {Date}
 */
export function addYearsClamped(date, years) {
  const base = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(base.getTime())) return new Date(NaN);
  const y = base.getFullYear() + Math.trunc(Number(years) || 0);
  const m = base.getMonth();
  const d = Math.min(base.getDate(), daysInMonth(y, m));
  return new Date(
    y,
    m,
    d,
    base.getHours(),
    base.getMinutes(),
    base.getSeconds(),
    base.getMilliseconds()
  );
}

/**
 * Add months, clamping the day to the length of the target month.
 * @param {Date} date
 * @param {number} months
 * @returns {Date}
 */
export function addMonthsClamped(date, months) {
  const base = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(base.getTime())) return new Date(NaN);
  const shift = Math.trunc(Number(months) || 0);
  const total = base.getMonth() + shift;
  const y = base.getFullYear() + Math.floor(total / 12);
  const m = ((total % 12) + 12) % 12;
  const d = Math.min(base.getDate(), daysInMonth(y, m));
  return new Date(
    y,
    m,
    d,
    base.getHours(),
    base.getMinutes(),
    base.getSeconds(),
    base.getMilliseconds()
  );
}

function parseDob(dobStr) {
  const text = clampText(dobStr, LIMITS.dob);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const [y, m, d] = text.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  if (Number.isNaN(date.getTime())) return null;
  if (
    date.getFullYear() !== y ||
    date.getMonth() !== m - 1 ||
    date.getDate() !== d
  ) {
    return null;
  }
  return date;
}

/**
 * Exact age breakdown plus lifetime counters.
 * @param {string} dobStr YYYY-MM-DD
 * @param {Date} [now]
 * @returns {{years: number, months: number, days: number, totalDays: number,
 *            totalHours: number, todayIs: boolean, daysLeft: number,
 *            nextBirthday: Date} | null}
 */
export function ageParts(dobStr, now = new Date()) {
  const dob = parseDob(dobStr);
  if (!dob) return null;
  const ref =
    now instanceof Date && !Number.isNaN(now.getTime()) ? now : new Date();

  let totalMonths =
    (ref.getFullYear() - dob.getFullYear()) * 12 +
    (ref.getMonth() - dob.getMonth());
  if (totalMonths < 0) totalMonths = 0;

  let anchor = addMonthsClamped(dob, totalMonths);
  let days = ref.getDate() - anchor.getDate();
  if (days < 0) {
    totalMonths = Math.max(0, totalMonths - 1);
    anchor = addMonthsClamped(dob, totalMonths);
    days += daysInMonth(anchor.getFullYear(), anchor.getMonth());
  }

  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;

  const livedMs = ref.getTime() - dob.getTime();
  const totalDays = Math.max(0, Math.floor(livedMs / 86400000));
  const totalHours = Math.max(0, Math.floor(livedMs / 3600000));

  const todayIs =
    ref.getMonth() === dob.getMonth() && ref.getDate() === dob.getDate();

  const midnight = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  let next = addYearsClamped(dob, years);
  if (next.getTime() <= midnight.getTime()) {
    next = addYearsClamped(dob, years + 1);
  }
  if (todayIs) next = addYearsClamped(dob, years + 1);
  const daysLeft = Math.max(
    0,
    Math.round((next.getTime() - midnight.getTime()) / 86400000)
  );

  return {
    years,
    months,
    days,
    totalDays,
    totalHours,
    todayIs,
    daysLeft,
    nextBirthday: next,
  };
}

/* ------------------------------------------------------------------ *
 * DOM helpers
 * ------------------------------------------------------------------ */

/**
 * @param {string} sel
 * @param {ParentNode} [root]
 * @returns {Element | null}
 */
export function qs(sel, root = document) {
  if (!root || typeof root.querySelector !== "function") return null;
  try {
    return root.querySelector(sel);
  } catch {
    return null;
  }
}

/**
 * @param {string} sel
 * @param {ParentNode} [root]
 * @returns {Element[]}
 */
export function qsa(sel, root = document) {
  if (!root || typeof root.querySelectorAll !== "function") return [];
  try {
    return Array.prototype.slice.call(root.querySelectorAll(sel));
  } catch {
    return [];
  }
}

/** Safe text assignment — never uses innerHTML. */
export function setText(el, text) {
  if (!el) return;
  el.textContent = text == null ? "" : String(text);
}

/**
 * @param {string} tag
 * @param {string} [className]
 * @param {string} [text]
 * @returns {HTMLElement}
 */
export function createEl(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text != null) el.textContent = String(text);
  return el;
}

/* ------------------------------------------------------------------ *
 * Feedback
 * ------------------------------------------------------------------ */

/** Haptic tick where supported (Android); iOS silently ignores it. */
export function vibrate(ms = 20) {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(ms);
      return true;
    }
  } catch {
    /* not supported or blocked */
  }
  return false;
}

function ensureToast() {
  let el = qs("#toast");
  if (el) return el;
  if (typeof document === "undefined" || !document.body) return null;
  el = createEl("div", "toast");
  el.id = "toast";
  el.setAttribute("role", "status");
  el.setAttribute("aria-live", "polite");
  document.body.appendChild(el);
  return el;
}

/**
 * Show a short status message.
 * @param {string} message
 * @param {number} [duration] ms on screen
 */
export function toast(message, duration = 2200) {
  const el = ensureToast();
  if (!el) return;
  setText(el, message);
  el.classList.add("show");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    el.classList.remove("show");
  }, duration);
}

/**
 * Copy text to the clipboard, falling back to selecting the field.
 * @param {string} text
 * @param {HTMLInputElement | HTMLTextAreaElement} [fallbackEl]
 * @returns {Promise<boolean>}
 */
export async function copyText(text, fallbackEl) {
  const value = String(text ?? "");
  try {
    if (
      navigator.clipboard &&
      typeof navigator.clipboard.writeText === "function"
    ) {
      await navigator.clipboard.writeText(value);
      toast("Link copied");
      return true;
    }
  } catch {
    /* clipboard blocked — fall through */
  }

  if (fallbackEl && typeof fallbackEl.select === "function") {
    const wasReadOnly = fallbackEl.hasAttribute("readonly");
    try {
      fallbackEl.removeAttribute("readonly");
      try {
        fallbackEl.focus({ preventScroll: true });
      } catch {
        fallbackEl.focus();
      }
      if (typeof fallbackEl.setSelectionRange === "function") {
        fallbackEl.setSelectionRange(0, value.length);
      } else {
        fallbackEl.select();
      }
      let ok = false;
      try {
        ok = document.execCommand("copy");
      } catch {
        ok = false;
      }
      if (wasReadOnly) fallbackEl.setAttribute("readonly", "");
      toast(ok ? "Link copied" : "Link selected — copy it");
      return ok;
    } catch {
      toast("Copy blocked — select the link");
      return false;
    }
  }

  toast("Copy unavailable");
  return false;
}

/* ------------------------------------------------------------------ *
 * Timing
 * ------------------------------------------------------------------ */

/** @param {number} n @returns {string} two digit string */
export function pad2(n) {
  return String(Math.trunc(Number(n) || 0)).padStart(2, "0");
}

/**
 * @param {number} ms
 * @returns {Promise<void>}
 */
export function sleep(ms = 0) {
  const delay = Math.max(0, Number(ms) || 0);
  return new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Run work when the browser is idle.
 * @param {(deadline: {didTimeout: boolean, timeRemaining: () => number}) => void} cb
 * @param {number} [timeout] ms before the callback is forced
 * @returns {() => void} cancel function
 */
export function onIdle(cb, timeout = 1200) {
  if (typeof cb !== "function") return () => {};
  if (
    typeof window !== "undefined" &&
    typeof window.requestIdleCallback === "function"
  ) {
    const handle = window.requestIdleCallback(cb, { timeout });
    return () => {
      if (typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(handle);
      }
    };
  }
  const handle = setTimeout(() => {
    cb({ didTimeout: false, timeRemaining: () => 0 });
  }, 16);
  return () => clearTimeout(handle);
}