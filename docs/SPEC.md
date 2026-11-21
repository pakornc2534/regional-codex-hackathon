# Build Prompt: ร้านเรา · AI Store Manager

Hackathon build specification · 21 November 2026 · English build instructions / Thai product UI · Asia/Bangkok

**How to use:** Open a Codex session in the empty hackathon repository, attach this file, and say: **"Build the project described in this file."** Everything below is addressed to the building agent. The file is self-contained: requirements, seed data, formulas, milestones, and acceptance checks are all here. No Shopee account, earlier conversation, or earlier repository is needed.

This is the single canonical specification. The pre-build addendum is historical background.

Keep the product UI and every owner- or customer-facing message in natural Thai, including the explicit Thai copy below. Keep code, documentation, and commit messages in English.

---

## 1. Situation and rules

This product is being built today, on-site, at the Regional Codex Hackathon Thailand (Sea × OpenAI). How the day works explains most of the priorities in this file.

- **Deadline.** Code freeze and submission are at 17:00 Asia/Bangkok, and a late submission is disqualified. Feature work stops at 16:00 (milestone M4 in section 14) so the last hour goes to deployment checks and documentation.
- **Judging.** Judges score the working product, not the pitch: problem and solution fit, build quality ("does it work and hold up under use"), insight and originality, real-world value shown in the demo, alignment with a build direction, and how deeply Codex was used to build it. Each team gets a 6-minute demo and a short Q&A, and judges may open the demo link on their own without the team present.
- **Audience.** Many judges work at Shopee. Anything presented as a Shopee fee, rule, eligibility condition, or metric must stay visibly labeled as an assumption of the simulation.
- **Build direction.** Primary: *Autonomous & Adaptive AI* — an agent the owner can trust to run on its own, and that gets better the more it runs. Secondary: *Deep Domain AI* — store math a domain expert would trust. Prioritize what makes these visible: backend-enforced authority, readback verification, autonomy levels the owner raises as the manager earns them, a scorecard computed from recorded outcomes, inspectable calculations, and a campaign rehearsal that shows consequences before the owner commits.

Repository rules, which come from the hackathon and can disqualify the team if broken:

- The repository is a new **public** repository created for this hackathon. Never commit secrets, tokens, `.data/`, or personal data. Provide `.env.example`.
- Build everything in this repository from this file. Do not copy code or assets from any earlier project.
- Commit and push after every milestone with a descriptive message, so the history shows the work being built on-site.
- The README must declare pre-existing work honestly (section 16). Leave clearly marked `TODO(team)` placeholders for facts only the team can supply, such as links to earlier repositories; do not invent them.

## 2. Product

Build a web app named **"ร้านเรา" (AI Store Manager)** for owners who sell both online and in a physical shop. It has a **resident AI shop manager** that observes the whole shop, reacts to events, prioritizes work, proposes options, accepts owner instructions, acts through tools within granted authority, and verifies the outcome.

The core problem is fragmented ecommerce administration with interconnected decisions. Running ads or joining a campaign can cause stock shortages, exhausted boxes or printer ink, insufficient packing capacity, cash shortages, or higher sales with less money left over. The app must answer **"ถ้าฉันเปลี่ยนสิ่งนี้ จะกระทบอะไรบ้าง และควรเลือกทางไหน?"** using evidence and inspectable calculations.

The defining experience:

> The owner opens the 3D shop, selects a product on a shelf, opens ads planning, enters a budget, and sees the additional sales needed to recover the ad cost, whether stock is sufficient, the packing supplies required, the preparation capacity, and the cash timing — as one chain of consequences. They can immediately discuss that plan with the manager, and watch the manager act where the work happens.

Implement complete workflows: data → calculation → recommendation → owner decision → action in the simulated shop → outcome verification. The dashboard, the chat, and the 3D scene all read the same shop. A success message without an actual state transition and a readback does not complete a workflow.

The app runs entirely on a simulated shop (`mode=simulated`). Do not require a Shopee partner ID or key, shop token, cookie, screenshot, or real shop export, and do not wait for any platform approval. "Platform API access" means a local connector inside the app that simulates data exchange and success or failure responses. On first launch, seed the shop automatically if no stored data exists, then open the shop UI.

## 3. Decisions already made

Do not ask the owner to reconfirm these.

| Topic | Decision |
| --- | --- |
| Shop | `bankzar`, selling toys, models, cards, and collectibles, with replenishable products and one-off items. All data is fabricated, uses `sim-*` identities, and is labeled as simulated. |
| Platform | Shopee Thailand and physical-shop workflows, through a local simulated connector. |
| AI manager | A real model called through the OpenAI API with function calling (section 12.3). If the key is missing or a call fails, the rest of the app stays usable, the UI shows the AI as disconnected, and AI checks are not reported as passed. Never replace a failed AI call with fabricated success text. |
| Runtime | One Node service with persistent state that survives reloads and restarts. Runs locally for the owner and as a public shared demo (section 13). |
| Authority | The owner chooses the first action of each kind. Afterwards the owner sets an autonomy level for that kind of work (section 8.3). |
| Chat | Private owner–manager chat and simulated customer inboxes, with manager pause and human takeover. |
| Proactive work | Shop events open or update cases without waiting for an owner question (section 8.2). |
| Brief | Every day at 07:00 Thai time, in the app, driven by a demo clock. |
| Layout | Three panels — navigation and cases, workspace, AI manager — plus an interactive 3D shop that opens real workflows. |
| Scope | The milestones in section 14, in order. Section 14 also lists what is out of scope today. |

## 4. Tech stack

Install the latest stable versions that satisfy each other's peer dependencies, commit the lockfile, and resolve a peer conflict by pinning a compatible version rather than forcing the install.

| Area | Use |
| --- | --- |
| Language and build | TypeScript, Vite, Node 22.12 or newer; one package with `src/client`, `src/server`, `src/shared` |
| UI components | shadcn/ui on Tailwind CSS 4 and React 19 |
| Icons | `lucide-react` only |
| Client state | TanStack Query for `/api/state` (invalidate on SSE); Zustand for selection, camera, and draft forms |
| 3D | `three`, `@react-three/fiber` 9, `@react-three/drei` 10 |
| Charts | shadcn/ui Chart components (built on Recharts) |
| Font | `@fontsource-variable/noto-sans-thai`, self-hosted, with a system fallback |
| API server | Hono with `@hono/node-server`; SSE via `streamSSE`; the same process serves the built bundle |
| Schemas | Zod, shared by client, server, and the manager's tool definitions |
| AI | Official `openai` SDK with function calling and a hand-written tool loop |
| Queue and persistence | `p-queue`, `write-file-atomic` |
| Tests | Vitest for calculators, invariants, and seed checksums; Playwright for end-to-end checks and screenshots |
| Dev and deploy | `tsx`, `concurrently`; a Dockerfile for a host that keeps a Node process running (not serverless functions) |

**shadcn/ui workflow.** During M0, initialize shadcn/ui for Vite with `npx shadcn@latest init`, then install the official shadcn skill with `npx skills add shadcn/ui` so component work reads the project's `components.json`. Use that skill for every UI task: find and add components through the shadcn CLI (`npx shadcn@latest add <component>`, `npx shadcn@latest docs <component>`) and compose screens from them instead of hand-writing equivalents. Expect to use Dialog for the popups in section 9.3 (stacked dialogs, Esc closing only the top layer, focus return, scroll lock), Tabs, Sheet or Drawer for the mobile panels, Command for product search, Tooltip or HoverCard for hover summaries, Card, Table, Badge, Sonner for toasts, and Chart. Map the palette in section 9.2 onto shadcn's CSS variables (`--background`, `--primary`, and so on) rather than hardcoding colors in components. If the skill cannot be installed, say so and keep using the shadcn CLI directly.

