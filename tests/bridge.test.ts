import { it, expect, vi } from "vitest";
import { createServer } from "node:http";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Store } from "../src/server/persistence";
import { Manager } from "../src/server/ai-bridge";
import { command } from "../src/server/operations";
import { scopeContext, useTool } from "../src/server/manager-tools";
import { uid } from "../src/server/fulfillment";
it("uses a scripted OpenAI protocol fixture for proposal, approval, receipt and a reset while inference is in flight", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "ranrao-bridge-")),
    st = await Store.open(dir);
  let calls = 0,
    release: () => void = () => {},
    started: () => void = () => {};
  const arrived = new Promise<void>((r) => (started = r)),
    gate = new Promise<void>((r) => (release = r));
  const upstream = createServer(async (req, res) => {
    let request = "";
    for await (const chunk of req) request += chunk;
    const body = JSON.parse(request);
    calls++;
    const propose = {
      role: "assistant",
      content: null,
      tool_calls: [
        {
          id: "fixture-call",
          type: "function",
          function: {
            name: "sim_propose_options",
            arguments: JSON.stringify({
              options: [
                {
                  action: "customer_reply",
                  text: "เหลือขาย 1 ชิ้นค่ะ",
                  reason: "อ่านยอดพร้อมขายล่าสุด",
                },
              ],
            }),
          },
        },
      ],
    };
    if (calls === 3) {
      started();
      await gate;
    }
    const message =
      calls === 2 ||
      body.messages.some((m: { role: string }) => m.role === "tool")
        ? { role: "assistant", content: "เตรียมทางเลือกให้เจ้าของแล้วค่ะ" }
        : propose;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        id: "fixture",
        object: "chat.completion",
        choices: [
          {
            index: 0,
            message,
            finish_reason: message.content ? "stop" : "tool_calls",
          },
        ],
      }),
    );
  });
  await new Promise<void>((r) => upstream.listen(0, "127.0.0.1", r));
  const a = upstream.address();
  if (!a || typeof a === "string") throw Error("fixture port");
  vi.stubEnv("OPENAI_BASE_URL", "http://127.0.0.1:" + a.port + "/v1");
  vi.stubEnv("OPENAI_API_KEY", "fixture-key");
  vi.stubEnv("DEMO_AI_ENABLED", "true");
  vi.stubEnv("AI_DAILY_CAP", "10");
  try {
    const ai = new Manager(st),
      room = {
        runId: st.shop.runId,
        version: st.shop.revision,
        room: "sim-case-1",
      };
    await ai.start(room, "เตรียมคำตอบ");
    await vi.waitFor(() => expect(ai.status.jobs.at(-1)?.status).toBe("done"));
    expect(st.shop.conversations[0].messages).toHaveLength(1);
    const pr = st.shop.proposals[0],
      receipt = await command(st, {
        runId: st.shop.runId,
        version: st.shop.revision,
        key: uid(),
        type: "choose",
        target: pr.id,
        option: pr.options[0].id,
      });
    expect(st.shop.conversations[0].messages.at(-1)?.id).toBe(
      receipt.verification,
    );
    const old = st.shop.runId;
    await ai.start(
      { room: "overview", runId: old, version: st.shop.revision },
      "ดูข้อมูล",
    );
    await arrived;
    await command(st, {
      type: "reset",
      runId: old,
      version: st.shop.revision,
      key: uid(),
    });
    release();
    await new Promise((r) => setTimeout(r, 90));
    expect(st.shop.runId).not.toBe(old);
    expect(st.shop.proposals).toHaveLength(0);
    expect(st.owner.chat).toHaveLength(0);
    const ctx = scopeContext(st.shop, st.owner, {
      runId: st.shop.runId,
      version: st.shop.revision,
      room: "sim-case-1",
    });
    expect(ctx.selectedVariant).not.toHaveProperty("cost");
    expect(ctx.displayBaht).not.toHaveProperty("planningCash");
    expect(ctx.ownerMemory).toEqual([]);
    const rehearsal = {
      room: "rehearsal",
      rehearsal: { date: "2026-10-10", multiplier: 5 },
      runId: st.shop.runId,
      version: st.shop.revision,
    };
    await useTool(st, rehearsal, "sim_propose_options", {
      preparationIds: ["both"],
    });
    expect(st.owner.rehearsalProposals[0]).toMatchObject({
      optionIds: ["both"],
      version: rehearsal.version,
    });
    await expect(
      useTool(st, rehearsal, "sim_propose_options", {
        preparationIds: ["purchase"],
      }),
    ).rejects.toThrow();
  } finally {
    release();
    vi.unstubAllEnvs();
    upstream.closeAllConnections();
    await new Promise((r) => upstream.close(r));
    await fs.rm(dir, { recursive: true, force: true });
  }
});
