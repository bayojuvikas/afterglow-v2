# Afterglow v2 — Cinematic Birthday Experience

A mobile-only, single-page birthday web app built with vanilla HTML, CSS, and JavaScript (ES modules). No frameworks, no build step, no external image assets. Open it from a shared link on a phone.

## Features

- **11-stage story flow**: generator → gift → key → storybook → cake → blow out → cut the cake → celebration → message → star wish → finale
- **Personalized shareable link**: generator form builds a URL with `?name=`, `?from=`, `?msg=`, `?dob=`, `?theme=` params (or a Base64 `?d=` payload)
- **Gift & key**: inline SVG self-drawing with `stroke-dasharray` / `stroke-dashoffset`
- **3D storybook**: CSS 3D pages with `perspective`, `preserve-3d`, auto-turn timer, swipe support
- **Synthesized music**: Web Audio API "Happy Birthday" synth + SFX (chime, cut, sparkle, swell), mute toggle
- **Cake & candles**: layered CSS cake, flickering flames, lettered balloons, mic blow detection with tap fallback
- **Cake cutting**: pointer-edge knife trail, Sutherland–Hodgman polygon clipping, cut-face cross-section, crumb particles, up to 4 pieces
- **Celebration**: confetti + fireworks canvas, per-letter wave title
- **Message**: typewriter text, Hall of Fame grid, scroll-driven timeline with IntersectionObserver
- **Star wish**: night-sky canvas, wish textarea anchored via `visualViewport`, particle flight to sky, simulated approval, localStorage persistence (cap 20), bottom sheet with delete
- **Finale**: SVG floral card, final wish, copy link, replay
- **Theming**: 5 palettes (rose, midnight, royal, sunset, forest) + light/dark mode
- **Mobile quality**: `100dvh`, safe-area insets, `viewport-fit=cover`, 44px+ tap targets, 16px body text, `prefers-reduced-motion`, `visibilitychange` pause, shared `requestAnimationFrame` loop

## File structure

```
afterglow-v2/
├── index.html
├── manifest.json
├── css/
│   └── style.css          # design tokens, themes, glass UI, stages
├── js/
│   ├── config.js          # single source of truth for all content
│   ├── util.js            # URL params, storage, age math, helpers
│   ├── audio.js           // Web Audio synth + SFX
│   ├── fx.js              // particles, confetti, fireworks, canvas loop
│   ├── book.js            // 3D storybook
│   ├── cake.js            // cake, candles, mic blow, cutting
│   ├── main.js            // bootstrap + stage state machine
│   └── sky.js             // star wish system
└── README.md
```

## Editing config.js

`js/config.js` is the single source of truth. Edit these fields:

```js
export const config = {
  name: "Varsha",           // recipient name
  from: "Jyotishudu",       // sender name
  message: "...",           // personal message (types out)
  dob: "",                  // optional YYYY-MM-DD for age/countdown
  pages: [...],             // storybook page strings
  favorites: [...],         // Hall of Fame {label, text}
  timeline: [...],          // {date, title, text}
  finalWish: "...",         // finale message
  musicSrc: "",             // optional user mp3 path
  theme: "rose",            // rose | midnight | royal | sunset | forest
};
```

Text values are length-limited per `LIMITS` and inserted via `textContent` only.

## Building the share link

Open the generator (stage 0), fill in name/sender/message/theme/optional DOB, then tap **Go**. The app builds a share URL:

```
https://your-host.github.io/repo/?name=Varsha&from=Jyotishudu&msg=...&dob=1990-10-18&theme=rose
```

Or a single Base64 payload `?d=...`. Tap **Copy link** (uses `navigator.clipboard.writeText` with a fallback that selects the link text).

If the URL already has params, the generator is skipped and the experience starts at the gift stage.

## Deploying

### GitHub Pages
1. Push to a repo on GitHub
2. Settings → Pages → Build and deployment → Source: Deploy from a branch → `main` / `(root)`
3. Your site is live at `https://<user>.github.io/<repo>/`

### Netlify
1. Connect the repo or drag the `afterglow-v2` folder to Netlify Drop
2. Site deploys automatically; share the Netlify URL

### Adding to home screen
- iOS Safari: tap Share → "Add to Home Screen"
- Chrome Android: tap menu → "Add to Home screen"
- The page uses `apple-mobile-web-app-capable` and `mobile-web-app-capable` meta tags

## Mobile test checklist

- [ ] All 11 stages reachable on a 375px portrait viewport
- [ ] Cake cutting works with one thumb in touch emulation at different angles
- [ ] Blow detection works; tap fallback works when mic is denied
- [ ] Wish textarea stays visible when the keyboard opens (`visualViewport`)
- [ ] Wish persists after reload (localStorage)
- [ ] Layout holds on 360px Android and 430px iPhone Pro Max
- [ ] Landscape shows the rotate prompt
- [ ] `prefers-reduced-motion` mode works (animations replaced with fades)
- [ ] Share link opens straight into the personalized experience inside an in-app browser (WhatsApp, Instagram)

## Notes

- All `localStorage` access is wrapped in `try/cost`; the app renders correctly without storage.
- Audio starts only after the first user tap (iOS requirement).
- No network calls are made for the wish approval; it is simulated locally.
- Stars are saved on this device only (max 20).

---
Built with vanilla HTML, CSS, and JavaScript. Deploy anywhere static hosting is supported.

