# Simulator verification

The simulator was verified using fabricated data. The domain tests do not call Shopee, a model, a mail provider, or a remote site.

Run the domain tests with `node --test test/domain.test.mjs`. The HTTP checks used a temporary data directory and a loopback server on port 4399.

| Starter scenario | Domain or HTTP evidence |
| --- | --- |
| 1. Fresh seed | Verified 9 listings, 13 variants, 2,658 orders, and 2,657 paid orders. Historical sales reconcile to ฿974,414. The seven-day summary contains 600 orders and ฿221,056. ROBOT starts at 420 physical, 13 reserved, and 407 available. SONIC starts at 2 physical, 1 reserved, and 1 available. |
| 2. SONIC inquiry | Verified one acknowledgement per waiting episode when enabled. The fixture generated a stock-based option without sending the proposed reply. |
| 3. Owner approval | Verified the approved reply in the target conversation, the audit receipt, and the separate future policy question. |
| 4. Policy boundaries | Verified a matching repeat inquiry uses the policy, an inquiry with different wording remains open, and a paused manager or owner takeover prevents an older proposal from sending. Cross-case and explicit cross-conversation targets were rejected. |
| 5. Last SONIC sold through POS | Verified 1 physical, 1 reserved, 0 available. The older reply proposal became stale and the ads case used the updated availability. |
| 6. Ads with no stock | Verified owner-approved pause affected only SONIC. Server policy rules reject authorizing automatic campaign increases or enabling. |
| 7. Prepare and ship | Verified creating documents keeps the order in the picking queue. Packing consumes materials once. Carrier pickup changes physical and reserved quantities without reducing available units again. |
| 8. Return arrives | Verified receipt moves the return to awaiting inspection and leaves products unchanged. |
| 9. Sync failure and duplicates | Verified desired 0 and last confirmed 1 after failure, then confirmed 0 after retry. A duplicate command returns the original receipt. Reusing the same idempotency key for a different payload is rejected. |
| 10. ฿400 example | Verified ฿64 per unit, 5 incremental units to cover ads, and 13 total or 8 incremental to match the baseline. At 12 units the plan leaves ฿468, below the ฿500 baseline. |
| 11. Unknown inputs | Verified null product cost yields null contribution. A missing material yields unknown material capacity. |
| 12. Cash and inventory | Verified loan proceeds increase cash without adding revenue. Sales wait for inbound inventory. Purchase costs affect forecast cash up front and enter contribution only for purchased units forecast to sell. Loan principal reconciles across installments. |
| 13. Morning brief | Verified a failed simulated delivery leaves the brief available, a retry avoids duplication, and a new Thai calendar date generates a new brief. |
| 14. Workflows in the scene | Scene interaction and keyboard verification belong to the browser checks. |
| 15. Restart and reset | Verified local process restart preserves a simulated sale, destination stock, and the original receipt. The domain checks run IDs on new mutations. |
| 16. Disconnect | Backend failure and real model status belong to the integration checks. |
| 17. ROBOT ads | Verified 17 normal units and 19 total units. One extra unit leaves a ฿120.65 shortfall after ads and two leave ฿58.70. Remaining preparation capacity is 25, material capacity 244, and lowest planning cash ฿29,700. |
| 18. Zero vs unknown | Verified capacities of 20 and 0, explicit null capacity, and explicit 0 or null cash. A daily limit of 20 leaves no room for new work and the existing queue exceeds capacity by 18. |
| 19. ROBOT sequence | Verified 407 → 405 after accepting two units and 405 → 402 after subsequent pickup and POS sale of three. Packing removes two units from the queue and uses exactly two boxes. Receipt of ten boxes increases free boxes by ten. |
| 20. Stale forms and late responses | Planner interaction belongs to the browser checks. The calculator returns the run ID, revision, variant, and submitted inputs with its result. |
| 21. Full snapshot and model scope | Verified state exposes all 2,658 orders. The model receives the newest 50 plus related orders for the overview and only scoped detail for a case. Aggregates still use the complete dataset. Hosting transport belongs to the deployment checks. |
| 22. No Shopee account | Verified the seed, growth calculation, events, and local persistence using only the simulator. |

## Scope and assumptions

- The unit model uses one packing set per item sold and one parcel per online order. Stock reservations stay in place through packing and release at pickup. A received return requires inspection.
- The planning baseline uses the reproducible 28-day seed period. The capacity view estimates how many additional units the shop could pack using that period’s online product mix. Per-SKU material capacity depends on that SKU’s recipe and allocations to other products.
- Cash forecasts reserve marketing spend and pay for purchased goods at the start of the plan, use equal principal installments, and receive modeled payouts after the configured delay. Platform voucher values are separate from seller-funded costs. The forecast has no effect on simulated sales or account balances.
- The brief is generated when the demo clock is advanced to or beyond 07:00 in Bangkok for that day. This prototype keeps the latest eligible date when the clock jumps over earlier delivery times. Simulated email can be retried independently.
- The case fixtures are explicitly marked fixtures. These tests establish authorization, mutation, and readback behavior. Real Codex model and hosted-session outcomes are tracked separately.
- The sandbox uses a fixed simulated store and limited preparation, customer, and ad case templates. Account health, competitor observations, news, and settlements are simulated.