**3D constraints.** `@react-three/fiber` 9 requires React 19. Do not use drei's `<Environment preset>` or in-canvas `<Text>`, because both fetch files from external hosts; light the scene with ordinary lights and render labels with `<Html>`. The scene must work with no external model, texture, HDR, or font URL.

## 5. Data model and seed

### 5.1 Data model

Maintain one authoritative state for the simulated shop. The UI, the AI, the 3D scene, and the calculators all read that state. Keep connectors, business facts, calculation, and AI interpretation in separate modules so a real platform API could replace the simulator later.

```text
Shop: id, name, platform, timezone, mode, defaults(packingCapacityPerDay, planningCash)
Product: id, shopId, category, name, kind(repeatable|one-off), variants[]
Variant: id, sellerSku, price, cost|null, physical, reserved, updatedAt
ChannelStock: platform, shopId, productId, variantId,
              desiredQuantity, verifiedQuantity, syncStatus, lastSyncedAt
Order: id, channel(online|pos), customerId, conversationId|null, items[], paymentStatus,
       fulfillmentStatus, paidAmount, createdAt, prepareBy|null, settlement|null
Conversation: id, customerId, owner(agent|human), waitingEpisode, messages[]
Campaign: id, productId, variantIds[], status, dailyBudget, spend, clicks, attributedOrderIds[], period
Supply: id, name, unit, quantity, unitCost, leadDays
PackingRecipe: variantId, materialQuantitiesPerUnit
Case: id, type, entityRefs, priority, status, evidence, amountAtRisk|null, analysisVersion
Proposal: id, caseId, options[], source(ai|fixture), basedOnVersion, decision
Policy: id, actionType, scope, conditions, limits, level(1|2|3), levelHistory[], ownerDecision
ActionReceipt: idempotencyKey, payloadHash, status, before, after, verification
Plan: id, variantId, inputs, assumptions, sourceVersion, results, savedAt
Rehearsal: id, inputs, sourceVersion, result, preparationPlan|null, savedAt
ActivityEvent: id, tool, targetRef, location, caseId, status, at
Return: id, orderId, items[], stage, receivedAt|null, inspectionStatus
Brief / Memory / AuditEvent
```

Store `runId`, schema version, state revision, and the simulated clock at shop level. Each fact and read model carries its source, `observedAt`, covered period, and completeness where applicable. Represent money as integer satang, rounded half up per order line. `null` means unknown and must never become zero.

### 5.2 Seed

Set the demo clock to **2 October 2026, 06:50, Asia/Bangkok**. All figures are fabricated. Generate IDs and timestamps deterministically from (day, SKU, channel, index) so every fresh seed is identical. Planning opens on ROBOT.

Create 9 listings with 13 variants. Variants of the same listing share a product; create identities independently of the seller SKU.

| SKU | Item / variant | Price ฿ | Cost ฿ | Physical | Base online units/day | Base POS units/day | Packing recipe |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| ROBOT | โมเดลหุ่นยนต์ 1/144 / สีขาว | 590 | 320 | 420 | 16 | 2 | Large |
| FOREST | ฟิกเกอร์กล่องสุ่ม Forest Friends | 290 | 150 | 680 | 25 | 4 | Small |
| KISS-B-CD | BNK48 Kiss me ยกชุด / CD | 590 | 330 | 120 | 3 | 1 | Small |
| KISS-B-PH | BNK48 Kiss me ยกชุด / Photobook | 790 | 430 | 100 | 2 | 1 | Small |
| KISS-S-CD | BNK48 Kiss me แยกชิ้น / CD | 89 | 35 | 340 | 9 | 2 | Small |
| KISS-S-PH | BNK48 Kiss me แยกชิ้น / Photobook | 149 | 60 | 260 | 6 | 1 | Small |
| KIBOU-CD | Kibouteki Refrain / แพ็ก CD 20 แผ่น | 990 | 540 | 90 | 2 | 0 | Large |
| KIBOU-PH | Kibouteki Refrain / แพ็ก Photobook 20 เล่ม | 1290 | 730 | 70 | 1 | 0 | Large |
| KITTY-A | Yu-Gi-Oh! × Hello Kitty / A | 159 | 65 | 180 | 5 | 1 | Small |
| KITTY-B | Yu-Gi-Oh! × Hello Kitty / B | 159 | 65 | 160 | 4 | 1 | Small |
| SONIC | พวงกุญแจ Sonic | 249 | 95 | 2 | Special case | 0 | Small |
| FORTUNE | Fortune ลายเซ็น / ชิ้นเดียว | 1290 | 650 | 0 | Special case | 0 | Small |
| RARE-CAR | รถโมเดลสะสม / น้ำเงินพร้อมกล่อง | 890 | 490 | 1 | 0 | 0 | Large |

Physical is the current physical stock at the demo clock. A product pack is one selling unit: one KIBOU-CD unit is one pack of 20 CDs. FORTUNE and RARE-CAR are one-off items; replenishment sources for SONIC and KITTY are unconfirmed; the rest are repeatable. Categories: โมเดล (ROBOT, RARE-CAR), ฟิกเกอร์และของสะสม (FOREST, SONIC), ไอดอลและเพลง (the two Kiss me listings, Kibouteki Refrain, FORTUNE), การ์ด (KITTY).

**Create actual order records first**, then aggregate the daily history from them; never add the two together. History covers 28 days, 4 September–1 October, with d=0..27:

- Online units, when base > 0: `base + (d%7>=5 ? 2 : d%3−1)`. POS units, when base > 0: `base + (d%7>=5 ? 1 : 0)`. Zero-sales days are valid.
- SONIC: one online unit when `d%4===0`. FORTUNE: one online unit when `d===5`. RARE-CAR: no sales.
- One unit per order, each with channel, `createdAt`, payment status, fulfillment status, and the price at the time of sale. POS orders are taken home by the customer and never enter the shipping stages.
- Online orders through d24 are delivered; d25–d26 have been collected by the carrier. For each SKU's online orders on d27: the first two units are ready for pickup, the next unit awaits preparation, and the rest have been collected by the carrier.
- Three extra case orders, all dated the evening of 1 October: one paid SONIC unit (awaiting preparation, `prepareBy` 2 October 09:00), one paid KISS-B-CD unit (awaiting preparation; it takes the place of the last generated d27 KISS-B-CD unit, so remove that one), and one unpaid SONIC unit (does not reserve stock).
- Today's online orders before 06:50, all paid and awaiting preparation: ROBOT 10, FOREST 12, KISS-S-CD 4 — exactly 26 orders and 9,736 baht.
- `prepareBy` is a simulation assumption, not a Shopee rule: the d27 units and the KISS-B-CD case order are due 2 October 18:00, today's orders are due 3 October 18:00, and orders created later by events are due 18:00 the same day when paid before 12:00 and 18:00 the next day otherwise.

