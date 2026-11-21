# Verification

Checked on 21 November 2026, Asia/Bangkok. The public shop, local preview, browser suite and unit tests use separate store directories. Destructive tests ran on disposable shops.

## Access

| Route | Observed result |
|---|---|
| [Local preview](http://127.0.0.1:4310) on the development Mac | The app returned its simulated health object and the bankzar shop. |
| Deployed container through the team's proxy host over private networking | Docker reported healthy. The deployed API returned bankzar, 2,658 orders, ฿221,056 for seven days and 38 units queued. Chromium opened the deployed ROBOT planner at widths of 1440 and 390 px through an SSH forward, evaluated the plan and displayed 19 required units at both sizes, with no horizontal overflow. |
| [Public hostname](https://ranrao.ipongs.com) | Cloudflare resolves the record. The public health endpoint returned the default proxy's plain-text OK and the state endpoint returned HTML. Site configuration is staged on the proxy host and requires an administrator to install it and reload Nginx. |
| OpenAI from the deployed container | The isolated live smoke command reported missing configuration and exited before inference. Live question, proposal and destination verification remain pending an API key. |

A successful public check requires the health endpoint to return JSON with `ok: true` and `mode: "simulated"`. The state response must identify `bankzar`, have a run ID and report `shared: true`.

## Reproducible checks

`npm run typecheck` and `npm run build` passed. Vitest passed 16 tests across five files. Playwright passed seven Chromium tests using the built client and actual Node API. Layout checks used widths of 1440, 390 and 360 px. Production builds emit a chunk-size advisory for the graphics dependencies.

| Scenario | What was exercised | Evidence and scope |
|---|---|---|
| S1 | Deterministic fresh seed | Identical seeds, 9 listings, 13 variants, 4 inboxes, 4 campaigns, 3 cases. Of 2,658 orders, 2,657 are paid, totaling ฿974,414. Checked SKU and free-supply totals and ROBOT 420/13/407, SONIC 2/1/1. |
| S2 | Last available SONIC sold at POS | Physical/reserved/available became 1/1/0. Channel desired and verified quantities reached zero, the prior proposal was rejected as stale and the ad case was updated. |
| S3 | Prepare, pack, hand to carrier | Proposal fixture prepared documents without consuming a box. Human confirmation consumed it. Pickup changed inventory and reservation. Chromium separately opened the generated documents. |
| S4 | Online order, pack, pickup, POS and restock | ROBOT availability 407→405, queue 38→40→38, three POS units left 402 available. Free large boxes increased by ten. Identical keys returned the original receipt and conflicting reuse was rejected. Ledger totals reconciled opening, current physical and reserved stock across seed and new orders. Chromium opened the ledger and recovered after a lost command response. |
| S5 | Discounted-margin calculator | At a ฿64 margin, five additional sales recover the spend, and 13 total or eight additional sales match baseline. With packing capacity set to ten, the plan reported a three-unit shortage against its 13-unit target. |
| S6 | One-day ROBOT plan | Calculator, production API and UI showed 19 units, two incremental units and ฿58.70 more contribution. Checked ฿179.35 per unit, 404 stock units allocated to online, packaging for 244, and packing for 25. |
| S7 | Missing costs and explicit zeros | Unknown cost propagated to margin and break-even. With zero capacity the shop accepts no new units. Zero starting cash reached −฿300 while unknown cash remained unknown. |
| S8 | Impact chain and constrained packing | Seed statuses were tight, sufficient, sufficient, sufficient, sufficient. At capacity 20 the existing queue exceeded capacity by 18. Chromium opened the packing station from the bottleneck and switched to its materials tab. |
| S9 | New SONIC inquiry and acknowledgement | Domain fixture verified one acknowledgement per waiting episode and the scoped reply decision. The scripted provider exercised a proposal. Natural-language follow-ups against a real model remain pending. |
| S10 | Owner chooses reply and inspects result | Scripted provider plus real SDK/tool execution and domain tests. The approved conversation received the selected reply, its message ID matched the receipt and a separate authority prompt was enabled. |
| S11 | Reopen, archive and reject old work | Reopening from disk preserved receipts and memory. Reset archived the prior run. A delayed provider response and an old browser command could not mutate the new run. Two browser tabs observed shared updates. |
| S12 | Disconnection and recovery | Removed key, scripted provider 401 and subsequent successful retry were exercised. Chromium showed offline status while planning, inventory and brief workflows remained available. |
| S13 | Start without shop or seller credentials | Fresh temporary store initialization, Docker startup, transactions and ad planning used the simulated shop. Checked the deployed API over the private network. |
| S14 | Authority, limits, takeover and demotion | Domain fixtures exercised a three-approval streak, bounded level-2 action with receipt, rejection after pause/takeover and lowering to level 1 after an uncertain result. |
| S15 | Advertised stockout | For SONIC the targeted campaign alone paused. For partly depleted KISS, an available sibling kept the action with the owner. Increasing spend requires an owner decision. |
| S16 | Receipt-based scorecard | Checked four verified outcomes including one autonomous action. A later uncertain readback incremented the separate uncertainty count. |
| S17 | Money at risk | A stockout with ฿120/day in active ads produced ฿5/hour and ฿15 over three hours. Missing evidence returned an unknown amount. |
| S18 | Product and station popups | Nine stations opened and closed by keyboard. The nested planner restored focus. Browser spot checks covered pointer targeting, 2D fallback and recorded read/verified/uncertain activity states. |
| S19 | 07:00 brief | Repeated triggers on 2 October created one brief. Advancing to 3 October produced another. Replayed the first threshold in Chromium with two open tabs. |
| S20 | Campaign rehearsal | Same inputs gave identical results without changing the operational revision. On ×5 demand SONIC constrained sales on 8 October. On 10 October the queue was 395 versus capacity 120. Initial misses totaled 275. Combined preparations reduced them to zero. Large boxes, labels and ink initially ran short by 11, 32 and 19.8 ml respectively. Saving the rehearsal created reminders. |
| S21 | Guided tour | Chromium started a fresh run, observed the reset, advanced through all seven coach steps and closed the tour on a disposable shop. Public-domain walkthrough and live AI steps remain pending. |
| S22 | Public-mode protections | Integration tests exercised origin and Host checks, payload sizes, per-IP and global rate limits, daily cap across reset, kill switch, retry and secret redaction. A fixture key was also checked against the built frontend. |

The OpenAI protocol fixture listens on a local ephemeral port inside the test suite. Application startup serves the real SDK integration. To exercise a configured provider on an isolated temporary shop, run `npm run test:live` in the service environment. The command checks a planning tool call, a proposal, owner approval and the delivered message receipt.

## Screenshots

All four images show the synthetic bankzar store.

- [Desktop shop and gallery](screenshots/shop-desktop.png)
- [ROBOT ad evaluation](screenshots/robot-plan.png)
- [Before-and-after campaign rehearsal](screenshots/campaign-rehearsal.png)
- [390 px mobile shop](screenshots/shop-mobile.png)
