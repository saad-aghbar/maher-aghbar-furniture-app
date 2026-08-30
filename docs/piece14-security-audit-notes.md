# Piece 14 security audit notes

| Check | Status | Notes |
|---|---|---|
| Demo password in Swagger examples | **PASS** | `auth.dto.ts` uses `your-password`, not `123` |
| Mock arrays on critical ops screens | **PASS** | No fake operational datasets in production paths |
| JWT secret | **PASS** (prod) | Production `NODE_ENV=production` requires `JWT_ACCESS_SECRET`; dev fallback allowed only in non-production |

## Severity

- Swagger demo password example — fixed (was LOW documentation smell)
- JWT hardcoded fallback — gated to non-production only (was HIGH if used in prod)
