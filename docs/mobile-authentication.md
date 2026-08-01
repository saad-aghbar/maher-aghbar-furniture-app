# Mobile authentication

## Problem

Web portals use HTTP-only cookies (`access_token`, `refresh_token`). React Native cannot reliably use those cookies across API hosts. `JwtAuthGuard` already accepts `Authorization: Bearer`, but login historically returned `{ user }` only.

## Solution (non-breaking)

`POST /api/v1/auth/login` accepts optional `client: 'web' | 'mobile'`.

| Client | Cookies set | JSON body |
|--------|-------------|-----------|
| web (default) | Yes | `{ user }` |
| mobile | Yes (harmless) | `{ user, accessToken, refreshToken }` |

`POST /api/v1/auth/refresh` with `{ refreshToken, client: 'mobile' }` rotates the session and returns new tokens.

`POST /api/v1/auth/logout` accepts refresh token from **cookie or body**.

## Mobile client flow

1. Login → store both tokens in Expo SecureStore  
2. API calls → `Authorization: Bearer <accessToken>`  
3. On 401 → refresh once (single-flight) → retry  
4. Logout → revoke session + clear SecureStore  
5. Cold start → restore via `/auth/me` if access token present  

## Security notes

- Access JWT TTL ~15m; refresh opaque + hashed in `Session`
- Do not log tokens
- MFA login challenge still incomplete on server — document as limitation
- Forgot-password tokens are in-memory in dev — not production-ready
