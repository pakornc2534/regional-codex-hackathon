import { randomUUID } from "node:crypto";
import { atShop, channelKey, facts, recipe, unpacked } from "../shared/facts";
import {
  dayKey,
  dayMs,
  plus,
  roundQty,
  type Shop,
  type Order,
  type Stage,
} from "../shared/model";
export const uid = () => "sim-" + randomUUID();
export function findItem<T extends { id: string }>(items: T[], id: string): T {
  const found = items.find((i) => i.id === id);
  if (!found) throw Error("ไม่พบข้อมูลในร้านรอบนี้");
  return found;
}
export function syncQuantity(s: Shop, id: string) {
  const v = findItem(s.variants, id),
    ch = s.sync.find(
      (item) =>
        item.variantId === id &&
        item.productId === v.productId &&
        item.shopId === s.id,
    );
  if (!ch) throw Error("ไม่พบช่องทางขายของรุ่นนี้");
  const reserved = s.orders.reduce(
    (q, o) => q + (o.variantId === id && atShop(o) ? o.qty : 0),
    0,
  );
  ch.desired = v.physical - reserved;
  if (ch.desired < 0 || reserved < 0) throw Error("จำนวนคงเหลือไม่พอ");
  ch.status = "pending";
  s.endpoint[channelKey(v)] = ch.desired;
  ch.verified = s.endpoint[channelKey(v)];
  ch.at = v.updatedAt = s.clock;
  ch.status = ch.verified === ch.desired ? "synced" : "failed";
}
export function sale(s: Shop, id: string, q: number, online: boolean) {
  const v = findItem(s.variants, id),
    current = findItem(facts(s).variants, id);
  if (q > current.available) throw Error("จำนวนที่สั่งมากกว่าสินค้าที่เหลือขาย");
  const orderId = uid(),
    stage = online ? "waiting" : "taken",
    date = dayKey(s.clock),
    today = new Date(date + "T18:00:00+07:00").toISOString(),
    morning = s.clock < new Date(date + "T12:00:00+07:00").toISOString();
  s.orders.push({
    id: orderId,
    variantId: id,
    qty: q,
    channel: online ? "online" : "pos",
    customerId: uid(),
    conversationId: null,
    paid: true,
    paidAmount: q * v.price,
    unitPrice: v.price,
    createdAt: s.clock,
    stage,
    prepareBy: online ? (morning ? today : plus(today, dayMs)) : null,
    settlement: null,
    events: [{ stage, at: s.clock }],
    documents: false,
  });
  if (!online) v.physical -= q;
  s.movements.push({
    variantId: id,
    type: online ? "กันให้คำสั่งซื้อ" : "ขายหน้าร้าน",
    qty: online ? q : -q,
    at: s.clock,
    orderId,
  });
  syncQuantity(s, id);
  return orderId;
}
export function changeStage(s: Shop, id: string, to: Stage) {
  const o = findItem(s.orders, id),
    v = findItem(s.variants, o.variantId);
  const allowed: Partial<Record<Stage, Stage[]>> = {
    waiting: ["packing", "ready", "cancelled"],
    packing: ["ready", "cancelled"],
    ready: ["picked", "cancelled"],
    picked: ["transit"],
    transit: ["delivered"],
  };
  if (!o.paid || o.channel !== "online" || !allowed[o.stage]?.includes(to))
    throw Error("ขั้นตอนของพัสดุเปลี่ยนแล้ว");
  if (to === "ready") {
    const needs = recipe(v.large).map((x) => x * o.qty);
    if (needs.some((n, i) => s.supplies[i].quantity < n))
      throw Error("วัสดุแพ็กไม่เพียงพอ");
    s.supplies.forEach(
      (m, i) => (m.quantity = roundQty(m.quantity - needs[i])),
    );
  }
  if (to === "picked") v.physical -= o.qty;
  if (to === "picked" || to === "cancelled")
    s.movements.push({
      variantId: v.id,
      type: to === "picked" ? "ขนส่งรับแล้ว" : "คืนยอดที่กันไว้",
      qty: to === "picked" ? -o.qty : o.qty,
      at: s.clock,
      orderId: id,
    });
  o.stage = to;
  o.events.push({ stage: to, at: s.clock });
  syncQuantity(s, v.id);
}
export function documents(s: Shop, ids: string[]) {
  const orders = ids.map((id) => findItem(s.orders, id));
  if (!orders.length || orders.some((o) => !unpacked(o)))
    throw Error("ไม่มีพัสดุรอเตรียมตามรายการนี้");
  orders.forEach((o) => (o.documents = true));
  return orders.map((o) => o.id);
}
export function orderView(o: Order) {
  return {
    id: o.id,
    variantId: o.variantId,
    qty: o.qty,
    channel: o.channel,
    stage: o.stage,
    createdAt: o.createdAt,
    prepareBy: o.prepareBy,
    paid: o.paid,
    paidAmount: o.paidAmount,
    documents: o.documents,
    events: o.events,
  };
}
