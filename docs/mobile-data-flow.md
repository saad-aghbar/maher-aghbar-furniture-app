# Mobile data flow

**Date:** 2026-08-05  
**Companion:** [mobile-architecture.md](./mobile-architecture.md), [mobile-api-gap-analysis.md](./mobile-api-gap-analysis.md)

All traffic goes to Nest `EXPO_PUBLIC_API_BASE_URL` + `/api/v1`. No Next.js BFF.

---

## 1. Login and token storage

```mermaid
sequenceDiagram
  participant UI as LoginScreen
  participant Auth as authSession
  participant Store as SecureStore
  participant API as NestAPI
  UI->>Auth: login username password
  Auth->>API: POST /auth/login client=mobile
  alt MFA required
    API-->>Auth: MFA_REQUIRED
    Auth-->>UI: navigate mfa
  else success
    API-->>Auth: user accessToken refreshToken
    Auth->>Store: set access + refresh
    Auth-->>UI: resolveMobileHomeHref
  end
```

- Ignore Set-Cookie; use JSON tokens only.
- On MFA success, same login endpoint with `mfaCode`.

---

## 2. Refresh rotation

```mermaid
sequenceDiagram
  participant Client as apiClient
  participant Gate as refreshSingleFlight
  participant Store as SecureStore
  participant API as NestAPI
  Client->>Gate: 401 or access missing
  Gate->>Store: get refresh_token
  Gate->>API: POST /auth/refresh refreshToken client=mobile
  API-->>Gate: accessToken refreshToken
  Gate->>Store: overwrite both tokens
  Gate-->>Client: retry original request
  Note over Gate,API: Concurrent 401s share one refresh promise
```

Failure path: clear SecureStore + Query `auth` cache → `/(auth)/login`.

Logout:

1. Ensure access (refresh if needed).
2. `POST /auth/logout` with Bearer + body `{ refreshToken }`.
3. Clear store; cancel polls; clear QueryClient.

---

## 3. Authenticated query path

```mermaid
sequenceDiagram
  participant Screen
  participant Q as TanStackQuery
  participant Client as apiClient
  participant API as NestAPI
  Screen->>Q: useQuery queryKeys.tasks.list
  Q->>Client: GET /tasks
  Client->>API: Bearer access
  alt 200
    API-->>Screen: data
  else 401
    Client->>Client: refresh then retry
  else 403
    API-->>Screen: forbidden empty state
  end
```

- `Accept-Language` from locale.
- List screens: `ListState` for pending / error / empty.
- AppState `active` → `queryClient.invalidateQueries` for hot keys (tasks, notifications) sparingly.

---

## 4. Mutation + invalidation

Example: complete task

```mermaid
sequenceDiagram
  participant UI as TaskDetail
  participant Q as TanStackQuery
  participant API as NestAPI
  UI->>Q: mutate complete
  Q->>API: POST /tasks/:id/complete
  API-->>Q: updated task
  Q->>Q: invalidate tasks.list tasks.detail today
  Q-->>UI: refetch overlays
```

Approvals (quote/PO): no optimistic update; wait for server; then invalidate.

---

## 5. Upload flow

```mermaid
sequenceDiagram
  participant UI as PhotoAttach
  participant Picker as ImagePicker
  participant Util as compress
  participant Client as apiClient
  participant API as NestAPI
  participant Q as TanStackQuery
  UI->>Picker: camera or library
  Picker-->>UI: localUri
  UI->>Util: compress under 15MB
  Util-->>UI: blob/file
  UI->>Client: POST /uploads multipart file
  Client->>API: Bearer + FormData
  API-->>Client: document accessToken downloadPath
  Client->>Q: invalidate parent entity
  Q-->>UI: show thumbnail via downloadPath or refreshed link
```

Query params: `taskId`, `requestId`, `category` as needed.  
If download TTL expired: `GET /uploads/documents/:id/link`.

Offline: keep `localUri` in a feature draft list; upload on reconnect (tasks/requests only).

---

## 6. Notification flow

```mermaid
sequenceDiagram
  participant App as AppSession
  participant Expo as ExpoNotifications
  participant API as NestAPI
  participant Q as TanStackQuery
  App->>API: POST /notifications/device-token
  loop every 60s while active
    Q->>API: GET /notifications
    API-->>Q: items take 50
  end
  App->>Expo: permission request
  Note over API: Push send not implemented — inbox is source of truth
  Q->>API: POST /notifications/:id/read
```

- Foreground: poll + optional local notification if payload ever arrives.
- Tap notification / deep link: `resolveDeepLink(linkUrl, user)`.
- Unread badge: `items.filter(i => !i.readAt).length`.

---

## 7. Offline / cache

```mermaid
flowchart TD
  Boot[Cold start]
  Hydrate[Hydrate Query persister AsyncStorage]
  Online{Network?}
  ReadCache[Render stale lists]
  Fetch[Network fetch]
  Mutate{User mutates?}
  Fail[Toast connect to continue]
  Ok[POST mutation]

  Boot --> Hydrate
  Hydrate --> Online
  Online -->|offline| ReadCache
  Online -->|online| Fetch
  ReadCache --> Mutate
  Fetch --> Mutate
  Mutate -->|offline| Fail
  Mutate -->|online| Ok
```

Persisted queries (whitelist):

- `tasks.list`, `tasks.detail`
- `requests.list`, `sales-orders.list`
- `notifications.list`
- `auth.me` **without** embedding tokens

Never persist: mutations, SecureStore secrets, full admin reports.

---

## 8. AI intake (customer / admin)

```mermaid
sequenceDiagram
  participant UI
  participant API
  UI->>API: POST /uploads
  UI->>API: POST /ai-intake/from-upload or extract-preview
  API-->>UI: job id
  UI->>API: GET /ai-intake/jobs/:id poll
  Note over API: OCR may be mock without provider keys
  UI->>API: approve or link-request when permitted
```

Feature-flag UI when settings/providers are mock (detect via failed extract or env).

---

## 9. Error mapping

| API signal | Client behavior |
|------------|-----------------|
| `MFA_REQUIRED` | MFA screen |
| `VALIDATION_ERROR` / field errors | Form inline via `translateApiError` |
| `INVALID_FILE_TYPE` / size | Toast on attach |
| 401 after refresh fail | Logout |
| 403 | Empty forbidden |
| 429 | Backoff retry once |
| Network fail | Offline banner + cached read |

---

## 10. Security data rules

- Tokens only in SecureStore.
- Signed `downloadPath` query tokens: treat as secrets; prefer https; short TTL.
- Do not put Bearer tokens in deep link URLs.
- Customer scope: never send another `customerId` from the client for statements; use `user.customerId`.
