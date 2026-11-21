import { useEffect, useRef, useState } from 'react';
import { Bot, Calculator, CheckCircle2, ChevronDown, FlaskConical, Package, RotateCcw, Save, Timer, TrendingUp, TriangleAlert } from 'lucide-react';
import { Dialog, Empty, Metric, Notice } from './components';
import { baht, count, evaluate, modes, problem, type Growth, type Mode, type PlanInputs, type ShopState, type Variant } from './model';

const shared = [
  ['days', 'ระยะเวลา (วัน)', '1', '1'],
  ['quota', 'จำกัดจำนวนขาย (ชิ้น)', '0', '1'],
  ['feeRate', 'ค่าธรรมเนียม (0–1)', '0', '0.01'],
  ['packingCapacity', 'กำลังแพ็กต่อวัน (ชิ้น)', '0', '1'],
  ['cash', 'เงินสดตั้งต้น (บาท)', '0', '1'],
  ['carrierDisruptionDays', 'วันที่ขนส่งหยุด (วัน)', '0', '1'],
  ['settlementDelay', 'รอรับเงินหลังขาย (วัน)', '0', '1'],
  ['demandLift', 'ตัวคูณความต้องการ', '0', '0.01'],
  ['baselineDemand', 'ยอดขายปกติออนไลน์ต่อวัน (ชิ้น)', '0', 'any'],
] satisfies Field[];
type Field = [key: string, label: string, min: string, step: string];
const byMode: Record<Mode, Field[]> = {
  ads: [['dailyBudget', 'งบแอดต่อวัน (บาท)', '0', '1'], ['cpc', 'ต้นทุนต่อคลิก (บาท)', '0.01', '0.01'], ['conversionRate', 'อัตราคลิกเป็นยอดขาย (0–1)', '0', '0.01']],
  flash: [['discountAmount', 'ส่วนลดต่อชิ้น (บาท)', '0', '0.01'], ['slotFee', 'ค่าพื้นที่โปรโมชัน (บาท)', '0', '1']],
  marketing: [['discountAmount', 'ส่วนลดต่อชิ้น (บาท)', '0', '0.01'], ['voucher', 'มูลค่าคูปองที่ร้านออก (บาท)', '0', '0.01'], ['voucherUsage', 'อัตราใช้คูปอง (0–1)', '0', '0.01'], ['platformVoucher', 'คูปองที่แพลตฟอร์มออก (บาท)', '0', '0.01'], ['sellerShipping', 'ค่าส่งที่ร้านรับผิดชอบ (บาท/ชิ้น)', '0', '0.01'], ['affiliateRate', 'ค่านายหน้า (0–1)', '0', '0.01'], ['otherFixedCosts', 'ต้นทุนการตลาดอื่น (บาท)', '0', '0.01']],
  investment: [['loanPrincipal', 'เงินกู้ (บาท)', '0', '1'], ['apr', 'ดอกเบี้ยต่อปี (0–1)', '0', '0.01'], ['loanFees', 'ค่าธรรมเนียมเงินกู้ (บาท)', '0', '1'], ['graceDays', 'ระยะพักชำระ (วัน)', '0', '1'], ['installments', 'จำนวนงวด', '1', '1'], ['restockUnits', 'จำนวนสินค้าที่สั่ง (ชิ้น)', '0', '1'], ['restockSpend', 'ต้นทุนซื้อสินค้ารวม (บาท)', '0', '0.01'], ['restockDelay', 'วันที่สินค้ามาถึง (นับจากวันเริ่มแผน)', '0', '1']],
};
function example(variantId: string, mode: Mode, days: number): PlanInputs {
  return {
    variantId, mode, days, quota: 100, feeRate: 0.12, demandLift: 1, carrierDisruptionDays: 0, settlementDelay: 7,
    ...(mode === 'ads' ? { dailyBudget: 300, cpc: 4, conversionRate: 0.03 } : {}),
    ...(mode === 'flash' ? { discountAmount: 0, slotFee: 0 } : {}),
    ...(mode === 'marketing' ? { discountAmount: 0, voucher: 0, voucherUsage: 0, sellerShipping: 0, affiliateRate: 0, otherFixedCosts: 0 } : {}),
    ...(mode === 'investment' ? { loanPrincipal: 0, loanFees: 0, graceDays: 0, installments: 1, restockUnits: 0, restockDelay: 0 } : {}),
  };
}
export function PlanDialog({ variant, mode, state, previous, onClose, onSubmit }: { variant: Variant; mode: Mode; state: ShopState; previous?: PlanInputs; onClose: () => void; onSubmit: (inputs: PlanInputs) => void }) {
  const [inputs, setInputs] = useState(() => previous?.variantId === variant.id && previous.mode === mode ? previous : example(variant.id, mode, 1));
  const field = ([key, label, min, step]: Field) => <label key={key} className="field">{label}
    <input type="number" min={min} step={step} max={key.endsWith('Rate') || key === 'voucherUsage' ? 1 : undefined}
      value={inputs[key] ?? ''} placeholder={key === 'cash' ? `${count(state.defaults.cash)} · ค่าเริ่มต้นร้าน` : key === 'packingCapacity' ? `${count(state.defaults.packingCapacity)} · ค่าเริ่มต้นร้าน` : undefined}
      required={key === 'days' || key === 'cpc'} onChange={event => {
        const value = event.currentTarget.value;
        setInputs(current => {
          const updated = { ...current };
          if (value.trim() === '') delete updated[key];
          else updated[key] = Number(value);
          return updated;
        });
      }}/>
    {(key === 'cash' || key === 'packingCapacity') && <label className="check-row"><input type="checkbox" checked={inputs[key] === null} onChange={event => {
      const checked = event.currentTarget.checked;
      setInputs(current => {
        const updated = { ...current };
        if (checked) updated[key] = null;
        else delete updated[key];
        return updated;
      });
    }}/> ยังไม่ทราบ</label>}
  </label>;
  return <Dialog title={modes[mode]} description={`${variant.productName} · ${variant.sellerSku}`} onClose={onClose}>
    <form onSubmit={event => { event.preventDefault(); onSubmit(inputs); }}>
      <div className="choice-row sample-buttons">{[1, 7, 14].map(days => <button key={days} type="button" className={inputs.days === days ? 'active' : ''} onClick={() => setInputs(example(variant.id, mode, days))}>ตัวอย่าง {days} วัน</button>)}</div>
      <p className="muted">{mode === 'flash' ? 'กรอกค่าพื้นที่โปรโมชันเฉพาะกรณีที่มีค่าใช้จ่าย' : 'ผลประเมินใช้ข้อมูลและสมมติฐานของร้านจำลอง'}</p>
      <div className="form-grid">{byMode[mode].map(field)}{shared.slice(0, 2).map(field)}</div>
      <details className="assumptions"><summary>สมมติฐานและข้อจำกัด <ChevronDown size={16}/></summary><div className="form-grid">{shared.slice(2).map(field)}</div></details>
      <div className="dialog-actions"><button type="button" className="secondary" onClick={onClose}>ยกเลิก</button><button className="primary" type="submit"><Calculator size={17}/> ประเมินแผนนี้</button></div>
    </form>
  </Dialog>;
}

