import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { bodyLimit } from "hono/body-limit";
import { getConnInfo } from "@hono/node-server/conninfo";
import { z } from "zod";
import { Store, Conflict } from "./persistence";
import { readModel } from "./read-model";
import { Manager } from "./ai-bridge";
import { command } from "./operations";
import { calculatePlan, planSchema } from "../shared/planner";
import { rehearse, rehearsalSchema } from "../shared/rehearsal";
import { orderView } from "./fulfillment";
import type { StreamEvent } from "../shared/model";
const scope = z.object({ runId: z.string(), version: z.number().int() });
const room = scope.extend({
  room: z.string().max(160),
  variantId: z.string().max(160).optional(),
  rehearsal: rehearsalSchema.optional(),
  text: z.string().trim().min(1).max(1800),
});
export function api(store: Store) {
  const app = new Hono(),
    ai = new Manager(store),
    publicOrigin = process.env.PUBLIC_ORIGIN
      ? new URL(process.env.PUBLIC_ORIGIN).origin
      : "",
    shared =
      process.env.PUBLIC_DEMO_ENABLED === "true" &&
      store.shop.mode === "simulated";
  const scheduled = new Set<string>();
  const rates = new Map<string, { start: number; count: number }>();
  const take = (id: string, max: number) => {
    const now = Date.now();
    if (rates.size > 3000)
      for (const [key, v] of rates)
        if (v.start < now - 60000) rates.delete(key);
    let counter = rates.get(id);
    if (!counter || counter.start < now - 60000) {
      counter = { start: now, count: 0 };
      rates.set(id, counter);
    }
    return ++counter.count <= max;
  };
  app.get("/healthz", (c) => c.json({ ok: true, mode: store.shop.mode }));
  app.use(
    "/api/*",
    bodyLimit({
      maxSize: 32000,
      onError: (c) => c.json({ error: "ข้อความยาวเกินไป" }, 413),
    }),
  );
  app.use("/api/*", async (c, next) => {
    const peer = (getConnInfo(c).remote.address ?? "").replace(/^::ffff:/, "");
    const loopback = peer === "127.0.0.1" || peer === "::1";
    const host = c.req.header("host") ?? "",
      origin = c.req.header("origin"),
      local =
        loopback && /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host);
    if (
      !local &&
      (!shared || !publicOrigin || host !== new URL(publicOrigin).host)
    )
      return c.json({ error: "ไม่อนุญาตให้เข้าจากที่อยู่นี้" }, 403);
    if (
      origin &&
      origin !== publicOrigin &&
      !(
        local &&
        (/^https?:\/\/(localhost|127\.0\.0\.1)(:431[01])?$/.test(origin) ||
          origin === "http://" + host)
      )
    )
      return c.json({ error: "ต้นทางไม่ตรงกับร้าน" }, 403);
    if (
      c.req.method === "POST" &&
      !c.req.header("content-type")?.startsWith("application/json")
    )
      return c.json({ error: "รูปแบบข้อมูลไม่ถูกต้อง" }, 415);
    if (shared) {
      const ip =
        peer === process.env.TRUSTED_PROXY_IP
          ? (c.req.header("x-real-ip") ?? peer)
          : peer;
      const mutation = c.req.method === "POST",
        prefix = mutation ? "write" : "read";
      if (
        !take(prefix + ip, mutation ? 45 : 360) ||
        !take(prefix + "-global", mutation ? 240 : 2400)
      )
        return c.json({ error: "มีคำขอมากเกินไป โปรดลองใหม่ในอีกหนึ่งนาที" }, 429);
    }
    c.header("Cache-Control", "no-store");
    await next();
  });
  app.get("/api/state", (c) =>
    c.json(readModel(store.shop, store.owner, ai.status, shared)),
  );
  app.get("/api/orders", (c) => {
    const q = z
        .object({
          page: z.coerce.number().int().min(1).max(100000).default(1),
          stage: z.string().optional(),
          variantId: z.string().optional(),
        })
        .parse(c.req.query()),
      rows = store.shop.orders
        .filter(
          (o) =>
            (!q.stage || o.stage === q.stage) &&
            (!q.variantId || o.variantId === q.variantId),
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return c.json({
      total: rows.length,
      page: q.page,
      orders: rows.slice((q.page - 1) * 30, q.page * 30).map(orderView),
    });
  });
  app.get("/api/events", (c) =>
    streamSSE(c, async (stream) => {
      const send = (e: StreamEvent) => {
        void stream.writeSSE({ data: JSON.stringify(e) }).catch(() => {});
      };
      store.events.on("change", send);
      send({
        type: "state",
        runId: store.shop.runId,
        revision: store.shop.revision,
      });
      await new Promise<void>((resolve) => {
        const timer = setInterval(() => {
          void stream.write(": ping\n\n").catch(() => {});
        }, 15000);
        stream.onAbort(() => {
          clearInterval(timer);
          store.events.off("change", send);
          resolve();
        });
      });
    }),
  );
  function verify(body: unknown) {
    const r = scope.parse(body);
    if (r.runId !== store.shop.runId || r.version !== store.shop.revision)
      throw new Conflict("ข้อมูลเปลี่ยนแล้ว กรุณาประเมินใหม่");
  }
  app.post("/api/sim/plan", async (c) => {
    const b = await c.req.json();
    verify(b);
    return c.json(calculatePlan(store.shop, planSchema.parse(b.inputs)));
  });
  app.post("/api/sim/rehearsal", async (c) => {
    const b = await c.req.json();
    verify(b);
    return c.json(rehearse(store.shop, rehearsalSchema.parse(b.inputs)));
  });
  app.post("/api/sim/command", async (c) => {
    const b = await c.req.json(),
      r = await command(store, b);
    if (
      !scheduled.has(r.id) &&
      ["message", "online", "pos", "advance"].includes(b.type) &&
      !store.shop.paused &&
      ai.status.configured &&
      ai.status.enabled
    ) {
      scheduled.add(r.id);
      if (scheduled.size > 2000)
        scheduled.delete(scheduled.values().next().value!);
      const s = store.shop;
      const targets = s.cases.filter(
        (k) =>
          k.status === "open" &&
          (b.type === "message"
            ? k.type === "reply" && k.target === b.target
            : b.type === "advance"
              ? k.type === "prepare"
              : k.type === "ads" &&
                s.campaigns.some(
                  (a) => a.id === k.target && a.variantIds.includes(b.target),
                )),
      );
      for (const k of targets)
        void ai
          .start(
            { room: k.id, runId: s.runId, version: s.revision },
            "ตรวจเหตุการณ์ล่าสุดและเสนอทางเลือกตามสิทธิ์",
            "event",
          )
          .catch(() => {});
    }
    return c.json(r);
  });
  app.post("/api/memories", async (c) =>
    c.json(await command(store, { ...(await c.req.json()), type: "memory" })),
  );
  for (const path of ["/api/chat", "/api/sim/analyze"])
    app.post(path, async (c) => {
      const b = room.parse(await c.req.json());
      verify(b);
      return c.json(await ai.start(b, b.text), 202);
    });
  app.post("/api/ai/retry", async (c) => c.json(await ai.retry()));
  app.post("/api/ai/cancel", async (c) => {
    const b = await c.req.json();
    verify(b);
    return c.json(ai.cancel(z.string().parse(b.jobId)));
  });
  app.all("/api/*", (c) => c.json({ error: "ไม่พบคำสั่งที่ขอ" }, 404));
  app.notFound((c) => c.json({ error: "ไม่พบหน้าที่ขอ" }, 404));
  app.onError((err, c) => {
    const message =
      err instanceof z.ZodError
        ? "ข้อมูลไม่ถูกต้อง · " +
          err.issues
            .map((i) => i.path.join("."))
            .slice(0, 3)
            .join(", ")
        : err instanceof SyntaxError
          ? "อ่านข้อมูลคำขอไม่ได้"
          : err.message;
    return c.json({ error: message }, err instanceof Conflict ? 409 : 400);
  });
  return app;
}
