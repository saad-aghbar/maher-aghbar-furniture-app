---
name: shadergradient
description: >-
  Add animated 3D shader gradients with @shadergradient/react (ShaderGradient,
  ShaderGradientCanvas, presets, urlString from shadergradient.co/customize).
  Use when the user mentions ShaderGradient, shadergradient, ruucm/shadergradient,
  moving/mesh/3D gradient backgrounds, grainy WebGL gradients, or wants a
  Framer/Figma-style shader gradient in React / Next / Vite.
---

# ShaderGradient

Full instructions live in the personal skill (same name). **Read that file first:**

`~/.cursor/skills/shadergradient/SKILL.md`

Then `~/.cursor/skills/shadergradient/reference.md` for prop tables and the 10 presets.

Official repo: [ruucm/shadergradient](https://github.com/ruucm/shadergradient). Package: `@shadergradient/react`.

Do **not** add this to Maher admin / mobile / Watch unless the user explicitly asked for a WebGL gradient on a web surface.

## Paste this to invoke

```
Use the shadergradient skill. Read ~/.cursor/skills/shadergradient/SKILL.md.
@shadergradient/react: ShaderGradientCanvas wrapping ShaderGradient. Drive with props or a customize URL.
```

## Install (web React only)

```bash
pnpm add @shadergradient/react @react-three/fiber three three-stdlib camera-controls
pnpm add -D @types/three
```

Next 15 App Router: React 19 + `@react-three/fiber` v9. Next 14 / Vite: match Fiber 8.x or 9.x to React 18/19.

## Minimal

```tsx
import { ShaderGradientCanvas, ShaderGradient } from '@shadergradient/react'

<ShaderGradientCanvas style={{ position: 'absolute', inset: 0 }} pixelDensity={1.5} fov={45}>
  <ShaderGradient cDistance={32} cPolarAngle={125} />
</ShaderGradientCanvas>
```

Query mode (paste a [customize](https://www.shadergradient.co/customize) URL):

```tsx
<ShaderGradient control="query" urlString="https://www.shadergradient.co/customize?animate=on&type=plane&..." />
```

Presets: `halo`, `pensive`, `mint`, `interstella`, `nightyNight`, `violaOrientalis`, `universe`, `sunset`, `mandarin`, `cottonCandy` via `import { presets } from '@shadergradient/react'`.
