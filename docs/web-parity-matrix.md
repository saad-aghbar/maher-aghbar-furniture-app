# Web parity matrix

Generated from `apps/web/src/parity/manifest.ts`.

| Mobile | Web | Surface | Status |
|--------|-----|---------|--------|
| `/(auth)/login` | `/login` | auth | ported |
| `/(auth)/unlock` | — | auth | native-only |
| `/(app)/(admin)/(tabs)/` | `/admin/dashboard` | admin | ported |
| `/(app)/(customer)/(tabs)/` | `/dealer/dashboard` | dealer | ported |
| `/(app)/(employee)/(tabs)/` | `/worker/dashboard` | worker | ported |

See the TypeScript manifest for the full list. A unit test fails if a new mobile route is added without an entry.
