# Mobile QR simulator audit

**Date:** 2026-09-12 (Asia/Amman)  
**Plan:** walk every mobile QR display, Print label, and scan destination — **admin and workers**. iOS Simulator has **no camera**. Scan contract: payload caption = API `scanCode` / `qrCode` = DEV simulate field → same `openScanner()` promise as a live camera.

No `demo:reset`. Running demo DB. Camera decode of the PNG is **N/A**.

---

## Environment

| Piece | Value |
|---|---|
| API | `http://127.0.0.1:4000` (`GET /api/v1/health` → `"status":"ok"`) |
| Metro | `http://127.0.0.1:8081` |
| Simulator | iPhone 17 · iOS 26.5 · UDID `734B8129-5CF4-41BC-9A56-86B3389F21EE` |
| App | `jo.maheraghbar.furniture` |
| Locale | Arabic |
| Camera | Unavailable. DEV simulate is the scan path. Native camera prompt is **not** auto-shown in `__DEV__`. |

### Live payloads (do not invent)

| Kind | Payload | Notes |
|---|---|---|
| Material (Italian velvet) | `MAT-ITAL-VEL` | catalog SKU |
| Accessory | `MAT-HW-KIT` | |
| Oak / screws (carpenter task) | `MAT-OAK`, `MAT-HW-SCREW` | |
| Bin with stock | `BIN-RAW-RAW-MAIN` | |
| WIP kit (P8-B) | `WIP-P8-B-CARPENTRY` | kit `e9946164-4a01-43f8-8b09-d677f26b8db8` on older notes; live walk used this code |
| WIP kit (P8-G carpentry → assembly) | `WIP-P8-G-CARPENTRY` | assembler take-in |
| WIP kit (P8-H carpentry → upholstery) | `WIP-P8-H-CARPENTRY` | upholsterer incoming |
| SEMI lot | `SEMI-P11-C` | |
| FIN lots | `FIN-P10-B`, `FIN-P10-D` | driver load sheet used D |
| Fabric bundle | `FB-SOFB1042-002` | not on upholsterer **mine** boards this DB |
| Unknown | `NO-SUCH-QR-XYZ` | all by-code routes **404** |

**API landmine:** `GET /inventory/items/by-code/:code` **collapses** kit / lot / fabric QR onto the catalog SKU. Mobile must keep `resolveInventoryScan` order: **bin → kit → lot (fabric) → item**.

---

## Admin IDENTIFY / Print (Simulator, prior + this campaign)

Inventory tab is the **stacked-layers** icon. Do **not** `simctl openurl`.

DEV simulate: paste into `testID=dev-simulate-code`, Return, **استخدام الرمز** (~y=828, not the home-indicator).

| Payload | Destination on Simulator | Result |
|---|---|---|
| `MAT-ITAL-VEL` | Identify sheet — مخمل إيطالي محجوز, SKU, qty, warehouse | **PASS** |
| `BIN-RAW-RAW-MAIN` | Bin sheet — caption + contents with qty | **PASS** |
| `WIP-P8-B-CARPENTRY` | Kit / semi-order detail (not SKU collapse) | **PASS** |
| `FIN-P10-B` | FG inspect — بضائع جاهزة, Show QR / Print pinned | **PASS** |
| `NO-SUCH-QR-XYZ` | Not-found board | **PASS** |

### Display + Print

| Surface | What we saw | Result |
|---|---|---|
| Kit Show QR | White plate, brand M in crop, caption `WIP-P8-B-CARPENTRY` | **PASS** |
| Kit Print | `printKind: 'wip-kit'` → `/inventory/wip-kits/{id}/qr-label` | **FIXED** + curl `%PDF-` **PASS** |
| Bin Print | Footer طباعة الملصق + Scan again + Done | **FIXED** + **PASS** |
| FG Show QR / Print | Pinned on FG inspect | **PASS** |
| SEMI / accessory / fabric type-in | Same resolver; fabric is `ORDER_FABRIC` | Jest + prior IDENTIFY; not every code re-typed this worker pass |
| Production hub Show QR | Same `BrandQrCode` widget, display-only | **N/A** as a separate Print site |

