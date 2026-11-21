import { ConversationLog } from "./ConversationLog";
import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  Calculator,
  ChevronRight,
  MessageCircle,
  PackageCheck,
  Search,
  ShoppingBag,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogHeader,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import {
  money,
  stages,
  statuses,
  actions,
  thTime,
  acknowledgements,
  type Stage,
  type Zone,
  type Action,
} from "../shared/model";
import { go, request, ui, useShop } from "./client";
import type { ReadModel } from "../server/read-model";
import type { orderView } from "../server/fulfillment";
export const Hint = ({ children }: { children: React.ReactNode }) => (
  <Empty className="empty">
    <EmptyHeader>
      <EmptyTitle>{children}</EmptyTitle>
    </EmptyHeader>
  </Empty>
);
export function DataTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: React.ReactNode[][];
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {headers.map((h) => (
            <TableHead key={h}>{h}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r, i) => (
          <TableRow key={i}>
            {r.map((cell, j) => (
              <TableCell key={j}>{cell}</TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
export function CaseList({ short = false }: { short?: boolean }) {
  const { s } = useShop(),
    { change } = ui(),
    cs = s.cases.filter((c) => c.status === "open");
  return (
    <div className="case-list">
      {(short ? cs.slice(0, 3) : cs).map((c) => {
        const I =
          c.type === "reply"
            ? MessageCircle
            : c.type === "prepare"
              ? PackageCheck
              : ShoppingBag;
        return (
          <button
            className="case-line"
            key={c.id}
            onClick={() => {
              go("cases");
              change({ caseId: c.id });
            }}
          >
            <span className={"case-icon " + c.type}>
              <I />
            </span>
            <span>
              <b>{c.title}</b>
              <small>{c.risk.detail}</small>
            </span>
            <span className="risk">
              {c.risk.value === null
                ? "ยังประเมินไม่ได้"
                : "฿" + money(c.risk.value)}
            </span>
            <ChevronRight size={16} />
          </button>
        );
      })}
      {!cs.length && <Hint>ไม่มีเคสรอเจ้าของเลือก</Hint>}
    </div>
  );
}
export function Options({ caseId }: { caseId: string }) {
  const { s, cmd, busy } = useShop(),
    pr = [...s.proposals].reverse().find((p) => p.caseId === caseId);
  if (!pr) return null;
  const receipt = [...s.receipts]
    .reverse()
    .find((r) => r.caseId === caseId && r.action);
  const currentCase = s.cases.find((c) => c.id === caseId);
  const inbox =
    currentCase?.type === "reply"
      ? s.conversations.find((t) => t.id === currentCase.target)
      : null;
  const delivered = inbox?.messages.find((m) => m.id === receipt?.verification);
  return (
    <div className="options">
      <Badge variant="secondary">
        {statuses[pr.status]} · {pr.source === "ai" ? "ผู้จัดการ AI" : "ข้อมูลทดสอบ"}
      </Badge>
      {receipt && (
        <section className="readback">
          <b>
            {statuses[receipt.status]} · {thTime(receipt.at)}
          </b>
          <p>
            {delivered
              ? "ข้อความที่อ่านกลับจาก " + inbox?.title + " · " + delivered.text
              : receipt.action === "prepare_order"
                ? "เอกสารที่ตรวจพบ " +
                  (Array.isArray(receipt.after) ? receipt.after.length : 0) +
                  " ชุด"
                : receipt.action
                  ? actions[receipt.action]
                  : ""}
          </p>
          <small>
            {receipt.level === 1
              ? "เจ้าของเป็นผู้เลือก"
              : "ผู้จัดการทำตามกฎระดับ " +
                receipt.level +
                " · " +
                (currentCase?.title ?? "")}
          </small>
          {inbox && delivered && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                go("inbox");
                ui.getState().change({ inbox: inbox.id, manager: false });
              }}
            >
              เปิดข้อความที่ส่ง
            </Button>
          )}
        </section>
      )}
      {pr.options.map((o) => (
        <div key={o.id} className="option">
          <b>{actions[o.action]}</b>
          <p>{o.text}</p>
          <small>{o.reason}</small>
          {o.amount !== undefined && <p>งบใหม่ ฿{money(o.amount)} ต่อวัน</p>}
          <Button
            disabled={
              busy || pr.status !== "proposed" || s.revision !== pr.version
            }
            onClick={() => cmd({ type: "choose", target: pr.id, option: o.id })}
          >
            {o.action === "customer_reply" ? "ส่งข้อความนี้" : "เลือกทางนี้"}
          </Button>
        </div>
      ))}
    </div>
  );
}
export function PolicyForm({ c }: { c: ReadModel["cases"][number] }) {
  const { s, cmd } = useShop(),
    allowed: Action[] =
      c.type === "ads"
        ? ["pause", "reduce", "increase", "enable"]
        : c.type === "reply"
          ? ["customer_reply"]
          : ["prepare_order"],
    [action, setAction] = useState<Action>(allowed[0]),
    [lev, setLev] = useState(1),
    [limit, setLimit] = useState(c.type === "ads" ? 120 : 1);
  const p = s.policies.find((p) => p.scope === c.target && p.action === action);
  return (
    <details open={p?.followup || undefined}>
      <summary>
        {p?.followup
          ? "งานแบบนี้ครั้งหน้าให้ทำเองตามกฎ หรือถามทุกครั้ง?"
          : "สิทธิ์และเพดานของงานประเภทนี้"}
      </summary>
      <div className="fields">
        <label>
          ประเภทงาน
          <select
            value={action}
            onChange={(e) => setAction(e.target.value as Action)}
          >
            {allowed.map((a) => (
              <option key={a} value={a}>
                {actions[a]}
              </option>
            ))}
          </select>
        </label>
        <label>
          ระดับสิทธิ์
          <select value={lev} onChange={(e) => setLev(Number(e.target.value))}>
            {["ถามทุกครั้ง", "ทำเอง แล้วแจ้งทันที", "ทำเอง แล้วสรุปในบรีฟ"].map(
              (n, i) => (
                <option key={n} value={i + 1}>
                  {i + 1} · {n}
                </option>
              ),
            )}
          </select>
        </label>
        <label>
          {c.type === "ads" ? "เพดานงบต่อวัน (บาท)" : "เพดานจำนวนข้อความหรือพัสดุ"}
          <Input
            type="number"
            value={limit}
            min="0"
            onChange={(e) => setLimit(Number(e.target.value))}
          />
        </label>
      </div>
      <Button
        variant="outline"
        onClick={() =>
          cmd({
            type: "policy",
            target: c.id,
            action,
            level: lev as 1 | 2 | 3,
            limit: limit * (c.type === "ads" ? 100 : 1),
          })
        }
      >
        บันทึกสิทธิ์
      </Button>
      {p && (
        <p>
          สิทธิ์ปัจจุบันระดับ {p.level} · {p.history.at(-1)?.reason}
        </p>
      )}
      {p && p.level === 1 && p.streak.length >= 3 && (
        <p>
          ผู้จัดการเสนอให้เพิ่มระดับ หลังเจ้าของอนุมัติต่อเนื่องในเคส{" "}
          {p.streak
            .map((id) => s.cases.find((c) => c.id === id)?.title)
            .join(" · ")}
        </p>
      )}
    </details>
  );
}
export function Cases() {
  const { s, ask } = useShop(),
    { caseId, change } = ui(),
    c = s.cases.find((x) => x.id === caseId) ?? s.cases[0];
  return (
    <>
      <section className="panel">
        <h2>รอเจ้าของเลือก</h2>
        <CaseList />
      </section>
      {c && (
        <section className="panel">
          <Badge variant="secondary">
            {c.status === "closed" ? "ดำเนินการแล้ว" : "เคสที่เลือก"}
          </Badge>
          <h2>{c.title}</h2>
          <p>{c.evidence}</p>
          <p>
            {c.risk.detail} · {money(c.risk.value)} บาท
          </p>
          {c.type === "ads" &&
            s.campaigns
              .find((a) => a.id === c.target)
              ?.variantIds.map((id) => {
                const v = s.variants.find((x) => x.id === id)!;
                return (
                  <p key={id}>
                    {v.sku} เหลือขาย {v.available} ชิ้น
                  </p>
                );
              })}
          <div className="row">
            <Button
              onClick={() => ask("ตรวจข้อมูลล่าสุดและเสนอทางเลือกให้เจ้าของ", c.id)}
            >
              วิเคราะห์เคสนี้
            </Button>
            {c.type === "reply" && (
              <Button
                variant="outline"
                onClick={() => {
                  go("inbox");
                  change({ inbox: c.target });
                }}
              >
                เปิดแชทลูกค้า
              </Button>
            )}
          </div>
          <Options caseId={c.id} />
          <PolicyForm key={c.id} c={c} />
        </section>
      )}
      <section className="panel">
        <h3>เคสที่ดำเนินการแล้ว</h3>
        {s.cases
          .filter((c) => c.status === "closed")
          .map((c) => (
            <Button
              variant="ghost"
              key={c.id}
              onClick={() => change({ caseId: c.id })}
            >
              {c.title}
            </Button>
          ))}
      </section>
    </>
  );
}
export function Inbox() {
  const { s, cmd, busy } = useShop(),
    { inbox, change } = ui(),
    [value, setValue] = useState(""),
    t = s.conversations.find((x) => x.id === inbox) ?? s.conversations[0];
  return (
    <section className="panel">
      <div className="chips">
        {s.conversations.map((x) => (
          <Button
            key={x.id}
            size="sm"
            variant={t.id === x.id ? "default" : "outline"}
            onClick={() => change({ inbox: x.id })}
          >
            {x.title}
          </Button>
        ))}
      </div>
      <h2>{t.title}</h2>
      <ConversationLog messages={t.messages} />
      <div className="row">
        <Button
          disabled={busy}
          variant="outline"
          onClick={() =>
            cmd({
              type: t.owner === "agent" ? "takeover" : "handback",
              target: t.id,
            })
          }
        >
          {t.owner === "agent" ? "รับช่วงแชทนี้" : "คืนแชทให้ผู้จัดการ"}
        </Button>
        <Button
          disabled={busy}
          variant="outline"
          onClick={() => cmd({ type: "ack", enabled: !s.ack.enabled })}
        >
          {s.ack.enabled ? "ปิด" : "เปิด"}ข้อความรับเรื่อง
        </Button>
      </div>
      <label>
        ข้อความรับเรื่อง
        <select
          disabled={busy}
          value={s.ack.text}
          onChange={(e) => {
            const text = acknowledgements.find((t) => t === e.target.value);
            if (text) void cmd({ type: "ack", enabled: s.ack.enabled, text });
          }}
        >
          {acknowledgements.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </label>
      <label>
        ข้อความสำหรับแชทจำลอง
        <Textarea
          value={value}
          maxLength={1800}
          onChange={(e) => setValue(e.target.value)}
        />
      </label>
      <div className="row">
        <Button
          disabled={busy || !value.trim()}
          onClick={async () => {
            if (await cmd({ type: "message", target: t.id, text: value }))
              setValue("");
          }}
        >
          จำลองลูกค้าส่งข้อความ
        </Button>
        {t.owner === "human" && (
          <Button
            variant="outline"
            disabled={busy || !value.trim()}
            onClick={async () => {
              if (await cmd({ type: "humanReply", target: t.id, text: value }))
                setValue("");
            }}
          >
            ส่งในนามเจ้าของ
          </Button>
        )}
      </div>
    </section>
  );
}
export function Product() {
  const { s, cmd } = useShop(),
    { selected, change } = ui(),
    v = s.variants.find((v) => v.id === selected)!,
    sync = s.sync.find((x) => x.variantId === v.id),
    [qty, setQty] = useState(1);
  return (
    <>
      <Badge variant="secondary">
        {v.category} · {v.sku}
      </Badge>
      <h3>{v.name}</h3>
      <div className="mini-kpis">
        {[
          ["ของที่ร้าน", v.physical],
          ["กันไว้แล้ว", v.reserved],
          ["เหลือขาย", v.available],
        ].map(([k, n]) => (
          <div key={k}>
            <small>{k}</small>
            <strong>{n}</strong>
          </div>
        ))}
      </div>
      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">ข้อมูลสินค้า</TabsTrigger>
          <TabsTrigger value="history">การเคลื่อนไหว</TabsTrigger>
        </TabsList>
        <TabsContent value="details">
          <dl className="facts">
            <div>
              <dt>ราคาขาย / ต้นทุน</dt>
              <dd>
                ฿{money(v.price)} / ฿{money(v.cost)}
              </dd>
            </div>
            <div>
              <dt>ยอดส่ง / ยอดยืนยันปลายทาง</dt>
              <dd>
                {sync?.desired} / {sync?.verified} ·{" "}
                {sync?.status === "synced" ? "ตรงกันแล้ว" : "รอตรวจ"}
              </dd>
            </div>
            <div>
              <dt>การเติมสินค้า</dt>
              <dd>{v.sourcing}</dd>
            </div>
          </dl>
        </TabsContent>
        <TabsContent value="history">
          {s.movements
            .filter((m) => m.variantId === v.id)
            .map((m, i) => (
              <p key={i}>
                {thTime(m.at)} · {m.type} {m.qty} ชิ้น
              </p>
            ))}
          <p>ยอดเปิดบัญชี {v.opening} ชิ้น</p>
        </TabsContent>
      </Tabs>
      <div className="row">
        <Button id="open-ad-planner" onClick={() => change({ planner: true })}>
          <Calculator />
          ยิงแอด
        </Button>
      </div>
      <details>
        <summary>จำลองการขายหน้าร้านหรือรับออเดอร์ออนไลน์</summary>
        <label>
          จำนวนชิ้น
          <Input
            type="number"
            min="1"
            value={qty}
            onChange={(e) => setQty(Number(e.target.value))}
          />
        </label>
        <div className="row">
          <Button
            variant="outline"
            onClick={() => cmd({ type: "pos", target: v.id, qty })}
          >
            ขายหน้าร้าน
          </Button>
          <Button
            variant="outline"
            onClick={() => cmd({ type: "online", target: v.id, qty })}
          >
            รับออเดอร์ออนไลน์
          </Button>
        </div>
      </details>
    </>
  );
}
export function Stock() {
  const { s } = useShop(),
    { change } = ui(),
    [q, search] = useState("");
  return (
    <section className="panel">
      <label className="search">
        <Search />
        <Input
          placeholder="ค้นหาชื่อสินค้า หรือ SKU"
          aria-label="ค้นหาสต็อก"
          value={q}
          onChange={(e) => search(e.target.value)}
        />
      </label>
      <DataTable
        headers={["สินค้า", "ของที่ร้าน", "กันไว้", "เหลือขาย"]}
        rows={s.variants
          .filter((v) =>
            (v.name + v.sku).toLowerCase().includes(q.toLowerCase()),
          )
          .map((v) => [
            <button
              className="table-link"
              onClick={() => change({ selected: v.id, zone: "shelf" })}
            >
              {v.sku} <ArrowUpRight size={14} />
              <small>{v.name}</small>
            </button>,
            v.physical,
            v.reserved,
            <b>{v.available}</b>,
          ])}
      />
    </section>
  );
}
export function Supplies() {
  const { s, cmd } = useShop(),
    [id, set] = useState(s.supplies[1].id),
    [q, setQ] = useState(10);
  return (
    <>
      <DataTable
        headers={["วัสดุ", "คงคลัง", "กันไว้", "เหลือใช้", "ควรสั่งภายใน"]}
        rows={s.supplies.map((m) => [
          m.name,
          m.quantity + " " + m.unit,
          m.reserved,
          m.free,
          m.orderBy ?? "ยังประเมินไม่ได้",
        ])}
      />
      <details>
        <summary>รับวัสดุเข้าร้าน</summary>
        <div className="fields">
          <label>
            วัสดุ
            <select value={id} onChange={(e) => set(e.target.value)}>
              {s.supplies.map((m) => (
                <option value={m.id} key={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            จำนวน
            <Input
              min="1"
              type="number"
              value={q}
              onChange={(e) => setQ(Number(e.target.value))}
            />
          </label>
        </div>
        <Button onClick={() => cmd({ type: "receive", target: id, qty: q })}>
          รับวัสดุ
        </Button>
      </details>
    </>
  );
}
export function Shipping({ initial = "waiting" }: { initial?: Stage }) {
  const { s, cmd, report } = useShop(),
    [stage, set] = useState<Stage>(initial),
    [page, pager] = useState(1),
    [rows, setRows] = useState<ReturnType<typeof orderView>[]>([]),
    [total, setTotal] = useState(0),
    [documentOrder, showDocument] = useState<ReturnType<
      typeof orderView
    > | null>(null);
  useEffect(() => {
    let active = true;
    request<{ orders: typeof rows; total: number }>(
      "/api/orders?stage=" + stage + "&page=" + page,
    )
      .then((r) => {
        if (active) {
          setRows(r.orders);
          setTotal(r.total);
        }
      })
      .catch(report);
    return () => {
      active = false;
    };
  }, [s.runId, s.revision, stage, page]);
  return (
    <>
      <div className="chips">
        {(
          [
            "waiting",
            "packing",
            "ready",
            "picked",
            "transit",
            "delivered",
          ] as Stage[]
        ).map((k) => (
          <Button
            size="sm"
            variant={stage === k ? "default" : "outline"}
            key={k}
            onClick={() => {
              set(k);
              pager(1);
            }}
          >
            {stages[k]} {s.fulfillment[k]?.orders}
          </Button>
        ))}
      </div>
      <p>
        {total} พัสดุ · {s.fulfillment[stage]?.units ?? 0} ชิ้น
      </p>
      <DataTable
        headers={["รายการ", "กำหนดเตรียม", "ดำเนินการ"]}
        rows={rows.map((o) => [
          <>
            <b>
              {s.variants.find((v) => v.id === o.variantId)?.sku} × {o.qty}
            </b>
            <small>
              {o.documents ? "มีใบหยิบและใบปะหน้าแล้ว" : stages[o.stage]}
            </small>
          </>,
          o.prepareBy ? thTime(o.prepareBy) : "—",
          <div className="row">
            {o.documents ? (
              <Button size="sm" variant="ghost" onClick={() => showDocument(o)}>
                ดูใบหยิบและใบปะหน้า
              </Button>
            ) : (
              ["waiting", "packing"].includes(stage) && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => cmd({ type: "printDocs", target: o.id })}
                >
                  เตรียมใบปะหน้า
                </Button>
              )
            )}

            {stage === "waiting" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => cmd({ type: "startPacking", target: o.id })}
              >
                เริ่มแพ็ก
              </Button>
            )}
            {["waiting", "packing", "ready", "picked", "transit"].includes(
              stage,
            ) && (
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  cmd({
                    type:
                      stage === "waiting" || stage === "packing"
                        ? "pack"
                        : stage === "ready"
                          ? "pickup"
                          : stage === "picked"
                            ? "transit"
                            : "deliver",
                    target: o.id,
                  })
                }
              >
                {stage === "ready"
                  ? "จำลองขนส่งรับ"
                  : stage === "picked"
                    ? "เริ่มนำส่ง"
                    : stage === "transit"
                      ? "ยืนยันส่งสำเร็จ"
                      : "ยืนยันแพ็กแล้ว"}
              </Button>
            )}
          </div>,
        ])}
      />
      <Dialog
        open={!!documentOrder}
        onOpenChange={(open) => {
          if (!open) showDocument(null);
        }}
      >
        <DialogContent className="shop-dialog">
          <DialogHeader>
            <DialogTitle>ใบหยิบสินค้าและใบปะหน้า</DialogTitle>
            <DialogDescription>เอกสารพัสดุจำลองจากคำสั่งซื้อที่เลือก</DialogDescription>
          </DialogHeader>
          {documentOrder && (
            <div className="shipping-label">
              <Badge variant="outline">พัสดุจำลอง</Badge>
              <h3>ร้าน {s.name}</h3>
              <b>
                {s.variants.find((v) => v.id === documentOrder.variantId)?.name}{" "}
                × {documentOrder.qty} ชิ้น
              </b>
              <p>เลขพัสดุอ้างอิง {documentOrder.id}</p>
              <p>
                กำหนดเตรียม{" "}
                {documentOrder.prepareBy
                  ? thTime(documentOrder.prepareBy)
                  : "ยังไม่ทราบ"}
              </p>
              <p>สถานะ {stages[documentOrder.stage]}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
      {!rows.length && <Hint>ไม่มีพัสดุในขั้นตอนนี้</Hint>}
      <div className="row">
        <Button
          disabled={page === 1}
          variant="outline"
          onClick={() => pager(page - 1)}
        >
          ก่อนหน้า
        </Button>
        <span>หน้า {page}</span>
        <Button
          disabled={page * 30 >= total}
          variant="outline"
          onClick={() => pager(page + 1)}
        >
          ถัดไป
        </Button>
      </div>
    </>
  );
}
export function Memory() {
  const { s, cmd } = useShop(),
    [text, set] = useState("");
  return (
    <section className="panel">
      <h2>ความจำของเจ้าของร้าน</h2>
      <label>
        ข้อจำกัดหรือข้อมูลที่อยากให้ผู้จัดการจำ
        <Textarea
          value={text}
          onChange={(e) => set(e.target.value)}
          maxLength={1800}
        />
      </label>
      <Button
        disabled={!text.trim()}
        onClick={async () => {
          if (await cmd({ type: "memory", text })) set("");
        }}
      >
        บันทึกความจำ
      </Button>
      {s.owner.memories.map((m, i) => (
        <p key={i}>
          {m.text} · {thTime(m.at)}
        </p>
      ))}
      <h3>กฎที่เจ้าของกำหนด</h3>
      {s.policies.length ? (
        s.policies.map((p) => (
          <p key={p.scope + p.action}>
            {actions[p.action]} · ระดับ {p.level} · {p.history.at(-1)?.reason}
          </p>
        ))
      ) : (
        <Hint>งานทุกประเภทเริ่มที่ระดับ 1 ถามเจ้าของทุกครั้ง</Hint>
      )}
      <h3>ผลการดำเนินงาน</h3>
      {s.receipts
        .filter((r) => r.action)
        .slice()
        .reverse()
        .map((r) => (
          <p key={r.id}>
            {actions[r.action!]} · {statuses[r.status]} · ระดับ {r.level}
            {r.policy ? " · " + r.policy : ""}{" "}
            {r.level > 1 &&
              r.type === "autonomous" &&
              ["reduce", "pause"].includes(r.action!) && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => cmd({ type: "reverse", target: r.id })}
                >
                  ย้อนกลับ
                </Button>
              )}
          </p>
        ))}
    </section>
  );
}
export function Brief() {
  const { s, cmd } = useShop(),
    { change } = ui();
  return (
    <section className="panel">
      <h2>บรีฟเวลา 07:00 น.</h2>
      <p>นาฬิการ้าน · {thTime(s.clock)}</p>
      <div className="row">
        <Button onClick={() => cmd({ type: "advance", minutes: 10 })}>
          เดินเวลา 10 นาที
        </Button>
        <Button
          variant="outline"
          onClick={() => cmd({ type: "advance", minutes: 1440 })}
        >
          เดินเวลา 1 วัน
        </Button>
      </div>
      {s.briefs.length ? (
        s.briefs
          .slice()
          .reverse()
          .map((b) => (
            <article className="summary-box" key={b.date}>
              <h3>{b.date}</h3>
              <p>
                ยอดชำระ 7 วัน ฿{money(b.sales)} · {b.paid} ออเดอร์
              </p>
              <p>งานที่ตรวจผลแล้ว ระดับ 1 / 2 / 3 · {b.levels.join(" / ")}</p>
              {b.risks.map((r) => (
                <Button
                  key={r.id}
                  variant="ghost"
                  onClick={() => {
                    go("cases");
                    change({ caseId: r.id });
                  }}
                >
                  {s.cases.find((c) => c.id === r.id)?.title} · ฿
                  {money(r.value)}
                </Button>
              ))}
              {b.low.length > 0 && <p>เหลือน้อย · {b.low.join(", ")}</p>}
              {b.reminders.map((r) => (
                <p key={r}>{r}</p>
              ))}
            </article>
          ))
      ) : (
        <Hint>บรีฟฉบับแรกจะพร้อมเมื่อเวลาในร้านถึง 07:00 น.</Hint>
      )}
    </section>
  );
}
export function ZoneBody({ zone }: { zone: Zone }) {
  const { s } = useShop();
  if (zone === "shelf") return <Product />;
  if (zone === "pack") return <Supplies />;
  if (["pick", "pickup", "carrier"].includes(zone))
    return (
      <Shipping
        initial={
          zone === "pick" ? "waiting" : zone === "pickup" ? "ready" : "picked"
        }
      />
    );
  if (zone === "returns")
    return (
      <DataTable
        headers={["พัสดุคืน", "สถานะ"]}
        rows={s.returns.map((r) => [r.orderId, r.stage])}
      />
    );
  if (zone === "cash")
    return (
      <dl className="facts">
        {[
          ["ยอดขายที่ชำระแล้ว", s.sales],
          ["เงินรับชำระออนไลน์ที่ยืนยันแล้ว", s.settled],
          ["เงินสดสำหรับวางแผน", s.defaults.cash],
        ].map(([k, n]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>฿{money(n as number | null)}</dd>
          </div>
        ))}
      </dl>
    );
  if (zone === "dashboard")
    return (
      <>
        <p>
          ยอดขาย 7 วัน ฿{money(s.weekSales)} · {s.weekCount} ออเดอร์
        </p>
        <Score />
      </>
    );
  return (
    <>
      <p>ร้าน {s.name} · ข้อมูลจำลอง</p>
      <p>
        ผู้จัดการ {s.paused ? "พักงาน" : "รับงานได้"} · {s.policies.length} กฎที่บันทึก
      </p>
      <h3>กิจกรรมล่าสุด</h3>
      {s.activity.length ? (
        s.activity
          .slice(-8)
          .reverse()
          .map((a) => (
            <p key={a.id}>
              {thTime(a.at)} · {statuses[a.status]}
            </p>
          ))
      ) : (
        <Hint>ยังไม่มีกิจกรรมจากผู้จัดการ</Hint>
      )}
    </>
  );
}
export function Score() {
  const { s } = useShop();
  return (
    <div className="mini-kpis wrap">
      {[
        ["ทำเอง", s.score.autonomous],
        ["รอเจ้าของ", s.score.waiting],
        ["ตรวจผลแล้ว", s.score.verified],
        ["ไม่สำเร็จ", s.score.failed],
        ["ยังไม่แน่ใจ", s.score.uncertain],
        ["ทำเองวันนี้", Math.round(s.score.share * 100) + "%"],
      ].map(([k, n]) => (
        <div key={k}>
          <small>{k}</small>
          <strong>{n}</strong>
        </div>
      ))}
    </div>
  );
}
