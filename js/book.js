import { setText } from "./util.js";

let pages = [];
let index = 0;
let timer = null;
let startX = 0;
let startY = 0;
let dragging = false;
let onDone = () => {};
let finished = false;
let container = null;
let listeners = [];

function render(root, texts) {
  root.replaceChildren();
  pages = texts.map((text, i) => {
    const page = document.createElement("div");
    page.className = "book-page";
    page.style.zIndex = String(texts.length - i);
    const face = document.createElement("div");
    face.className = "book-face";
    setText(face, text);
    page.appendChild(face);
    root.appendChild(page);
    return page;
  });
  index = 0;
}

function turn() {
  if (finished) return;
  if (index >= pages.length) {
    onDone();
    finished = true;
    return;
  }
  pages[index].classList.add("turned");
  index += 1;
  if (index >= pages.length) {
    clearInterval(timer);
    timer = null;
  }
}

function clearTimer() {
  if (timer) { clearInterval(timer); timer = null; }
}

function addListener(target, type, fn, opts) {
  target.addEventListener(type, fn, opts);
  listeners.push({ target, type, fn, opts });
}

export function mountBook(root, texts, done) {
  onDone = done;
  finished = false;
  container = root.parentElement;
  render(root, texts);
  clearTimer();
  timer = setInterval(turn, 4200);

  const down = (e) => {
    dragging = true;
    startX = e.clientX;
    startY = e.clientY;
    try { container.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  };
  const move = (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (Math.abs(dx) > Math.abs(dy)) {
      e.preventDefault();
    }
  };
  const up = (e) => {
    if (!dragging) return;
    dragging = false;
    const dx = e.clientX - startX;
    if (finished) return;
    if (dx < -28) {
      turn();
      clearTimer();
      timer = setInterval(turn, 4200);
    } else if (dx > 28 && index > 0) {
      clearTimer();
      index -= 1;
      pages[index].classList.remove("turned");
      timer = setInterval(turn, 4200);
    } else {
      turn();
      clearTimer();
      timer = setInterval(turn, 4200);
    }
  };
  const cancel = () => { dragging = false; };

  addListener(container, "pointerdown", down);
  addListener(container, "pointermove", move, { passive: false });
  addListener(container, "pointerup", up);
  addListener(container, "pointercancel", cancel);

  return () => {
    clearTimer();
    listeners.forEach(({ target, type, fn, opts }) => {
      try { target.removeEventListener(type, fn, opts); } catch { /* ignore */ }
    });
    listeners = [];
    dragging = false;
    finished = false;
  };
}
