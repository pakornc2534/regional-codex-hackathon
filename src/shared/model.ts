export type Stage =
  | "waiting"
  | "packing"
  | "ready"
  | "picked"
  | "transit"
  | "delivered"
  | "taken"
  | "cancelled"
  | "unpaid";
export type CaseType = "reply" | "prepare" | "ads";
export type Action =
  | "customer_reply"
  | "prepare_order"
  | "pause"
  | "reduce"
  | "increase"
  | "enable";
export type ActionStatus =
  | "proposed"
  | "awaiting"
  | "executing"
  | "verified"
  | "failed"
  | "uncertain"
  | "stale";
export type Zone =
  | "shelf"
  | "pick"
  | "pack"
  | "pickup"
  | "carrier"
  | "returns"
  | "cash"
  | "dashboard"
  | "computer";
export interface Variant {
  id: string;
  productId: string;
  sku: string;
  name: string;
  category: string;
  kind: "repeatable" | "one-off";
  sourcing: string;
  physical: number;
  opening: number;
  price: number;
  cost: number | null;
  large: boolean;
  updatedAt: string;
}
export interface Order {
  id: string;
  variantId: string;
  qty: number;
  channel: "online" | "pos";
  customerId: string;
  conversationId: string | null;
  paid: boolean;
  paidAmount: number;
  unitPrice: number;
  createdAt: string;
  stage: Stage;
  prepareBy: string | null;
  settlement: { amount: number; at: string } | null;
  events: { stage: Stage; at: string }[];
  documents: boolean;
}
export interface Supply {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  cost: number;
  lead: number;
}
export interface Message {
  id: string;
  role: "customer" | "manager" | "owner";
  text: string;
  at: string;
}
export interface Conversation {
  id: string;
  title: string;
  variantId: string;
  customerId: string;
  owner: "agent" | "human";
  episode: number;
  waiting: boolean;
  ackEpisode: number;
  messages: Message[];
}
export interface Campaign {
  id: string;
  variantIds: string[];
  budget: number;
  status: "active" | "paused";
  spend: number;
  clicks: number;
  attributedOrderIds: string[];
  period: string[];
}
export interface ShopCase {
  id: string;
  type: CaseType;
  target: string;
  variantId: string;
  title: string;
  status: "open" | "closed";
  evidence: string;
  createdAt: string;
  deadline: string | null;
  orderIds: string[];
  episode: number;
}
export interface Option {
  id: string;
  action: Action;
  text: string;
  reason: string;
  amount?: number;
}
export interface Proposal {
  id: string;
  caseId: string;
  options: Option[];
  version: number;
  source: "ai" | "fixture";
  status: ActionStatus;
  decision?: string;
}
export interface Policy {
  scope: string;
  action: Action;
  level: 1 | 2 | 3;
  limit: number;
  history: { level: number; at: string; reason: string }[];
  streak: string[];
  followup: boolean;
}
export interface Receipt {
  id: string;
  hash: string;
  at: string;
  runId: string;
  status: ActionStatus;
  type: string;
  target: string;
  caseId?: string;
  action?: Action;
  level: number;
  policy?: string;
  before: unknown;
  after: unknown;
  verification: string | null;
}
export interface Activity {
  id: string;
  tool: string;
  target: string;
  zone: Zone;
  caseId: string;
  status: ActionStatus | "reading";
  at: string;
}
export interface Movement {
  variantId: string;
  type: string;
  qty: number;
  at: string;
  orderId?: string;
}
export interface ChannelStock {
  shopId: string;
  platform: string;
  productId: string;
  variantId: string;
  desired: number;
  verified: number;
  status: "synced" | "pending" | "failed";
  at: string;
}
export interface Brief {
  date: string;
  at: string;
  paid: number;
  sales: number;
  waiting: string[];
  levels: number[];
  risks: { id: string; value: number | null }[];
  low: string[];
  reminders: string[];
}
export interface Shop {
  schema: 1;
  id: string;
  name: string;
  mode: "simulated";
  runId: string;
  revision: number;
  clock: string;
  defaults: { capacity: number; cash: number | null };
  variants: Variant[];
  orders: Order[];
  supplies: Supply[];
  conversations: Conversation[];
  campaigns: Campaign[];
  cases: ShopCase[];
  proposals: Proposal[];
  policies: Policy[];
  receipts: Receipt[];
  activity: Activity[];
  movements: Movement[];
  sync: ChannelStock[];
  endpoint: Record<string, number>;
  returns: { orderId: string; stage: string }[];
  briefs: Brief[];
  paused: boolean;
  ack: { enabled: boolean; text: string };
}
export interface PrivateStore {
  runId: string;
  memories: { text: string; at: string }[];
  chat: { room: string; role: "owner" | "manager"; text: string; at: string }[];
  plans: {
    id: string;
    variantId: string;
    version: number;
    inputs: unknown;
    results: unknown;
    at: string;
  }[];
  rehearsals: {
    id: string;
    date: string;
    version: number;
    text: string;
    reminders: string[];
  }[];
}
export interface Scope {
  runId: string;
  version: number;
}
export const stages: Record<Stage, string> = {
  waiting: "รอหยิบ",
  packing: "กำลังแพ็ก",
  ready: "รอขนส่งรับ",
  picked: "ขนส่งรับแล้ว",
  transit: "ระหว่างทาง",
  delivered: "ส่งสำเร็จ",
  taken: "รับที่หน้าร้าน",
  cancelled: "ยกเลิกแล้ว",
  unpaid: "รอชำระเงิน",
};
export const zones: Record<Zone, string> = {
  shelf: "ชั้นสินค้า",
  pick: "คิวหยิบสินค้า",
  pack: "โต๊ะแพ็ก",
  pickup: "จุดรอขนส่ง",
  carrier: "รถขนส่ง",
  returns: "พื้นที่รับคืน",
  cash: "เคาน์เตอร์เงิน",
  dashboard: "กระดานร้าน",
  computer: "โต๊ะผู้จัดการ",
};
export const statuses: Record<string, string> = {
  proposed: "เสนอแล้ว",
  awaiting: "รอเจ้าของเลือก",
  executing: "กำลังทำ",
  verified: "ทำแล้ว ตรวจผลแล้ว",
  failed: "ทำไม่สำเร็จ",
  uncertain: "ยังไม่แน่ใจผล",
  stale: "ข้อมูลเปลี่ยนแล้ว",
  reading: "กำลังอ่านข้อมูล",
};
export const actions: Record<Action, string> = {
  customer_reply: "ตอบลูกค้า",
  prepare_order: "เตรียมใบปะหน้า",
  pause: "พักโฆษณา",
  reduce: "ลดงบ",
  increase: "เพิ่มงบ",
  enable: "เปิดโฆษณา",
};
export type StreamEvent = {
  type: "state" | "activity";
  runId: string;
  revision: number;
  activity?: Activity;
};
export const dayMs = 86400000;
export const dayKey = (time: string) =>
  new Date(Date.parse(time) + 7 * 3600000).toISOString().slice(0, 10);
export const plus = (time: string, ms: number) =>
  new Date(Date.parse(time) + ms).toISOString();
export const roundQty = (n: number) => Math.round(n * 100) / 100;
export const money = (n: number | null | undefined) =>
  n == null
    ? "ยังไม่ทราบ"
    : new Intl.NumberFormat("th-TH", { maximumFractionDigits: 2 }).format(
        n / 100,
      );
export const thTime = (time: string) =>
  new Date(time).toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
