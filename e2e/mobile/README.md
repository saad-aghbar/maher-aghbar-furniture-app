# Mobile Maestro E2E

Device flows for the Expo dev client (`jo.maheraghbar.furniture`).

## Prerequisites

- API `:4000`, admin-web `:3000`, Metro `:8081` (see `.cursor/skills/dev-stack/SKILL.md`)
- Simulator or device with the development client installed
- [Maestro CLI](https://docs.maestro.dev)

```bash
pnpm mobile:e2e
# or a single flow:
maestro test e2e/mobile/login.yaml
```

These flows are **not** in the blocking CI job — they need a simulator. Run them per phase locally and as an optional nightly.

Selectors reuse `accessibilityLabel` / visible text from the mobile app.
