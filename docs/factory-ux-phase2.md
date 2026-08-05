# Factory UX — Phase 2 (credential-gated)

Phase 1 shipped the father-friendly admin shell: Orders, Products, Inventory, Production, and username-based demo logins. **Phase 2** covers integrations that need real credentials and are intentionally left mock/disabled in local `.env`.

## Scope

| Integration | Env keys | When to enable |
|-------------|----------|----------------|
| **Live inbound email (IMAP)** | `EMAIL_INBOUND_*`, `EMAIL_INBOUND_WEBHOOK_SECRET` | Dealer RFQs arrive in a shared inbox and should auto-create draft RFQs |
| **WhatsApp notifications** | `WHATSAPP_PROVIDER`, `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` (or Twilio vars) | Payment/delivery alerts to customers on WhatsApp |
| **Maps / geocoding** | TBD — e.g. `GOOGLE_MAPS_API_KEY` or `MAPBOX_TOKEN` | Delivery driver routing, address validation on POD |

Everything else (SMTP console, mock AI/OCR, JoFotara mock clearance) works without production keys for demos.

**Also shipped without paid keys:** `OCR_PROVIDER=local` (pdf-parse + tesseract.js), Twilio SMS/WhatsApp when `TWILIO_*` are set.

## 1. Live IMAP inbound email

**Goal:** Poll a dealer inbox and create draft RFQs for human review (same flow as AI Intake under Orders).

1. Create a dedicated mailbox (e.g. `rfq@maher-aghbar.jo`) or folder rule.
2. Set in `.env`:
   - `EMAIL_INBOUND_HOST`, `EMAIL_INBOUND_PORT`, `EMAIL_INBOUND_SECURE`
   - `EMAIL_INBOUND_USER`, `EMAIL_INBOUND_PASS`, `EMAIL_INBOUND_MAILBOX`
   - `EMAIL_INBOUND_POLL_INTERVAL_MS` (default 60000)
   - `EMAIL_INBOUND_WEBHOOK_SECRET` — shared with worker + `POST /api/v1/webhooks/inbound-email`
   - Optional: `EMAIL_INBOUND_ADMIN_NOTIFY_EMAIL`
3. Restart **worker** — IMAP poll runs in `apps/worker` (`inbound-email.ts`).
4. Verify: send a test email from a seeded dealer address; check Admin → Orders for a new draft RFQ and in-app notification `INBOUND_EMAIL_RFQ`.

**Rollback:** Clear `EMAIL_INBOUND_HOST` — worker logs mock heartbeat only.

## 2. WhatsApp

**Goal:** Outbound templates (e.g. payment received, delivery window) via Meta Cloud API or Twilio, plus inbound RFQ drafts.

### Outbound
1. Obtain WhatsApp Business API credentials from Meta or Twilio.
2. Set provider:
   - Meta: `WHATSAPP_PROVIDER=meta` + `WHATSAPP_TOKEN` + `WHATSAPP_PHONE_NUMBER_ID`
   - Twilio: `WHATSAPP_PROVIDER=twilio` + `TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN` + `TWILIO_WHATSAPP_FROM` (e.g. `whatsapp:+14155238886`)
3. SMS (optional): `SMS_PROVIDER=twilio` + same Twilio SID/token + `TWILIO_SMS_FROM` (E.164).
4. Map notification templates in Admin → Settings → Integrations; ensure template codes match seed (`PAYMENT_RECEIVED`, etc.).
5. Test with a sandbox number before production traffic.

**Local default:** `WHATSAPP_PROVIDER=console` / `SMS_PROVIDER=console` — messages logged, not sent.

### Inbound RFQ webhook
1. Set `WHATSAPP_INBOUND_WEBHOOK_SECRET` and optionally `WHATSAPP_WEBHOOK_VERIFY_TOKEN` (Meta GET challenge).
2. Point Meta Cloud API webhook to `POST /api/v1/webhooks/inbound-whatsapp` with header `x-inbound-whatsapp-secret`.
3. Local stub (no Meta):

```bash
curl -X POST "$API_URL/api/v1/webhooks/inbound-whatsapp" \
  -H "Content-Type: application/json" \
  -H "x-inbound-whatsapp-secret: $WHATSAPP_INBOUND_WEBHOOK_SECRET" \
  -d '{"from":"9627xxxxxxx","text":"Need 2 sofas fabric beige","messageId":"test-1"}'
```

Sender phone must match a dealer `customer.phone` / contact phone. Creates draft RFQ + `INBOUND_WHATSAPP_RFQ` admin notification.

## 3. Maps API key

**Goal:** Delivery planning — geocode addresses, show map on delivery detail, optional ETA for drivers.

**Shipped without a paid key:** Leaflet + OpenStreetMap tiles + Nominatim reverse/search (portal order form + admin delivery detail). Delivery rows store `latitude` / `longitude`.

**Optional Google upgrade:**
1. Set `GOOGLE_MAPS_API_KEY` (server-side only — used by `GET /api/v1/geo/reverse` and `/geo/search`).
2. Restrict key by IP / HTTP referrer.
3. Settings → Integrations shows maps provider (`nominatim` vs `google`).

Local default remains Nominatim (no key).

## Checklist before go-live

- [ ] IMAP credentials in secrets manager (not committed)
- [ ] Webhook secret rotated from dev default
- [ ] WhatsApp template approval (Meta) or Twilio sender verified
- [ ] Maps key restricted and billed alerts enabled
- [ ] Run `pnpm smoke:workflow` and `pnpm smoke:scope` against staging with username logins (`admin`, `cedar`, `worker`)

## Related docs

- [launch-checklist.md](./launch-checklist.md) — local demo usernames
- [`.env.example`](../.env.example) — full variable list
- Worker inbound email: `apps/worker/src/inbound-email.ts`
- API webhook: `apps/api/src/modules/inbound-email/`
