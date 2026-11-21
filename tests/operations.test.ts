import { afterEach, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Store } from "../src/server/persistence";
import { command, type Command } from "../src/server/operations";
import { facts } from "../src/shared/facts";
import {
  covers,
  perform,
  policyOf,
  provision,
  risk,
  score,
} from "../src/server/manager-controller";
import { uid } from "../src/server/fulfillment";
import { scopeContext, useTool } from "../src/server/manager-tools";
import { rehearse } from "../src/shared/rehearsal";
import type { Receipt, Action } from "../src/shared/model";
const dirs: string[] = [];
async function setup() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "ranrao-"));
  dirs.push(dir);
  return Store.open(dir);
}
afterEach(async () => {
  await Promise.all(
    dirs.splice(0).map((d) => fs.rm(d, { recursive: true, force: true })),
  );
});
type Payload = Command extends infer T
  ? T extends unknown
    ? Omit<T, "runId" | "version" | "key">
    : never
  : never;
const send = (store: Store, body: Payload) =>
  command(store, {
    ...body,
    runId: store.shop.runId,
    version: store.shop.revision,
    key: uid(),
  });
async function proposal(
  st: Store,
  caseId = "sim-case-1",
  action: Action = "customer_reply",
) {
  const k = st.shop.cases.find((k) => k.id === caseId)!;
  const id = uid(),
    option = uid();
  await st.run((s) => {
    s.proposals.push({
      id,
      caseId: k.id,
      source: "fixture",
      version: s.revision,
      status: "proposed",
      options: [
        {
          id: option,
          action,
          text: "ตรวจแล้วค่ะ เหลือขาย 1 ชิ้น",
          reason: "อ่านจากสต็อกที่ตรวจสอบแล้ว",
        },
      ],
    });
  });
  return { target: id, option };
}
it("S2 invalidates an older reply after selling the last SONIC and reads back channel stock", async () => {
  const st = await setup(),
    p = await proposal(st);
  await send(st, { type: "pos", target: "sim-v11", qty: 1 });
  expect(facts(st.shop).variants[10]).toMatchObject({
    physical: 1,
    reserved: 1,
    available: 0,
  });
  expect(st.shop.sync[10]).toMatchObject({ desired: 0, verified: 0 });
  await expect(send(st, { type: "choose", ...p })).rejects.toThrow("ข้อมูลเก่า");
  expect(st.shop.cases[2].evidence).toContain("0 ชิ้น");
});
it("S3 documents leave the SONIC parcel untouched, then human packing and carrier events advance it", async () => {
  const st = await setup(),
    id = st.shop.cases[1].orderIds[0],
    p = await proposal(st, "sim-case-2", "prepare_order"),
    before = st.shop.supplies[0].quantity;
  await send(st, { type: "choose", ...p });
  expect(st.shop.orders.find((o) => o.id === id)).toMatchObject({
    stage: "waiting",
    documents: true,
  });
  expect(st.shop.supplies[0].quantity).toBe(before);
  await send(st, { type: "pack", target: id });
  expect(st.shop.supplies[0].quantity).toBe(before - 1);
  await send(st, { type: "pickup", target: id });
  expect(facts(st.shop).variants[10]).toMatchObject({
    physical: 1,
    reserved: 0,
    available: 1,
  });
});
it("S4 executes the ROBOT sequence once, rejects conflicting keys and serializes simultaneous stock mutations", async () => {
  const st = await setup();
  async function twice(b: Payload) {
    const c = {
      ...b,
      runId: st.shop.runId,
      version: st.shop.revision,
      key: uid(),
    };
    const [a, duplicate] = await Promise.all([command(st, c), command(st, c)]);
    expect(a).toEqual(duplicate);
    return a;
  }
  const o = await twice({ type: "online", target: "sim-v1", qty: 2 });
  expect([facts(st.shop).variants[0].available, facts(st.shop).queue]).toEqual([
    405, 40,
  ]);
  await twice({ type: "pack", target: String(o.after) });
  expect(facts(st.shop).queue).toBe(38);
  expect(st.shop.supplies[1].quantity).toBe(258);
  await twice({ type: "pickup", target: String(o.after) });
  expect(facts(st.shop).variants[0]).toMatchObject({
    physical: 418,
    reserved: 13,
    available: 405,
  });
  await twice({ type: "pos", target: "sim-v1", qty: 3 });
  expect(facts(st.shop).variants[0].available).toBe(402);
  const free = facts(st.shop).supplies[1].free;
  const receipt = await twice({ type: "receive", target: "sim-m1", qty: 10 });
  expect(facts(st.shop).supplies[1].free).toBe(free + 10);
  await expect(
    command(st, {
      key: receipt.id,
      runId: st.shop.runId,
      version: st.shop.revision,
      type: "receive",
      target: "sim-m1",
      qty: 11,
    }),
  ).rejects.toThrow("รหัสคำสั่ง");
});
it("S9 and S10 send one acknowledgement per waiting episode and only the chosen reply to its scoped inbox", async () => {
  const st = await setup(),
    target = "sim-inbox-1",
    n = st.shop.conversations[1].messages.length;
  await send(st, { type: "ack", enabled: true });
  await send(st, { type: "message", target, text: "ยังมีไหม" });
  await send(st, { type: "message", target, text: "ขอสอบถามอีกรอบ" });
  expect(
    st.shop.conversations[0].messages.filter((m) => m.role === "manager"),
  ).toHaveLength(1);
  const p = await proposal(st),
    r = await send(st, { type: "choose", ...p });
  expect(r.status).toBe("verified");
  expect(st.shop.conversations[0].messages.at(-1)?.id).toBe(r.verification);
  expect(st.shop.conversations[1].messages.length).toBe(n);
  expect(st.shop.policies[0]).toMatchObject({ followup: true, level: 1 });
  await send(st, { type: "message", target, text: "แล้วราคาเท่าไร" });
  expect(st.shop.conversations[0].episode).toBe(2);
});
it("S11 persists, archives policy evidence and rejects work from an earlier run, including delayed AI tools", async () => {
  const st = await setup(),
    before = { runId: st.shop.runId, version: st.shop.revision };
  await send(st, { type: "memory", text: "ใช้กล่องที่ร้านมีอยู่" });
  await send(st, { type: "choose", ...(await proposal(st)) });
  const reopened = await Store.open(st.dir);
  expect(reopened.owner.memories).toHaveLength(1);
  expect(reopened.shop.receipts).toEqual(st.shop.receipts);
  await send(reopened, { type: "reset" });
  const archive = JSON.parse(
    await fs.readFile(
      path.join(st.dir, "archives", before.runId + ".json"),
      "utf8",
    ),
  );
  expect(archive.shop.policies.length).toBe(1);
  await expect(
    command(reopened, {
      ...before,
      type: "pos",
      target: "sim-v11",
      qty: 1,
      key: uid(),
    }),
  ).rejects.toThrow("เปลี่ยน");
  await expect(
    useTool(reopened, { ...before, room: "sim-case-1" }, "sim_get_context", {}),
  ).rejects.toThrow("เปลี่ยน");
});
it("S14 covers approval streaks, takeover, bounds and uncertain readback; S16 counts receipt-backed outcomes", async () => {
  const st = await setup(),
    target = "sim-inbox-1";
  let id = "sim-case-1";
  for (let i = 0; i < 3; i++) {
    if (i) {
      await send(st, { type: "message", target, text: "สอบถามอีกครั้ง" });
      id = st.shop.cases.find(
        (c) => c.target === target && c.status === "open",
      )!.id;
    }
    await send(st, { type: "choose", ...(await proposal(st, id)) });
  }
  expect(st.shop.policies[0].streak).toHaveLength(3);
  await send(st, {
    type: "policy",
    target: id,
    action: "customer_reply",
    level: 2,
    limit: 1,
  });
  await send(st, { type: "message", target, text: "สินค้ายังเหลือไหม" });
  id = st.shop.cases.find(
    (c) => c.target === target && c.status === "open",
  )!.id;
  let p = await proposal(st, id);
  const tool = () =>
    useTool(
      st,
      { runId: st.shop.runId, version: st.shop.revision, room: id },
      "sim_execute_approved",
      { proposalId: p.target, optionId: p.option },
    );
  await tool();
  expect(st.shop.receipts.at(-1)).toMatchObject({
    level: 2,
    status: "verified",
    policy: target + "/customer_reply",
  });
  expect(score(st.shop)).toMatchObject({ verified: 4, autonomous: 1 });
  await send(st, { type: "message", target, text: "อีกรอบ" });
  id = st.shop.cases.find(
    (c) => c.target === target && c.status === "open",
  )!.id;
  p = await proposal(st, id);
  await send(st, { type: "takeover", target });
  await expect(tool()).rejects.toThrow();
  await send(st, { type: "handback", target });
  await send(st, { type: "control", paused: true });
  await expect(tool()).rejects.toThrow();
  await send(st, { type: "control", paused: false });
  await st.run((s) => {
    const k = s.cases.find((k) => k.id === id)!,
      pol = policyOf(s, k, "customer_reply")!,
      o = s.proposals.at(-1)!.options[0];
    pol.limit = 0;
    expect(covers(s, k, o, pol)).toBe(false);
    pol.limit = 1;
    const r = {
      id: uid(),
      type: "autonomous",
      at: s.clock,
      status: "executing",
      target: k.target,
    } as Receipt;
    perform(s, k, o, false, r, () => false);
    s.receipts.push(r);
    expect(pol.level).toBe(1);
    expect(pol.history.at(-1)?.reason).toContain("ตรวจผลไม่ได้");
  });
  expect(score(st.shop).uncertain).toBe(1);
});
it("S15 and S17 distinguish a single sold-out campaign from a partly available multi-variant KISS listing", async () => {
  const st = await setup();
  await send(st, { type: "pos", target: "sim-v11", qty: 1 });
  let s = st.shop;
  expect(risk(s, s.cases[2])).toEqual({
    value: 1500,
    detail: "120 ÷ 24 = 5 บาท/ชั่วโมง · 15 บาทใน 3 ชั่วโมง",
  });
  await st.run((s) => {
    const c = s.cases[2],
      p = provision(s, c, "pause");
    p.level = 2;
    p.limit = 12000;
  });
  const p = await proposal(st, "sim-case-3", "pause");
  await useTool(
    st,
    { runId: s.runId, version: s.revision, room: "sim-case-3" },
    "sim_execute_approved",
    { proposalId: p.target, optionId: p.option },
  );
  expect(st.shop.campaigns.map((c) => c.status)).toEqual([
    "paused",
    "active",
    "active",
    "active",
  ]);
  await expect(
    send(st, {
      type: "policy",
      target: "sim-case-3",
      action: "enable",
      level: 3,
      limit: 1000,
    }),
  ).rejects.toThrow();
  await send(st, {
    type: "pos",
    target: "sim-v5",
    qty: facts(st.shop).variants[4].available,
  });
  s = st.shop;
  const k = s.cases.find((c) => c.target === "sim-ad-2")!;
  expect(k.evidence).toContain("KISS-S-PH");
  const pol = provision(s, k, "pause");
  pol.level = 2;
  pol.limit = 20000;
  expect(
    covers(s, k, { id: "test", action: "pause", text: "", reason: "" }, pol),
  ).toBe(false);
  expect(risk(s, k).value).toBeNull();
});
it("S19 generates one 07:00 brief per date and carries saved reminders", async () => {
  const st = await setup();
  await send(st, { type: "advance", minutes: 10 });
  await send(st, { type: "advance", minutes: 10 });
  expect(st.shop.briefs.map((b) => b.date)).toEqual(["2026-10-02"]);
  await send(st, { type: "advance", minutes: 1440 });
  expect(st.shop.briefs[1].date).toBe("2026-10-03");
  expect(st.shop.briefs[0].waiting).toContain("sim-case-1");
});
it("S20 computes reproducible forked results, limits preparation IDs and stores reminders outside the operational revision", async () => {
  const st = await setup(),
    version = st.shop.revision,
    base = { date: "2026-10-10", multiplier: 5 },
    before = rehearse(st.shop, base),
    after = rehearse(st.shop, { ...base, option: "both" });
  expect(rehearse(st.shop, base)).toEqual(before);
  expect(before.before.peak).toBeGreaterThan(120);
  expect(before.before.first?.date).toBeTruthy();
  expect(before.before.materials.some((m) => m.short > 0)).toBe(true);
  expect(after.after!.late).toBeLessThanOrEqual(before.before.late);
  await send(st, {
    type: "saveRehearsal",
    inputs: { ...base, option: "both" },
  });
  expect(st.shop.revision).toBe(version);
  expect(st.shop.supplies[1].quantity).toBe(260);
  expect(st.owner.rehearsals[0].reminders.length).toBeGreaterThan(0);
  const context = scopeContext(st.shop, st.owner, {
    room: "overview",
    runId: st.shop.runId,
    version,
  });
  expect(context.contextCoverage).toMatchObject({
    total: 2658,
    returned: 50,
    omitted: 2608,
  });
});