Reserved stock is derived from paid online orders still at the shop, and available = physical − reserved. Set packing, pickup, and delivery timestamps before the demo clock, and keep opening balances so that opening + receipts − departed reconciles to current physical stock.

The seed must reproduce these values exactly; assert them in a test.

| Check | Value |
| --- | --- |
| Total orders / paid orders / paid sales | 2,658 / 2,657 / 974,414 baht |
| Seven-day overview (26 September through the demo clock, paid orders) | 600 orders / 221,056 baht |
| Paid online units per SKU, 4 Sep–1 Oct | ROBOT 463, FOREST 715, KISS-B-CD 99, KISS-B-PH 71, KISS-S-CD 267, KISS-S-PH 183, KIBOU-CD 71, KIBOU-PH 43, KITTY-A 155, KITTY-B 127, SONIC 8, FORTUNE 1 |
| POS units per SKU, 4 Sep–1 Oct | ROBOT 64, FOREST 120, KISS-S-CD 64, and 36 each for KISS-B-CD, KISS-B-PH, KISS-S-PH, KITTY-A, KITTY-B |
| Units awaiting preparation (the packing queue) | 38 |
| ROBOT physical / reserved / available | 420 / 13 / 407 |
| FOREST physical / reserved / available | 680 / 15 / 665 |
| SONIC physical / reserved / available | 2 / 1 / 1 |

Also seed:

- **Conversations (4):** the last SONIC item, tracking the SONIC order, a Kiss me inquiry, and the sold-out FORTUNE item. Other historical orders use fabricated customer IDs without creating conversations.
- **Cases (3):** reply about SONIC, prepare the SONIC order before 09:00, and review SONIC ads as stock runs low. Exactly these three exist at seed time.
- **Campaigns (4):** SONIC 120/day, Kiss me แยกชิ้น 180/day, ROBOT 300/day, FOREST 250/day. Their spend, clicks, and attributed order IDs for 26 September–2 October must point at real orders in the seed, and attributed revenue is never added to sales again.
- **Returns (2):** one in transit back to the shop and one received and awaiting inspection. Neither is sellable stock.
- **Settlements:** online orders at least 7 days old are settled after an assumed 12% fee, with a cash-receipt date; newer orders are unsettled and their settlement is `null`. Do not treat all sales as cash received.
- Autonomy levels all start at level 1 and the acknowledgement message starts disabled.

Opening existing data must never overwrite it. Starting a new run archives the old run with its policies.

## 6. Inventory, materials, and fulfillment

### 6.1 Inventory

```text
available = physical stock at the shop − stock reserved for accepted orders
0 ≤ reserved ≤ physical
POS sale of q: physical -= q; reserved unchanged
Accept a paid online order of q: reserved += q
Cancel before shipping: release the reservation
Carrier pickup of q: physical -= q; reserved -= q
```

Check available stock and idempotency before every mutation, and show an inventory movement ledger. `physical` means usable inventory including reserved units; returns awaiting inspection and damaged stock use separate states even when the parcels are at the shop. Selling out a one-off collectible does not imply it should be replenished.

When available stock changes, the simulated connector sends the new quantity to the simulated Shopee endpoint inside the app. Store the **desired quantity to send** separately from the **latest quantity confirmed by the destination**, with pending, synced, and failed states. Join identities on platform + shop + product + variant; a name or seller SKU alone is not enough.

### 6.2 Materials and packing capacity

| Material | On hand at the demo clock | Unit cost ฿ | Lead time, days |
| --- | ---: | ---: | ---: |
| กล่องเล็ก (small box) | 900 boxes | 6 | 3 |
| กล่องใหญ่/กล่องโมเดล (large/model box) | 260 boxes | 12 | 4 |
| กันกระแทก (protective wrap) | 1050 metres | 4 | 2 |
| เทป (tape) | 2100 metres | 0.50 | 2 |
| ใบปะหน้า (shipping label) | 1000 sheets | 0.80 | 2 |
| หมึก (ink) | 135 ml | 2 | 3 |

These quantities already reflect historical packing. Recipe per online selling unit: the small recipe uses 1 small box + 0.5 m wrap + 1.5 m tape + 1 label + 0.15 ml ink (9.85 baht); the large recipe uses 1 large box + 1.5 m wrap + 1.5 m tape + 1 label + 0.15 ml ink (19.85 baht). POS purchases use no packing recipe.

```text
free material = on hand − material reserved for paid, unpacked orders
additional units of one SKU that can be packed = min over materials of floor(free material / recipe usage)
average consumption per day = sum(each SKU's online units over 28 days × recipe usage) / 28
days remaining = free material / average consumption per day
```

At seed time the free quantities are: small boxes 875, large boxes 247, wrap 1,018 m, tape 2,043 m, labels 962, ink 129.3 ml.

Show the bottleneck material, shortage quantities, lead times, and an estimated date to place a replenishment order. Consume materials exactly once, when packing is confirmed, not when documents are generated. Per-SKU capacity assumes all remaining materials go to that SKU, so capacities across SKUs cannot be added. When consumption history or a recipe is missing, display "ยังประเมินไม่ได้".

Keep units explicit: one packing set per selling unit, and one parcel per order. A two-unit order is one parcel that consumes two packing sets. Do not interchange "ชิ้น" (units) and "พัสดุ" (parcels).

### 6.3 Parcel location

Shipping stages are mutually exclusive: **รอหยิบ → กำลังแพ็ก → รอขนส่งรับ → ขนส่งรับแล้ว → ระหว่างทาง → ส่งสำเร็จ**. They include paid, non-cancelled online orders only. Every stage change has event evidence and a simulated timestamp.

Generating pick lists and shipping labels leaves the order at รอหยิบ. A human confirms packing; a simulated carrier event confirms collection. Returns are displayed as **ระหว่างทางกลับ** or **ถึงร้านรอตรวจ** and are never counted as sellable stock; processing a return is out of scope today.

## 7. Ad planner and impact chain

### 7.1 Behavior

For the selected SKU, the button **"ยิงแอด"** opens a popup for numeric inputs. Calculate, and scroll to the results below, only when the owner clicks **"ประเมินแผนนี้"**; opening the popup alone neither calculates nor changes anything. Only this planner is offered today; do not render buttons for flash-sale, voucher, or investment planning.

- **Inputs:** SKU, number of days, daily budget, CPC, conversion rate, assumed fee rate, quota, discount per unit, demand multiplier (`demandLift`), other fixed costs, daily packing capacity, planning cash, and settlement delay.
- **Outputs:** normal sales versus the plan, demand, the quantity the shop can actually support, the bottleneck, sales revenue, itemized costs, money left after the stated costs, the two break-even targets, additional supplies required, lowest planning cash, and a recommendation that fits the constraints.

The UI and the AI tool call the same pure calculator, and a preview never writes state. Bind each result to the SKU, `runId`, state revision, and submitted inputs. When the state revision changes, mark the result "ข้อมูลเปลี่ยนแล้ว" and offer "ประเมินใหม่". A response for an older SKU, run, or revision must never replace the current result. If evaluation fails, show the cause and a retry button.

**"บันทึกแผน"** saves the plan and its context for discussion with the manager. It does not buy ads or change the shop. Plan figures are forecasts; only authorized events change shop state.

### 7.2 Defaults and unknowns

