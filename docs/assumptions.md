# Assumptions

Non-critical decisions made so implementation can proceed. Blocking items are listed at the end.

## Business

| Item | Assumption |
|------|------------|
| Primary market | Jordan (Amman HQ) |
| Primary currency | JOD (Jordanian Dinar), 3 decimal places |
| Tax | Configurable VAT; default **16%** (Jordan standard) |
| Company legal name | مفروشات ماهر الأغبر وأولاده / Maher Al-Aghbar & Sons Furniture |
| Default UI language | Arabic (RTL) |
| Supported languages | Arabic, English, Hebrew |
| Branches | Single branch at launch; multi-branch schema ready |
| Customer types | Individual + Company (B2B showrooms, hotels, restaurants) |
| Negative stock | **Forbidden** by default; override only with `inventory.adjust` + audit |
| Soft delete | Business records archived (`archivedAt`), not hard-deleted |
| Quotation expiry | Default 30 days from issue |
| Deposit | Optional per sales order; configurable percentage |

## Technical

| Item | Assumption |
|------|------------|
| Monorepo | pnpm workspaces + Turborepo |
| API style | REST + OpenAPI (not GraphQL) |
| Auth tokens | JWT access (short) + refresh in **HTTP-only Secure cookies** |
| Password hashing | Argon2id |
| IDs | UUID v7 (time-sortable) where supported; else UUID v4 |
| Money | `Decimal(18,3)` for JOD; never float |
| File storage | MinIO locally; S3-compatible in production |
| Jobs | BullMQ + Redis |
| AI/OCR | Provider interfaces; **MockProvider** for local/CI; OpenAI-compatible + OCR provider in staging/prod |
| WhatsApp / SMS / Email | Provider abstractions; console/mock in local |
| Online payments | Not enabled until provider configured |
| Virus scan | Integration hook (ClamAV-compatible); no-op in local |
| Timezone | Asia/Amman |
| Document numbers | Server-generated sequential per type with year prefix (e.g. `QT-2026-00041`) |

## Security defaults

- Access token TTL: 15 minutes
- Refresh token TTL: 30 days with rotation
- Failed login lockout: 5 attempts / 15 minutes
- MFA: optional TOTP for staff; off for customers by default
- File URLs: signed, expiring (default 15 minutes)

## Non-blocking open questions (defaults applied)

1. Exact brand font pairing → **IBM Plex Sans Arabic** + **IBM Plex Sans** + **Heebo** for Hebrew.
2. Exact coral hex → `#E03C31` brand, `#C43228` hover.
3. WhatsApp Business number → configured via settings later.
4. Multi-branch rollout date → schema ready, UI single-branch first.

## Genuinely blocking questions

None for Phase 0–1. These block only later integrations:

1. **Production AI/OCR vendor credentials** (needed for Phase 9 live providers).
2. **Production domain + TLS certificates** (needed for Phase 11 deploy).
3. **WhatsApp Business API / Meta account** (needed for live WhatsApp notifications).

Until then, mock providers keep all flows testable.
