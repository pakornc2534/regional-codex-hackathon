import { z } from 'zod';

const n = z.number();
const s = z.string();
const nullableMoney = n.nullable();
const option = z.object({
  id: s, actionType: s.optional(), title: s.optional(), label: s.optional(), reason: s.optional(), description: s.optional(),
  text: s.optional(), action: z.object({type: s, text: s.optional(), dailyBudget: n.optional()}).optional(),
});
const proposal = z.object({ id: s, status: s.optional(), source: s.optional(), options: z.array(option), basedOnVersion: n.optional(), decision: z.unknown().optional() });
const stateSchema = z.object({
  runId: s, revision: n, clock: s,
  shop: z.object({ id: s, name: s, mode: s, timezone: s, platform: s }),
  defaults: z.object({ packingCapacity: nullableMoney, cash: nullableMoney }),
  products: z.array(z.object({
    id: s, category: s, name: s, kind: s,
    variants: z.array(z.object({ id: s, sellerSku: s, name: s.optional(), price: n, cost: nullableMoney, physical: n, reserved: n, available: n })),
  })),
  supplies: z.array(z.object({ id: s, name: s, unit: s, quantity: nullableMoney, unitCost: nullableMoney, leadDays: n, reserved: nullableMoney, free: nullableMoney, daysRemaining: nullableMoney, orderOn: s.nullish() })),
  orders: z.array(z.object({
    id: s, channel: s, customerId: s, conversationId: s.nullish(), paymentStatus: s, fulfillmentStatus: s, paidAmount: n, createdAt: s, prepareBy: s.nullish(),
    items: z.array(z.object({ variantId: s, quantity: n, unitPrice: n })),
    settlement: z.object({ amount: n, date: s }).nullish(),
    documents: z.object({ pickList: z.array(z.object({sellerSku:s,quantity:n})), label: s }).nullish(), tracking: s.nullish(), events: z.array(z.object({stage:s, at:s})).optional(),
  })),
  channelStock: z.array(z.object({ variantId: s, desiredQuantity: n, verifiedQuantity: nullableMoney, syncStatus: s })),
  cases: z.array(z.object({
    id: s, type: s, title: s, entityRefs: z.object({ variantId: s.optional(), orderId: s.optional(), conversationId: s.optional(), campaignId: s.optional() }),
    priority: s, status: s, evidence: z.array(s), proposal: proposal.nullish(), proposals: z.array(proposal).optional(), options: z.array(option).optional(), proposalId: s.optional(),
  })),
  conversations: z.array(z.object({
    id: s, title: s, owner: s, messages: z.array(z.object({ id: s, author: s, text: s, at: s })),
  })),
  returns: z.array(z.object({ id: s, orderId: s, stage: s })),
  campaigns: z.array(z.object({ id: s, name: s, status: s, dailyBudget: n, variantIds: z.array(s), spend: n, attributedSales: n })),
  metrics: z.object({
    sales7d: n, orders7d: n, overdueOrders: n.optional(), period: z.object({from:s,to:s}).optional(), queueUnits: n, queueOrders: n, paidOrders: n, sales: n, confirmedCash: n, pendingSettlements: n,
    daily: z.array(z.object({ date: s, online: n, pos: n, orders: n })),
    stages: z.record(s, z.object({ orders: n, units: n })),
  }),
  health: z.object({status:s, observedAt:s, source:s, stale:z.boolean(), period:z.object({from:s,to:s})}).optional(), mail: z.array(z.object({id:s,date:s,status:s})).default([]), movements: z.array(z.object({id:s,variantId:s,reason:s,at:s,before:z.object({available:n}),after:z.object({available:n})})).default([]),
  capacity: z.object({materialCapacity: nullableMoney, bottleneckSupplyId:s.nullish(),workerCapacity:nullableMoney,nextDayNewUnits:nullableMoney}).optional(),
  managerPaused: z.boolean(), acknowledgement: z.object({ enabled: z.boolean(), text: s }).optional(),
  policies: z.array(z.record(s, z.unknown())), briefs: z.array(z.record(s, z.unknown())), plans: z.array(z.record(s, z.unknown())),
  news: z.array(z.record(s, z.unknown())), competitors: z.array(z.record(s, z.unknown())), audit: z.array(z.record(s, z.unknown())),
  owner: z.object({
    messages: z.array(z.object({ id: s, role: z.enum(['owner', 'manager']), text: s, room: s, caseId: s.nullish(), status: s.optional(), createdAt: s })),
    memories: z.array(z.object({ id: s, text: s })),
  }),
  connection: z.object({ status: s, detail: s.optional() }),
  hosted: z.object({ publicDemo: z.boolean().optional(), stale: z.boolean().optional(), ageMs: n.nullable().optional() }).optional(),
});
export type ShopState = z.infer<typeof stateSchema>;
export type Product = ShopState['products'][number];
export type Variant = Product['variants'][number] & { productName: string; category: string; productId: string };
export type Command = { type: string } & Record<string, unknown>;
export type Case = ShopState['cases'][number];
export type Order = ShopState['orders'][number];

export const modes = {
  ads: 'ยิงแอด',
  flash: 'แฟลชเซล',
  marketing: 'โค้ดส่วนลดและการตลาด',
  investment: 'เงินลงทุน',
};
export type Mode = keyof typeof modes;
export type PlanInputs = { variantId: string; mode: Mode; days: number } & Record<string, number | string | null>;