### Label PDFs (`curl` + admin bearer)

| Label | URL | Status | Magic |
|---|---|---|---|
| Item | `/inventory/items/{id}/qr-label` | 200 | `%PDF-` |
| WIP kit | `/inventory/wip-kits/{id}/qr-label` | 200 | `%PDF-` |
| FIN / fabric lot | `/inventory/lots/{id}/qr-label` | 200 | `%PDF-` |
| Bin | `/warehouses/{wh}/locations/{id}/qr-label` | 200 | `%PDF-` |

---

## Worker walks (this pass)

Demo passwords are all `123`. Login username via **keystroke** (Cmd+V often misses the field). Save Password: relaunch the app if the native sheet eats host clicks.

### Carpenter (Khaled) — task material scan

- Home → oak table **SO-2026-00024** / **PO-2026-00034** → carpentry → **TSK-2026-00184**.
- Materials: `MAT-HW-SCREW` expected 8, `MAT-OAK` expected 3.
- Dock **مسح** (second row, RTL right) opened DEV scanner. Simulate `MAT-OAK` → caption `MAT-OAK` → استخدام الرمز → toast **تم مطابقة MAT-OAK**. **PASS**
- Identify API: OAK **MATCH**, SCREW **MATCH**, `MAT-ITAL-VEL` **EXTRA**, `BIN-RAW-RAW-MAIN` **NOT_FOUND**.
- Second material scan after the toast **did not reopen** on that session (dock under ScrollView / Modal). Later **Modal remount** fix was verified on the **driver** second scan.

### Assembler (Tareq) — incoming WIP take-in

- Home **جاهز بعد الاستلام** **SO-P8-G**. Lane → assembly node (brown ring) → **استلام الطقم**.
- Incoming line: `WIP-P8-G-CARPENTRY` **READY_TO_COLLECT**.
- Dock **مسح QR اختياري** opened DEV scanner. Caption `WIP-P8-G-CARPENTRY` → استخدام الرمز → toast **✓ تم التعرف على القطعة — أكّد الاستلام** and green copy on the board. **PASS**
- **Did not** tap تأكيد الاستلام / متابعة.
- `MAT-OAK` (raw) and `WIP-P8-B-CARPENTRY` (wrong order) are classified **before confirm** (`classifyIncomingWipScan`). Finger walk of those two on this task did not complete because the scanner would not reopen until the Modal remount (then we had moved on). Jest covers raw / wrong-kit / unknown.

### Upholsterer (Nour)

- Home: **نفذ الآن** SO-P9-L / SO-P9-D (rework), **جاهز بعد الاستلام** **SO-P8-H**.
- Opened **SO-P8-H** lane. Station copy: receive first from Foam preparation. CTA **استلام الطقم** visible.
- `GET .../fabric-procurements/tasks/{id}/board` for all three mine tasks: **`items: []`**. `TaskFabricTakeInBoard` **returns null** — no fabric scan CTA. **N/A** (empty board, honest).
- Incoming WIP on P8-H: `WIP-P8-H-CARPENTRY` **READY_TO_COLLECT**. Same take-in QR path as assembler; not re-scanned after the assembler MATCH. `FB-SOFB1042-00*` is **not** on this worker’s mine boards (still on unassigned SO-FB1042).
- Did **not** confirm fabric take-in or kit receive.

### Driver (Basel) — FG lot on load sheet

- Home **تحميل الشاحنة**. Opened **ورقة التحميل** **DLV-P10-D** / SO-P10-D (current ready delivery; P10-A was not the card on screen).
- CTA **مسح QR الجاهز** → scanner title **مسح البضاعة الجاهزة**.
- Simulate `FIN-P10-B` → caption `FIN-P10-B` → استخدام الرمز → error toast **هذا الرمز ليس على ورقة التحميل**. **PASS** (unknown)
- Second scan **did open** after Modal remount. Simulate `FIN-P10-D` → caption `FIN-P10-D` → sheet progress **0 من 1 → 1 من 1**, banner **جاهز للمغادرة**. **PASS** (MATCH loads the piece)
- **Did not** tap انطلاق / depart.

### Cutter

