# Store runtime

## One simulated shop

React reads the shop through the Node API. The 3D renderer and the 2D workflows use variant and case identifiers from that response. Orders store individual selling units and channel. A pack of 20 CDs is one selling unit. Dashboard aggregates use all qualifying paid orders in the reporting window.

The read model derives available stock, material reservations, preparation queues and sales history from the same shop. Accepting an online order reserves units. Packing consumes the recipe once. Collection reduces physical and reserved quantities together. POS uses sellable stock directly. Returns stay outside sellable inventory until inspection.

## Planning

The four planning modes use server/domain/growth-planner.mjs. Previewing a plan is a read operation. Forecast demand combines historical demand with an editable multiplier and incremental conversions. The simulator rounds quantities after combining demand and constrains them by stock after POS allowances, committed materials, preparation capacity and quota.

For advertising, recovering the budget alone requires enough extra units to cover the budget at the new unit contribution. To match the original plan, the calculation also restores the contribution from normal sales at their original economics. The cash timeline distinguishes the cost of goods sold from the timing of purchases, settlements, borrowing and repayment.

## Decisions and model access

The manager controller queues jobs and reads the shop in the room and case selected by the owner. It starts an ephemeral Codex thread with that context and recent conversation history, through stdio. The installed Codex app-server protocol is the integration contract. The model uses dynamic tools for shop evidence, calculations and proposals. When the owner selects an option the domain handler applies it, records the resulting receipt and provides verification. Preparation creates documents. Shipment progression uses separate human and simulated carrier commands.

A dedicated Codex process reads the machine's selected model and uses its existing login. It launches with an empty working directory and environment list, disables shell, plugins, computer access, agents and MCP integrations, and denies approval requests. The app exposes a separate research mode for owner-selected live searches. Responses consume the connected Codex account's quota.

## Persistence and hosting

Each local run has its own directory holding simulator.json and store.json. Writes use a temporary file and atomic rename. The active-run pointer changes after new files are ready. One Node process per data directory is the supported deployment model.

The deployable Worker serves the built frontend and a latest snapshot. The gateway checks the demo flag, shop mode, origin, heartbeat and command scope. A private-mode deployment additionally needs OWNER_SITE_ID and an authenticated matching Sites identity. Relay endpoints require RELAY_SECRET.

The outbound relay launches another loopback-only process and seeds a separate persistent data directory. It publishes the complete snapshot on change and monitors reachability independently. R2 stores queue, claim, snapshot and result objects. A conditional write claims each command once. A relay journal preserves its reply before upload, and reports uncertainty if interrupted after a claim. Commands in an uncertain state require checking the shop before trying again. Snapshot and result transport accepts 2 MB of JSON or a gzip envelope up to 2 MB expanding to 8 MB.

If the local machine stops responding for 15 seconds the Site displays its saved snapshot and stops taking new commands. Restart the relay from the same directory to resume. Old queue, result and run records require operator retention management for longer-lived installations.

[Codex app-server protocol](https://developers.openai.com/codex/app-server/)
