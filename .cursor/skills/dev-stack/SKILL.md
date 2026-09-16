---
name: dev-stack
description: >-
  Start, health-check, or stop the local Maher API, admin-web, and Expo Metro.
  Use when the user types /run, /start, /fix, or /stop, or asks to run / start /
  stop / check metro, api, and admin (mobile + website).
---

# Dev stack (`/run` `/start` `/fix` `/stop`)

Always execute. Do not ask. Do not edit this skill as part of `/run` `/start` `/fix` `/stop`.

Repo root: git root with `pnpm-workspace.yaml`. Never `cd` into the Cursor `terminals` folder.

Export PATH with Homebrew, then **unset `CI` and `CONTINUOUS_INTEGRATION`**. Expo exits if it thinks it is in CI.

```bash
export PATH="/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin:/usr/local/bin:$PATH"
unset CI CONTINUOUS_INTEGRATION
```

## Stop latch (cross-chat)

`/stop` writes `.run/dev-stack.stopped`. While that file exists:

- `/run` and `/fix` **must not** start or restart anything (report latched + leave down)
- Only `/start` clears the latch and brings the stack up

This stops other Cursor chats from resurrecting API/admin/Metro after the user said stop.

| Slash | What the agent does |
|-------|---------------------|
| `/start` | Clear stop latch, then start missing services as **three background Shells** |
| `/run` | If latched → refuse. Else start missing services as **three background Shells** |
| `/fix` | If latched → kill listeners if any, do **not** restart. Else curl health; restart only what is down |
| `/stop` | Kill ports + orphan shells, **write stop latch** |

## Why not only `stack.sh run`

`stack.sh run` from a one-shot Shell **dies when that command ends**. When allowed to start, the three processes must be **Cursor background terminals** (`block_until_ms: 0`) so they stay up.

**Before starting any Shell for `/run` `/start` `/fix`:** run `bash .cursor/skills/dev-stack/scripts/stack.sh status`. If it prints `Latch  STOPPED`, do not spawn API/admin/Metro Shells (except `/start`, which clears the latch via `stack.sh start` first).

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

## `/start`

1. `bash .cursor/skills/dev-stack/scripts/stack.sh start` (clears latch), **or** `rm -f .run/dev-stack.stopped` then start Shells.
2. Ensure Redis (`PONG`).
3. For each **DOWN** service, one Shell with **`block_until_ms: 0`**, `working_directory` = repo root — same commands as `/run` below.
4. Poll health until all three OK (or ~90s).
5. Tell the user the URLs.

## `/run`

1. `stack.sh status`. If `Latch STOPPED`, tell the user to use `/start` and **do not** start Shells.
2. If all three OK, tell the user the URLs and stop.
3. Ensure Redis (`PONG`).
4. For each **DOWN** service, one Shell with **`block_until_ms: 0`**, `working_directory` = repo root:

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

5. Poll health until all three OK (or ~90s). Read the matching terminal log if one fails.
6. Tell the user (open on **this Mac**):

- Website: `http://localhost:3000/ar/login`
- API: `http://localhost:4000/api/v1/health`
- Expo Go **Simulator**: `exp://127.0.0.1:8081`
- Expo Go **phone** (same Wi‑Fi): `exp://<LAN-IP>:8081` (`ipconfig getifaddr en0`)

Never tell them to paste `http://localhost:8081` into Expo Go. Metro is not a website.

## `/fix`

1. `stack.sh status`.
2. If latched: run `stack.sh stop` (or kill listeners), report intentionally stopped, **do not** start Shells.
3. If a service is OK, **leave it**. Do not restart healthy processes.
4. If Redis is down, start it, then restart API only if API is down.
5. Background-start (`block_until_ms: 0`) only the DOWN ones, same commands as `/run`.
6. Poll and report OK / restarted / still down / latched.

## `/stop`

```bash
bash .cursor/skills/dev-stack/scripts/stack.sh stop
```

Confirm `:4000`, `:3000`, `:8081` are free and the stop latch exists (`.run/dev-stack.stopped`). If anything is still listening, kill those process trees too. Do not stop Redis or Postgres. Do not quit Simulator unless the user asked.

## Do not

- `pnpm start:all` / `pnpm stop:all` (production launch).
- `expo start -c` on a healthy Metro.
- Start customer/employee portals.
- Start Metro/API/admin with a one-shot `nohup` inside a Shell that then exits.
- Start the stack while `.run/dev-stack.stopped` exists unless the user typed `/start`.
