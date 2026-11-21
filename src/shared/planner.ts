import { z } from "zod";
import { facts, recipe } from "./facts";
import { type Shop, type Zone } from "./model";
const nonneg = z.number().finite().nonnegative().max(1e12);
export const planSchema = z.object({
  variantId: z.string(),
  days: z.number().int().min(1).max(90).default(1),
  dailyBudget: nonneg.default(30000),
  cpc: nonneg.positive().default(400),
  conversion: z.number().min(0).max(1).default(0.03),
  fee: z.number().min(0).max(1).default(0.12),
  quota: nonneg.int().default(100),
  discount: nonneg.default(0),
  demandLift: nonneg.max(100).default(1),
  fixed: nonneg.default(0),
  extraUnit: nonneg.default(0),
  capacity: nonneg.int().nullable().optional(),
  cash: nonneg.nullable().optional(),
  delay: nonneg.int().max(365).default(7),
});
export type PlanInputs = z.input<typeof planSchema>;
export const ceilUnits = (n: number) => Math.ceil(n - 1e-10);
export function breakEven(
  m: number | null,
  spend: number,
  baseline: number | null,
  units: number,
  fixed: number,
) {
  if (m === null || m <= 0 || baseline === null)
    return { recover: null, total: null, additional: null };
  const target = (amount: number) => {
    let q = Math.max(0, Math.floor(amount / m));
    while (q * m < amount) q++;
    return q;
  };
  const total = target(baseline + spend + fixed);
  return {
    recover: target(spend),
    total,
    additional: Math.max(0, total - units),
  };
}
export interface Impact {
  label: string;
  zone: Zone;
  need: number | null;
  have: number | null;
  short: number | null;
  status: string;
}
export function calculatePlan(s: Shop, raw: PlanInputs) {
  const i = planSchema.parse(raw),
    f = facts(s),
    v = f.variants.find((x) => x.id === i.variantId);
  if (!v) throw Error("ไม่พบรุ่นสินค้าที่เลือก");
  if (i.discount > v.price) throw Error("ส่วนลดสูงกว่าราคาสินค้า");
  const selected = v;
  const capacity = i.capacity === undefined ? s.defaults.capacity : i.capacity,
    cash = i.cash === undefined ? s.defaults.cash : i.cash;
  const spend = i.dailyBudget * i.days,
    adDemand = (spend / i.cpc) * i.conversion,
    baselineDemand = ceilUnits((v.online / 28) * i.days),
    demand = ceilUnits((v.online / 28) * i.days * i.demandLift + adDemand);
  const pos = ceilUnits((v.pos / 28) * i.days),
    stock = Math.max(0, v.available - pos),
    mix = f.variants.map((p) => ({
      v: p,
      q: Math.min(
        Math.floor((p.online / 28) * i.days),
        Math.max(0, p.available - ceilUnits((p.pos / 28) * i.days)),
      ),
    }));
  const myRecipe = recipe(v.large);
  function allocate(total: number, coeff: (p: typeof selected) => number) {
    const other = mix.reduce(
        (n, a) => n + (a.v.id !== selected.id ? a.q * coeff(a.v) : 0),
        0,
      ),
      mine =
        (mix.find((a) => a.v.id === selected.id)?.q ?? 0) * coeff(selected);
    if (other + mine > total && other + mine > 0)
      return Math.max(0, (total * mine) / (other + mine));
    return Math.max(0, total - other);
  }
  const materials = f.supplies.map((m, j) => {
    const remaining = allocate(m.free, (p) => recipe(p.large)[j]);
    return {
      id: m.id,
      name: m.name,
      free: m.free,
      other: m.free - remaining,
      required: demand * myRecipe[j],
      short: Math.max(0, demand * myRecipe[j] - remaining),
      units: myRecipe[j] ? Math.floor(remaining / myRecipe[j] + 1e-9) : null,
    };
  });
  const material = Math.min(
      ...materials.flatMap((m) => (m.units === null ? [] : [m.units])),
    ),
    packing =
      capacity === null
        ? null
        : Math.floor(
            allocate(Math.max(0, capacity * i.days - f.queue), () => 1),
          );
  const support = (q: number, quota = Infinity) =>
    packing === null
      ? null
      : Math.max(0, Math.min(q, quota, stock, material, packing));
  const baselineUnits = support(baselineDemand),
    units = support(demand, i.quota),
    packCost = Math.round(
      f.supplies.reduce((a, m, j) => a + m.cost * myRecipe[j], 0),
    ),
    price = v.price - i.discount;
  const fee = Math.round(price * i.fee),
    regularFee = Math.round(v.price * i.fee),
    m = v.cost === null ? null : price - v.cost - packCost - fee - i.extraUnit;
  const baseM =
    v.cost === null
      ? null
      : v.price - v.cost - packCost - regularFee - i.extraUnit;
  const baseline =
      baseM === null || baselineUnits === null ? null : baselineUnits * baseM,
    contribution =
      m === null || units === null ? null : units * m - spend - i.fixed;
  const targets = breakEven(m, spend, baseline, baselineUnits ?? 0, i.fixed);
  const impact: Impact[] = [];
  function add(
    label: string,
    zone: Zone,
    need: number | null,
    have: number | null,
  ) {
    const short =
      need === null || have === null ? null : Math.max(0, need - have);
    impact.push({
      label,
      zone,
      need,
      have,
      short,
      status:
        short === null
          ? "ยังไม่ทราบ"
          : short > 0
            ? "ไม่พอ"
            : have! > 0 && need! >= 0.8 * have!
              ? "ตึง"
              : "พอ",
    });
  }
  add(
    "ยอดขายเพิ่ม",
    "dashboard",
    targets.recover,
    Math.max(0, demand - baselineDemand),
  );
  add("สต็อก", "shelf", demand, stock);
  add("วัสดุแพ็ก", "pack", demand, material);
  add("กำลังแพ็ก", "pick", demand, packing);
  add("เงินสด", "cash", spend + i.fixed, cash);
  let balance = cash,
    lowestCash = cash;
  if (cash !== null) {
    let running = cash;
    for (let d = 0; d < i.days; d++) {
      running -= i.dailyBudget + (d === 0 ? i.fixed : 0);
      if (d >= i.delay && units !== null) {
        const j = d - i.delay;
        running +=
          (Math.floor(((j + 1) * units) / i.days) -
            Math.floor((j * units) / i.days)) *
          (price - fee);
      }
      lowestCash = Math.min(lowestCash!, running);
    }
    balance = running;
  }
  const targetChecks = [
    targets.recover === null || baselineUnits === null
      ? null
      : baselineUnits + targets.recover,
    targets.total,
  ].map((required) => ({
    required,
    resources: [stock, material, packing, i.quota, demand].map((available) => ({
      available,
      short:
        available === null || required === null
          ? null
          : Math.max(0, required - available),
    })),
  }));
  return {
    runId: s.runId,
    version: s.revision,
    variantId: v.id,
    inputs: i,
    spend,
    adDemand,
    demand,
    baselineDemand,
    baselineUnits,
    units,
    stock,
    pos,
    materials,
    material,
    packing,
    capacity,
    cash,
    lowestCash,
    balance,
    queue: f.queue,
    queueOver:
      capacity === null ? null : Math.max(0, f.queue - capacity * i.days),
    otherUnits: mix.filter((x) => x.v.id !== v.id).reduce((n, x) => n + x.q, 0),
    m,
    baseM,
    price,
    productCost: v.cost,
    packCost,
    fee,
    baseline,
    contribution,
    gain:
      baseline === null || contribution === null
        ? null
        : contribution - baseline,
    revenue: units === null ? null : units * price,
    targets,
    targetChecks,
    impact,
    bottleneck: impact.find((n) => n.status === "ไม่พอ")?.zone ?? null,
  };
}
export type PlanResult = ReturnType<typeof calculatePlan>;
