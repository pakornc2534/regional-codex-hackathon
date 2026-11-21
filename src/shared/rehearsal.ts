import { z } from "zod";
import { facts, recipe, unpacked } from "./facts";
import { dayKey, dayMs, plus, roundQty, type Shop } from "./model";
export const rehearsalSchema = z.object({
  date: z.iso.date(),
  multiplier: z.number().min(0).max(30).default(5),
  option: z.enum(["supplies", "capacity", "both"]).optional(),
});
export type RehearsalInput = z.input<typeof rehearsalSchema>;
export function presets(s: Pick<Shop, "clock">) {
  const today = dayKey(s.clock),
    y = Number(today.slice(0, 4));
  return [y, y + 1]
    .flatMap((year) => [10, 11, 12].map((m) => year + "-" + m + "-" + m))
    .filter((d) => d >= today)
    .slice(0, 3);
}
export function rehearse(s: Shop, input: RehearsalInput) {
  const i = rehearsalSchema.parse(input),
    f = facts(s),
    start = dayKey(s.clock),
    n = Math.round((Date.parse(i.date) - Date.parse(start)) / dayMs) + 1;
  if (n < 1 || n > 400) throw Error("เลือกวันที่ซ้อมภายใน 400 วันข้างหน้า");
  const days = Array.from({ length: n }, (_, d) =>
    dayKey(plus(s.clock, d * dayMs)),
  );
  function simulate(extra: number, deliveries: number[]) {
    const available = f.variants.map((v) => v.available),
      onHand = s.supplies.map((m) => m.quantity),
      firstShort: (string | null)[] = onHand.map(() => null),
      shorts = onHand.map(() => 0),
      unmet = available.map(() => 0);
    const queue = s.orders
      .filter(unpacked)
      .map((o) => ({
        v: s.variants.findIndex((v) => v.id === o.variantId),
        q: o.qty,
        due: o.prepareBy!.slice(0, 10),
      }));
    const receipts = new Map<string, number>();
    for (const o of s.orders) {
      if (
        !o.settlement &&
        o.channel === "online" &&
        o.paid &&
        o.stage !== "cancelled"
      ) {
        const key = dayKey(plus(o.createdAt, 7 * dayMs));
        receipts.set(
          key,
          (receipts.get(key) ?? 0) + Math.round(o.paidAmount * 0.88),
        );
      }
    }
    let balance = s.defaults.cash,
      lowest = balance,
      first: { date: string; reason: string } | null = null,
      peak = 0,
      late = 0;
    const daily: {
      date: string;
      requested: number;
      accepted: number;
      packed: number;
      backlog: number;
      late: number;
      cash: number | null;
    }[] = [];
    for (const [d, date] of days.entries()) {
      const campaign = date === i.date,
        cap = s.defaults.capacity + (campaign ? extra : 0);
      let requested = 0,
        accepted = 0,
        packed = 0;
      if (balance !== null) balance += receipts.get(date) ?? 0;
      if (campaign) {
        onHand.forEach((_, j) => {
          onHand[j] += deliveries[j] ?? 0;
        });
      }
      deliveries.forEach((q, j) => {
        if (
          date ===
            dayKey(
              plus(
                new Date(i.date + "T06:00:00+07:00").toISOString(),
                -s.supplies[j].lead * dayMs,
              ),
            ) &&
          balance !== null
        )
          balance -= Math.round(q * s.supplies[j].cost);
      });
      for (const [k, v] of f.variants.entries()) {
        const rates = (x: number) =>
          campaign
            ? Math.ceil((x / 28) * i.multiplier - 1e-9)
            : Math.floor(((d + 1) * x) / 28 + 1e-9) -
              Math.floor((d * x) / 28 + 1e-9);
        const today = (channel: string) =>
          d === 0
            ? s.orders
                .filter(
                  (o) =>
                    o.variantId === v.id &&
                    o.channel === channel &&
                    o.paid &&
                    dayKey(o.createdAt) === date,
                )
                .reduce((a, o) => a + o.qty, 0)
            : 0;
        const pos = Math.max(0, rates(v.pos) - today("pos")),
          posSold = Math.min(pos, available[k]);
        available[k] -= posSold;
        if (balance !== null) balance += posSold * v.price;
        const q = Math.max(0, rates(v.online) - today("online")),
          sold = Math.min(q, available[k]);
        available[k] -= sold;
        requested += q;
        accepted += sold;
        unmet[k] += pos - posSold + q - sold;
        if (sold) {
          queue.push({ v: k, q: sold, due: date });
          const payday = dayKey(
            plus(new Date(date + "T06:00:00+07:00").toISOString(), 7 * dayMs),
          );
          receipts.set(
            payday,
            (receipts.get(payday) ?? 0) + Math.round(v.price * 0.88) * sold,
          );
        }
        if ((sold < q || posSold < pos) && !first)
          first = { date, reason: "สต็อก " + v.sku + " ไม่พอ" };
      }
      const committed = queue.reduce((a, row) => a + row.q, 0);
      if (campaign) peak = committed;
      for (let j = 0; j < onHand.length; j++) {
        const need = queue.reduce(
            (a, row) => a + row.q * recipe(s.variants[row.v].large)[j],
            0,
          ),
          diff = roundQty(need - onHand[j]);
        if (diff > 0) {
          firstShort[j] ??= date;
          shorts[j] = Math.max(shorts[j], diff);
          first ??= {
            date,
            reason: s.supplies[j].name + " ไม่พอสำหรับงานที่รับแล้ว",
          };
        }
      }
      if (committed > cap) first ??= { date, reason: "กำลังแพ็กไม่พอ" };
      queue.sort((a, b) => a.due.localeCompare(b.due));
      for (const row of queue) {
        const r = recipe(s.variants[row.v].large),
          can = Math.min(
            row.q,
            cap - packed,
            ...r.flatMap((use, j) =>
              use ? [Math.floor(onHand[j] / use + 1e-8)] : [],
            ),
          );
        if (can <= 0) continue;
        row.q -= can;
        packed += can;
        r.forEach((use, j) => (onHand[j] = roundQty(onHand[j] - can * use)));
      }
      const backlog = queue.reduce((a, row) => a + row.q, 0),
        overdue = queue
          .filter((row) => row.q && row.due === date)
          .reduce((a, row) => a + row.q, 0);
      late += overdue;
      if (balance !== null) lowest = Math.min(lowest!, balance);
      daily.push({
        date,
        requested,
        accepted,
        packed,
        backlog,
        late: overdue,
        cash: balance,
      });
    }
    return {
      first,
      peak,
      late,
      lowest,
      daily,
      unmet: f.variants.map((v, j) => ({ sku: v.sku, qty: unmet[j] })),
      materials: s.supplies.map((m, j) => ({
        id: m.id,
        name: m.name,
        unit: m.unit,
        date: firstShort[j],
        short: shorts[j],
        lead: m.lead,
      })),
    };
  }
  const before = simulate(0, []),
    extra = Math.max(0, before.peak - s.defaults.capacity),
    supplies = before.materials.map((m) => Math.ceil(m.short)),
    orderDates = s.supplies.map((m) =>
      dayKey(
        plus(
          new Date(i.date + "T06:00:00+07:00").toISOString(),
          -m.lead * dayMs,
        ),
      ),
    );
  const options = [
    { id: "supplies" as const, text: "เตรียมวัสดุที่ขาด", extra: 0, supplies },
    {
      id: "capacity" as const,
      text: "เพิ่มกำลังแพ็กตามคิว",
      extra,
      supplies: supplies.map(() => 0),
    },
    { id: "both" as const, text: "เตรียมวัสดุและเพิ่มกำลังแพ็ก", extra, supplies },
  ];
  const chosen = options.find((o) => o.id === i.option),
    reminders = chosen
      ? chosen.supplies.flatMap((q, j) =>
          q
            ? [
                orderDates[j] +
                  " · " +
                  s.supplies[j].name +
                  " " +
                  q +
                  " " +
                  s.supplies[j].unit,
              ]
            : [],
        )
      : [];
  const after = chosen
    ? simulate(
        chosen.extra,
        chosen.supplies.map((q, j) => (orderDates[j] >= start ? q : 0)),
      )
    : null;
  return {
    runId: s.runId,
    version: s.revision,
    date: i.date,
    multiplier: i.multiplier,
    before,
    after,
    options,
    orderDates,
    reminders,
  };
}
export type RehearsalResult = ReturnType<typeof rehearse>;
