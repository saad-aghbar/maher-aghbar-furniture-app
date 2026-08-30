# Piece 14 — External Integrations

Honest status for outbound/inbound channels and file storage. Defaults favor **console / local** so local demo does not call paid vendors.

Provider factories: `packages/integrations/` · API wiring: `apps/api/src/integrations/integrations.module.ts`.

---

## Classification

| Channel | Status | Behavior | Production implication |
|---------|--------|----------|------------------------|
| **Email** | **IMPLEMENTED** (Resend / SMTP / Console) | `createEmailProvider()` — Resend (`RESEND_API_KEY` or `EMAIL_PROVIDER=resend`), SMTP (`SMTP_URL`), else **Console** (default `EMAIL_PROVIDER=console`) | With Console (or missing live keys) → treat as **EXTERNAL DEPENDENCY** until Resend/SMTP is configured and verified |
| **WhatsApp** | **IMPLEMENTED** (Meta / Twilio / Console) | `createWhatsAppProvider()` — Meta Cloud (`WHATSAPP_TOKEN` + `WHATSAPP_PHONE_NUMBER_ID`), Twilio, else **Console** (default `WHATSAPP_PROVIDER=console`). Inbound webhook: `apps/api/src/modules/inbound-whatsapp/` | Console → **EXTERNAL DEPENDENCY** until a live provider is keyed and tested |
| **Push** | **PARTIAL** | Device token register: `POST /api/v1/notifications/device-token` (`notifications.controller.ts`). Inbox poll exists. **No push send pipeline** | **PENDING DEVICE** / sender — do not market reliable push |
| **Storage** | Local default / S3 optional | Local disk via `LOCAL_UPLOAD_DIR`; `STORAGE_PROVIDER=s3` enables S3/MinIO | Local without durable volume/backup is a production risk |

---

## Notes

- Console providers log instead of delivering — fine for CI/local; not factory production notification.
- SMS follows the same console/live pattern (`SMS_PROVIDER`); not a Piece 14 readiness blocker unless you rely on SMS alerts.
- Do not build a new email/WhatsApp/push platform in Piece 14; configure or document EXTERNAL / PENDING DEVICE honestly.

See also: [`.env.example`](../.env.example), [`docs/known-limitations.md`](./known-limitations.md), [`PRODUCTION-DEPLOYMENT.md`](./PRODUCTION-DEPLOYMENT.md).
