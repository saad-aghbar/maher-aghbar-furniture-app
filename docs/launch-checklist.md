# Launch checklist

## One-command launch

```bash
pnpm launch
```

This starts API + Admin + Customer + Employee + Worker (and runs `prepare:launch` if builds are missing).

```bash
pnpm stop:all
```

First time / after a big pull:

```bash
pnpm install
pnpm prepare:launch
pnpm launch
```

## Mobile (unified Expo app)

In a second terminal (API must already be up):

```bash
pnpm mobile:start
```

Then scan the QR code with **Expo Go** (Camera app on iOS, Expo Go on Android).
Use an Expo Go build that supports **SDK 54**. This is the only path that needs
no extra native tooling.

`EXPO_PUBLIC_API_BASE_URL` is intentionally left unset in `apps/mobile/.env`. The
app derives the API host from the Expo dev server, so a physical phone, the iOS
simulator, and the Android emulator all resolve correctly without editing files.
Set it only to pin a deployed backend, e.g. `https://api.maher-aghbar.jo`.

The phone and the Mac must be on the same Wi-Fi. The API already binds to
`0.0.0.0`, so no change is needed there.

### Simulators / emulators are optional

Pressing `i` or `a` in Expo requires local native tooling, and without it you
will see errors that are *not* app bugs:

| Message | Cause | Fix |
|---------|-------|-----|
| `xcrun simctl ... code 72` / `Xcode must be fully installed` | Xcode not installed | Install Xcode from the App Store, or use Expo Go |
| `Failed to resolve the Android SDK path` / `spawn adb ENOENT` | Android SDK missing | Install Android Studio and set `ANDROID_HOME`, or use Expo Go |

Verify the bundle without any device:

```bash
pnpm --filter @maher/mobile typecheck
cd apps/mobile && npx expo-doctor          # expect 18/18
npx expo export --platform ios --output-dir /tmp/mobile-export
```

## Live URLs

| Service | URL |
|---------|-----|
| Admin | http://localhost:3000/ar/login |
| Customer portal | http://localhost:3001/ar/login |
| Employee portal | http://localhost:3002/ar/login |
| API health | http://localhost:4000/api/v1/health |
| Swagger | http://localhost:4000/api/docs |
| Mobile | Expo Metro via `pnpm mobile:start` |

## Demo accounts

Password: **`Admin@12345!`** — **local/demo only, never production**

Sign in with **username** (login forms no longer accept email):

| Username | Role / portal |
|----------|----------------|
| `admin` | Admin web |
| `sales` | Admin web (sales) |
| `worker` | Employee portal (material prep / QC) |
| `carpenter` | Employee portal (carpentry) |
| `painter` | Employee portal (painting) |
| `upholsterer` | Employee portal (upholstery) |
| `assembler` | Employee portal (assembly) |
| `packer` | Employee portal (packaging / delivery) |
| `cedar` | Customer portal (Cedar Hotel only) |
| `olive` | Customer portal (Olive Restaurant only) |

Smoke scripts use **`admin`**, **`cedar`**, and **`worker`** with the same password.

Demo production order `PO-DEMO-001` is mid-pipeline (Material Prep done, Carpentry in progress, Painting ready). Open Admin → Production → assign/track stages; each worker sees only their tasks.

## Verified at launch

- Auth cookies (web) + Bearer tokens (`client: 'mobile'`)
- Admin RFQs + multi-step quote approval + customer revision request
- Quotation accept → SO specs/delivery date + auto Contract + auto-confirm PO (setting)
- Multi-worker stage pipeline (deps + assign + progress rollup)
- PO planning fields; task time/notes/photos; QC pass unlock; rework complete
- Delivery driver picker; DELIVERED closes sales order
- Customer contracts page; dashboard factory KPIs (new orders, in production, nearing delivery)
- Purchasing PO → approve → GRN → stock
- Quality checklist templates + inspections
- Delivery POD (signature + photo)
- Binary PDFs: quotations, invoices, SOA, inventory labels
- Notifications templates + channel dispatch (console by default)
- AI intake list / extract / approve / reject
- Documents upload + download links
- Customer RFQ channels + electronic quote accept + stage tracking
- Dashboards, CRM, inventory, invoices, reports, users, audit
- Admin / customer / employee portals HTTP 200
- Mobile login + permission shell typechecks
- Smoke: `pnpm smoke:lifecycle`, `pnpm smoke:workflow`, and `pnpm smoke:scope`

## Mobile full-parity QA

For persona scripts (admin / cedar / worker), device × EN/AR RTL matrix, P0–P5 phase gates, and EAS/preview commands, see [mobile-launch-qa.md](./mobile-launch-qa.md).

## Infra notes

- Postgres: `brew services start postgresql@18` **or** Docker Compose under `infra/docker/`
- Redis: Homebrew / `redis-server --daemonize yes` / Docker
- API listens on `0.0.0.0:4000` (LAN-reachable for phones)
- Quote `COMPANY_NAME_*` in `.env`
- Logs: `logs/*.log` · PIDs: `.run/*.pid`
- Smoke: `pnpm smoke:lifecycle` · `pnpm smoke:workflow` · `pnpm smoke:scope`
- Phase 2 integrations (IMAP, WhatsApp, Maps): [factory-ux-phase2.md](./factory-ux-phase2.md)