Every page and tool reads planning defaults from the same shop data: packing capacity **120 units/day** and planning cash **THB 30,000**, which is a planning figure and not a claim about a bank balance. Use the shop default when an input is omitted, and preserve explicit values: capacity 0 means no capacity, cash 0 means no cash, and `null` means unknown, which must be surfaced when a formula needs it rather than replaced with a guess.

The first ad plan opens on ROBOT for **1 day**: ads THB 300/day, CPC THB 4, conversion 3%, assumed fees 12%, quota 100 units, `demandLift` 1, settlement delay 7 days, discount 0, other fixed costs 0. The plan is additional budget on top of the existing ROBOT campaign, and the baseline is all historical online sales, including ad-attributed ones. Provide 7-day and 14-day example buttons that state their duration and apply their own inputs.

### 7.3 Formulas

These formulas are the app's simulation model, not guaranteed outcomes or Shopee rules. Keep the calculator's input type open to further per-unit and fixed costs that default to 0.

1. `totalAdSpend = dailyBudget × days`; `assumedIncrementalAdUnits = totalAdSpend / CPC × conversionRate`. CPC must be greater than 0. `conversionRate` is a fraction from 0 to 1, and one conversion is one selling unit.
2. `rawBaselineDemand = averageOnlineUnitsPerDay × days`; `rawPlanDemand = rawBaselineDemand × demandLift + assumedIncrementalAdUnits`. Ad demand is incremental and is not counted again in `demandLift`. Convert each demand to whole units with one `ceil` after summing, correcting only floating-point noise (69.00000000000001 becomes 69). Use the true average, not a display-rounded one.
3. Resources for this SKU. Start from available stock and subtract an allowance for expected POS sales: `ceil(average POS units per day × days)`. Subtract supplies and packing capacity already committed to the unpacked queue. Then reserve an allowance for the normal online sales of every other SKU: `floor(average online units per day × days)` per SKU, capped by that SKU's stock after its own POS allowance. If normal demand across the shop exceeds a resource, allocate that resource in proportion to the normal sales mix before rounding down. Use identical allowances for the baseline and the plan, and show the supplies reserved for other products.
4. `supportablePlanUnits = min(wholeUnitDemand, allocatableStock, materialCapacity, preparationCapacity, quota)`, all in whole selling units, with material capacity rounded down by recipe. Compare with the baseline over the same period; the quota applies to the plan only. Return requested whole units, target units and supportable units separately. The impact chain compares uncapped demand against resources even when supportable demand is zero. Show total supportable units separately from incremental units.
5. `unitPrice = price − discountPerUnit`; `m = unitPrice − productUnitCost − packingUnitCost − feeRate × unitPrice`.
6. `F = adSpend + otherFixedCosts`; `planContribution = supportableUnits × m − F`. The UI label is **"เงินเหลือหลังต้นทุนที่ระบุ"**, not net profit. If a required cost is unknown, contribution and break-even are unknown.
7. **Recover ad spend only:** `ceil(adSpend / m)` additional units when `m > 0`, assuming those units are incremental.
8. **Make the whole plan worthwhile versus normal sales:** with `B` = baseline contribution at the regular price and `q0` = baseline units, `requiredTotalUnits = max(0, ceil((B + F) / m))` and `requiredAdditionalUnits = max(0, requiredTotalUnits − q0)`. This also recovers the margin lost by discounting sales that would have happened anyway.
9. Check both targets against stock, materials, capacity, quota, and assumed demand. Ad recovery needs resources for `q0 + additional units`; the whole-plan target needs the total from step 8. Show available, required, and shortfall for each. If `m <= 0`, explain that selling more cannot recover fixed costs.
10. `ROAS = adAttributedSalesRevenue / adSpend` is not profit; when `adSpend` is 0 report that it cannot be calculated. Find break-even units by searching for the smallest whole number using the same money rounding as real line totals, so display rounding of `m` cannot distort the answer.

Lowest planning cash is planning cash minus the plan's spend before any settlement arrives; with a 7-day settlement delay, a 1-day plan receives no sales cash inside the plan period.

### 7.4 Worked examples

Derive these from the formulas. Never hard-code the answers.

**Discount example.** Regular price 400, product cost 250, packing 10, fee 10% → 100 per unit. A 10% discount gives price 360 → 64 per unit. Ad spend 300, no other fixed cost, baseline 5 units → baseline contribution 500. Recovering ad spend needs 5 units; matching the baseline for the whole plan needs **13 total units, 8 additional**, because `13 × 64 − 300 = 532` while 12 units leave 468. If the shop can support only 10 units, report that the plan cannot reach this target.

**ROBOT 1-day plan on a fresh seed.**

| Evaluation | Result that must be explainable |
| --- | --- |
| Unit contribution before ad spend | 590 − 320 − 19.85 − 70.80 = **THB 179.35** |
| Recover THB 300 of ad spend | 1 additional unit leaves a shortfall of 120.65; 2 additional units leave **THB 58.70** after ads |
| Baseline and target | Average online sales 463/28 per day → baseline 17; incremental ad demand 2.25 → total demand 19; ad recovery needs **2 additional units, 19 total** |
| Stock and materials | 407 available − 3 POS allowance = 404; after supplies for the queue and other products, large boxes support up to **244** ROBOT units |
| Packing capacity | 120 − queue 38 − other products 57 = **25 units**, enough for 19 |
| Plan finances | Baseline leaves 3,048.95; the plan leaves 3,107.65, an increase of 58.70; lowest planning cash THB 29,700 |

Primary message: **"ถ้าขายเพิ่มจากปกติ 2 ชิ้นขึ้นไป รวมอย่างน้อย 19 ชิ้น เงินที่เหลือหลังหักต้นทุนจะพอจ่ายค่าแอด 300 บาทแล้ว"**, followed by the constraints that must hold. The 2 means sales beyond the baseline, and it is not a promise that demand will arrive.

**Insufficient capacity.** If the owner sets capacity to 20 units/day while the queue holds 38, capacity for new work is 0. Explain that the queue exceeds capacity by 18 units and that accepting 2 additional units needs a total capacity of at least 40 as a lower bound, to be re-evaluated after the change.

### 7.5 Impact chain ("ผลกระทบต่อเนื่อง")

After "ประเมินแผนนี้", show the result first as a chain: **งบแอด → ยอดขายเพิ่ม → สต็อก → วัสดุแพ็ก → กำลังแพ็ก → เงินสด**. The first node shows the spend and what it is assumed to buy. Every other node compares what the plan requires with what is available, using the same calculator output:

| Node | Required | Available |
| --- | --- | --- |
| ยอดขายเพิ่ม | Additional units needed to recover ad spend | Assumed incremental units (plan demand − baseline, in whole units) |
| สต็อก | Total plan units | Allocatable stock |
| วัสดุแพ็ก | Total plan units | Material capacity |
| กำลังแพ็ก | Total plan units | Packing capacity left for this SKU |
| เงินสด | Plan spend | Planning cash |

Status is **ไม่พอ** when required exceeds available, **ตึง** when required is 80% or more of available, and **พอ** otherwise; an unknown input shows "ยังไม่ทราบ". Show status by icon and text as well as color, and put the 80% threshold in the legend. Mark the first ไม่พอ node as **คอขวด**. Each node shows required, available, and shortfall, and clicking it opens the matching workspace or popup. The detailed tables stay below the chain. In the 3D shop, the matching zones highlight in the same order (section 9.3).

