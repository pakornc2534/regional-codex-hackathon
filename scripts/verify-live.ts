import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { existsSync } from "node:fs";
import { Store } from "../src/server/persistence";
import { Manager } from "../src/server/ai-bridge";
import { command } from "../src/server/operations";
import { uid } from "../src/server/fulfillment";

if (existsSync(".env")) process.loadEnvFile(".env");
if (!process.env.OPENAI_API_KEY || process.env.DEMO_AI_ENABLED === "false") {
  console.error(
    "Live verification unavailable. Configure the OpenAI API key and enable the model on this host.",
  );
  process.exit(2);
}
if (
  process.env.OPENAI_BASE_URL &&
  new URL(process.env.OPENAI_BASE_URL).origin !== "https://api.openai.com"
)
  throw Error("Live verification requires the official OpenAI endpoint.");
const dir = await fs.mkdtemp(path.join(os.tmpdir(), "ranrao-live-"));
try {
  const store = await Store.open(dir),
    manager = new Manager(store);
  const ask = async (room: string, text: string) => {
    const job = await manager.start(
      {
        room,
        runId: store.shop.runId,
        version: store.shop.revision,
        variantId: "sim-v1",
      },
      text,
    );
    const deadline = Date.now() + 160000;
    while (Date.now() < deadline) {
      const state = manager.status.jobs.find((j) => j.id === job.id);
      if (state?.status === "done") return;
      if (state?.status === "failed" || state?.status === "cancelled")
        throw Error(state.error ?? state.status);
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    manager.cancel(job.id);
    throw Error(
      "The live model did not finish within the verification window.",
    );
  };
  await ask(
    "planning",
    "ประเมินแผน ROBOT หนึ่งวันโดยใช้ค่าเริ่มต้น แล้วบอกว่าต้องขายเพิ่มกี่ชิ้น",
  );
  if (
    !store.shop.activity.some((e) => e.tool === "sim_calculate_plan") ||
    !store.owner.chat.some((m) => m.role === "manager")
  )
    throw Error("The model did not use the calculator and answer.");
  await ask(
    "sim-case-1",
    "ตรวจสต็อก SONIC และเสนอข้อความสั้นที่จะส่งให้ลูกค้าผ่านเครื่องมือ รอให้ฉันเลือกก่อน",
  );
  const proposal = store.shop.proposals.find(
    (p) =>
      p.caseId === "sim-case-1" && p.source === "ai" && p.status === "proposed",
  );
  if (
    !proposal ||
    store.shop.conversations[0].messages.some((m) => m.role === "manager")
  )
    throw Error("The approval boundary was not observed.");
  const choice = proposal.options.find((o) => o.action === "customer_reply");
  if (!choice) throw Error("No scoped customer reply was proposed.");
  const r = await command(store, {
    type: "choose",
    target: proposal.id,
    option: choice.id,
    runId: store.shop.runId,
    version: store.shop.revision,
    key: uid(),
  });
  if (
    r.status !== "verified" ||
    !store.shop.conversations[0].messages.some(
      (m) => m.id === r.verification && m.text === choice.text,
    )
  )
    throw Error("The selected message did not match its readback.");
  console.log(
    "Live OpenAI checks passed: calculator answer, scoped proposal, explicit approval and matching destination receipt.",
  );
} finally {
  await fs.rm(dir, { recursive: true, force: true });
}
