---
name: dev-stack
description: >-
  Start, health-check, or stop the local Maher API, admin-web, and Expo Metro.
  Use when the user types /run, /fix, or /stop, or asks to run / stop / check
  metro, api, and admin (mobile + website).
---

# Dev stack (`/run` `/fix` `/stop`)

Always execute. Do not ask. Do not edit this skill as part of `/run` `/fix` `/stop`.

Repo root: git root with `pnpm-workspace.yaml`. Never `cd` into the Cursor `terminals` folder.

Export PATH with Homebrew, then **unset `CI` and `CONTINUOUS_INTEGRATION`**. Expo exits if it thinks it is in CI.

```bash
export PATH="/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin:/usr/local/bin:$PATH"
unset CI CONTINUOUS_INTEGRATION
```

## Why not only `stack.sh run`

`stack.sh run` from a one-shot Shell **dies when that command ends**. The three processes must be **Cursor background terminals** (`block_until_ms: 0`) so they stay up.

| Slash | What the agent does |
|-------|---------------------|
| `/run` | Start only what is down, as **three background Shells** |
| `/fix` | Curl health; background-restart **only** what is down |
| `/stop` | `bash .cursor/skills/dev-stack/scripts/stack.sh stop` |

## Health (always `127.0.0.1`, not `localhost`)

| Process | Port | Healthy |
|---------|------|---------|
| API | `4000` | `GET http://127.0.0.1:4000/api/v1/health` contains `"status":"ok"` |
| Admin | `3000` | `GET http://127.0.0.1:3000/ar/login` → `200` |
| Metro | `8081` | `GET http://127.0.0.1:8081/status` → `200` (`packager-status:running`) |

```bash
bash .cursor/skills/dev-stack/scripts/stack.sh status
```

## Redis (API will not stay up without it)

Before starting the API:

```bash
redis-cli ping || brew services start redis || redis-server --daemonize yes --port 6379
```

Do not `demo:reset`. Do not stop Postgres. Do not boot the Simulator unless the user asked.

## `/run`

1. `stack.sh status`. If all three OK, tell the user the URLs and stop.
2. Ensure Redis (`PONG`).
3. For each **DOWN** service, one Shell with **`block_until_ms: 0`**, `working_directory` = repo root:

API:

```bash
export PATH="/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin:/usr/local/bin:$PATH"
unset CI CONTINUOUS_INTEGRATION
exec pnpm dev:api
```

Admin:

```bash
export PATH="/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin:/usr/local/bin:$PATH"
unset CI CONTINUOUS_INTEGRATION
exec pnpm dev:admin
```

Metro:

```bash
export PATH="/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin:/usr/local/bin:$PATH"
unset CI CONTINUOUS_INTEGRATION
exec pnpm --filter @maher/mobile exec expo start --host lan
```

4. Poll health until all three OK (or ~90s). Read the matching terminal log if one fails.
5. Tell the user (open on **this Mac**):

- Website: `http://localhost:3000/ar/login`
- API: `http://localhost:4000/api/v1/health`
- Expo Go **Simulator**: `exp://127.0.0.1:8081`
- Expo Go **phone** (same Wi‑Fi): `exp://<LAN-IP>:8081` (`ipconfig getifaddr en0`)

Never tell them to paste `http://localhost:8081` into Expo Go. Metro is not a website.

## `/fix`

1. `stack.sh status`.
2. If a service is OK, **leave it**. Do not restart healthy processes.
3. If Redis is down, start it, then restart API only if API is down.
4. Background-start (`block_until_ms: 0`) only the DOWN ones, same commands as `/run`.
5. Poll and report OK / restarted / still down.

## `/stop`

```bash
bash .cursor/skills/dev-stack/scripts/stack.sh stop
```

Confirm `:4000`, `:3000`, `:8081` are free. Do not stop Redis or Postgres. Do not quit Simulator unless the user asked.

## Do not

- `pnpm start:all` / `pnpm stop:all` (production launch).
- `expo start -c` on a healthy Metro.
- Start customer/employee portals.
- Start Metro/API/admin with a one-shot `nohup` inside a Shell that then exits.
