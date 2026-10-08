---
name: liquid-glass-js
description: >-
  Apply Apple Liquid Glass UI using the vendored dashersw/liquid-glass-js
  WebGL library (real-time refraction, blur, nested glass, rounded/circle/pill
  shapes). Use when the user mentions liquid glass, liquid-glass-js, Apple glass,
  glassmorphism, glass buttons, glass containers, refraction, dashersw, or asks
  to restyle web UI with liquid glass.
---

# Liquid Glass JS

Vendored from [dashersw/liquid-glass-js](https://github.com/dashersw/liquid-glass-js.git) (`78cb6cc`, MIT). Live demo: https://dashersw.github.io/liquid-glass-js/

This is a **browser WebGL + html2canvas** library. It is not React Native, not SwiftUI, not CSS-only glassmorphism.

## Read this first, then apply

1. Read this file.
2. For API, uniforms, and Next.js wiring, read [reference.md](reference.md).
3. Copy runtime files from `vendor/` — do not rewrite the shaders from memory.

## Where it can run (this repo)

| Surface | Use the real library? |
|---------|------------------------|
| `apps/admin-web`, `apps/customer-portal`, `apps/employee-portal` (Next.js DOM) | Yes, client-only |
| `apps/mobile` (Expo / React Native) | No |
| `apps/mobile/targets/watch` (WatchKit / SwiftUI) | No |
| Native iOS 26 `.glassEffect()` | Different system — do not substitute this JS lib |

Do **not** restyle Maher mobile parchment floors with this skill unless the user explicitly asks for liquid glass on that surface.

## Runtime files (copy these)

From this skill’s `vendor/` (keep LICENSE):

| File | Role |
|------|------|
| `container.js` | `Container` class + WebGL refraction |
| `button.js` | `Button extends Container` |
| `glass.css` | Required layout for `.glass-container` / `.glass-button` |
| `expose-globals.js` | Assigns `window.Container` / `window.Button` |
| `styles.css` | Demo page only — do not dump into the app |

Skip `demo.gif`, `index.html`, `demo.js`, `controls.*` unless building a playground.

**Dependency:** `html2canvas@1.4.1` must exist as the global `html2canvas` before `container.js` runs.

Load order:

1. html2canvas
2. `container.js`
3. `button.js`
4. `expose-globals.js`
5. `glass.css`

## Defaults (do not invent)

Constructor:

```js
new Container({ borderRadius: 48, type: 'rounded', tintOpacity: 0.2 })
new Button({ text: 'Button', size: 48, type: 'rounded', onClick: null, warp: false, tintOpacity: 0.2 })
```

`type`: `'rounded'` | `'circle'` | `'pill'` only.

Global shader knobs (`window.glassControls`), library defaults in `container.js`:

| Key | Default |
|-----|---------|
| `edgeIntensity` | `0.01` |
| `rimIntensity` | `0.05` |
| `baseIntensity` | `0.01` |
| `edgeDistance` | `0.15` |
| `rimDistance` | `0.8` |
| `baseDistance` | `0.1` |
| `cornerBoost` | `0.02` |
| `rippleEffect` | `0.1` |
| `blurRadius` | `5.0` |

`tintOpacity` is per-instance, not only global.

## Hard constraints

- **Client only.** Never import `container.js` / `button.js` from a Next Server Component or Node.
- **Classic scripts**, not ESM. Classes are not `export`ed. After the four-step load, use `window.Container` / `window.Button`.
- **WebGL required.** `canvas.getContext('webgl', { preserveDrawingBuffer: true })`. No WebGL → no glass (library logs and skips).
- **html2canvas snapshots `document.body`**, ignoring `.glass-container`, `.glass-button`, `.glass-button-text`. Glass samples the page *behind* it. Empty/plain backgrounds look dead.
- **No `destroy()`.** Instances stay in `Container.instances`. On unmount, remove `instance.element` and splice that instance out of `Container.instances`.
- **Resize:** the demo recaptures the page snapshot (see `vendor/demo.js`). If you add glass to a real page, copy that debounce/recapture or glass will mis-sample after layout changes.
- **Nested glass:** `container.addChild(button)` makes the button sample the parent canvas. Do not `appendChild` the button yourself if you want nested refraction.

## Next.js (Maher web apps)

1. Copy `container.js`, `button.js`, `glass.css`, `expose-globals.js` → `public/liquid-glass/`.
2. Add `html2canvas` in that app: `pnpm --filter <app> add html2canvas@1.4.1`.
3. Import `glass.css` from a client component (or copy into the app’s CSS entry).
4. Use the loader + mount helper in [wrappers/next-liquid-glass.tsx](wrappers/next-liquid-glass.tsx).
5. Verify in the browser: glass must refract the real background, not a flat grey fill.

## React Native / Watch fallback (only if asked)

Do not port html2canvas or the fragment shaders into RN/Swift.

- **iOS 26+ native:** SwiftUI `glassEffect` / `GlassEffectContainer` — separate from this skill.
- **RN approximation:** `BlurView` + translucent fill + hairline highlight. Say it is an approximation, not Liquid Glass JS.

## Do not

- Rewrite the WebGL shaders from scratch “to simplify”.
- Load the library on the server.
- Apply this to the mobile floor aesthetic unless the user asked.
- Add `demo.gif` to the repo (10MB).
- Treat CSS `backdrop-filter: blur()` as this library.