Mine queue is **Material preparation** only (same material-scan surface as carpenter). No distinct kit / FIN / fabric QR. **N/A** as a separate QR role.

---

## What was broken, what changed (this pass)

### 1. Worker lane had no tappable take-in CTA

The selected-station board explained “receive first from Carpentry” but only the flow **node** navigated. Host mouse often missed the node.

**Change:** `worker-lane-open-station` Pressable on the selected station (`استلام الطقم` / `عمل مفتوح`). RN `Pressable` (same as flow nodes).

### 2. Incoming WIP scan always said “identified”

Any CodeField scan showed success until **confirm receive** (which we must not tap on a walk).

**Change:** `classifyIncomingWipScan` against eligible / incoming kit QRs. Match → identified toast. `MAT-` / `BIN-` → `incomingQrIsRaw`. Other `WIP-` → `incomingQrWrongOrder`. Else unknown. Jest in `classifyIncomingWipScan.test.ts`.

### 3. Take-in scan lived in a chip under the ScrollView

Receive-pieces chip and in-board SecondaryButton were easy for the host mouse to miss (press-and-hold looks like a scroll).

**Change:** full-width `task-scan-incoming` + take-in **TaskActionDock** scan that calls `openScanner` on the screen. Incoming `loading` starts **true** so a remount does not flash “no SEMI input”. Continue stays **disabled** until the incoming board has loaded (`incomingReady`).

### 4. Second `openScanner` often did not show the Modal

iOS RN `Modal` with `visible={open}` staying mounted does not reliably re-present.

**Change:** mount the Modal only while `open` (`{open ? <Modal visible>…</Modal> : null}`). Driver unknown → MATCH second scan **PASS**.

### 5. Earlier inventory QR (still in)

Identify bin Print, kit `printKind: 'wip-kit'`, pinned Show QR / Print, skip camera permission in DEV, SELECT/VERIFY named non-SKU, floor aesthetic on QR sheets only. QR **stays on white**.

---

## Simulator / tap notes

- Window `{209, 39, 402, 926}`. PNG is 2x; `px/2` = points.
- Helper `/tmp/simwalk.py`. Instant `cliclick c:` on ScrollView buttons; `dd`/`du` holds are treated as scrolls.
- **استخدام الرمز** ~y=828. Return in the DEV field applies the code (`onSubmitEditing`).
- Employee tabs RTL: profile · bell · completed · tasks · Home. Profile ~`(48, 860)`. Logout: instant-click **تسجيل الخروج**.
- Home order cards: scroll so the card is in the **upper** half, then tap (RNGH / pill overlap).
- Do not tap Simulator window traffic lights (AX `button 1` closes the device).

---

## Scoreboard

| Area | Result |
|---|---|
| Live codes from API | **PASS** |
| Label PDFs `%PDF-` | **PASS** |
| BrandQrCode + M in crop | **PASS** (kit Show QR) |
| Admin IDENTIFY MAT / BIN / WIP / FIN / unknown | **PASS** |
| Bin Print + Scan again + Done | **FIXED** + **PASS** |
| Kit Print kind = kit QR | **FIXED** |
| Show QR footers pinned | **FIXED** |
| DEV simulate + no camera prompt | **FIXED** |
| SELECT / VERIFY named non-SKU | **FIXED** (Jest) |
| Carpenter `MAT-OAK` MATCH | **PASS** |
| Assembler `WIP-P8-G-CARPENTRY` identified (no confirm) | **PASS** |
| Incoming raw / wrong-kit copy | **FIXED** (Jest; not both finger-walked) |
| Upholsterer fabric take-in | **N/A** (empty mine boards) |
| Driver `FIN-P10-B` unknown | **PASS** |
| Driver `FIN-P10-D` MATCH (loaded, not departed) | **PASS** |
| Cutter distinct QR | **N/A** |
| Camera PNG decode | **N/A** |
| Second scanner on carpenter / assembler take-in | Was **FAIL**; Modal remount verified on **driver** |

Jest: `classifyIncomingWipScan` `taskIncomingFloor` `selectScanPresentation` `inventoryQrMatrix` `inventoryScanIdentity` `BrandQrCode` → **PASS** where run this pass.
