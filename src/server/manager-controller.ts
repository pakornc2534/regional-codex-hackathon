import { facts, type Facts } from "../shared/facts";
import {
  actions,
  dayKey,
  dayMs,
  money,
  plus,
  type Shop,
  type ShopCase,
  type Action,
  type Option,
  type Policy,
  type ActionStatus,
  type Receipt,
  type PrivateStore,
} from "../shared/model";
import { documents, findItem, uid } from "./fulfillment";
export function risk(s: Shop, c: ShopCase, f: Facts = facts(s)) {
  let value: number | null = null,
    detail = "ยังประเมินไม่ได้";
  if (c.type === "ads") {
    const ad = s.campaigns.find((a) => a.id === c.target);
    if (ad) {
      const missing = ad.variantIds.filter(
        (id) => f.variants.find((v) => v.id === id)?.available === 0,
      );
      if (missing.length === ad.variantIds.length && ad.status === "active") {
        const hour = ad.budget / 24;
        value = Math.round(hour * 3);
        detail =
          money(ad.budget) +
          " ÷ 24 = " +
          money(hour) +
          " บาท/ชั่วโมง · " +
          money(value) +
          " บาทใน 3 ชั่วโมง";
      } else if (!missing.length || ad.status === "paused") {
        value = 0;
        detail = "ไม่มีงบที่เสี่ยงจากสินค้าหมด";
      }
    }
  }
  if (c.type === "prepare") {
    const orders = s.orders.filter(
      (o) =>
        c.orderIds.includes(o.id) &&
        o.stage === "waiting" &&
        o.prepareBy &&
        o.prepareBy <= plus(s.clock, 3 * 3600000),
    );
    value = orders.reduce((n, o) => n + o.paidAmount, 0);
    detail = orders.length + " พัสดุที่ถึงกำหนดภายใน 3 ชั่วโมง";
  }
  if (c.type === "reply") {
    const v = f.variants.find((x) => x.id === c.variantId);
    if (v) {
      value = v.price;
      detail = "โอกาสขายสินค้าที่ลูกค้าสอบถาม 1 ชิ้น";
    }
  }
  return { value, detail };
}
export function ensureCase(
  s: Shop,
  c: Pick<ShopCase, "type" | "target" | "variantId" | "title">,
  extra: Partial<ShopCase> = {},
) {
  let row = s.cases.find(
    (x) =>
      x.status === "open" &&
      x.type === c.type &&
      x.target === c.target &&
      (c.type !== "reply" || x.episode === extra.episode),
  );
  if (!row) {
    row = {
      ...c,
      id: uid(),
      status: "open",
      createdAt: s.clock,
      evidence: "ตรวจพบจากเหตุการณ์ในร้าน",
      orderIds: [],
      deadline: null,
      episode: 0,
      ...extra,
    };
    s.cases.push(row);
  }
  return row;
}
export function triggerStock(s: Shop, id: string) {
  const f = facts(s),
    v = findItem(f.variants, id);
  for (const a of s.campaigns.filter(
    (a) => a.status === "active" && a.variantIds.includes(id),
  )) {
    if (v.available <= Math.max(1, Math.ceil(v.online / 28))) {
      const c = ensureCase(s, {
        type: "ads",
        target: a.id,
        variantId: id,
        title: "ทบทวนโฆษณา " + v.sku,
      });
      c.evidence = a.variantIds
        .map((k) => {
          const p = findItem(f.variants, k);
          return p.sku + " เหลือขาย " + p.available + " ชิ้น";
        })
        .join(" · ");
    }
  }
}
export function checkDue(s: Shop) {
  for (const o of s.orders) {
    if (
      o.paid &&
      o.channel === "online" &&
      o.stage === "waiting" &&
      o.prepareBy &&
      o.prepareBy <= plus(s.clock, 3 * 3600000)
    ) {
      const c = ensureCase(
        s,
        {
          type: "prepare",
          target: o.prepareBy,
          variantId: o.variantId,
          title: "เตรียมพัสดุที่ใกล้ถึงกำหนด",
        },
        { deadline: o.prepareBy },
      );
      if (!c.orderIds.includes(o.id)) c.orderIds.push(o.id);
    }
  }
}
export function policyOf(s: Shop, c: ShopCase, action: Action) {
  return s.policies.find((p) => p.scope === c.target && p.action === action);
}
export function provision(s: Shop, c: ShopCase, action: Action): Policy {
  let p = policyOf(s, c, action);
  if (!p) {
    p = {
      scope: c.target,
      action,
      level: 1,
      limit: 0,
      history: [],
      streak: [],
      followup: false,
    };
    s.policies.push(p);
  }
  return p;
}
export function level(p: Policy, n: 1 | 2 | 3, reason: string, s: Shop) {
  p.level = n;
  p.history.push({ level: n, at: s.clock, reason });
}
export function allowed(c: ShopCase, action: Action) {
  return c.type === "reply"
    ? action === "customer_reply"
    : c.type === "prepare"
      ? action === "prepare_order"
      : ["pause", "reduce", "increase", "enable"].includes(action);
}
export function covers(s: Shop, c: ShopCase, o: Option, p: Policy | undefined) {
  if (!p || p.level === 1 || ["increase", "enable"].includes(o.action))
    return false;
  if (c.type === "ads") {
    const ad = findItem(s.campaigns, c.target),
      f = facts(s);
    if (ad.variantIds.some((id) => findItem(f.variants, id).available > 0))
      return false;
    return ad.budget <= p.limit;
  }
  return c.type === "prepare" ? c.orderIds.length <= p.limit : 1 <= p.limit;
}
export function score(s: Shop) {
  const a = s.receipts.filter((r) => r.action);
  const today = a.filter((r) => dayKey(r.at) === dayKey(s.clock));
  return {
    autonomous: a.filter((r) => r.level > 1 && r.status === "verified").length,
    waiting: s.cases.filter((c) => c.status === "open").length,
    verified: a.filter((r) => r.status === "verified").length,
    failed: a.filter((r) => r.status === "failed").length,
    uncertain: a.filter((r) => r.status === "uncertain").length,
    share: today.length
      ? today.filter((r) => r.level > 1 && r.status === "verified").length /
        today.length
      : 0,
    changes: s.policies.flatMap((p) =>
      p.history.map((h) => ({ ...h, action: p.action, scope: p.scope })),
    ),
  };
}
export function perform(
  s: Shop,
  c: ShopCase,
  o: Option,
  owner: boolean,
  receipt: Receipt,
  readback?: (v: boolean) => boolean,
) {
  if (!allowed(c, o.action) || s.paused || c.status !== "open")
    throw Error("ผู้จัดการไม่มีสิทธิ์ทำงานนี้ในขณะนี้");
  const p = provision(s, c, o.action);
  if (!owner && !covers(s, c, o, p)) throw Error("ต้องให้เจ้าของเลือกก่อน");
  receipt.action = o.action;
  receipt.caseId = c.id;
  receipt.level = owner ? 1 : p.level;
  receipt.policy = owner ? undefined : p.scope + "/" + p.action;
  let verified = false;
  if (o.action === "customer_reply") {
    const thread = findItem(s.conversations, c.target);
    if (thread.owner !== "agent" || c.episode !== thread.episode)
      throw Error("เจ้าของรับช่วงแชทหรือเริ่มรอบการรอใหม่แล้ว");
    const id = uid();
    receipt.before = thread.messages.length;
    thread.messages.push({ id, at: s.clock, role: "manager", text: o.text });
    thread.waiting = false;
    receipt.after = id;
    verified = thread.messages.some((m) => m.id === id && m.text === o.text);
  } else if (o.action === "prepare_order") {
    receipt.before = c.orderIds.map((id) => findItem(s.orders, id).documents);
    receipt.after = documents(s, c.orderIds);
    verified = c.orderIds.every((id) => findItem(s.orders, id).documents);
  } else {
    const ad = findItem(s.campaigns, c.target);
    receipt.before = { budget: ad.budget, status: ad.status };
    if (o.action === "reduce" || o.action === "increase") {
      if (
        !Number.isSafeInteger(o.amount) ||
        o.amount! < 0 ||
        (o.action === "reduce"
          ? o.amount! >= ad.budget
          : o.amount! <= ad.budget)
      )
        throw Error("จำนวนงบไม่ตรงกับทางเลือก");
      ad.budget = o.amount!;
    } else ad.status = o.action === "pause" ? "paused" : "active";
    const dest = findItem(s.campaigns, ad.id);
    receipt.after = { budget: dest.budget, status: dest.status };
    verified =
      o.action === "pause"
        ? dest.status === "paused"
        : o.action === "enable"
          ? dest.status === "active"
          : dest.budget === o.amount;
  }
  verified = readback ? readback(verified) : verified;
  receipt.status = verified ? "verified" : "uncertain";
  receipt.verification = verified
    ? String(typeof receipt.after === "string" ? receipt.after : c.target)
    : null;
  if (verified) {
    if (owner) receipt.target = c.target;
    c.status = "closed";
    if (owner) {
      p.followup = true;
      p.streak.push(c.id);
      p.streak = p.streak.slice(-3);
    }
  } else {
    level(p, 1, "ตรวจผลไม่ได้ จึงกลับมาถามเจ้าของทุกครั้ง", s);
    p.streak = [];
  }
  return receipt.status;
}
export function recordActivity(
  s: Shop,
  tool: string,
  target: string,
  caseId: string,
  status: ActionStatus | "reading",
  zone: "shelf" | "computer" | "dashboard" | "pick" = "computer",
) {
  s.activity.push({
    id: uid(),
    tool,
    target,
    caseId,
    status,
    zone,
    at: s.clock,
  });
  s.activity = s.activity.slice(-120);
}
export function advance(s: Shop, p: PrivateStore, minutes: number) {
  const old = s.clock,
    next = plus(old, minutes * 60000);
  for (
    let day = dayKey(old);
    day <= dayKey(next);
    day = dayKey(plus(new Date(day + "T07:00:00+07:00").toISOString(), dayMs))
  ) {
    const at = new Date(day + "T07:00:00+07:00").toISOString();
    if (at <= old || at > next || s.briefs.some((b) => b.date === day))
      continue;
    s.clock = at;
    checkDue(s);
    const f = facts(s),
      cases = s.cases.filter((c) => c.status === "open"),
      events = s.receipts.filter(
        (r) => r.action && r.status === "verified" && dayKey(r.at) === day,
      );
    s.briefs.push({
      date: day,
      at,
      paid: f.weekCount,
      sales: f.weekSales,
      waiting: cases.map((c) => c.id),
      risks: cases.map((c) => ({ id: c.id, value: risk(s, c, f).value })),
      levels: [1, 2, 3].map((l) => events.filter((r) => r.level === l).length),
      low: [
        ...f.supplies
          .filter((m) => m.days !== null && m.days <= m.lead)
          .map((m) => m.name),
        ...f.variants.filter((v) => v.available <= 1).map((v) => v.sku),
      ],
      reminders: p.rehearsals.flatMap((r) => r.reminders),
    });
  }
  s.clock = next;
  checkDue(s);
  for (const o of s.orders)
    if (
      o.channel === "online" &&
      o.paid &&
      o.stage !== "cancelled" &&
      !o.settlement &&
      plus(o.createdAt, 7 * dayMs) <= next
    )
      o.settlement = {
        amount: Math.round(o.paidAmount * 0.88),
        at: plus(o.createdAt, 7 * dayMs),
      };
}
export function policyLabel(p: Policy) {
  return actions[p.action] + " · ระดับ " + p.level;
}