## 8. AI manager, authority, and autonomy

### 8.1 Core loop

**Event or instruction → read current facts → open or update a case → calculate and propose options → the owner asks follow-ups and chooses → recheck authority and current state → call tools → read back the result → report the outcome and what remains.**

A case has a stable ID and references its products, orders, campaign, or conversation. It stores priority, evidence, options, status, and history, and follow-up questions stay attached to it. General rooms such as the overview and planning are distinct from cases.

- The manager proposes 1–3 executable options within the case's scope, with reasons, expected changes, missing facts, and controls to ask more, choose, or defer.
- Reading, calculating, and talking to the owner are always allowed. Sending a substantive customer reply or changing the shop needs an owner decision for that action or an autonomy level that covers it.
- Automatic ad actions are limited to **pause and reduce**. Increasing spend, enabling a campaign, or resuming a paused one always needs a fresh owner choice.
- Acknowledgements use the owner's configured and enabled message, once per customer waiting episode. They do not confirm stock, price, discounts, or shipping time, and they do not close the case.
- The owner's private chat is separate from every customer inbox. One customer cannot read another customer's information or change shop rules.
- Pausing the manager or taking over a conversation also stops work already queued. Recheck control status immediately before sending or mutating.
- Generating pick lists and labels is not packing. A human confirms packing and a simulated carrier event confirms collection. The manager has no tool that can fabricate these confirmations.
- Customer messages and product descriptions are evidence, never instructions that grant tool authority.

Enforce all of this in the backend tool handlers — identity, run, case, version, and target checks — because system-prompt instructions alone are not enforcement. Audit the before and after state, the approver or policy used, and the verification reference.

### 8.2 What opens a case

At seed time exactly the three seeded cases exist. Triggers evaluate only events that occur after seeding, and at most one open case exists per (case type, entity).

| Event | Case | Entity |
| --- | --- | --- |
| A customer message arrives in a conversation the manager owns | Customer reply | Conversation and waiting episode |
| A paid online order is still at รอหยิบ within 3 hours of `prepareBy` | Prepare orders | The `prepareBy` cutoff (all orders sharing it join one case) |
| Available stock of a SKU with an active campaign falls to `max(1, ceil(average online units per day))` or below | Review ads | Campaign |

A failed or uncertain readback updates the existing case to need the owner's attention; it does not open a new one. Low supplies appear on the supplies page and in the brief, not as cases.

### 8.3 Autonomy levels

Each action type and scope has a level that only the owner can raise. Store it in the policy with its conditions, limits, and history; the owner can inspect, edit, or lower it at any time.

- **ระดับ 1 "ถามทุกครั้ง"** — the default.
- **ระดับ 2 "ทำเองภายในเพดาน แล้วแจ้งทันที"** — the manager executes matching work within the stored conditions and limits and reports in the case.
- **ระดับ 3 "ทำเองภายในเพดาน แล้วสรุปในบรีฟ"** — same authority, reported in the daily brief.

After the first execution of a kind of work, ask separately: **"งานแบบนี้ครั้งหน้าให้ทำเองตามกฎ หรือถามทุกครั้ง?"** Until the owner answers, keep asking before acting. In addition, when a level-1 action type reaches three consecutive approvals without edits, the manager proposes raising it and cites those cases. Increasing ad spend, enabling a campaign, and resuming a paused one stay at level 1 permanently.

The backend lowers a level to 1 automatically, and records why, when a readback fails, a result is uncertain, or the owner reverses an autonomous action. Work outside the limits waits for the owner. For a multi-variant campaign, a stockout of only some variants always requires an owner choice and shows stock for all variants. Automatic stockout pausing requires all variants to be sold out and a matching policy. Every autonomous action names the policy and level it used.

### 8.4 Scorecard ("ผลงานของผู้จัดการ")

Show on the overview, computed from action receipts and the audit log and never from model text: work handled autonomously, work waiting for the owner, verified, failed, and uncertain results, level changes with their reasons, and the share of work handled without the owner per simulated day.

### 8.5 Amount at risk ("เสี่ยงถ้ายังไม่ตัดสินใจ")

Every case waiting for the owner shows an estimate computed by pure functions from current facts and labeled as an estimate:

- Review ads: ad spend per hour (`dailyBudget / 24`) still going to a SKU with no available stock.
- Prepare orders: the number and value of orders that will pass `prepareBy` within the next 3 hours.
- Customer reply: the value of the item the waiting customer asked about, labeled as a potential sale, not a loss.

Show how each figure was derived, show "ยังประเมินไม่ได้" when inputs are missing, and rank comparable baht estimates over the next three hours (hourly ad spend × 3, orders due in that window, or current potential customer sale), then earliest deadline. Keep the original unit and derivation visible; unknowns sort last.

## 9. UX, visual direction, and the 3D shop

### 9.1 Layout

- **Left:** shop name, grouped navigation, the count of decisions waiting for the owner, and cases that can be resumed.
- **Center:** the selected workspace — ภาพรวม / ร้าน 3D / เคส / แชทลูกค้า / สต็อกกลาง / วัสดุแพ็ก / ส่งของ / ลองปรับแผน / ซ้อมแคมเปญใหญ่ / บรีฟ / ความจำและกฎของร้าน.
- **Right:** the AI manager, aware of the current page, case, and selected product, with suggested questions, history, and option cards. The owner never needs to type a product ID.
- On mobile, use drawers or tabs so both the workflows and the manager stay reachable instead of squeezing three columns.
- Every page has understandable loading, empty, error, stale-data, and AI-disconnected states.

Use plain, polite, concise Thai, for example "เหลือขาย 1 ชิ้น", "รอเจ้าของเลือก", "เตรียมใบปะหน้า", "ยังไม่ทราบต้นทุน", "ดูผลกระทบ", "ส่งข้อความนี้". Explain what happened, what should happen next, why, and who must act. Button copy describes its effect. Keep implementation terms out of the UI, never use "กู/มึง", and do not substitute slogans for information.

### 9.2 Visual direction

A presentation-ready product: pale cream data surfaces, dark text, deep green primary buttons, subtle borders and shadows, generous spacing, and key metrics legible at a glance.

The 3D shop is a **collectibles gallery diorama** with recognizable architecture: tall arches, illuminated display cabinets, a raised ivory floor, a terracotta packing and dispatch zone, a sculptural central product pedestal with a golden light ring, and a dark blue backdrop. Make it large enough to tell the zones apart, and keep information boxes from cluttering it.

Initial palette: backdrop `#1D2B34`, floor `#EEE6D5`, terracotta `#B97455`, gold `#C5A46D`, green buttons `#246B57`, data surfaces `#F7F5EF`. Adjust for contrast. Clear composition matters more than exact colors.

### 9.3 The 3D shop is an operational interface

Use a real rotatable, zoomable scene built from primitives, with warm lighting, contact shadows, distinct wood, stone, and metal materials, and an isometric camera that shows the whole shop. Include camera reset, fullscreen, and a 2D view that opens the same workflows.

