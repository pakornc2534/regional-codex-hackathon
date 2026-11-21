# Verification

## Local fixture and real model

The seeded shop has 2,658 orders. The 2,657 paid orders total ฿974,414. The seven-day reporting window contains 600 paid orders and ฿221,056. The model overview sampled 50 detail rows and reported 2,608 omitted while preserving whole-shop totals. The initial 1-day ROBOT plan returned 17 baseline units, 19 supported units, two additional units, 244 material sets, 25 preparation slots and ฿29,700 minimum planning cash.

A real logged-in Codex app-server processed the Sonic customer case on an isolated local API. The manager checked that physical stock was 2, reserved stock 1 and available stock 1. It saved an AI proposal. The test selected that option as owner, read back the target conversation and matched the exact approved text to the single newly delivered message.

The automated suite covers immutable previews, duplicate commands, approvals and cross-case scope, reserve/pack/collect/POS and material receipts, synchronization failure, returns, daily brief/mail delivery, current-run persistence, payload limits and stale or unauthorized relay requests. The transport tests round-trip a synthetic 30,000-record snapshot and reject a corrupt gzip envelope and an expansion beyond the permitted size.

## Reproduce

Run `npm test`, `npm run typecheck` and `npm run build`. For the genuine manager cycle, start the API with a fresh temporary DATA_DIR and run `TEST_ORIGIN=http://127.0.0.1:4310 node scripts/check-manager.mjs`. This sends one message in that disposable simulated world. For an informational model question only, add `READ_ONLY=1`.

The fake inbox and carrier events do not validate any actual Shopee or email service. Figures depend on the current shared demo state. For reproducible seed values, use an isolated local shop.
