# Parity session handoff, 13 October 2026

This is a record of work done in the Maher furniture repo at /Users/saadaghbar/maher-aghbar-furniture-app. It is not a certificate that the app is finished. The canonical plan is docs/FINAL-WEB-MOBILE-PARITY-AND-WORKFLOW-PLAN.md and the route ledger is docs/final-parity-route-inventory.csv. The plan is NOT closed.

## What was asked

Compare the website to mobile. Mobile is the reference for business meaning. Faulty mobile behavior is fixed, not copied.

Web dashboards may look different. Data, permissions, and destinations must match.

Keep the parchment/board look on the web and the floor look on the phone.

Do not demo:reset, blanket reseed, send external messages, or destroy current local data.

Real clicks were required. Terminal tests alone do not close the plan.

Later the user said: if a step would reload the app or restart the development editor, skip it. Skip the AI chatbot entirely. Do not keep restarting Metro, the phone, or the servers.

## Earlier UI work in the same effort

Website language switch updates html lang/dir without a refresh, via DocumentLocale in apps/web/src/components/document-locale.tsx, plus font variables in apps/web/src/lib/fonts.ts and the locale layouts.

Login no longer does a full page refresh then a second login. A portal switch under the password chooses Admin, Dealer, or Worker. Mismatch logs out. Files include apps/web/src/components/auth/portal-switch.tsx, portal-switch.css, apps/web/src/lib/post-login.ts, login-form.tsx, and en/ar/he auth messages. The thumb uses a measured spring, not layoutId, because layoutId broke in RTL.

## Rules that were implemented and checked

A sales-order line keeps its own identity. SO-2026-00036 parent e5baa528-2cd6-4097-bfe6-b3a26e5739a1 has Classic Chair line A bba1da67-e820-4acc-8ebb-b51d65a83930 and Queen Bed line B 4c9c7460-3740-4d2c-abd8-c4fbb67c11e3. A opens production order 2d86acf1-fc56-40a5-8a23-58300f70a22c. B opens ef197e36-d370-43f6-aa99-4b9bc5a96941. Parent is In production, not Delivered. A fake lineId stays on the order and says the item is not on the order.

Production hub Needs planning shows unreleased SO-FB1042.A (production f18d7d26-ac6b-4e54-9e92-fbc94755eae6, sales order 8ad305f6-d50d-45e7-8512-8ab7a7800f5a, line ee0928a7-7bd9-4f49-9706-5dfc7e09877e) as Planned and not released, with no Start. In production lists the chair and the bed separately. Ready for factory was empty. Website In production count 19 is production orders. Phone count 13 is sales-order baskets. Same set. Three baskets have more than one line: SO-2026-00025 (3), SO-GOLDEN-001 (4), SO-2026-00036 (2), plus 10 single-line baskets.

An unreleased line opens the preparation plan, not the factory floor. Loading the plan does not POST ensure-plan. The stamp says production orders were created, and the factory floor is not released, in English, Arabic, and Hebrew. Preview schedule and Apply are separate. Apply was not clicked. Open factory floor on SO-FB1042.A opens the planned order and does not release it.

Start production on an unreleased planned order is disabled. Reason: Not released to the factory. The API returns NOT_RELEASED_TO_FACTORY and does not set a release time or an actual start. A released in-progress order does not show that block. On the phone, Confirm on that unreleased plan is disabled with the same reason.

SO-PARITY-UAT-20261012.A production order 6a78d820-bd0a-4095-be43-944bf31091a2 stays In progress. Carpentry task 878607c8-1247-4fa7-9651-6d5fa536c616 (TSK-2026-00346) is Not started and unassigned. The stored carpentry stage row is still Completed and was NOT patched. Foam preparation task b740126f-3495-4a11-a245-694817de7bcf is Completed, assigned to Khaled Obeid. The page and the phone say Carpentry · Not started. Inspection is not the current step while that task is open. There is no generic Finish. Khaled’s website Home and My orders, and the iPhone Do now and My tasks, do not offer that task.

SO-GOLDEN-001.A Your stages is Khaled’s own line. Painting is paused and assigned to him. Open work was visible and was not pressed. That order was not changed.

Navigation folds: Scheduling and Workflow are Production hub tabs, not primary sidebar doors. Old URLs /admin/production/scheduling and /admin/production/workflow still open. Production problems and Quality were already hub tabs. Primary doors kept: Dashboard, Orders, Products, Dealers, Production, Inventory, Purchasing, Invoices, Cost & Performance, Users, Returns, plus footer AI, Settings, Notifications. Dealer Contracts and Documents moved under Account. Money stays invoices, payments, and statement. /dealer/contracts and /dealer/documents still open. Worker shell is Home, My orders, and Completed.

