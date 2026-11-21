import { z } from "zod";
import { calculatePlan, planSchema } from "../shared/planner";
import { rehearse, rehearsalSchema } from "../shared/rehearsal";
import { roundQty, actions, type Action, type Receipt } from "../shared/model";
import { findItem, changeStage, sale, uid } from "./fulfillment";
import {
  advance,
  allowed,
  ensureCase,
  level,
  perform,
  provision,
  recordActivity,
  triggerStock,
  checkDue,
} from "./manager-controller";
import { Conflict, emptyPrivate, hash, Store } from "./persistence";
import { seed } from "./simulator";
const id = z.string().min(1).max(160),
  qty = z.number().int().positive().max(100000),
  msg = z.string().trim().min(1).max(1800);
const base = z.object({
  runId: id,
  version: z.number().int().positive(),
  key: id,
});
const bodies = z.discriminatedUnion("type", [
  z.object({ type: z.enum(["pos", "online", "receive"]), target: id, qty }),
  z.object({
    type: z.enum([
      "startPacking",
      "pack",
      "pickup",
      "transit",
      "deliver",
      "cancel",
      "takeover",
      "handback",
      "reverse",
    ]),
    target: id,
  }),
  z.object({ type: z.literal("message"), target: id, text: msg }),
  z.object({ type: z.literal("humanReply"), target: id, text: msg }),
  z.object({ type: z.literal("control"), paused: z.boolean() }),
  z.object({ type: z.literal("ack"), enabled: z.boolean() }),
  z.object({ type: z.literal("advance"), minutes: qty.max(10080) }),
  z.object({ type: z.literal("choose"), target: id, option: id }),
  z.object({
    type: z.literal("policy"),
    target: id,
    action: z.enum(Object.keys(actions) as [Action, ...Action[]]),
    level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    limit: z.number().int().nonnegative().max(1e9),
  }),
  z.object({ type: z.literal("savePlan"), inputs: planSchema }),
  z.object({ type: z.literal("saveRehearsal"), inputs: rehearsalSchema }),
  z.object({ type: z.literal("memory"), text: msg }),
  z.object({ type: z.literal("reset") }),
]);
export const commandSchema = z.intersection(base, bodies);
export type Command = z.input<typeof commandSchema>;
export async function command(store: Store, raw: unknown) {
  const c = commandSchema.parse(raw),
    fingerprint = hash(c);
  return store.run(async (s, p) => {
    const old = s.receipts.find((r) => r.id === c.key);
    if (old) {
      if (old.hash !== fingerprint)
        throw new Conflict("รหัสคำสั่งนี้ถูกใช้กับข้อมูลอื่นแล้ว");
      return old;
    }
    if (s.runId !== c.runId || s.revision !== c.version)
      throw new Conflict("ข้อมูลเปลี่ยนแล้ว กรุณาเปิดข้อมูลล่าสุด");
    const receipt: Receipt = {
      id: c.key,
      hash: fingerprint,
      at: s.clock,
      runId: s.runId,
      status: "verified",
      type: c.type,
      target: "target" in c ? c.target : s.id,
      level: 1,
      before: s.revision,
      after: null,
      verification: null,
    };
    let operational = true;
    switch (c.type) {
      case "reset": {
        await store.archive(s, p);
        const fresh = seed(uid());
        Object.assign(s, fresh);
        Object.assign(p, emptyPrivate(s.runId));
        operational = false;
        receipt.after = s.runId;
        break;
      }
      case "pos":
      case "online": {
        receipt.after = sale(s, c.target, c.qty, c.type === "online");
        triggerStock(s, c.target);
        checkDue(s);
        break;
      }
      case "receive": {
        const m = findItem(s.supplies, c.target);
        receipt.before = m.quantity;
        m.quantity = roundQty(m.quantity + c.qty);
        receipt.after = m.quantity;
        break;
      }
      case "startPacking":
      case "pack":
      case "pickup":
      case "transit":
      case "deliver":
      case "cancel": {
        const o = findItem(s.orders, c.target);
        receipt.before = o.stage;
        changeStage(
          s,
          o.id,
          (
            {
              startPacking: "packing",
              pack: "ready",
              pickup: "picked",
              transit: "transit",
              deliver: "delivered",
              cancel: "cancelled",
            } as const
          )[c.type],
        );
        receipt.after = o.stage;
        triggerStock(s, o.variantId);
        break;
      }
      case "ack":
        s.ack.enabled = c.enabled;
        receipt.after = s.ack.enabled;
        break;
      case "control":
        s.paused = c.paused;
        receipt.after = s.paused;
        break;
      case "takeover":
      case "handback": {
        const t = findItem(s.conversations, c.target);
        t.owner = c.type === "takeover" ? "human" : "agent";
        receipt.after = t.owner;
        break;
      }
      case "humanReply": {
        const t = findItem(s.conversations, c.target);
        if (t.owner !== "human") throw Error("รับช่วงแชทก่อนส่งข้อความ");
        t.messages.push({
          id: uid(),
          at: s.clock,
          role: "owner",
          text: c.text,
        });
        t.waiting = false;
        s.cases
          .filter((x) => x.target === t.id && x.status === "open")
          .forEach((x) => (x.status = "closed"));
        receipt.after = t.messages.at(-1)!.id;
        break;
      }
      case "message": {
        const t = findItem(s.conversations, c.target);
        if (!t.waiting) t.episode++;
        t.waiting = true;
        t.messages.push({
          id: uid(),
          role: "customer",
          at: s.clock,
          text: c.text,
        });
        if (t.owner === "agent") {
          const k = ensureCase(
            s,
            {
              type: "reply",
              target: t.id,
              variantId: t.variantId,
              title: "ตอบลูกค้า · " + t.title,
            },
            { episode: t.episode },
          );
          k.evidence = c.text;
          if (!s.paused && s.ack.enabled && t.ackEpisode !== t.episode) {
            t.messages.push({
              id: uid(),
              role: "manager",
              at: s.clock,
              text: s.ack.text,
            });
            t.ackEpisode = t.episode;
          }
        }
        receipt.after = t.messages.at(-1)!.id;
        break;
      }
      case "choose": {
        const prop = findItem(s.proposals, c.target);
        if (prop.version !== s.revision || prop.status !== "proposed")
          throw new Conflict("ข้อเสนอนี้ใช้ข้อมูลเก่า กรุณาวิเคราะห์ใหม่");
        const k = findItem(s.cases, prop.caseId),
          o = findItem(prop.options, c.option);
        prop.decision = o.id;
        prop.status = perform(s, k, o, true, receipt);
        recordActivity(
          s,
          "sim_execute_approved",
          k.target,
          k.id,
          receipt.status,
          k.type === "prepare" ? "pick" : "computer",
        );
        break;
      }
      case "policy": {
        const k = findItem(s.cases, c.target);
        if (
          !allowed(k, c.action) ||
          (["increase", "enable"].includes(c.action) && c.level !== 1)
        )
          throw Error("สิทธิ์ประเภทนี้ต้องถามเจ้าของทุกครั้ง");
        if (
          c.level > 1 &&
          !s.receipts.some(
            (r) =>
              r.action === c.action &&
              r.level === 1 &&
              r.status === "verified" &&
              s.cases.some(
                (prior) => prior.id === r.caseId && prior.target === k.target,
              ),
          )
        )
          throw Error("เจ้าของต้องเลือกงานประเภทนี้ครั้งแรกก่อน");
        const policy = provision(s, k, c.action);
        policy.limit = c.limit;
        level(policy, c.level, "เจ้าของกำหนดสิทธิ์และเพดาน", s);
        policy.followup = false;
        receipt.after = policy.level;
        break;
      }
      case "reverse": {
        const r = findItem(s.receipts, c.target);
        if (r.level <= 1 || r.status !== "verified" || !r.caseId || !r.action)
          throw Error("เลือกรายการอัตโนมัติที่ตรวจผลแล้ว");
        const k = findItem(s.cases, r.caseId);
        if (
          k.type !== "ads" ||
          !r.before ||
          typeof r.before !== "object" ||
          !("budget" in r.before) ||
          !("status" in r.before)
        )
          throw Error("ย้อนกลับได้เฉพาะการเปลี่ยนโฆษณา");
        const ad = findItem(s.campaigns, k.target);
        if (hash({ budget: ad.budget, status: ad.status }) !== hash(r.after))
          throw new Conflict("แคมเปญเปลี่ยนไปแล้ว");
        Object.assign(ad, r.before);
        level(provision(s, k, r.action), 1, "เจ้าของย้อนกลับการทำงานอัตโนมัติ", s);
        receipt.after = ad.status;
        break;
      }
      case "advance":
        advance(s, p, c.minutes);
        receipt.after = s.clock;
        break;
      case "memory":
        p.memories.push({ text: c.text, at: s.clock });
        operational = false;
        receipt.after = p.memories.length;
        break;
      case "savePlan": {
        const results = calculatePlan(s, c.inputs),
          id = uid();
        p.plans.push({
          id,
          variantId: c.inputs.variantId,
          version: s.revision,
          inputs: c.inputs,
          results,
          at: s.clock,
        });
        receipt.after = id;
        operational = false;
        break;
      }
      case "saveRehearsal": {
        const r = rehearse(s, c.inputs),
          opt = r.options.find((o) => o.id === c.inputs.option);
        if (!opt) throw Error("เลือกทางเตรียมร้านก่อนบันทึก");
        const id = uid();
        p.rehearsals.push({
          id,
          date: r.date,
          version: r.version,
          text: opt.text,
          reminders: r.reminders,
        });
        receipt.after = id;
        operational = false;
        break;
      }
    }
    if (operational) {
      s.revision++;
      s.proposals
        .filter((pr) => pr.status === "proposed" && pr.version !== s.revision)
        .forEach((pr) => (pr.status = "stale"));
    }
    receipt.verification =
      receipt.status === "verified"
        ? (receipt.verification ?? String(receipt.after ?? s.revision))
        : null;
    s.receipts.push(receipt);
    return receipt;
  });
}