const growthSchema = z.object({
  runId: s, revision: n, variantId: s,
  mode: z.enum(['ads', 'flash', 'marketing', 'investment']),
  baselineUnits: nullableMoney, planDemand: nullableMoney, supportablePlanUnits: nullableMoney,
  unitContribution: nullableMoney, baselineContribution: nullableMoney, planContribution: nullableMoney,
  adSpend: nullableMoney, adRecoveryUnits: nullableMoney, requiredTotalUnits: nullableMoney,
  requiredAdditionalUnits: nullableMoney, preparationCapacity: nullableMoney, materialCapacity: nullableMoney,
  allocatableStock: nullableMoney, lowestCash: nullableMoney, revenue: nullableMoney,
  warnings: z.array(s),
  primaryMessage: s.nullish(), adTarget: nullableMoney.optional(), posAllowance: nullableMoney.optional(), otherUnits: nullableMoney.optional(), queueUnits: n.optional(),
  assumedClicks: nullableMoney.optional(), assumedIncrementalAdUnits: nullableMoney.optional(), receivables: nullableMoney.optional(),
  roas: nullableMoney.optional(), discountedPrice: nullableMoney.optional(), fixedCosts: nullableMoney.optional(),
  costs: z.record(s, nullableMoney).optional(), materials: z.array(z.object({supplyId:s,name:s,perUnit:n,free:nullableMoney,reservedForOthers:nullableMoney,remaining:nullableMoney,capacity:nullableMoney})).optional(),
  cashTimeline: z.array(z.object({day:n,in:n,out:n,balance:n,low:n})).nullish(),
  loanSchedule: z.array(z.object({day:n,principal:n,interest:n,outstanding:n,paid:n})).nullish(),
  adRequirements: z.record(s,z.object({available:nullableMoney,required:n,shortfall:nullableMoney})).nullish(),
  wholePlanRequirements: z.record(s,z.object({available:nullableMoney,required:n,shortfall:nullableMoney})).nullish(),
  unitRecoveryEvidence: z.unknown().optional(),
}).passthrough();
export type Growth = z.infer<typeof growthSchema>;

async function request(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(path, { cache: 'no-store', ...init });
  const payload: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    const failure = z.object({ error: s }).safeParse(payload);
    throw new Error(failure.success ? failure.data.error : 'เชื่อมต่อระบบร้านไม่ได้');
  }
  return payload;
}
export async function readStamp(): Promise<string> {
  return z.object({ version: s }).parse(await request('/api/stamp')).version;
}
export function post(path: string, body: unknown): Promise<unknown> {
  return request(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}
export async function readState(signal?: AbortSignal): Promise<ShopState> {
  const body = await request('/api/state', { signal });
  const parsed = stateSchema.safeParse(body);
  if (!parsed.success) {
    const detail = parsed.error.issues[0];
    throw new Error(detail ? `ข้อมูลร้านยังไม่พร้อม (${detail.path.join('.')})` : 'ข้อมูลร้านยังไม่พร้อม');
  }
  return parsed.data;
}
export async function evaluate(inputs: PlanInputs, signal: AbortSignal): Promise<Growth> {
  const body = await request('/api/sim/growth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(inputs), signal });
  const parsed = growthSchema.safeParse(body);
  if (!parsed.success) {
    const detail = parsed.error.issues[0];
    throw new Error(detail ? `อ่านผลประเมินไม่ได้ (${detail.path.join('.')})` : 'อ่านผลประเมินไม่ได้');
  }
  return parsed.data;
}
export const count = (num: number | null | undefined): string => num == null ? 'ยังไม่ทราบ' : num.toLocaleString('th-TH', { maximumFractionDigits: 2 });
export const baht = (num: number | null | undefined): string => num == null ? 'ยังไม่ทราบ' : `฿${count(num)}`;
const dateFormat = new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: 'numeric' });
const timeFormat = new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const isoFormat = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', day: '2-digit', month: '2-digit', year: 'numeric' });
export const date = (value: string) => !value || Number.isNaN(Date.parse(value)) ? 'ยังไม่ทราบ' : dateFormat.format(new Date(value));
export const time = (value: string) => !value || Number.isNaN(Date.parse(value)) ? 'ยังไม่ทราบ' : timeFormat.format(new Date(value));
export const isoDate = (value: string) => isoFormat.format(new Date(value));
export const timestamp = (value: string) => `${date(value)} · ${time(value)} น.`;
export const stages: Record<string, string> = {
  picking: 'รอหยิบ', packing: 'กำลังแพ็ก', ready: 'รอขนส่งรับ',
  collected: 'ขนส่งรับแล้ว', transit: 'ระหว่างทาง', delivered: 'ส่งสำเร็จ', taken: 'รับที่หน้าร้าน',
};
export const statuses: Record<string, string> = {
  open: 'รอเจ้าของเลือก', pending: 'รอดำเนินการ', awaiting_approval: 'รอเจ้าของเลือก', verified: 'ตรวจสอบแล้ว',
  resolved: 'เสร็จแล้ว', completed: 'เสร็จแล้ว', closed: 'ปิดเคสแล้ว', active: 'กำลังทำงาน', paused: 'พักไว้', enabled: 'กำลังทำงาน',
  synced: 'ตรงกันแล้ว', failed: 'ส่งไม่สำเร็จ', stale: 'ข้อมูลเปลี่ยนแล้ว', deferred: 'พักไว้',
  thinking: 'กำลังตรวจข้อมูล', queued: 'รอคิว', proposed: 'มีตัวเลือกให้พิจารณา', executing: 'กำลังดำเนินการ', uncertain: 'รอตรวจสอบผล',
};
export const statusLabel = (value: string) => statuses[value] ?? value;
export const problem = (error: unknown) => error instanceof Error ? error.message : 'เกิดข้อผิดพลาด กรุณาลองอีกครั้ง';