| Shop location | Popup |
| --- | --- |
| 1. Product shelves / central pedestal | The selected SKU: price, physical, reserved, and available stock, channel sync, cost, and the "ยิงแอด" button |
| 2. Picking queue | Paid orders awaiting preparation, deadlines, and simulated pick lists and labels |
| 3. Packing table | Orders being packed, supplies required, and remaining capacity |
| 4. Pickup staging | Packed orders awaiting the carrier, with separate order and unit counts |
| 5. Carrier vehicle / dispatch area | Collected, in-transit, and delivered shipments with tracking details |
| 6. Returns area | Read-only: returns in transit and received awaiting inspection |
| 7. Cashier desk | Read-only: paid sales, known settlements, and planning cash, each labeled distinctly |
| 8. Wall dashboard | Read-only: sales and orders for the seven-day overview, and the manager's scorecard |
| 9. Computer | Read-only: shop details, autonomy levels, and the manager's recent activity |

Interaction rules:

1. Each shelf position maps to one real `variantId`. The number of rendered models is not the stock count, and the central pedestal shows the selected product, not another inventory pool.
2. Select through **category → product → variant**, with search by name, model, and SKU.
3. Hovering an object, or focusing its label with the keyboard, shows its workflow name, purpose, and brief data. Hover never changes the selected SKU or plan.
4. Click or Enter opens a **popup over the same scene** with a title, summary metrics, tabs, scrollable details, a close control, and an optional "เปิดหน้าเต็ม" button. Preserve the camera, the selection, and entered values.
5. The planning dialog can stack over product details. Esc closes only the top layer, focus returns correctly, and scroll stays locked while another dialog remains open.
6. Clear hover cards when the pointer leaves, a camera drag begins, a popup opens, or the mode changes. A camera drag must not register as a click.
7. Scene labels show work and quantities actually recorded in the shop. Plan forecasts appear only in plan results.
8. Lazy-load the scene, render on demand, and cap resolution by device capability. Support reduced motion, keyboard access, and the 2D fallback. Check 1440, 390, and 360 px widths for overflow.

**Impact chain in 3D.** When a plan is evaluated, highlight the zones of the chain in the same order as section 7.5, with the bottleneck zone marked.

**Manager avatar.** Add a simple figure built from primitives. The server emits an activity event for each manager tool call — tool, target entity, mapped shop location, case ID, and status — and the avatar moves to that location with a short Thai status bubble such as "กำลังเช็กสต็อก SONIC…". It shows a check mark only after the readback is recorded and a warning on a failed or uncertain result, and it waits at the computer when idle. The avatar reflects recorded activity events only; never animate an action that did not happen. Clicking it opens the manager's recent activity. With reduced motion it jumps instead of walking, and the 2D view shows the same activity as a status line. Document the tool-to-location mapping.

### 9.4 Thai labels for states

Use these consistently everywhere.

| State | Thai label |
| --- | --- |
| Action: proposed | เสนอแล้ว |
| Action: awaiting approval | รอเจ้าของเลือก |
| Action: executing | กำลังทำ |
| Action: verified | ทำแล้ว ตรวจผลแล้ว |
| Action: failed | ทำไม่สำเร็จ |
| Action: uncertain | ยังไม่แน่ใจผล |
| Action or result: stale | ข้อมูลเปลี่ยนแล้ว |
| Stock sync: pending / synced / failed | รอส่งยอด / ตรงกันแล้ว / ส่งยอดไม่สำเร็จ |
| AI disconnected | ผู้จัดการ AI ยังไม่ได้เชื่อมต่อ |
| Simulated data | ข้อมูลจำลอง |
| Assumption | สมมติฐาน |

## 10. Mega-campaign rehearsal ("ซ้อมแคมเปญใหญ่")

The owner rehearses a campaign day on a copy of the shop before committing to it.

1. **Inputs:** campaign date and demand multiplier. Offer presets for the next double-date campaigns after the demo clock (10.10, 11.11, 12.12) and default to the nearest one. The multiplier defaults to ×5 across the shop, is editable, and is labeled as the owner's assumption, not a Shopee figure.
2. **Simulation:** a deterministic pure function with no model call. Fork the current state and never mutate the live shop. Simulate day by day from the demo clock through the campaign day: normal days at baseline online and POS rates, the campaign day at baseline × multiplier, in whole units, applying the live rules for stock, reservations, packing recipes, daily packing capacity (unpacked work carries to the next day), material lead times, and settlement delay.
3. **Result ("ผลการซ้อม"):** what breaks first, on which date, and why — demand that could not be sold per SKU, the date each material runs out, the number of orders that would pass `prepareBy` because of packing capacity, and the lowest planning cash — plus the impact chain for the campaign day. On the seed with the default preset, expect packing capacity to be exceeded several times over on the campaign day and large boxes, labels, and ink to run short around it; the result must reach this from its own calculation.
4. **Preparation case ("เตรียมรับแคมเปญ"):** the manager proposes 1–3 options built from quantities the calculator derived, such as reorder amounts with order-by dates (campaign date minus lead time), per-SKU quota caps, the extra packing capacity needed, and ad budget changes. The model selects and explains; it does not invent quantities. Choosing an option saves it as a plan on the fork and reruns the rehearsal, showing before and after side by side. Saving purchases nothing; the order-by dates become reminders in the daily brief.
5. **If time remains:** add a demo event "จำลองยอดขาย 1 วัน" that advances the live shop by one simulated day, then compare the rehearsal with what was recorded and store the observed multiplier as labeled memory for the next rehearsal.

## 11. Daily brief and memory

**Brief.** At 07:00 Thai time on the demo clock, generate one brief per shop per Thai calendar date, in the app only. It summarizes the metrics and the period they cover, urgent tasks, cases waiting for the owner with their amount at risk, what the manager did at each autonomy level, unresolved work, supplies and stock running low, and reminders from saved rehearsal plans, with links to the related cases. Provide demo-clock controls to advance time. Triggering again on the same date must not create a second brief. Do not create an OS scheduler and do not send real email.

**Memory.** The owner can save shop context and constraints, and rooms share that memory according to their permissions. A saved plan or an instruction for one purchase does not become a policy. Private owner information never enters a customer inbox.

## 12. Architecture, API, and AI contract

### 12.1 Architecture

```text
React + TypeScript + Vite (shadcn/ui)
Dashboard / 3D shop / Popups / Cases / Inbox / Manager chat
                         │ HTTP + SSE
                         ▼
Node API (Hono) ── Manager controller / job queue / demo clock
                         │
        ┌────────────────┼──────────────────┐
        ▼                ▼                  ▼
Simulator & facts   Pure calculators    AI bridge
Stock / Orders      Plan / Rehearsal    Tools / Conversation scope
Materials / Audit   Cash / Capacity          │
        │                │                  ▼
        └────── same shop state         OpenAI API
                         │
                         ▼
               Local persistence (JSON)
```

Keep these modules separate: `simulator`, `operations`, `fulfillment`, `planner`, `rehearsal`, `manager-controller`, `manager-tools`, `ai-bridge`, `api`, and `persistence`. Keep the 3D scene separate from its data bindings and from popup content.

Atomic JSON writes are enough for persistence. Keep `store.json` (owner memories and chat) separate from `simulator.json` (shop, events, policies, and action results). Use schema versions with migrations that preserve data, serialize mutations to prevent lost updates, and use a separate data directory for tests. Changing the seed must not overwrite a shop already in use.

Local defaults: in development the frontend runs on port 4310 and the API on 4311; in production one Node process serves the bundle and the API on `PORT` (default 4310). Bind to `127.0.0.1` locally and validate Host and Origin. Keep boot and load errors separate from errors in owner commands, so a successful reload never erases the message that a previous command failed.

