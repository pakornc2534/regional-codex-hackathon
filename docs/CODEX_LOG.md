# Codex build log

Milestone entries record implementation and observed checks. Times are Asia/Bangkok.

## M0 — foundation

Scaffolded the Vite/Hono project, installed the official shadcn toolchain, wrote the canonical specification and generated actual deterministic orders. Vitest validated the 28-day SKU totals, seven-day sales, available inventory and packing material checksum. Typecheck passed.

## M1 — store and manager

Built the Hono API, atomic persistence, scoped function calls, retail workflows, shared calculator and Thai UI. The app is built from this hackathon branch. The original main advanced with a different laptop-relay implementation; its history was preserved. On the first deployment lab_vm read the real 2,658-order state from lab2_vm. Fifteen deterministic domain/API tests and five Chromium tests passed locally. Live model verification requires a configured key.

## M2 — owner authority and gallery

Separated customer messages from owner conversations. The UI links a verified action to the actual delivered message, records policy changes and exposes the common three-hour risk estimate. Case fixtures verified first approval, three consecutive approvals, level-2 scope limits, takeover, demotion after uncertain readback and partial KISS stockouts. The gallery uses local geometry and a matching Canvas 2D path. Chromium exercised nested dialogs, keyboard selection, SSE reset and all three viewport sizes. Five browser checks passed.
