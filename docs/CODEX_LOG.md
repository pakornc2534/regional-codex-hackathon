# Codex build log

Milestone entries record implementation and observed checks. Times are Asia/Bangkok.

## M0 — foundation

Scaffolded the Vite/Hono project, installed the official shadcn toolchain, wrote the canonical specification and generated actual deterministic orders. Vitest validated the 28-day SKU totals, seven-day sales, available inventory and packing material checksum. Typecheck passed.

## M1 — store and manager

Built the Hono API, atomic persistence, scoped function calls, retail workflows, shared calculator and Thai UI. The app is built from this hackathon branch. The original main advanced with a different laptop-relay implementation; its history was preserved. On the first deployment lab_vm read the real 2,658-order state from lab2_vm. Fifteen deterministic domain/API tests and five Chromium tests passed locally. Live model verification requires a configured key.

## M2 — owner authority and gallery

Separated customer messages from owner conversations. The UI links a verified action to the actual delivered message, records policy changes and exposes the common three-hour risk estimate. Case fixtures verified first approval, three consecutive approvals, level-2 scope limits, takeover, demotion after uncertain readback and partial KISS stockouts. The gallery uses local geometry and a matching Canvas 2D path. Chromium exercised nested dialogs, keyboard selection, SSE reset and all three viewport sizes. Five browser checks passed.

## M3 — campaign rehearsal

Built day-by-day fractional baseline allocation, stock and material reservation, competing packing work, delayed settlements, cash expenses and preparation lead times. On the default October fork SONIC stock first limited sales on 8 October. The 10 October packing load reached 395 units against capacity of 120. Added controls for comparing both runs and attaching only calculated preparation IDs to a scoped manager recommendation. The selected combined option reduced simulated deadline misses from 275 to zero. Saving preserved the operational revision.

## M4 — guided demo, deployment and evidence

Exercised the seven-step coach on a disposable run, corrected navigation from an insufficient packing forecast into the packing station and verified both its orders and materials tabs. Reconciled the SKU movement history against its opening inventory and current reservations, including seed orders and subsequent transactions. Prepared the six-minute walkthrough, submission writeup and four screenshots. The final local checks passed TypeScript, the Vite build, 16 Vitest tests and seven Chromium tests. Domain and provider-protocol fixtures are identified in the [scenario record](VERIFICATION.md).

The application container responded through the private proxy-to-app route. Chromium evaluated the deployed planner at 1440 and 390 px over that route. The Cloudflare DNS record resolved, but the public health and state requests still reached the default Nginx site. The site file is staged for installation by a proxy administrator. The container's live smoke check reported that the OpenAI key is missing.