Driver Basel Smadi: DLV-2026-00010 for SO-2026-00012 is Ready, 0 of 4 packages, Open load sheet. DLV-SHELF-PLAN is Planned, reason that it is still planned and loading starts when ready. No factory Finish. Website and phone load sheets open as reads. Confirm truck departed is disabled or absent at 0 of 4. Delivery id 506f5de7-507f-4696-8a61-0300ab92c9a6. Nothing was shipped.

Inventory: Bouclé 611 Cream MAT-BOU-CRM is 254 m on hand on the website and the phone, matching the fabric inventory endpoint. SEMI-PARITY-UAT-20261012 is 0 pcs. Issue is disabled and a tap does not send. The API refuses an issue the warehouse does not have.

Purchasing: PORD-DEMO-DRAFT for Zarqa Timber Yard is Draft on the website and the phone. Send was not pressed.

Invoice INV-COST-VAR-XL-1 for Nile Interiors is Paid, outstanding 0, total 940 ILS, on website and phone.

Return RT-DEMO-002, Queen Bed, Nile Interiors, is Requested on website and phone. The phone had said Reported and was changed to Requested. Refund was not pressed.

Product Classic Chair shows SKU ARM-01 on the website and the phone. The website grid had been showing the section name instead of the code.

Dealer Balqis Hospitality, code CUS-0103, Active, matches on website and phone.

User Nader Unpriced shows role Worker on website and phone.

Website Cost & Performance Active orders is 28, from GET /api/v1/reports/dashboard field ordersInProduction. The phone does not show that 28. Factory flow In production is 19 production orders, all time, from management-summary factoryFlow in_progress. Production today Active is 37 open production orders, all time, from production.activeOrders. The caption was changed to “Open orders, all time.” Tasks done is tasksCompletedToday. Due is dueToday. The board title stays Production today.

Notification title “Task completed” matches on website and phone. The phone body mentioned foam preparation on SO-PARITY-UAT-20261012.

Admin search for SO-2026-00036 returns the parent order on website and phone, with both lines, not one child.

Settings Name (EN) is Maher Al-Aghbar & Sons Furniture on website and phone, matching company.nameEn.

Scan of ARM-01 opens Classic Chair on website and phone. It did not receive or issue stock. The first lookup missed it because ARM-01 is a catalog SKU, not an inventory item code. Both clients were fixed to match the SKU.

Chatbot: one load of the website chatbot showed an empty composer and called POST /api/v1/ai-chat/conversations, with no message and no completion. The user then said skip the chatbot. It was not finished and must not be treated as done. Do not investigate it further.

## Later route work, 13 October 2026

Missing web destinations from the route inventory were given aliases that keep the query string. Production flow opens the workflow tab. An unreleased sales order opens that line’s plan. An unreleased return or replacement stays on the production-order plan. Released work stays on the production order. Inventory groups open the inventory desk. Unknown group shows a warning. Warehouse list opens Warehouses. Legacy order, plan, setup, product setup, purchasing create, supplier, and supplier-orders links open the real pages. /admin/reports/order/[id] opens /admin/reports/orders/[id]. Dealer calendar, payments, statement, new order, request detail, return create, and order progress open the existing dealer pages. A new purchase order keeps supplierId. Settings honors tab. Staff-type create=1 opens the new editor. Roles open staff types. Departments open employees. A return-cost link that pointed at /admin/orders/[id] now points at the sales order.

A worker order opened from Due today or Active is no longer treated as missing just because it is absent from Open. The completed-order page reads finished tasks instead of reusing the Open list. GET /tasks can filter by salesOrderId in source. The completed page falls back to the first page of completed tasks if the running API rejects that parameter. The running API was NOT restarted, so that filter is not live.

Read-only counts at that check: users 20, customers 3, sales orders 58, production orders 64, tasks 363, quotations 60, lots 43, deliveries 26, invoices 22, returns 3. No sales-origin order missing a parent or line. No open task assigned to an inactive user. No negative balances. No task with more than one open timer. No accepted quote with two orders or none. SO-GOLDEN-001, SO-2026-00036, and SO-PARITY-UAT-20261012 were still present and not changed. Seven production-required lines have no factory order because they are still pre-factory. Sixteen orders are already in a floor status without releasedToFactoryAt. That was treated as legacy and not rewritten. Eight deliveries are marked delivered without a customer confirmation time and were left as they are.

