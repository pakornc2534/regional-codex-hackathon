import {
  dayMs,
  plus,
  type Shop,
  type Order,
  type Stage,
  type Conversation,
  type ShopCase,
  type Variant,
} from "../shared/model";
import { channelKey, facts } from "../shared/facts";
const catalog: [
  string,
  string,
  number,
  string,
  string,
  number,
  number,
  number,
  number,
  number,
  boolean,
][] = [
  [
    "ROBOT",
    "โมเดลหุ่นยนต์ 1/144 · สีขาว",
    1,
    "โมเดล",
    "ยืนยันแล้ว",
    590,
    320,
    420,
    16,
    2,
    true,
  ],
  [
    "FOREST",
    "ฟิกเกอร์กล่องสุ่ม Forest Friends",
    2,
    "ฟิกเกอร์และของสะสม",
    "ยืนยันแล้ว",
    290,
    150,
    680,
    25,
    4,
    false,
  ],
  [
    "KISS-B-CD",
    "BNK48 Kiss me ยกชุด · CD",
    3,
    "ไอดอลและเพลง",
    "ยืนยันแล้ว",
    590,
    330,
    120,
    3,
    1,
    false,
  ],
  [
    "KISS-B-PH",
    "BNK48 Kiss me ยกชุด · Photobook",
    3,
    "ไอดอลและเพลง",
    "ยืนยันแล้ว",
    790,
    430,
    100,
    2,
    1,
    false,
  ],
  [
    "KISS-S-CD",
    "BNK48 Kiss me แยกชิ้น · CD",
    4,
    "ไอดอลและเพลง",
    "ยืนยันแล้ว",
    89,
    35,
    340,
    9,
    2,
    false,
  ],
  [
    "KISS-S-PH",
    "BNK48 Kiss me แยกชิ้น · Photobook",
    4,
    "ไอดอลและเพลง",
    "ยืนยันแล้ว",
    149,
    60,
    260,
    6,
    1,
    false,
  ],
  [
    "KIBOU-CD",
    "Kibouteki Refrain · แพ็ก CD 20 แผ่น",
    5,
    "ไอดอลและเพลง",
    "ยืนยันแล้ว",
    990,
    540,
    90,
    2,
    0,
    true,
  ],
  [
    "KIBOU-PH",
    "Kibouteki Refrain · แพ็ก Photobook 20 เล่ม",
    5,
    "ไอดอลและเพลง",
    "ยืนยันแล้ว",
    1290,
    730,
    70,
    1,
    0,
    true,
  ],
  [
    "KITTY-A",
    "Yu-Gi-Oh! × Hello Kitty · A",
    6,
    "การ์ด",
    "ยังไม่ยืนยัน",
    159,
    65,
    180,
    5,
    1,
    false,
  ],
  [
    "KITTY-B",
    "Yu-Gi-Oh! × Hello Kitty · B",
    6,
    "การ์ด",
    "ยังไม่ยืนยัน",
    159,
    65,
    160,
    4,
    1,
    false,
  ],
  [
    "SONIC",
    "พวงกุญแจ Sonic",
    7,
    "ฟิกเกอร์และของสะสม",
    "ยังไม่ยืนยัน",
    249,
    95,
    2,
    0,
    0,
    false,
  ],
  [
    "FORTUNE",
    "Fortune ลายเซ็น · ชิ้นเดียว",
    8,
    "ไอดอลและเพลง",
    "ชิ้นเดียว",
    1290,
    650,
    0,
    0,
    0,
    false,
  ],
  [
    "RARE-CAR",
    "รถโมเดลสะสม · น้ำเงินพร้อมกล่อง",
    9,
    "โมเดล",
    "ชิ้นเดียว",
    890,
    490,
    1,
    0,
    0,
    true,
  ],
];
export const seedClock = new Date("2026-10-02T06:50:00+07:00").toISOString();
const start = new Date("2026-09-04T00:00:00+07:00").toISOString();
export function seed(runId: string): Shop {
  const variants: Variant[] = catalog.map(
    (
      [sku, name, group, category, sourcing, price, cost, physical, , , large],
      i,
    ) => ({
      id: "sim-v" + (i + 1),
      productId: "sim-p" + group,
      sku,
      name,
      category,
      sourcing,
      kind: sourcing === "ชิ้นเดียว" ? "one-off" : "repeatable",
      price: price * 100,
      cost: cost * 100,
      physical,
      opening: physical,
      large,
      updatedAt: seedClock,
    }),
  );
  const orders: Order[] = [];
  function add(
    d: number,
    i: number,
    ch: "online" | "pos",
    n: number,
    stage: Stage,
    minute: number,
    suffix = "",
    conversationId: string | null = null,
  ) {
    const v = variants[i],
      id = ["sim-o", d, i, ch, n, suffix].filter((x) => x !== "").join("-"),
      createdAt = plus(start, d * dayMs + minute * 60000);
    const paid = stage !== "unpaid",
      online = ch === "online",
      events: Order["events"] = [
        {
          stage: online ? (paid ? "waiting" : "unpaid") : "taken",
          at: createdAt,
        },
      ];
    if (online && ["ready", "picked", "delivered"].includes(stage))
      events.push({ stage: "ready", at: plus(createdAt, 60000) });
    if (online && ["picked", "delivered"].includes(stage))
      events.push({ stage: "picked", at: plus(createdAt, 120000) });
    if (online && stage === "delivered")
      events.push({ stage, at: plus(createdAt, dayMs) });
    orders.push({
      id,
      variantId: v.id,
      qty: 1,
      channel: ch,
      customerId: conversationId
        ? "sim-customer-" + conversationId
        : "sim-customer-" + id,
      conversationId,
      paid,
      paidAmount: paid ? v.price : 0,
      unitPrice: v.price,
      createdAt,
      stage,
      prepareBy:
        online && paid
          ? plus(
              start,
              (d + 1) * dayMs + (suffix === "sonic" ? 9 : 18) * 3600000,
            )
          : null,
      settlement:
        online &&
        paid &&
        Date.parse(createdAt) + 7 * dayMs <= Date.parse(seedClock)
          ? {
              amount: Math.round(v.price * 0.88),
              at: plus(createdAt, 7 * dayMs),
            }
          : null,
      events,
      documents: false,
    });
  }
  for (let d = 0; d < 28; d++)
    catalog.forEach(([sku, , , , , , , , online, pos], i) => {
      const count = online
        ? online + (d % 7 >= 5 ? 2 : (d % 3) - 1)
        : Number(
            (sku === "SONIC" && d % 4 === 0) || (sku === "FORTUNE" && d === 5),
          );
      for (let n = 0; n < count; n++) {
        if (d === 27 && i === 2 && n === count - 1) continue;
        add(
          d,
          i,
          "online",
          n,
          d < 25
            ? "delivered"
            : d < 27
              ? "picked"
              : n < 2
                ? "ready"
                : n === 2
                  ? "waiting"
                  : "picked",
          500 + i * 7 + n,
        );
      }
      for (let n = 0; n < (pos ? pos + Number(d % 7 >= 5) : 0); n++)
        add(d, i, "pos", n, "taken", 650 + i * 7 + n);
    });
  add(27, 10, "online", 0, "waiting", 1180, "sonic", "sim-inbox-2");
  add(27, 2, "online", 0, "waiting", 1190, "kiss", "sim-inbox-3");
  add(27, 10, "online", 1, "unpaid", 1200, "unpaid", "sim-inbox-1");
  for (const [i, n] of [
    [0, 10],
    [1, 12],
    [4, 4],
  ])
    for (let k = 0; k < n; k++)
      add(28, i, "online", k, "waiting", 310 + i * 5 + k);
  const conversations: Conversation[] = [
    "SONIC ชิ้นสุดท้าย",
    "ติดตามพัสดุ SONIC",
    "สอบถาม Kiss me",
    "สอบถาม Fortune",
  ].map((title, i) => {
    const id = "sim-inbox-" + (i + 1);
    return {
      id,
      title,
      variantId: variants[[10, 10, 2, 11][i]].id,
      customerId: "sim-customer-" + id,
      owner: "agent",
      episode: 1,
      waiting: true,
      ackEpisode: 0,
      messages: [
        {
          id: "sim-msg-" + i,
          at: plus(seedClock, -600000),
          role: "customer",
          text: [
            "พวงกุญแจ Sonic ยังเหลือไหมคะ",
            "พัสดุของฉันถึงไหนแล้วคะ",
            "Kiss me แบบ CD ยังมีไหมคะ",
            "Fortune ลายเซ็นยังมีของไหมคะ",
          ][i],
        },
      ],
    };
  });
  const sonic = orders.find((o) => o.id.endsWith("-sonic"))!;
  const cases: ShopCase[] = [
    {
      id: "sim-case-1",
      type: "reply",
      target: conversations[0].id,
      variantId: variants[10].id,
      title: "ตอบลูกค้าเรื่อง SONIC ชิ้นสุดท้าย",
      episode: 1,
      orderIds: [],
      deadline: null,
    },
    {
      id: "sim-case-2",
      type: "prepare",
      target: sonic.prepareBy!,
      variantId: sonic.variantId,
      title: "เตรียมพัสดุ SONIC ก่อน 09:00",
      episode: 0,
      orderIds: [sonic.id],
      deadline: sonic.prepareBy,
    },
    {
      id: "sim-case-3",
      type: "ads",
      target: "sim-ad-1",
      variantId: sonic.variantId,
      title: "ทบทวนโฆษณา SONIC",
      episode: 0,
      orderIds: [],
      deadline: null,
    },
  ].map(
    (c) =>
      ({
        ...c,
        status: "open",
        createdAt: seedClock,
        evidence: "ข้อมูลจำลอง ณ เวลาเปิดร้าน",
      }) as ShopCase,
  );
  const supplies: Shop["supplies"] = [
    ["กล่องเล็ก", "กล่อง", 900, 600, 3],
    ["กล่องใหญ่", "กล่อง", 260, 1200, 4],
    ["กันกระแทก", "เมตร", 1050, 400, 2],
    ["เทป", "เมตร", 2100, 50, 2],
    ["ใบปะหน้า", "แผ่น", 1000, 80, 2],
    ["หมึก", "มล.", 135, 200, 3],
  ].map(([name, unit, quantity, cost, lead], i) => ({
    id: "sim-m" + i,
    name: String(name),
    unit: String(unit),
    quantity: Number(quantity),
    cost: Number(cost),
    lead: Number(lead),
  }));
  const s: Shop = {
    schema: 1,
    id: "sim-shop",
    name: "bankzar",
    mode: "simulated",
    runId,
    revision: 1,
    clock: seedClock,
    defaults: { capacity: 120, cash: 3000000 },
    variants,
    orders,
    conversations,
    cases,
    supplies,
    proposals: [],
    policies: [],
    receipts: [],
    activity: [],
    movements: [],
    sync: [],
    endpoint: {},
    returns: [],
    briefs: [],
    paused: false,
    ack: {
      enabled: false,
      text: "ได้รับข้อความแล้วค่ะ ผู้จัดการร้านจะตรวจสอบให้สักครู่นะคะ",
    },
    campaigns: [[10], [4, 5], [0], [1]].map((indices, i) => {
      const variantIds = indices.map((k) => variants[k].id),
        budget = [120, 180, 300, 250][i] * 100;
      return {
        id: "sim-ad-" + (i + 1),
        variantIds,
        budget,
        status: "active",
        spend: 6 * budget,
        clicks: Math.floor((6 * budget) / 400),
        attributedOrderIds: orders
          .filter(
            (o) =>
              variantIds.includes(o.variantId) &&
              o.channel === "online" &&
              o.paid &&
              o.createdAt >= plus(start, 22 * dayMs),
          )
          .filter((_, n) => n % 4 === 0)
          .map((o) => o.id),
        period: ["2026-09-26", "2026-10-02"],
      };
    }),
  };
  for (const o of orders)
    if (["picked", "delivered", "taken"].includes(o.stage))
      variants.find((v) => v.id === o.variantId)!.opening += o.qty;
  for (const v of facts(s).variants) {
    s.endpoint[channelKey(v)] = v.available;
    s.sync.push({
      shopId: s.id,
      platform: "shopee-th",
      productId: v.productId,
      variantId: v.id,
      desired: v.available,
      verified: v.available,
      status: "synced",
      at: s.clock,
    });
  }
  s.returns = orders
    .filter((o) => o.stage === "delivered")
    .slice(0, 2)
    .map((o, i) => ({
      orderId: o.id,
      stage: i ? "ถึงร้านรอตรวจ" : "ระหว่างทางกลับ",
    }));
  return s;
}
