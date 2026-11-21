import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Input } from "@/components/ui/input";
import { Play, Bookmark } from "lucide-react";
import {
  presets,
  type RehearsalInput,
  type RehearsalResult,
} from "../shared/rehearsal";
import { money } from "../shared/model";
import { request, useShop } from "./client";
export function Rehearsal() {
  const { s, cmd, ask, report } = useShop(),
    dates = presets(s),
    [date, setDate] = useState(dates[0]),
    [mult, setMult] = useState(5),
    [res, setRes] = useState<RehearsalResult | null>(null),
    [opt, setOpt] = useState<RehearsalInput["option"]>(),
    [busy, setBusy] = useState(false);
  const generation = useRef(0);
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  const invalidate = () => {
    generation.current++;
    setRes(null);
    setBusy(false);
  };
  async function run(option?: RehearsalInput["option"]) {
    const ticket = ++generation.current;
    setBusy(true);
    try {
      const r = await request<RehearsalResult>("/api/sim/rehearsal", {
        runId: s.runId,
        version: s.revision,
        inputs: { date, multiplier: mult, option },
      });
      if (generation.current !== ticket) return;
      setRes(r);
      setOpt(option);
    } catch (e) {
      report(e);
    } finally {
      if (generation.current === ticket) setBusy(false);
    }
  }
  const stale = res && (res.version !== s.revision || res.runId !== s.runId);
  return (
    <section className="panel">
      <h2>ซ้อมวันแคมเปญบนสำเนาร้าน</h2>
      <ToggleGroup
        type="single"
        variant="outline"
        value={date}
        aria-label="เลือกวันแคมเปญ"
        onValueChange={(d) => {
          if (d) {
            setDate(d);
            invalidate();
          }
        }}
      >
        {dates.map((d) => (
          <ToggleGroupItem key={d} value={d}>
            {d.slice(5).replace("-", ".")}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <FieldGroup className="fields">
        <Field>
          <FieldLabel htmlFor="rehearsal-date">วันแคมเปญ</FieldLabel>
          <Input
            id="rehearsal-date"
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              invalidate();
            }}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="rehearsal-multiplier">
            ตัวคูณยอดขาย · สมมติฐาน
          </FieldLabel>
          <Input
            id="rehearsal-multiplier"
            type="number"
            min="0"
            max="30"
            value={mult}
            onChange={(e) => {
              setMult(Number(e.target.value));
              invalidate();
            }}
          />
        </Field>
      </FieldGroup>
      <Button disabled={busy} onClick={() => run()}>
        <Play />
        ซ้อมแคมเปญ
      </Button>
      {res && (
        <>
          <h3>ผลการซ้อม · {date}</h3>
          {stale && <p className="alert">ข้อมูลเปลี่ยนแล้ว</p>}
          <div className="split">
            {[res.before, res.after].map(
              (r, i) =>
                r && (
                  <div className="summary-box" key={i}>
                    <b>{i ? "หลังเตรียมร้าน" : "ก่อนเตรียมร้าน"}</b>
                    <p>
                      {r.first
                        ? r.first.date + " · " + r.first.reason
                        : "ทรัพยากรเพียงพอ"}
                    </p>
                    <p>
                      คิววันแคมเปญ {r.peak} ชิ้น · เลยกำหนด {r.late} พัสดุ
                    </p>
                    <p>เงินสดต่ำสุด {money(r.lowest)} บาท</p>
                    {r.materials
                      .filter((m) => m.date)
                      .map((m) => (
                        <p key={m.id}>
                          {m.name} ขาด {m.short} {m.unit} · {m.date}
                        </p>
                      ))}
                    <details>
                      <summary>ผลกระทบในวันแคมเปญ</summary>
                      <dl className="facts">
                        <div>
                          <dt>งบแอดสมมติที่ยังเปิดต่อวัน</dt>
                          <dd>฿{money(r.impact.dailyAds)}</dd>
                        </div>
                        <div>
                          <dt>ต้องการซื้อ / มีให้ขาย</dt>
                          <dd>
                            {r.impact.requested} / {r.impact.accepted} ชิ้น
                          </dd>
                        </div>
                        <div>
                          <dt>วัสดุที่ขาดระหว่างซ้อม</dt>
                          <dd>{r.impact.materialsShort} รายการ</dd>
                        </div>
                        <div>
                          <dt>งานแพ็ก / กำลังแพ็ก</dt>
                          <dd>
                            {r.impact.work} / {r.impact.capacity} ชิ้น
                          </dd>
                        </div>
                        <div>
                          <dt>เงินสดปิดวัน</dt>
                          <dd>฿{money(r.impact.closingCash)}</dd>
                        </div>
                      </dl>
                    </details>
                    <details>
                      <summary>ความต้องการที่พลาดรายสินค้า</summary>
                      {r.unmet.map((v) => (
                        <p key={v.sku}>
                          {v.sku} · {v.qty} ชิ้น
                        </p>
                      ))}
                    </details>
                  </div>
                ),
            )}
          </div>
          <h3>เตรียมรับแคมเปญ</h3>
          {res.options.map((o) => (
            <Button
              key={o.id}
              variant={opt === o.id ? "default" : "outline"}
              disabled={busy || !!stale}
              onClick={() => run(o.id)}
            >
              {s.owner.rehearsalProposals.some(
                (p) =>
                  p.version === res.version &&
                  p.date === res.date &&
                  p.multiplier === res.multiplier &&
                  p.optionIds.includes(o.id),
              ) && <Badge variant="secondary">ผู้จัดการแนะนำ</Badge>}
              {o.text}
              {o.extra ? " +" + o.extra + " ชิ้น/วัน" : ""}
            </Button>
          ))}
          <div className="row">
            <Button
              variant="outline"
              disabled={!!stale}
              onClick={() =>
                ask("ช่วยเลือกทางเตรียมร้านจากผลซ้อม", "rehearsal", {
                  rehearsal: { date, multiplier: mult },
                })
              }
            >
              คุยกับผู้จัดการ
            </Button>
            {opt && (
              <Button
                disabled={!!stale}
                onClick={() =>
                  cmd(
                    {
                      type: "saveRehearsal",
                      inputs: { date, multiplier: mult, option: opt },
                    },
                    { runId: res.runId, version: res.version },
                  )
                }
              >
                <Bookmark />
                บันทึกแผนเตรียมร้าน
              </Button>
            )}
          </div>
          {res.reminders.map((r) => (
            <p key={r}>{r}</p>
          ))}
        </>
      )}
    </section>
  );
}
