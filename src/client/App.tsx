import {
  lazy,
  Suspense,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Boxes,
  BrainCircuit,
  CalendarDays,
  ChartColumnIncreasing,
  Check,
  CircleHelp,
  Clock3,
  ClipboardList,
  FlaskConical,
  Headset,
  House,
  Layers3,
  LayoutDashboard,
  Menu,
  MessageSquare,
  Package,
  PanelRightOpen,
  Pause,
  Play,
  Radio,
  RefreshCw,
  RotateCcw,
  Send,
  Settings2,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
  Truck,
  Wallet,
  Warehouse,
  X,
} from "lucide-react";
import { toast, Toaster } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { money, thTime, zones, statuses, type Zone } from "../shared/model";
import {
  StoreContext,
  ui,
  request,
  useShop,
  go,
  pageNames,
  type Payload,
  type Page,
} from "./client";
import type { ReadModel } from "../server/read-model";
import {
  Brief,
  CaseList,
  Cases,
  Hint,
  Inbox,
  Memory,
  Options,
  Score,
  Shipping,
  Stock,
  Supplies,
  ZoneBody,
} from "./Workspaces";
import { ConversationLog } from "./ConversationLog";
import { Planner } from "./Planner";
import { Rehearsal } from "./Rehearsal";
const Gallery = lazy(() => import("./Gallery"));
const groups: [string, [Page, typeof Store][]][] = [
  [
    "หน้าร้าน",
    [
      ["overview", LayoutDashboard],
      ["gallery", Store],
      ["cases", ClipboardList],
      ["inbox", MessageSquare],
    ],
  ],
  [
    "จัดการร้าน",
    [
      ["stock", Boxes],
      ["supplies", Package],
      ["shipping", Truck],
    ],
  ],
  [
    "ผู้จัดการและแผน",
    [
      ["planning", ChartColumnIncreasing],
      ["rehearsal", FlaskConical],
      ["brief", BookOpen],
      ["memory", ShieldCheck],
    ],
  ],
];
function Navigation() {
  const { s } = useShop(),
    { page } = ui();
  return (
    <nav className="navigation" aria-label="เมนูร้าน">
      <div className="brand">
        <div className="brand-icon">
          <Store strokeWidth={1.7} />
        </div>
        <div>
          <strong>ร้านเรา</strong>
          <small>ผู้จัดการร้าน AI</small>
        </div>
      </div>
      <div className="shop-identity">
        <span className="shop-monogram">b</span>
        <span>
          <b>bankzar</b>
          <small>ร้านของสะสม</small>
        </span>
        <Badge variant="outline">จำลอง</Badge>
      </div>
      {groups.map(([title, links]) => (
        <section key={title}>
          <h3>{title}</h3>
          {links.map(([id, I]) => (
            <button
              key={id}
              className={page === id ? "active" : ""}
              aria-current={page === id ? "page" : undefined}
              onClick={() => go(id)}
            >
              <I size={18} />
              <span>{pageNames[id]}</span>
              {id === "cases" && <em>{s.score.waiting}</em>}
            </button>
          ))}
        </section>
      ))}
      <div className="nav-clock">
        <Clock3 size={16} />
        <div>
          <small>นาฬิการ้านจำลอง</small>
          <b>{thTime(s.clock)}</b>
        </div>
      </div>
    </nav>
  );
}
function ManagerDesk() {
  const { s, cmd, ask, report, refresh } = useShop(),
    { page, caseId, change } = ui(),
    [draft, setDraft] = useState(""),
    room =
      page === "cases"
        ? caseId
        : ["rehearsal", "planning"].includes(page)
          ? page
          : "overview",
    c = s.cases.find((c) => c.id === room),
    jobs = s.ai.jobs.filter((j) => j.room === room),
    last = jobs.at(-1),
    [retry, setRetry] = useState(false);
  const chat = s.owner.chat.filter((m) => m.room === room);
  async function send() {
    if (!draft.trim()) return;
    const val = draft;
    setDraft("");
    if (!(await ask(val, room))) setDraft(val);
  }
  return (
    <aside className="manager-desk">
      <div className="manager-heading">
        <span className="ai-icon">
          <Sparkles />
        </span>
        <div>
          <small>ผู้ช่วยประจำร้าน</small>
          <h2>ผู้จัดการ AI</h2>
        </div>
        <span className={"dot " + (s.ai.connected ? "on" : "")} />
      </div>
      <div className="manager-status">
        <span>
          {s.paused
            ? "พักงานอยู่"
            : s.ai.connected
              ? "เชื่อมต่อแล้ว"
              : s.ai.configured
                ? "พร้อมทดสอบการเชื่อมต่อ"
                : "ยังไม่ได้เชื่อมต่อ"}
        </span>
        <button onClick={() => cmd({ type: "control", paused: !s.paused })}>
          {s.paused ? <Play size={12} /> : <Pause size={12} />}{" "}
          {s.paused ? "ทำงานต่อ" : "พักงาน"}
        </button>
      </div>
      <div className="manager-scroll">
        <div className="desk-heading">
          <h3>งานที่รอคุณ</h3>
          <Badge variant="secondary">{s.score.waiting} เคส</Badge>
        </div>
        {s.cases
          .filter((c) => c.status === "open")
          .slice(0, 3)
          .map((k) => (
            <button
              key={k.id}
              className="desk-case"
              onClick={() => {
                go("cases");
                change({ caseId: k.id, manager: false });
              }}
            >
              <span className={"desk-mark " + k.type} />
              <span>
                <b>{k.title}</b>
                <small>
                  {k.type === "prepare"
                    ? "กำหนดส่ง · " + (k.deadline ? thTime(k.deadline) : "—")
                    : k.type === "ads"
                      ? "ตรวจงบและจำนวนที่ขายได้"
                      : "รอคำตอบในแชทลูกค้า"}
                </small>
              </span>
              <ArrowUpRight size={14} />
            </button>
          ))}
        <Separator />
        <div className="desk-heading">
          <h3>คุยกับผู้จัดการ</h3>
          <MessageSquare size={16} />
        </div>
        <small className="muted">
          ห้อง {c?.title ?? pageNames[room as Page] ?? "ภาพรวมร้าน"}
        </small>
        {!s.ai.connected && (
          <div className="connection">
            <Radio size={17} />
            <div>
              <b>
                {s.ai.configured
                  ? "สถานะการเชื่อมต่อ AI"
                  : "ผู้จัดการ AI ยังไม่ได้เชื่อมต่อ"}
              </b>
              <p>{s.ai.error ?? "ส่งคำถามหรือทดสอบการเชื่อมต่อ"}</p>
              <button
                disabled={retry}
                onClick={async () => {
                  setRetry(true);
                  try {
                    const r = await request<ReadModel["ai"]>(
                      "/api/ai/retry",
                      {},
                    );
                    if (!r.connected) report(r.error);
                    await refresh();
                  } finally {
                    setRetry(false);
                  }
                }}
              >
                <RefreshCw size={12} /> {retry ? "กำลังตรวจ…" : "ทดสอบการเชื่อมต่อ"}
              </button>
            </div>
          </div>
        )}
        <ConversationLog messages={chat} />
        {last?.status === "failed" && <p className="alert">{last.error}</p>}
        {last && ["queued", "thinking"].includes(last.status) && (
          <p>
            ผู้จัดการกำลังตรวจข้อมูล…{" "}
            <button
              onClick={() =>
                request("/api/ai/cancel", {
                  runId: s.runId,
                  version: s.revision,
                  jobId: last.id,
                })
                  .then(refresh)
                  .catch(report)
              }
            >
              ยกเลิกงาน
            </button>
          </p>
        )}
        {c && <Options caseId={c.id} />}
      </div>
      <div className="composer">
        <label htmlFor="manager-message">ข้อความถึงผู้จัดการ</label>
        <Textarea
          id="manager-message"
          placeholder="ถามเรื่องร้านหรือแผนนี้…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={1800}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              void send();
            }
          }}
        />
        <Button size="sm" disabled={!draft.trim() || s.paused} onClick={send}>
          <Send />
          ส่งข้อความ
        </Button>
      </div>
    </aside>
  );
}
function ShopGallery({ compact = false }: { compact?: boolean }) {
  const { s } = useShop(),
    { selected, change, result } = ui();
  return (
    <Suspense fallback={<Skeleton className="gallery-placeholder" />}>
      <Gallery
        variants={s.variants}
        selected={selected}
        onSelect={(id) => change({ selected: id })}
        onOpen={(zone) => change({ zone })}
        activity={s.activity.at(-1) ?? null}
        impact={
          result?.version === s.revision
            ? result.impact.map((n) => n.zone)
            : undefined
        }
        bottleneck={result?.bottleneck}
        compact={compact}
      />
    </Suspense>
  );
}
function Overview() {
  const { s } = useShop(),
    { change } = ui();
  return (
    <>
      <div className="metrics">
        {[
          {
            label: "ยอดขายที่ชำระแล้ว",
            value: "฿" + money(s.weekSales),
            sub: "ยอดรวม 7 วัน",
            Icon: Wallet,
            kind: "mint",
          },
          {
            label: "ออเดอร์ที่ชำระแล้ว",
            value: s.weekCount,
            sub: "ออเดอร์ใน 7 วัน",
            Icon: ShoppingBag,
            kind: "wheat",
          },
          {
            label: "สินค้ารอแพ็ก",
            value: s.queue,
            sub: s.parcels + " พัสดุในร้าน",
            Icon: Package,
            kind: "peach",
          },
        ].map(({ label, value, sub, Icon, kind }) => (
          <Card key={label} className="metric">
            <CardHeader>
              <CardTitle>
                <span className={"metric-icon " + kind}>
                  <Icon size={17} />
                </span>
                {label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <strong>{value}</strong>
              <small>{sub}</small>
            </CardContent>
          </Card>
        ))}
      </div>
      <section className="gallery-block">
        <div className="section-heading">
          <div>
            <h2>หน้าร้านของคุณ</h2>
            <p>เลือกสินค้าและจุดทำงานจากร้านจำลอง</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => go("gallery")}>
            เปิดร้าน 3D <ArrowUpRight />
          </Button>
        </div>
        <ShopGallery compact />
      </section>
      <section className="panel">
        <div className="section-heading">
          <h2>เคสที่รอเจ้าของเลือก</h2>
          <Button size="sm" variant="ghost" onClick={() => go("cases")}>
            ดูทั้งหมด <ArrowRight />
          </Button>
        </div>
        <CaseList short />
      </section>
      <div className="overview-lower">
        <Card>
          <CardHeader>
            <CardTitle>ยอดขายย้อนหลัง 7 วัน</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{ sales: { label: "ยอดชำระ (บาท)", color: "#28735d" } }}
              className="chart"
            >
              <AreaChart
                data={s.trend.map((t) => ({
                  ...t,
                  sales: t.sales / 100,
                  day: t.date.slice(8),
                }))}
              >
                <CartesianGrid vertical={false} />
                <XAxis dataKey="day" tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area
                  dataKey="sales"
                  type="monotone"
                  stroke="var(--color-sales)"
                  fill="var(--color-sales)"
                  fillOpacity={0.16}
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>ผลงานของผู้จัดการ</CardTitle>
          </CardHeader>
          <CardContent>
            <Score />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
function PageBody() {
  const { page } = ui();
  switch (page) {
    case "overview":
      return <Overview />;
    case "gallery":
      return <ShopGallery />;
    case "cases":
      return <Cases />;
    case "inbox":
      return <Inbox />;
    case "stock":
      return <Stock />;
    case "supplies":
      return (
        <section className="panel">
          <Supplies />
        </section>
      );
    case "shipping":
      return (
        <section className="panel">
          <Shipping />
        </section>
      );
    case "planning":
      return (
        <section className="panel">
          <Planner />
        </section>
      );
    case "rehearsal":
      return <Rehearsal />;
    case "brief":
      return <Brief />;
    case "memory":
      return <Memory />;
  }
}
const steps = [
  ["เปิด ROBOT ที่ชั้นสินค้า", "ตรวจยอดของที่ร้าน 420 ชิ้น และยอดพร้อมขาย 407 ชิ้น"],
  ["ประเมินแผนยิงแอด 300 บาท", "ดูยอดขายเพิ่มที่ต้องการและกำลังแพ็กที่เหลือ"],
  ["บันทึกแผนเพื่อคุยกับผู้จัดการ", "เก็บสมมติฐานสำหรับการตัดสินใจครั้งนี้"],
  ["วิเคราะห์เคส SONIC", "ให้ผู้จัดการตรวจสต็อกก่อนเสนอข้อความ"],
  ["เลือกข้อความแล้วตรวจกล่องลูกค้า", "ตรวจว่าข้อความที่อนุมัติถึงลูกค้าที่ถูกต้อง"],
  ["ทดลองขาย SONIC ที่หน้าร้าน", "ตรวจยอดคงเหลือและยอดที่ปลายทางยืนยัน"],
  ["เดินนาฬิการ้านถึง 07:00", "อ่านบรีฟของร้านและงานที่รอเจ้าของ"],
];
function Frame() {
  const { s, cmd } = useShop(),
    { page, zone, planner, nav, manager, change, selected, result } = ui(),
    [reset, setReset] = useState(false),
    [step, setStep] = useState<number | null>(null),
    navButton = useRef<HTMLButtonElement>(null),
    deskButton = useRef<HTMLButtonElement>(null),
    opener = useRef<HTMLElement | null>(null),
    previous = useRef(false);
  useEffect(() => {
    if (zone && !previous.current)
      opener.current = document.activeElement as HTMLElement;
    previous.current = !!zone;
  }, [zone]);
  function next() {
    setStep((k) => (k === null || k >= steps.length - 1 ? null : k + 1));
  }
  useEffect(() => {
    if (step === null) return;
    const done = [
      zone === "shelf" && selected === "sim-v1",
      !!result && result.runId === s.runId,
      s.owner.plans.length > 0,
      s.proposals.some(
        (p) => p.caseId === "sim-case-1" && p.status === "proposed",
      ),
      s.receipts.some(
        (r) => r.action === "customer_reply" && r.status === "verified",
      ),
      s.variants.find((v) => v.sku === "SONIC")?.available === 0,
      s.briefs.length > 0,
    ][step];
    if (done) next();
  }, [step, zone, selected, result, s]);
  const captions: Record<Page, string> = {
    overview: "ยอดขาย งานค้าง และสิ่งที่ต้องตัดสินใจในร้านของคุณ",
    gallery: "สำรวจร้านของสะสมและเปิดงานจากแต่ละจุด",
    cases: "ตรวจหลักฐานและเลือกสิ่งที่จะให้ผู้จัดการทำ",
    inbox: "ติดตามบทสนทนาและรับช่วงตอบลูกค้า",
    stock: "ตรวจยอดในร้าน ยอดที่กันไว้ และยอดพร้อมขาย",
    supplies: "วัสดุที่ยังเหลือหลังกันให้พัสดุในคิว",
    shipping: "ติดตามพัสดุตั้งแต่รอหยิบจนถึงมือลูกค้า",
    planning: "ประเมินงบโฆษณาและข้อจำกัดก่อนตัดสินใจ",
    rehearsal: "ทดลองยอดขายวันแคมเปญและเตรียมร้านล่วงหน้า",
    brief: "สรุปงานจากนาฬิกาจำลองตามเวลาประเทศไทย",
    memory: "บริบทที่บันทึกไว้และสิทธิ์ที่เจ้าของกำหนด",
  };
  function jump() {
    change({ planner: false, zone: null });
    if (step === 0)
      change({ selected: "sim-v1", page: "gallery", zone: "shelf" });
    if (step === 1 || step === 2)
      change({ selected: "sim-v1", page: "planning" });
    if (step === 3 || step === 4)
      change({ page: "cases", caseId: "sim-case-1" });
    if (step === 5)
      change({ selected: "sim-v11", page: "stock", zone: "shelf" });
    if (step === 6) go("brief");
  }
  return (
    <div className="shell">
      <div className="nav-desktop">
        <Navigation />
      </div>
      <div className="app-area">
        <header className="topbar">
          <div className="breadcrumb">
            <Button
              size="icon"
              variant="ghost"
              className="mobile-nav"
              ref={navButton}
              onClick={() => change({ nav: true })}
              aria-label="เปิดเมนู"
            >
              <Menu />
            </Button>
            <Store size={16} />
            <span>bankzar</span>
            <i>/</i>
            <b>{pageNames[page]}</b>
          </div>
          <div className="row">
            <Badge variant="outline">
              <span className="sim-dot" />
              ข้อมูลจำลอง
            </Badge>
            <Button
              className="open-manager"
              ref={deskButton}
              size="icon"
              variant="outline"
              onClick={() => change({ manager: true })}
              aria-label="เปิดผู้จัดการ"
            >
              <PanelRightOpen />
            </Button>
            <Button
              size="sm"
              variant="outline"
              aria-label="รีเซ็ตเดโม"
              onClick={() => setReset(true)}
            >
              <RotateCcw />
              <span className="reset-label">รีเซ็ตเดโม</span>
            </Button>
          </div>
        </header>
        {s.shared && (
          <div className="public-note">
            <ShieldCheck size={14} />
            นี่คือร้านจำลองที่ทุกคนใช้ร่วมกัน ทุกคนเห็นบทสนทนาเดียวกัน กรุณาอย่าใส่ข้อมูลส่วนตัว
          </div>
        )}
        <div className="desk-layout">
          <main>
            <div className="page-heading">
              <div>
                <div className="eyebrow">
                  <span />{" "}
                  {new Date(s.clock).toLocaleDateString("th-TH", {
                    timeZone: "Asia/Bangkok",
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </div>
                <h1>{pageNames[page]}</h1>
                <p>{captions[page]}</p>
              </div>
              {step === null && (
                <Button
                  className="demo-btn"
                  onClick={async () => {
                    if (await cmd({ type: "reset" })) {
                      go("overview");
                      setStep(0);
                    }
                  }}
                >
                  <Play />
                  เริ่มเดโม
                </Button>
              )}
            </div>
            {step !== null && (
              <div className="coach">
                <div>
                  <small>
                    เดโม {step + 1} / {steps.length}
                  </small>
                  <b>{steps[step][0]}</b>
                  <p>
                    {steps[step][1]}
                    {[3, 4].includes(step) && !s.ai.connected
                      ? " · ขณะนี้ AI ยังไม่เชื่อมต่อ ข้ามขั้นนี้ได้"
                      : ""}
                  </p>
                </div>
                <div className="row">
                  <Button size="sm" onClick={jump}>
                    เปิดจุดนี้
                  </Button>
                  <Button size="sm" variant="outline" onClick={next}>
                    {step === 6 ? "จบเดโม" : "ถัดไป"}
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="ปิดคำแนะนำ"
                    onClick={() => setStep(null)}
                  >
                    <X />
                  </Button>
                </div>
              </div>
            )}
            <PageBody />
          </main>
          <div className="desk-desktop">
            <ManagerDesk />
          </div>
        </div>
      </div>
      <Sheet open={nav} onOpenChange={(open) => change({ nav: open })}>
        <SheetContent
          side="left"
          className="nav-sheet"
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            navButton.current?.focus();
          }}
        >
          <SheetHeader className="sr-only">
            <SheetTitle>เมนูร้าน</SheetTitle>
            <SheetDescription>เลือกพื้นที่ทำงาน</SheetDescription>
          </SheetHeader>
          <Navigation />
        </SheetContent>
      </Sheet>
      <Sheet open={manager} onOpenChange={(open) => change({ manager: open })}>
        <SheetContent
          className="desk-sheet"
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            deskButton.current?.focus();
          }}
        >
          <SheetHeader className="sr-only">
            <SheetTitle>ผู้จัดการ AI</SheetTitle>
            <SheetDescription>คุยเรื่องร้านและเคสที่เลือก</SheetDescription>
          </SheetHeader>
          <ManagerDesk />
        </SheetContent>
      </Sheet>
      <Dialog
        open={!!zone}
        onOpenChange={(o) => {
          if (!o) change({ zone: null });
        }}
      >
        <DialogContent
          className="shop-dialog"
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            opener.current?.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle>{zone ? zones[zone] : ""}</DialogTitle>
            <DialogDescription>ข้อมูลล่าสุดจากร้าน {s.name}</DialogDescription>
          </DialogHeader>
          {zone && <ZoneBody zone={zone} />}
        </DialogContent>
      </Dialog>
      <Dialog open={planner} onOpenChange={(o) => change({ planner: o })}>
        <DialogContent className="shop-dialog">
          <DialogHeader>
            <DialogTitle>ลองแผนยิงแอด</DialogTitle>
            <DialogDescription>ประเมินผลก่อนใช้งบจริง</DialogDescription>
          </DialogHeader>
          {planner && <Planner />}
        </DialogContent>
      </Dialog>
      <Dialog open={reset} onOpenChange={setReset}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>เริ่มร้านจำลองรอบใหม่?</DialogTitle>
            <DialogDescription>
              ระบบจะเก็บประวัติรอบเดิมและสร้างร้านใหม่ให้ทุกคนที่เปิดเดโมนี้
            </DialogDescription>
          </DialogHeader>
          <Button
            onClick={async () => {
              if (await cmd({ type: "reset" })) {
                setReset(false);
                setStep(null);
                go("overview");
              }
            }}
          >
            ยืนยันรีเซ็ตเดโม
          </Button>
          <Button variant="outline" onClick={() => setReset(false)}>
            กลับ
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
export default function App() {
  const cache = useQueryClient(),
    q = useQuery({
      queryKey: ["shop"],
      queryFn: () => request<ReadModel>("/api/state"),
      retry: 1,
    }),
    s = q.data,
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    lastRun = useRef(""),
    active = useRef(false);
  const refresh = async () => {
    await cache.invalidateQueries({ queryKey: ["shop"] });
  };
  useEffect(() => {
    const es = new EventSource("/api/events");
    es.onmessage = () => void refresh();
    return () => es.close();
  }, []);
  useEffect(() => {
    if (s && lastRun.current && lastRun.current !== s.runId)
      ui.getState().change({
        selected: "sim-v1",
        caseId: "sim-case-1",
        inbox: "sim-inbox-1",
        result: null,
        drafts: {},
        planner: false,
        zone: null,
      });
    if (s) lastRun.current = s.runId;
  }, [s?.runId]);
  const report = (e: unknown) => {
    const msg = e instanceof Error ? e.message : String(e ?? "ไม่ทราบสาเหตุ");
    setError(msg);
    toast.error(msg);
  };
  async function cmd(
    body: Payload,
    scope?: { runId: string; version: number },
  ) {
    if (!s || active.current) return false;
    active.current = true;
    setBusy(true);
    setError("");
    try {
      const r = await request<{ status: string }>(
        body.type === "memory" ? "/api/memories" : "/api/sim/command",
        {
          ...body,
          runId: scope?.runId ?? s.runId,
          version: scope?.version ?? s.revision,
          key: crypto.randomUUID(),
        },
      );
      await refresh();
      toast.success(statuses[r.status] ?? "บันทึกแล้ว");
      return true;
    } catch (e) {
      report(e);
      await refresh();
      return false;
    } finally {
      active.current = false;
      setBusy(false);
    }
  }
  async function ask(text: string, room = "overview", extra = {}) {
    if (!s) return false;
    try {
      await request("/api/chat", {
        runId: s.runId,
        version: s.revision,
        room,
        variantId: ui.getState().selected,
        text,
        ...extra,
      });
      await refresh();
      return true;
    } catch (e) {
      report(e);
      await refresh();
      return false;
    }
  }
  if (!s)
    return (
      <div className="boot">
        <Store size={40} />
        <h1>ร้านเรา</h1>
        {q.isError ? (
          <>
            <p>เปิดข้อมูลร้านไม่ได้ · {q.error.message}</p>
            <Button onClick={() => q.refetch()}>ลองอีกครั้ง</Button>
          </>
        ) : (
          <>
            <p>กำลังเปิดร้านจำลอง…</p>
            <Skeleton className="h-3 w-48" />
          </>
        )}
      </div>
    );
  return (
    <StoreContext.Provider value={{ s, cmd, ask, report, busy, refresh }}>
      <Frame />
      <Toaster position="bottom-center" richColors />
      {error && (
        <div role="alert" className="command-error">
          <span>{error}</span>
          <button aria-label="ปิดข้อความ" onClick={() => setError("")}>
            <X size={14} />
          </button>
        </div>
      )}
    </StoreContext.Provider>
  );
}
