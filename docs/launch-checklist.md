# Launch checklist

## One-command start / stop

```bash
pnpm prepare:launch   # first time / after pull
pnpm start:all
pnpm stop:all
```

`start:all` will call `prepare:launch` automatically if app builds are missing.

## Live URLs

| Service | URL |
|---------|-----|
| Admin | http://localhost:3000/ar/login |
| Customer portal | http://localhost:3001/ar/login |
| Employee portal | http://localhost:3002/ar/login |
| API health | http://localhost:4000/api/v1/health |
| Swagger | http://localhost:4000/api/docs |

## Demo accounts

Password: `Admin@12345!`

- `admin@maher-aghbar.jo`
- `sales@maher-aghbar.jo`
- `worker@maher-aghbar.jo`
- `customer@cedar-hotel.jo`

## Verified

- Auth cookies + RBAC
- Quotation → accept → sales order → production order
- Dashboard, customers, inventory, invoices, reports, users, audit
- Statements of account, purchasing, suppliers, contracts, returns
- File uploads (local disk), printable quote/invoice HTML
- Admin / customer / employee portals HTTP 200

## Infra notes

- Postgres: `brew services start postgresql@18` **or** `docker compose -f infra/docker/docker-compose.yml up -d postgres redis`
- Redis: Homebrew / `redis-server --daemonize yes` / Docker
- `DATABASE_URL` uses `127.0.0.1` with `?schema=public` (Prisma). Strip `?schema=public` for raw `psql`.
- Quote `COMPANY_NAME_*` values in `.env`
- `LOCAL_UPLOAD_DIR` is set absolute by `prepare:launch`
- Logs: `logs/*.log` · PIDs: `.run/*.pid`
- Smoke: `pnpm smoke:lifecycle`
