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

## Live URLs

| Service | URL |
|---------|-----|
| Admin | http://localhost:3000/ar/login |
| Customer portal | http://localhost:3001/ar/login |
| Employee portal | http://localhost:3002/ar/login |
| API health | http://localhost:4000/api/v1/health |
| Swagger | http://localhost:4000/api/docs |

## Demo accounts

Password: **`Admin@12345!`** — **local/demo only, never production**

Sign in with **username** (login forms no longer accept email):

| Username | Role / portal |
|----------|----------------|
| `admin` | Admin web |
| `cedar` / `olive` / `petra` / `villa` | Customer portal |
| `carpenter` / `painter` / `worker` / … | Employee portal |

## Smoke checks

```bash
pnpm smoke:lifecycle
pnpm smoke:workflow
pnpm smoke:scope
```

## Auth model

- Auth cookies (web)
- Backend enforces permissions on every protected route

See [docs/](./) for architecture, security, and workflows.