16 new unit tests passed and the web TypeScript check passed, as reported by that pass. Do not claim a full suite run.

The admin site was then started once on port 3000. API and Metro were left running. These URLs were opened as admin and did not 404 or write: production flow for order 37da00f1-e295-4403-87b3-411f39f0402c, unreleased plan for b0f17deb-aedc-4a92-ad6f-c97f38fb62ab which landed on SO-2026-00031.A plan, released setup for the dining-table order staying on the production hub, /admin/inventory/fabric, /admin/inventory/warehouses, legacy order 16657aa2-b9ee-4326-af71-cb280d062954 (SO-FB-STATES, Balqis Hospitality), supplier orders for f5db15fc-325c-4826-8734-8417a4def546.

In a separate browser window, dealer Nile opened /dealer/account/statement onto /dealer/statement and /dealer/account/calendar onto the delivery calendar. Carpenter Khaled opened Due today order SO-2026-00004 at /worker/orders/d068a510-086a-451e-8505-3dc3f7bd6be7?segment=today. It showed the order, not a missing-order message. SO-GOLDEN-001 was visible and not opened. The original admin tab had expired and was signed back in as Maher Aghbar on the admin dashboard. No code change for that click pass.

## Servers

Last port check: API on 4000 healthy (node apps/api/dist/main). Metro on 8081 healthy (expo start --host lan). Port 3000 was empty at that check, then the admin site was started once later and the clicks above used it. Nothing stale was killed. The user asked to stop reloading the phone. Metro, the simulator, and the API were not restarted after that request.

## Files touched across the effort

These are the files named by the work, not a git diff.

Web locale and login: apps/web/src/components/document-locale.tsx, apps/web/src/lib/fonts.ts, apps/web/src/components/auth/portal-switch.tsx, portal-switch.css, apps/web/src/lib/post-login.ts, apps/web/src/components/login-form.tsx.

Production and lifecycle: apps/web/src/components/sales-orders/order-production-setup-view.tsx, plan-line-outputs.tsx, apps/web/src/components/production/production-hub/production-hub.tsx, use-production-order.ts, apps/web/src/app/[locale]/admin/production/page.tsx, production-shared.ts, production-basket-board.tsx, apps/web/src/lib/production-lifecycle.ts, order-lifecycle.test.ts, apps/api/src/modules/production/production.service.ts.

Phone production: OrderProductionPlanEditorScreen.tsx, ProductionDetailScreen.tsx, selectProductionJourney.ts, ProductionWhereNowBoard.tsx, ProductionLifecycleStrip.tsx, selectProductionJourney.test.ts, ProductionBoard.tsx.

Worker and driver: apps/web/src/app/[locale]/worker/dashboard/page.tsx, DeliveryWorkerHomeScreen.tsx, driverHomeDeliveries.ts, driverHomeDeliveries.test.ts. Later worker-order-lookup and completed-order / task list changes are named only as areas. The exact new paths under apps/web/src/lib, with tests, are worker-order-lookup.ts, supplier-orders-tab.ts, compat-href.ts, and inventory-deep-link.ts.

Inventory: inventory-client.tsx, inventory.service.ts, InventoryMaterialRow.tsx, AddStockSheet.tsx, InventorySignatureHome.tsx, InventoryGroupListScreen.tsx, matchCatalogSku.ts and its test.

Catalog: products page, ProductCard.tsx, selectProductCard.ts and its test, showroomFeatures.tsx.

Returns: selectReturn.ts and en/ar/he mobile.json.

Scan: apps/web/src/lib/scan-router.ts and scan-router.test.ts.

Nav: apps/web/src/components/nav-items.ts, can-see-nav.test.ts, dealer portal-shell.tsx.

i18n messages in en/ar/he for auth, sales, production, errors, and mobile, where those features changed copy.


## Still open

The plan is not done. Still open: full route and control pass with click evidence for every new alias, reports walk, current-data repair (the eight deliveries delivered without a confirmation time were left; the carpentry stage/task mismatch was not patched), UAT scenarios U01–U16 were not rerun, no physical-device pass beyond the iPhone 17 Pro simulator, no second full review, the salesOrderId task filter is not live until the API process is restarted, and the chatbot was skipped on purpose.

## Do not do

Do not demo:reset or reseed.

Do not restart Metro or the phone unless the user asks.

Do not send chat prompts or external messages.

Do not mark the plan passed.

Do not treat a setup status of RELEASED as released to the factory.

Do not treat factory completion as customer delivery.

Do not treat a missing assignedToMe flag as “mine.”

Written so this session can be continued by another assistant without repeating the checks above.
