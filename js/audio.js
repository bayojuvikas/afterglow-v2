/**
 * audio.js - Web Audio synthesis for the Afterglow birthday experience.
 *
 * Synthesizes "Happy Birthday" from a note-sequence array with an ADSR gain
 * envelope. SFX are short synthesized bursts. Music only starts after a user
 * gesture; the AudioContext is resumed on tap. Mute state is persisted.
 */

import { storageGet, storageSet } from "./util.js";

const STORAGE_KEY = "afterglow:muted";

let ctx = null;
let masterGain = null;
let musicGain = null;
let sfxGain = null;
let muted = false;
let musicTimer = null;
let musicPlaying = false;
let optionalTrack = null;
let optionalTrackPlaying = false;

function loadMuted() {
  muted = Boolean(storageGet(STORAGE_KEY, false));
  return muted;
}

function applyMute() {
  if (!ctx) return;
  const g = muted ? 0 : 1;
  if (masterGain) masterGain.gain.value = g;
}

export function getContext() {
  if (ctx) return ctx;
  try {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    masterGain = ctx.createGain();
    masterGain.gain.value = muted ? 0 : 1;
    masterGain.connect(ctx.destination);
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.35;
    musicGain.connect(masterGain);
    sfxGain = ctx.createGain();
    sfxGain.gain.value = 0.5;
    sfxGain.connect(masterGain);
  } catch {
    ctx = null;
  }
  return ctx;
}

export function isMuted() {
  return muted;
}

export function setMuted(value) {
  muted = Boolean(value);
  storageSet(STORAGE_KEY, muted);
  applyMute();
  if (optionalTrack) optionalTrack.muted = muted;
  return muted;
}

export function toggleMute() {
  return setMuted(!muted);
}

export async function unlock() {
  loadMuted();
  const c = getContext();
  if (!c) return false;
  try {
    if (c.state === "suspended") await c.resume();
  } catch {
    /* iOS silent switch / blocked */
  }
  applyMute();
  return c.state === "running";
}

// --- Happy Birthday note sequence: [midi, beats] ---
const NOTES = [
  [60, 0.75], [60, 0.25], [62, 1], [60, 1], [65, 1], [64, 2],
  [60, 0.75], [60, 0.25], [62, 1], [60, 1], [67, 1], [65, 2],
  [60, 0.75], [60, 0.25], [72, 1], [69, 1], [65, 1], [64, 1], [62, 1],
  [70, 0.75], [70, 0.25], [69, 1], [65, 1], [67, 1], [65, 2],
];

function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function adsr(gain, start, duration, peak = 0.6) {
  const a = 0.015;
  const d = 0.08;
  const s = 0.5;
  const r = 0.12;
  gain.gain.cancelScheduledValues(start);
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(peak, start + a);
  gain.gain.linearRampToValueAtTime(peak * s, start + a + d);
  gain.gain.setValueAtTime(peak * s, start + duration - r);
  gain.gain.linearRampToValueAtTime(0.0001, start + duration);
}

export function startMusic() {
  const c = getContext();
  if (!c || musicPlaying) return false;
  try {
    if (c.state === "suspended") c.resume();
  } catch {}
  musicPlaying = true;
  let t = c.currentTime + 0.05;
  const beat = 0.45;
  const scheduleOnce = () => {
    let cursor = c.currentTime + 0.05;
    for (const [midi, beats] of NOTES) {
      const dur = beats * beat;
      const osc = c.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = midiToFreq(midi);
      const g = c.createGain();
      adsr(g, cursor, dur, 0.5);
      osc.connect(g);
      g.connect(musicGain);
      osc.start(cursor);
      osc.stop(cursor + dur + 0.05);
      cursor += dur;
    }
    musicTimer = setTimeout(() => {
      if (musicPlaying) scheduleOnce();
    }, (NOTES.reduce((a, b) => a + b[1], 0) * beat * 1000) - 100);
  };
  scheduleOnce();
  return true;
}

