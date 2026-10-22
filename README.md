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
├── index.html            # personalisation form - the landing page
├── experience.html       # the animated 11-stage experience
├── customize.html        # redirect alias to index.html
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
  name: "Recipient",        // recipient name
  from: "Sender",           // sender name
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

## The personalisation form (index.html)

Open `index.html` in any browser - no build step, no server needed. This is the landing page: a front-end form where you fill in every placeholder and see the result immediately:

- **Basics**: recipient name, sender, message, date of birth, theme, light/dark mode
- **Storybook pages**: add, edit and remove pages
- **Hall of Fame**: add, edit and remove title/description entries
- **Timeline**: add, edit and remove date/title/text entries
- **Final wish**: the closing message

Two actions at the bottom:

- **Continue to experience** - saves everything to this device under the `afterglow_content` localStorage key and jumps straight to `experience.html` with your text applied. The details travel in the URL, so the experience works even where storage is blocked.
- **Copy share link** - builds a link to `experience.html` with a base64 `?d=` payload carrying the name, sender, message, date of birth, theme, pages, Hall of Fame entries, timeline and final wish. Send that link to anyone - it needs no storage on their device.

**Reset** clears the saved content and restores the defaults.

The built-in generator in `experience.html` (stage 0) covers the core fields only and appears if you open the experience with no details - use the form on `index.html` for the full set.

## The one-link flow

**Live link:** `https://bayojuvikas.github.io/afterglow-v2/`

1. The visitor lands on `index.html` and fills in the placeholders.
2. Tapping **Continue to experience** goes to `experience.html` with the details in the URL, and the animation starts with the gift, the storybook, the cake, the candles, the cut, the celebration, the message and the star wish - all using the entered text.
3. The same URL works as a direct link: opening `index.html?d=...` forwards straight to the experience.

`customize.html` is kept only as a redirect to `index.html` so older bookmarks keep working.

## Building the share link

Open the generator (stage 0), fill in name/sender/message/theme/optional DOB, then tap **Go**. The app builds a share URL:

```
https://your-host.github.io/repo/experience.html?d=<base64-payload>
```

Or a single Base64 payload `?d=...`. Tap **Copy link** (uses `navigator.clipboard.writeText` with a fallback that selects the link text).
The `?d=` payload also carries `pages`, `favorites`, `timeline` and `finalWish`, so a single link can reproduce the whole experience.

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
- `index.html` and the stage-0 generator both write to the `afterglow_content` localStorage key; the share link uses a `?d=` base64 payload so it works with no storage on the recipient's device.

---
Built with vanilla HTML, CSS, and JavaScript. Deploy anywhere static hosting is supported.