### 12.2 Internal API

These are routes of the simulator app, not Shopee endpoints.

| Route | Responsibility |
| --- | --- |
| `GET /api/state` | Read model for all pages, with source, time, and connection status. Keep it light: aggregates, open work, and recent items |
| `GET /api/orders` | Paged order list for pages that need full detail |
| `GET /api/events` | SSE: state-changed notifications and manager activity events |
| `POST /api/chat` | Owner message scoped to a room, run, and case; returns a job ID and status |
| `POST /api/sim/analyze` | Analyze the selected case with the latest data |
| `POST /api/sim/plan` | Read-only evaluation of an ad plan |
| `POST /api/sim/rehearsal` | Read-only campaign rehearsal on a fork of the state |
| `POST /api/sim/command` | Owner commands: choose an option, set an autonomy level, pause or take over, confirm packing, trigger demo events, save a plan, reset the demo |
| `POST /api/memories` | Save memory text added by the owner |
| `POST /api/ai/retry` | Retry the AI connection and report the actual result |

Mutating commands carry the actor and scope, `runId`, target IDs, the expected version, a decision or policy reference, and an idempotency key. Detect a reused key with a different payload. Result states are proposed, awaiting approval, executing, verified, failed, uncertain, and stale, shown with the Thai labels in section 9.4.

If a timeout occurs after the destination may have accepted an action, check its receipt and readback before retrying. Reject or re-propose work tied to an old run, an outdated plan, or changed stock; an earlier approval never authorizes a materially different outcome.

### 12.3 AI contract

The manager calls the OpenAI API from the Node server using function calling. Read `OPENAI_API_KEY` and `OPENAI_MODEL` from the environment and keep the key server-side only. Choose a current general-purpose model available to the key as the default and name it in the README. This choice exists because the submission needs a demo link that works while the team's laptop is closed, and a public demo must not route anonymous input into a coding agent on a personal machine.

Model-facing tools, and nothing else — no shell, filesystem, network, or web search:

| Tool | Purpose |
| --- | --- |
| `sim_get_context` | Read current facts for the room or case in scope |
| `sim_calculate_plan` | Run the ad planner; read-only |
| `sim_calculate_rehearsal` | Run the campaign rehearsal; read-only |
| `sim_propose_options` | Attach 1–3 options to the assigned case |
| `sim_execute_approved` | Execute an option that has an owner decision or a covering autonomy level |

The calculation tools are available in the owner's overview and planning rooms. Proposals and execution are scoped to the assigned case. A rehearsal case may attach only calculator-issued preparation option IDs from its assigned fork and source version. An owner choice reruns that fork; saving the plan and reminder never changes the operational shop revision. Actions the manager may propose: `customer_reply` for reply cases; `prepare_order` for preparation cases, which generates documents only; and pause, reduce, increase, or enable for ad cases, where increase and enable always need an owner choice. Setting an autonomy level, taking over a conversation, confirming packing, confirming carrier pickup, and resetting a run are owner or simulator commands the manager cannot invoke.

- Bind each conversation to its room, run, and case, and supply shop context explicitly on every call. The manager does not know anything from the session that built this project.
- The manager answers in Thai and says what it does not know. Every number about money, stock, or capacity in its messages comes from a tool result; it does not do that arithmetic itself.
- Run one job at a time through a queue. Support thinking, cancellation, failure, and retry states. Cap the tool loop at a small number of iterations and cap output length.
- **Context for large order volumes.** Keep complete data in storage and in the read models. For the model, include the latest 50 orders plus the orders related to the cases and customers in scope, and compute aggregates from the full data. Include `contextCoverage` with total, returned, and omitted counts, the selection method, and where the aggregates are. Never sum sampled rows as a stand-in for shop totals.

## 13. Hosting and the public demo

Deploy one Node service that serves the built frontend and the API with its own simulated dataset. Deploy for the first time as soon as M1 passes and redeploy at every milestone, so a working demo link always exists. If no hosting account is authenticated on this machine, say exactly what is needed as soon as M0 is done, add a Dockerfile, and keep building.

The public demo is anonymous and shared: every visitor uses the same shop and the same conversations, and may issue manager commands and change simulated data.

- Enable anonymous API access only when `PUBLIC_DEMO_ENABLED=true` and the stored shop has `mode=simulated`. Public access never adds manager tools and never bypasses approval, scope, run, version, or receipt checks.
- Show a persistent notice: **"นี่คือร้านจำลองที่ทุกคนใช้ร่วมกัน ทุกคนเห็นบทสนทนาเดียวกัน กรุณาอย่าใส่ข้อมูลส่วนตัว"**.
- Protect the API key's budget: per-IP and global rate limits, a maximum message length, a daily cap on model calls, and a `DEMO_AI_ENABLED` kill switch. When a limit is reached, say so plainly in Thai and keep every non-AI feature working.
- Provide a visible **"รีเซ็ตเดโม"** control that starts a fresh run.
- If the host's filesystem is ephemeral, re-seeding on restart is acceptable; state it in the README.

## 14. Milestones

Work in milestones. Finish, verify, commit, and deploy each one before starting the next, and continue without waiting for confirmation unless blocked. Check the system clock at each milestone and record it in `PROGRESS.md`. Target times: M1 by 13:30, M2 by 15:00, M3 by 16:00. When a milestone passes its target, finish the item in progress, drop the rest of that milestone, and move on. Items inside each milestone are in priority order, so the tail is the safest thing to cut. M4 always happens.

The 3D scene and the manager avatar depend only on the state read model, the event stream, and the popup components, so they can be built in a separate session or worktree once M0's shared types exist.

**M0 — foundation.** Save this file as `docs/SPEC.md`. Create `AGENTS.md` pointing to it, and `PROGRESS.md` with the milestones and the scenario checklist, updated as you go so a new session can resume. Scaffold the app with shadcn/ui, define shared TypeScript types for the state read model and the event stream, and build the deterministic seed with its checksum test. Scenario S1.

**M1 — the trust loop and the store math.**
1. Inventory, materials, and fulfillment events with their invariants and idempotent commands (section 6): S2, S3, S4.
2. Ad planner (sections 7.1–7.4): S5, S6, S7.
3. Impact chain (section 7.5): S8.
4. AI manager on the SONIC customer case end to end (sections 8.1 and 12.3): S9, S10.
5. Three-panel Thai UI with a 2D shop view that opens the same popups the 3D scene will use (sections 9.1, 9.2, 9.4).
6. Persistence, reset, an honest AI-disconnected state, and the first public deployment with its protections (section 13): S11, S12, S13, S22.

**M2 — autonomy the owner can see.**
1. Case triggers and autonomy levels (sections 8.2, 8.3): S14, S15.
2. Scorecard (section 8.4): S16.
3. Amount at risk (section 8.5): S17.
4. 3D shop, impact-chain highlight, and manager avatar (section 9.3): S18.
5. Daily brief and memory (section 11): S19.

**M3 — mega-campaign rehearsal** (section 10): S20.

