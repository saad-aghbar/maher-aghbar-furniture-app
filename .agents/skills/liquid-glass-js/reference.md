# Liquid Glass JS — reference

Upstream: https://github.com/dashersw/liquid-glass-js.git  
Commit: `78cb6ccb0b9987bb60a88b14ccbd13a9e6e8ab2a`  
License: MIT (Armagan Amcalar, 2025) — keep `vendor/LICENSE` next to copied JS.

## Architecture

1. `html2canvas(document.body)` captures the page once (shared `Container.pageSnapshot`).
2. Each `Container`/`Button` draws a full-size WebGL canvas behind its children (`z-index: -1`).
3. The fragment shader refracts that snapshot using shape-aware normals (rounded / circle / pill).
4. Nested `Button`s (`setupAsNestedGlass`) sample the **parent container canvas** every animation frame (`texSubImage2D`), not the page snapshot.

There is no npm package. Files are vanilla classic scripts.

## Container

```js
new Container({
  borderRadius: 48,   // px; circle/pill overwrite this from size
  type: 'rounded',    // 'rounded' | 'circle' | 'pill'
  tintOpacity: 0.2    // 0–1
})
```

Methods: `addChild(child)`, `removeChild(child)`, `updateSizeFromDOM()`.

Public fields used by the demo: `element`, `canvas`, `gl_refs`, `render`, `children`, `warp` (buttons).

Statics: `Container.instances`, `Container.pageSnapshot`, `Container.isCapturing`, `Container.waitingForSnapshot`.

## Button

Extends `Container`.

```js
new Button({
  text: 'Button',
  size: 48,           // font-size px; drives width/height
  type: 'rounded',
  onClick: null,      // (text) => void
  warp: false,        // center distortion
  tintOpacity: 0.2
})
```

Sizing (`setSizeFromText`):

- **circle:** width = height = `fontSize * 2.5`, radius = half
- **pill:** width = text + `2 * fontSize`, height = `fontSize + 1.2 * fontSize`, radius = half height
- **rounded:** width = text + `2 * fontSize`, height = `fontSize + 1.5 * fontSize`, radius = `fontSize`

Click: `.glass-button` click → `onClick(this.text)` if provided.

## CSS (required)

From `vendor/glass.css`:

- `.glass-container` — flex, centered, `gap: 20px`, `padding: 10px`
- `.glass-container-circle` / `.glass-container-pill`
- `.glass-button` — `box-shadow: 0 25px 50px rgba(0,0,0,0.25)`, pointer cursor
- `.glass-button-circle`
- `.glass-button-text` — absolute centered, white, `pointer-events: none`

Do not restyle the canvas; it is sized in JS.

## html2canvas options (must match library)

```js
html2canvas(document.body, {
  scale: 1,
  useCORS: true,
  allowTaint: true,
  backgroundColor: null,
  ignoreElements: (element) =>
    element.classList.contains('glass-container') ||
    element.classList.contains('glass-button') ||
    element.classList.contains('glass-button-text')
})
```

## Updating `window.glassControls`

After changing globals, push uniforms on every live instance and call `instance.render()` if present. Uniform names live on `instance.gl_refs` (`edgeIntensityLoc`, `rimIntensityLoc`, `blurRadiusLoc`, …). Nested buttons keep their own program; update those too.

`tintOpacity` is set per instance at shader init (`this.tintOpacity`). Changing only `window.glassControls.tintOpacity` does not retint existing instances unless you also set the instance uniform.

## Resize recapture

`vendor/demo.js` debounces 300ms, then:

1. `Container.pageSnapshot = null`
2. `Container.isCapturing = true`
3. `Container.waitingForSnapshot = Container.instances.slice()`
4. Recapture with the same html2canvas options
5. For nested buttons, resize their texture to the parent canvas; for standalone, upload the new snapshot
6. `instance.render()`

Copy that path for production pages.

## Next.js load order

`public/liquid-glass/container.js` → `button.js` → `expose-globals.js` after `window.html2canvas` is set.

See [wrappers/next-liquid-glass.tsx](wrappers/next-liquid-glass.tsx).

## Browser support (upstream)

Chrome 80+, Firefox 75+, Safari 14+, Edge 80+. Needs WebGL, ES6, Canvas. Code requests **WebGL 1** (`getContext('webgl')`), not WebGL2.

## Cleanup

Library never removes from `Container.instances` and never cancels `requestAnimationFrame` nested loops. On React unmount:

1. `instance.element.remove()`
2. Remove from `Container.instances`
3. Nested rAF will no-op once `gl_refs`/`parent` is gone, but prefer not leaking dozens of instances

## Not this library

- CSS `backdrop-filter`
- Expo `BlurView`
- SwiftUI `glassEffect` / `GlassEffectContainer` (Apple system Liquid Glass)
- React Native views