export function usePlanEvaluation(state: ShopState | undefined, inputs: PlanInputs | undefined, editing: boolean, variantId: string | undefined) {
  const [result, setResult] = useState<Growth>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const request = useRef(0);
  const runId = state?.runId;
  const revision = state?.revision;
  useEffect(() => {
    if (!inputs || !runId || inputs.variantId !== variantId || editing) return;
    const seq = ++request.current;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    evaluate({ ...inputs, runId }, controller.signal).then(value => {
      if (controller.signal.aborted || seq !== request.current) return;
      if (value.runId !== runId || value.variantId !== variantId || value.revision !== revision) {
        setError('ข้อมูลร้านเปลี่ยนระหว่างประเมิน กรุณาประเมินอีกครั้ง');
        return;
      }
      setResult(value);
    }).catch(error => { if (!controller.signal.aborted) setError(problem(error)); }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [inputs, runId, revision, variantId, editing, attempt]);
  const current = result?.variantId === variantId && result?.runId === runId ? result : undefined;
  return {
    result: current, error, loading: loading && !editing,
    stale: !!current && (current.revision !== revision || editing || loading),
    retry: () => setAttempt(value => value + 1),
  };
}

export function PlanResults({ evaluation, onSave, onDiscuss, onSupplies, onPacking, unavailable }: {
  evaluation: ReturnType<typeof usePlanEvaluation>;
  onSave: () => void; onDiscuss: () => void; onSupplies: () => void; onPacking: () => void; unavailable: boolean;
}) {
  const { result, error, loading, stale, retry } = evaluation;
  return <section className="panel plan-results" id="plan-results">
    <div className="section-head"><div><h2>ผลประเมินแผน</h2><p>เปรียบเทียบยอดขายปกติ ต้นทุน และข้อจำกัดของร้าน</p></div><FlaskConical size={22} className="subtle-icon"/></div>
    {error && <><Notice error>{error}</Notice><button className="secondary" onClick={retry}><RotateCcw size={14}/> ประเมินอีกครั้ง</button></>}
    {loading && <p role="status" className="muted">กำลังประเมินจากข้อมูลร้านล่าสุด…</p>}
    {stale && <Notice>ผลเดิมอาจไม่ตรงกับข้อมูลร้านล่าสุด</Notice>}
    {!result && !loading && !error && <Empty>เลือกสินค้า เปิดแบบฟอร์มแผน แล้วกดประเมินเพื่อดูผลกระทบ</Empty>}
    {result && <>
      {result.adSpend !== null && result.adSpend > 0 && result.adRecoveryUnits !== null && result.baselineUnits !== null && <div className="plan-answer"><TrendingUp size={24}/><div>
        <strong>ถ้าขายเพิ่มจากปกติ {count(result.adRecoveryUnits)} ชิ้นขึ้นไป รวมอย่างน้อย {count(result.baselineUnits + result.adRecoveryUnits)} ชิ้น เงินที่เหลือหลังหักต้นทุนจะพอจ่ายค่าแอด {count(result.adSpend)} บาทแล้ว</strong>
        <p>คาดการณ์จากข้อสมมติของแผน ยอดขายจริงขึ้นกับความต้องการและความพร้อมของร้าน</p></div></div>}
      <div className="metric-grid three">
        <Metric label="ยอดขายปกติ" value={count(result.baselineUnits)} detail="ชิ้น"/>
        <Metric label="ความต้องการตามแผน" value={count(result.planDemand)} detail="ชิ้น"/>
        <Metric label="จำนวนที่ร้านรองรับ" value={count(result.supportablePlanUnits)} detail="ชิ้น"/>
      </div>
      <dl className="fact-list">
        <div><dt>เงินเหลือต่อชิ้นก่อนต้นทุนคงที่</dt><dd>{baht(result.unitContribution)}</dd></div>
        <div><dt>เงินเหลือหลังต้นทุนที่ระบุ · ปกติ</dt><dd>{baht(result.baselineContribution)}</dd></div>
        <div><dt>เงินเหลือหลังต้นทุนที่ระบุ · ตามแผน</dt><dd>{baht(result.planContribution)}</dd></div>
        <div><dt>ขายให้คุ้มทั้งแผนเทียบปกติ</dt><dd>{result.requiredTotalUnits === null ? 'ยังประเมินไม่ได้' : `${count(result.requiredTotalUnits)} ชิ้น (เพิ่ม ${count(result.requiredAdditionalUnits)})`}</dd></div>
        <div><dt>สต็อกที่จัดสรรให้ขายออนไลน์ได้</dt><dd>{count(result.allocatableStock)} ชิ้น</dd></div>
        <div><dt>รองรับจากวัสดุแพ็ก</dt><dd>{count(result.materialCapacity)} ชิ้น</dd></div>
        <div><dt>กำลังแพ็กที่เหลือ</dt><dd>{count(result.preparationCapacity)} ชิ้น</dd></div>
        <div><dt>รายได้ตามแผน</dt><dd>{baht(result.revenue)}</dd></div>
        <div><dt>เงินสดต่ำสุดของแผน</dt><dd>{baht(result.lowestCash)}</dd></div>
      </dl>
      {result.adSpend !== null && result.adSpend > 0 && result.adRecoveryUnits !== null && result.adRecoveryUnits > 0 && result.unitContribution !== null && <p className="reason-line">
        ที่ {count(result.adRecoveryUnits - 1)} ชิ้น เงินเหลือ {baht((result.adRecoveryUnits - 1) * result.unitContribution)} · ที่ {count(result.adRecoveryUnits)} ชิ้น เงินเหลือ {baht(result.adRecoveryUnits * result.unitContribution)} · หลังหักค่าแอด {baht(result.adRecoveryUnits * result.unitContribution - result.adSpend)}
      </p>}
      {result.warnings.length ? <ul className="plan-warnings">{result.warnings.map((warning, index) => <li key={index}><TriangleAlert size={16}/>{warning}</li>)}</ul> : <p className="success-line"><CheckCircle2 size={16}/> ตรวจสอบข้อจำกัดของร้านแล้ว</p>}
      <div className="choice-row"><button className="secondary" onClick={onSupplies}><Package size={15}/> ดูวัสดุแพ็ก</button><button className="secondary" onClick={onPacking}><Timer size={15}/> ดูคิวแพ็ก</button><button className="secondary" disabled={stale} onClick={onDiscuss}><Bot size={15}/> คุยกับผู้จัดการ AI</button><button className="primary" disabled={stale || unavailable} onClick={onSave}><Save size={15}/> บันทึกแผน</button></div>
    </>}
  </section>;
}