**M4 — freeze at 16:00 (always).** Implement the guided demo before the freeze. Reserve M4 for verification, deployment and submission materials.
- Guided demo ("เริ่มเดโม"): starts a fresh run and shows a non-blocking coach panel of at most eight steps. Each step says what to click and what it proves, and advances when the expected state change is observed or the viewer presses next. It never fakes a result: if the AI is disconnected it says so and offers the steps that do not need it. S21.
- `docs/DEMO.md`: the same path, click by click, fitting in six minutes and naming the scenario each step proves.
- The documents in section 16 completed, the final deployment done, and the public link checked at 1440 and 390 px.

**Out of scope today:** flash-sale, voucher, and investment planners; return processing; finance and Business Insights workflows; Account Health; Seller Missions; news and competitor research; live web search; a simulated mailbox; simulated sync-failure events; slides and flow images beyond one architecture diagram in the README; any real Shopee connection.

## 15. Acceptance scenarios

Test business rules, authority, and persistence with meaningful expected outcomes, on data isolated from the running shop. Report only checks that were actually run and outcomes actually observed, and state which checks used fixtures and which called the real model.

| # | Test | Observable outcome |
| --- | --- | --- |
| S1 | Start a fresh seed | 9 listings, 13 variants, 4 inboxes, 4 campaigns, 3 cases, and every value in the checksum table of section 5.2. Planning opens on ROBOT with 407 available. SONIC is 2 / 1 / 1 on every page |
| S2 | Sell the last available SONIC unit at the physical shop | Physical 1, reserved 1, available 0. Desired quantity 0 is sent to the simulated Shopee endpoint and confirmed. The earlier chat proposal becomes stale, and the SONIC ad case reflects the change |
| S3 | Prepare the SONIC order | Generating documents does not mark it packed. Materials are consumed only when a human confirms packing. Physical and reserved decrease, and the parcel moves, only after carrier pickup |
| S4 | From a fresh shop: accept an online ROBOT order for 2 units → pack → carrier pickup → sell 3 at POS → receive 10 large boxes | Available 407→405 and queue 38→40. Packing returns the queue to 38 and consumes materials once. Pickup reduces physical and reserved without reducing available again. POS leaves 402 available and uses no packing materials. Free large boxes rise by 10. Every page and the plan read the latest values. Repeating any command with the same idempotency key changes nothing |
| S5 | Evaluate the discount example in section 7.4 | m = 64; 5 additional units recover ad spend; 13 total / 8 additional match the baseline; capacity for 10 is reported as insufficient |
| S6 | Open the ROBOT 1-day plan on a fresh seed | Every value in the ROBOT table of section 7.4, the primary message, and identical results from the UI and from `sim_calculate_plan` |
| S7 | Unknown cost; capacity 20; capacity 0; cash 0; cash null | No fabricated contribution or break-even when cost is unknown; what can be verified is still shown and the missing input is named. Explicit zeros are preserved and explained. No cash is distinguished from unknown cash |
| S8 | Impact chain for S6, then with capacity 20 | ยอดขายเพิ่ม is ตึง (2 required of 2 assumed); สต็อก (19 of 404), วัสดุแพ็ก (19 of 244), กำลังแพ็ก (19 of 25), and เงินสด (300 of 30,000) are พอ. With capacity 20 the packing node is ไม่พอ and marked คอขวด, and clicking it opens the packing workspace |
| S9 | The owner enables the acknowledgement message, then a new customer message arrives in the SONIC conversation | The acknowledgement is sent once for that waiting episode. The manager proposes a substantive reply based on current stock. The owner can ask follow-ups. Nothing substantive is sent until an option is chosen |
| S10 | The owner chooses a reply | Only the approved message goes to the approved conversation. The result is read back and shown. The question about next time is asked separately |
| S11 | Reload, restart, and reset | History and decisions survive reload and restart. Reset creates a new run and archives the old one, and work from the old run cannot change the new one |
| S12 | The AI key is missing or a call fails | The actual error is shown, no fixture is presented as AI output, the rest of the app works, and the manager recovers after retry |
| S13 | Build in an empty directory with no Shopee account or credentials | The seed is generated and the shop opens. S4 and S6 pass without any real Shopee call, and AI status is reported truthfully |
| S14 | Autonomy levels | Matching work at level 2 executes and names its policy and level. Work outside the limits waits. After pause or takeover, queued work cannot send. Three consecutive unedited approvals produce a proposal to raise the level, citing the cases. A failed readback lowers the level to 1 with a recorded reason |
| S15 | An advertised SKU runs out of stock | With authority, only that SKU's campaign is paused or reduced and the others are untouched. Increasing or enabling it again still needs the owner |
| S16 | Scorecard after S9–S15 | Every count matches the audit log and action receipts |
| S17 | Amount at risk | With SONIC at 0 available and its campaign active, the ad case shows 5 baht per hour (120 / 24) with its derivation. A case with missing inputs shows "ยังประเมินไม่ได้". The waiting queue is ordered by amount at risk |
| S18 | Click and hover products and the nine 3D locations; run a manager action | Each opens the correct popup over the scene with camera and plan preserved; hover does not change selection; the 2D and keyboard paths reach the same functions. The avatar moves on the recorded activity event and shows a check mark only after the readback |
| S19 | Advance the demo clock past 07:00 and trigger again | One brief for that date, listing autonomous work by level and waiting cases. The next simulated day produces a new brief |
| S20 | Run the default rehearsal on a fresh seed, choose a preparation option, and rerun | The live shop's state revision is unchanged. The result names what breaks first, with dates, from its own calculation. Before and after are shown side by side. Nothing is purchased. Identical inputs give identical results |
| S21 | Open the public link and press "เริ่มเดโม" | The guided steps run from a fresh run to the end without the team's help |
| S22 | Public demo protections | The API key appears in no response or bundle. Rate limits, the daily cap, the kill switch, and "รีเซ็ตเดโม" behave as described in section 13 |

Also run typecheck and build, and inspect the workflows in a real browser: nested popups, hover, product search, evaluation followed by visible results, empty and error states, 390 and 360 px layouts, and keyboard operation. Once the AI is connected, test it with at least one question and one proposal → approval → verification path.

## 16. Deliverables

- Application source with install, dev, build, start, test, and typecheck scripts in `package.json`, a lockfile, `.gitignore`, `.env.example`, and a Dockerfile.
- `README.md` with these sections: Problem, Solution, Build direction, Live demo link, How to run, Architecture (one Mermaid diagram), AI and simulated-data status, How Codex was used, What was built during the hackathon, Declarations (the pre-existing concept and specification, any earlier repositories as `TODO(team)`, and all open-source dependencies), and Limitations.
- `AGENTS.md`: working rules, the manager's scope, preservation of existing data, and a pointer to `docs/SPEC.md`.
- `PROGRESS.md`: milestones, scenario checklist, timestamps, and what was cut.
- `docs/WRITEUP.md`: problem, solution, build direction, and how Codex was utilised, ready to paste into the submission form.
- `docs/CODEX_LOG.md`: for each milestone, what was requested, what was built, which checks were run, and their actual results.
- `docs/DEMO.md` and `docs/VERIFICATION.md`, the latter listing the scenarios actually run, whether each used fixtures or the real model, and app screenshots that contain no personal information.

Begin by inspecting the machine and the directory, then follow the milestones. Make reversible implementation decisions on your own. If a real constraint blocks part of the work, name it precisely and continue with the work it does not affect. The intended outcome is **an owner who can control both the shop and its AI manager from the same data, see the consequences before choosing, and verify what happened afterwards**.
