import { afterEach, expect, it, vi } from "vitest";
import { serve } from "@hono/node-server";
import { once } from "node:events";
import { createServer, get } from "node:http";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { api } from "../src/server/api";
import { Store } from "../src/server/persistence";
import { Manager } from "../src/server/ai-bridge";
import { command } from "../src/server/operations";
import { uid } from "../src/server/fulfillment";
const clean: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  await Promise.all(clean.splice(0).map((fn) => fn()));
  vi.unstubAllEnvs();
});
async function isolated() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "ranrao-public-"));
  clean.push(() => fs.rm(dir, { recursive: true, force: true }));
  return Store.open(dir);
}
it("S12 and S22 report missing credentials, actual upstream error, successful retry, daily cap across reset, and kill switch", async () => {
  const st = await isolated();
  vi.stubEnv("OPENAI_API_KEY", "");
  expect((await new Manager(st).retry()).error).toContain("OPENAI_API_KEY");
  let fail = true;
  const server = createServer((_req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.statusCode = fail ? 401 : 200;
    res.end(
      JSON.stringify(
        fail
          ? {
              error: {
                message: "invalid credentials",
                code: "invalid_api_key",
              },
            }
          : {
              id: "fixture",
              choices: [
                {
                  index: 0,
                  message: { role: "assistant", content: "พร้อม" },
                  finish_reason: "stop",
                },
              ],
            },
      ),
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  clean.push(async () => {
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
  });
  const a = server.address();
  if (!a || typeof a === "string") throw Error("No fixture port");
  vi.stubEnv("OPENAI_API_KEY", "fixture-publication-test-key");
  vi.stubEnv("OPENAI_BASE_URL", "http://127.0.0.1:" + a.port + "/v1");
  vi.stubEnv("AI_DAILY_CAP", "2");
  vi.stubEnv("DEMO_AI_ENABLED", "true");
  const manager = new Manager(st);
  expect((await manager.retry()).error).toContain("401");
  fail = false;
  expect((await manager.retry()).connected).toBe(true);
  await command(st, {
    type: "reset",
    runId: st.shop.runId,
    version: st.shop.revision,
    key: uid(),
  });
  expect((await manager.retry()).error).toContain("เพดาน");
  vi.stubEnv("DEMO_AI_ENABLED", "false");
  expect((await manager.retry()).error).toContain("ปิดการใช้ AI");
});
it("S13 and S22 enforce shared-demo host/origin, body limit, rate limits and key secrecy while shop math stays available", async () => {
  const st = await isolated();
  vi.stubEnv("PUBLIC_DEMO_ENABLED", "true");
  vi.stubEnv("PUBLIC_ORIGIN", "https://shop.example");
  vi.stubEnv("OPENAI_API_KEY", "fixture-publication-test-key");
  vi.stubEnv("DEMO_AI_ENABLED", "false");
  const app = api(st),
    server = serve({ fetch: app.fetch, hostname: "127.0.0.1", port: 0 });
  clean.push(async () => {
    if ("closeAllConnections" in server) server.closeAllConnections();
    await new Promise((r) => server.close(r));
  });
  if (!server.listening) await once(server, "listening");
  const a = server.address();
  if (!a || typeof a === "string") throw Error("No port");
  const url = "http://127.0.0.1:" + a.port;
  const send = (
    p: string,
    body: unknown,
    headers: Record<string, string> = {},
  ) =>
    fetch(url + p, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    });
  expect(
    await new Promise<number | undefined>((resolve, reject) =>
      get(url + "/api/state", { headers: { Host: "unknown.example" } }, (r) => {
        r.resume();
        resolve(r.statusCode);
      }).on("error", reject),
    ),
  ).toBe(403);
  expect(
    (await send("/api/sim/plan", {}, { Origin: "https://unrelated.example" }))
      .status,
  ).toBe(403);
  const state = await (await fetch(url + "/api/state")).text();
  expect(state).not.toContain("fixture-publication-test-key");
  expect(JSON.parse(state).total).toBe(2658);
  const result = await send("/api/sim/plan", {
    runId: st.shop.runId,
    version: st.shop.revision,
    inputs: { variantId: "sim-v1" },
  });
  expect((await result.json()).gain).toBe(5870);
  expect((await send("/api/chat", { text: "x".repeat(35000) })).status).toBe(
    413,
  );
  let last = 0;
  for (let n = 0; n < 50; n++) last = (await send("/api/ai/retry", {})).status;
  expect(last).toBe(429);
  expect((await fetch(url + "/api/state")).status).toBe(200);
});