export function stopMusic() {
  musicPlaying = false;
  if (musicTimer) {
    clearTimeout(musicTimer);
    musicTimer = null;
  }
  if (optionalTrack) {
    try { optionalTrack.pause(); optionalTrack.currentTime = 0; } catch {}
    optionalTrackPlaying = false;
  }
}

export function attachOptionalTrack(src) {
  if (!src) return false;
  try {
    if (optionalTrack) {
      optionalTrack.src = src;
    } else {
      optionalTrack = new Audio(src);
      optionalTrack.loop = true;
      optionalTrack.preload = "auto";
    }
    optionalTrack.muted = muted;
    return true;
  } catch {
    return false;
  }
}

// --- SFX ---

function makeOsc(type, freq, start, dur, peak, dest) {
  const c = getContext();
  if (!c) return;
  const osc = c.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  const g = c.createGain();
  adsr(g, start, dur, peak);
  osc.connect(g);
  g.connect(dest || sfxGain);
  osc.start(start);
  osc.stop(start + dur + 0.05);
}

export function chime() {
  const c = getContext();
  if (!c) return;
  try { if (c.state === "suspended") c.resume(); } catch {}
  const t = c.currentTime + 0.02;
  makeOsc("sine", 880, t, 0.18, 0.4);
  makeOsc("sine", 1320, t + 0.1, 0.2, 0.3);
}

export function tapCut(speed = 1) {
  const c = getContext();
  if (!c) return;
  try { if (c.state === "suspended") c.resume(); } catch {}
  const t = c.currentTime + 0.01;
  const dur = 0.12 / Math.max(0.5, Math.min(2, speed));
  const osc = c.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(1200, t);
  osc.frequency.exponentialRampToValueAtTime(200, t + dur);
  const g = c.createGain();
  adsr(g, t, dur, 0.35);
  osc.connect(g);
  g.connect(sfxGain);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

export function sparkle() {
  const c = getContext();
  if (!c) return;
  try { if (c.state === "suspended") c.resume(); } catch {}
  const t = c.currentTime + 0.01;
  const freqs = [988, 1318, 1568, 1976];
  freqs.forEach((f, i) => {
    makeOsc("sine", f, t + i * 0.06, 0.14, 0.25);
  });
}

export function swell() {
  const c = getContext();
  if (!c) return;
  try { if (c.state === "suspended") c.resume(); } catch {}
  const t = c.currentTime + 0.02;
  const dur = 1.2;
  const osc = c.createOscillator();
  osc.type = "sine";
  osc.frequency.value = 220;
  const g = c.createGain();
  g.gain.cancelScheduledValues(t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.18, t + dur * 0.5);
  g.gain.linearRampToValueAtTime(0.0001, t + dur);
  osc.connect(g);
  g.connect(sfxGain);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

export function pop() {
  const c = getContext();
  if (!c) return;
  try { if (c.state === "suspended") c.resume(); } catch {}
  const t = c.currentTime + 0.01;
  const osc = c.createOscillator();
  osc.type = "square";
  osc.frequency.setValueAtTime(660, t);
  osc.frequency.exponentialRampToValueAtTime(180, t + 0.06);
  const g = c.createGain();
  adsr(g, t, 0.08, 0.25);
  osc.connect(g);
  g.connect(sfxGain);
  osc.start(t);
  osc.stop(t + 0.12);
}

export function initAudioUi(container) {
  loadMuted();
  getContext();
  applyMute();
  if (!container) return;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "mute-toggle";
  btn.setAttribute("aria-label", "Toggle mute");
  btn.textContent = muted ? "Unmute" : "Mute";
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    toggleMute();
    btn.textContent = isMuted() ? "Unmute" : "Mute";
    pop();
  });
  container.appendChild(btn);
}

// Handle iOS silent switch: Web Audio may be muted; nothing extra needed.
export default {
  initAudioUi,
  unlock,
  getContext,
  isMuted,
  setMuted,
  toggleMute,
  startMusic,
  stopMusic,
  attachOptionalTrack,
  chime,
  tapCut,
  sparkle,
  swell,
  pop,
};
