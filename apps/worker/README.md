# Worker (`@maher/worker`)

BullMQ process: email, SMS, WhatsApp, PDF, AI, OCR, notifications, scheduling, file processing, plus inbound-email and low-stock pollers.

```
src/main.ts
src/inbound-email.ts
src/low-stock-pr.ts
```

```bash
# started by pnpm launch / pnpm start:all
```

Depends on `@maher/integrations`, `@maher/logging`. Not a UI.
