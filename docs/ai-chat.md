# AI system chatbot

Read-only ERP assistant for **admin staff** and **dealers** (`CUSTOMER`). No writes.

## Endpoints

All require `ai-chat.read`:

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/ai-chat/conversations` | Create thread (`locale`, optional `title`) |
| `GET` | `/ai-chat/conversations` | List mine |
| `GET` | `/ai-chat/conversations/:id` | Thread + messages |
| `DELETE` | `/ai-chat/conversations/:id` | Archive |
| `POST` | `/ai-chat/conversations/:id/messages` | `{ text, clientMessageId?, locale? }` → `{ userMessage, assistantMessage }` |

Response boards match the mobile `ChatContent` contract (`text`, `metrics`, `table`, `entities`, `list`, `chart`, `clarification`, `error`, `sources`) plus suggestion chips with optional `href` deep links.

## Env

| Variable | Meaning |
|---|---|
| `AI_CHAT_ENABLED` | `false` kills the feature; otherwise enabled |
| `OPENAI_API_KEY` / `AI_LLM_MODEL` | Live tool-calling agent |
| `AI_CHAT_MODE=deterministic` | Skip OpenAI; keyword → tools (tests / offline) |

## Tool matrix

**Admin** (permission-filtered): home snapshot, late orders, dealer profit (`report.financial.read`), low stock, open invoices, sales orders, customer lookup, search, production summary.

**Dealer** (scoped to `user.customerId`): my home, my orders, my order detail, my invoices, my statement, my requests, catalog search.

Dealers never receive profit/cost/atelier inventory tools.

## Mobile

- Admin: More → AI chatbot → `/(app)/(admin)/ai-chat`
- Dealer: Account → AI chatbot → `/(app)/(customer)/ai-chat`

## Seed

After deploying permission `ai-chat.read`, re-run DB seed (or upsert permissions) so `CUSTOMER` and `SYSTEM_ADMINISTRATOR` role grants include it.
