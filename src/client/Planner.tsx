import { useQueryClient } from "@tanstack/react-query";
import type { ReadModel } from "../server/read-model";
import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUpRight,
  Calculator,
  Bookmark,
  TriangleAlert,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Input } from "@/components/ui/input";
import { money, type Zone } from "../shared/model";
import type { PlanInputs, PlanResult } from "../shared/planner";
import { request, ui, useShop } from "./client";
const fields: [keyof PlanInputs, string, number, number][] = [
  ["days", "ระยะเวลา (วัน)", 1, 1],
  ["dailyBudget", "งบแอดต่อวัน (บาท)", 300, 100],
  ["cpc", "ราคาต่อคลิก (บาท)", 4, 100],
  ["conversion", "อัตราซื้อ (%)", 3, 0.01],
  ["fee", "ค่าธรรมเนียมสมมติ (%)", 12, 0.01],
  ["quota", "โควตาขาย (ชิ้น)", 100, 1],
  ["discount", "ส่วนลดต่อชิ้น (บาท)", 0, 100],
  ["demandLift", "ตัวคูณความต้องการ", 1, 1],
  ["fixed", "ค่าใช้จ่ายคงที่อื่น (บาท)", 0, 100],
  ["capacity", "กำลังแพ็ก (ชิ้น/วัน)", 120, 1],
  ["cash", "เงินสดสำหรับวางแผน (บาท)", 30000, 100],
  ["delay", "ระยะรอรับเงิน (วัน)", 7, 1],
];
export function Planner() {
  const cache = useQueryClient(),
    { s, cmd, report, ask } = useShop(),
    { selected, drafts, result, change } = ui(),
    variant = s.variants.find((v) => v.id === selected)!,
    draft = drafts[selected] ?? { variantId: selected };
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [more, setMore] = useState(false);
  const output = useRef<HTMLDivElement>(null),
    id = useRef(0),
    mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      id.current++;
    };
  }, []);
  const scoped =
      result?.variantId === selected && result.runId === s.runId
        ? result
        : null,
    stale = scoped && scoped.version !== s.revision;
  function edit(next: Partial<PlanInputs>) {
    id.current++;
    change({
      drafts: { ...drafts, [selected]: { ...draft, ...next } },
      result: null,
    });
    setBusy(false);
  }
  async function evaluate() {
    const ticket = ++id.current;
    setBusy(true);
    setError("");
    try {
      const r = await request<PlanResult>("/api/sim/plan", {
        runId: s.runId,
        version: s.revision,
        inputs: draft,
      });
      const current = cache.getQueryData<ReadModel>(["shop"]);
      if (
        mounted.current &&
        id.current === ticket &&
        ui.getState().selected === selected &&
        current?.runId === r.runId &&
        current.revision === r.version
      ) {
        change({ result: r });
        setTimeout(
          () =>
            output.current?.scrollIntoView({
              block: "nearest",
              behavior: "smooth",
            }),
          70,
        );
      }
    } catch (e) {
      if (mounted.current) setError((e as Error).message);
    } finally {
      if (mounted.current && id.current === ticket) setBusy(false);
    }
  }
  const target = (zone: Zone) => {
    change({ planner: false, zone });
    if (zone === "pick") change({ page: "shipping", zone: null });
    if (zone === "pack") change({ page: "supplies", zone: null });
  };
  return (
    <div className="planner">
      <div className="eyebrow">{variant.sku} · ข้อมูลจำลอง</div>
      <p>
        {variant.name} · เหลือขาย {variant.available} ชิ้น
      </p>
      <ToggleGroup
        type="single"
        variant="outline"
        aria-label="ระยะเวลาตัวอย่าง"
        value={String(draft.days ?? 1)}
        onValueChange={(value) => {
          if (value) {
            const d = Number(value);
            edit({
              days: d,
              dailyBudget: d === 1 ? 30000 : d === 7 ? 25000 : 20000,
              quota: d * 100,
            });
          }
        }}
      >
        {[1, 7, 14].map((d) => (
          <ToggleGroupItem value={String(d)} key={d}>
            {d} วัน
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <FieldGroup className="fields">
        {fields
          .filter((_, i) => more || i < 4)
          .map(([key, label, def, mult]) => (
            <Field key={key}>
              <FieldLabel htmlFor={"plan-" + key}>{label}</FieldLabel>
              <Input
                id={"plan-" + key}
                aria-label={label}
                type="number"
                min="0"
                step="any"
                value={
                  draft[key] === null
                    ? ""
                    : draft[key] === undefined
                      ? key === "capacity"
                        ? s.defaults.capacity
                        : key === "cash"
                          ? s.defaults.cash === null
                            ? ""
                            : s.defaults.cash / 100
                          : def
                      : Number(draft[key]) / mult
                }
                onChange={(e) =>
                  edit({
                    [key]:
                      e.target.value === ""
                        ? key === "cash" || key === "capacity"
                          ? null
                          : undefined
                        : Number(e.target.value) * mult,
                  })
                }
              />
            </Field>
          ))}
      </FieldGroup>
      <div className="row">
        <Button variant="ghost" onClick={() => setMore(!more)}>
          {more ? "ย่อสมมติฐาน" : "ดูสมมติฐานทั้งหมด"} <ArrowDown />
        </Button>
        <Button onClick={evaluate} disabled={busy}>
          <Calculator />
          {busy ? "กำลังประเมิน…" : stale ? "ประเมินใหม่" : "ประเมินแผนนี้"}
        </Button>
      </div>
      {error && (
        <p role="alert" className="alert">
          {error} <button onClick={evaluate}>ลองอีกครั้ง</button>
        </p>
      )}
      {scoped && (
        <div ref={output} className="plan-result" aria-live="polite">
          <h3>ผลประเมินแผน</h3>
          {stale && <p className="alert">ข้อมูลเปลี่ยนแล้ว · ประเมินใหม่ก่อนบันทึก</p>}
          <p className="lead-result">
            {scoped.targets.recover === null
              ? scoped.m === null
                ? "ยังไม่ทราบต้นทุน หรือข้อมูลที่จำเป็นต่อการประเมิน"
                : "รายได้ต่อชิ้นไม่พอคืนค่าแอด"
              : scoped.baselineUnits === null
                ? "ยังไม่ทราบกำลังแพ็ก จึงยังยืนยันยอดรวมที่ร้านรองรับไม่ได้"
                : scoped.queueOver
                  ? "คิวเดิมเกินกำลังแพ็ก " + scoped.queueOver + " ชิ้น จึงรับงานใหม่ไม่ได้"
                  : "ถ้าขายเพิ่มจากปกติ " +
                    scoped.targets.recover +
                    " ชิ้นขึ้นไป รวมอย่างน้อย " +
                    ((scoped.baselineUnits ?? 0) + scoped.targets.recover) +
                    " ชิ้น เงินที่เหลือหลังหักต้นทุนจะพอจ่ายค่าแอด " +
                    money(scoped.spend) +
                    " บาทแล้ว"}
          </p>
          <div className="eyebrow">
            ผลกระทบต่อเนื่อง · งบแอด ฿{money(scoped.spend)}
          </div>
          <div className="impact">
            {scoped.impact.map((n) => (
              <button key={n.label} onClick={() => target(n.zone)}>
                <span>{n.label}</span>
                <strong>
                  {n.zone === "cash" ? money(n.need) : (n.need ?? "—")} /{" "}
                  {n.zone === "cash" ? money(n.have) : (n.have ?? "—")}
                </strong>
                <small>
                  {n.status === "ไม่พอ" ? (
                    <TriangleAlert size={13} />
                  ) : (
                    <CheckCircle2 size={13} />
                  )}{" "}
                  {n.status}
                  {scoped.bottleneck === n.zone ? " · คอขวด" : ""}
                </small>
              </button>
            ))}
          </div>
          <small>
            ตัวเลขแสดงที่ต้องใช้ / ที่มี · ตึงเมื่อใช้ตั้งแต่ 80% · ความต้องการซื้อเป็นสมมติฐาน
          </small>
          <dl className="facts">
            {[
              [
                "ยอดปกติ / ที่คาด / รองรับได้จริง",
                [
                  scoped.baselineDemand,
                  scoped.demand,
                  scoped.units ?? "—",
                ].join(" / ") + " ชิ้น",
              ],
              ["เงินเหลือต่อชิ้นก่อนค่าแอด", money(scoped.m) + " บาท"],
              ["รายรับตามแผน", money(scoped.revenue) + " บาท"],
              [
                "ยอดขายจากแอด / ค่าแอดย้อนหลัง",
                scoped.historicalAd
                  ? money(scoped.historicalAd.attributedRevenue) +
                    " / " +
                    money(scoped.historicalAd.spend) +
                    " บาท · ROAS " +
                    (scoped.historicalAd.roas?.toFixed(2) ?? "ยังประเมินไม่ได้") +
                    " · " +
                    scoped.historicalAd.period.join(" ถึง ")
                  : "ไม่มีแคมเปญ",
              ],
              [
                "ราคาขาย / ต้นสินค้า / ค่าแพ็ก / ค่าธรรมเนียมต่อชิ้น",
                [scoped.price, scoped.productCost, scoped.packCost, scoped.fee]
                  .map(money)
                  .join(" / ") + " บาท",
              ],
              [
                "เงินเหลือหลังต้นทุนที่ระบุ · ปกติ / ตามแผน",
                money(scoped.baseline) +
                  " / " +
                  money(scoped.contribution) +
                  " บาท",
              ],
              ["ส่วนต่างจากยอดปกติ", money(scoped.gain) + " บาท"],
              [
                "เทียบให้คุ้มเท่ายอดปกติ",
                (scoped.targets.total ?? "—") +
                  " ชิ้นรวม · เพิ่ม " +
                  (scoped.targets.additional ?? "—") +
                  " ชิ้น",
              ],
              ["เงินสดต่ำสุด", money(scoped.lowestCash) + " บาท"],
              [
                "กำลังแพ็กที่กันให้คิวเดิม / สินค้าอื่น",
                scoped.queue + " / " + scoped.otherUnits + " ชิ้น",
              ],
            ].map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          <details>
            <summary>วัสดุและข้อจำกัดของเป้าทั้งสอง</summary>
            {scoped.materials.map((m) => (
              <p key={m.id}>
                {m.name} · กันให้สินค้าอื่น {Number(m.other.toFixed(2))} · ขาด{" "}
                {Number(m.short.toFixed(2))}
              </p>
            ))}
            {scoped.targetChecks.map((t, i) => (
              <p key={i}>
                {i ? "เท่าฐานเดิม" : "คืนค่าแอด"} · ต้องขาย {t.required ?? "—"} ชิ้น ·
                ส่วนที่ขาดตามสต็อก วัสดุ กำลังแพ็ก โควตา และความต้องการ{" "}
                {t.resources.map((r) => r.short ?? "—").join(" / ")}
              </p>
            ))}
          </details>
          <div className="row">
            <Button
              variant="outline"
              disabled={!!stale}
              onClick={() =>
                cmd(
                  { type: "savePlan", inputs: scoped.inputs },
                  { runId: scoped.runId, version: scoped.version },
                )
              }
            >
              <Bookmark />
              บันทึกแผน
            </Button>
            <Button
              variant="outline"
              disabled={!!stale}
              onClick={() => {
                change({
                  manager: true,
                  planner: false,
                  zone: null,
                  page: "planning",
                });
                void ask(
                  "ช่วยอธิบายผลกระทบของแผน " +
                    variant.sku +
                    " ตามสมมติฐานนี้ " +
                    JSON.stringify(scoped.inputs),
                  "planning",
                ).catch(report);
              }}
            >
              คุยกับผู้จัดการ <ArrowUpRight />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
