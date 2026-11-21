# Codex build log

Milestone entries record implementation and observed checks. Times are Asia/Bangkok.

## M0 — foundation

Scaffolded the Vite/Hono project, installed the official shadcn toolchain, wrote the canonical specification and generated actual deterministic orders. Vitest validated the 28-day SKU totals, seven-day sales, available inventory and packing material checksum. Typecheck passed.

## M1 — store and manager

Built the Hono API, atomic persistence, scoped function calls, retail workflows, shared calculator and Thai UI. The app is built from this hackathon branch. The original main advanced with a different laptop-relay implementation; its history was preserved. On the first deployment lab_vm read the real 2,658-order state from lab2_vm. Fifteen deterministic domain/API tests and five Chromium tests passed locally. Live model verification requires a configured key.
