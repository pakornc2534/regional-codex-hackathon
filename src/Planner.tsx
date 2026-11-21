import { useEffect, useRef, useState } from 'react';
import { Bot, Calculator, Check, ChevronDown, Coins, Megaphone, Package, RotateCcw, Save, TicketPercent, Timer, TriangleAlert, Zap } from 'lucide-react';
import { z } from 'zod';
import { Dialog, Empty, Notice } from './components';
import { bahtAmount } from '../shared/baht.mjs';
import { count, evaluate, modes, problem, type Growth, type Mode, type PlanInputs, type ShopState, type Variant } from './model';
import './planner.css';

const planTools = [
  { mode: 'ads', Icon: Megaphone },
  { mode: 'flash', Icon: Zap },
  { mode: 'marketing', Icon: TicketPercent },
  { mode: 'investment', Icon: Coins },
] as const;

export function PlanTools({ current, disabled, onOpen }: { current?: Mode; disabled: boolean; onOpen: (mode: Mode) => void }) {
  return <div className="plan-tools" role="group" aria-label="เลือกประเภทแผน">
    <div className="plan-tools-grid">{planTools.map(({ mode, Icon }) =>
      <button key={mode} type="button" className="plan-tool" data-mode={mode}
        data-featured={mode === (current ?? 'ads')} aria-current={mode === current ? 'true' : undefined}
        aria-haspopup="dialog" disabled={disabled} onClick={() => onOpen(mode)}>
        <span className="plan-ticket">
          <span className="plan-tool-icon" aria-hidden="true"><Icon size={23} strokeWidth={2}/></span>
          <span className="plan-tool-label">{modes[mode]}</span>
          {mode === current && <Check className="plan-tool-check" size={15} strokeWidth={3} aria-hidden="true"/>}
        </span>
      </button>
    )}</div>
  </div>;
}

type Field = [key: string, label: string, unit: string, min: number, step: number | 'any'];
const shared = [
  ['days', 'ระยะเวลา', 'วัน', 1, 1],
  ['quota', 'จำนวนสูงสุดที่เปิดขาย', 'ชิ้น', 0, 1],
  ['feeRate', 'ค่าธรรมเนียมการขาย', '%', 0, 0.01],
  ['packingCapacity', 'กำลังแพ็กต่อวัน', 'ชิ้น', 0, 1],
  ['cash', 'เงินสดตั้งต้น', 'บาท', 0, 0.01],
  ['carrierDisruptionDays', 'ขนส่งหยุดรับพัสดุ', 'วัน', 0, 1],
  ['settlementDelay', 'ระยะรอรับเงินหลังขาย', 'วัน', 0, 1],
  ['demandLift', 'ยอดที่คาดเทียบกับปกติ', 'เท่า', 0, 0.01],
  ['baselineDemand', 'ยอดขายออนไลน์ปกติต่อวัน', 'ชิ้น', 0, 'any'],
] satisfies Field[];
const byMode: Record<Mode, Field[]> = {
  ads: [
    ['dailyBudget', 'งบแอดต่อวัน', 'บาท', 0, 0.01],
    ['cpc', 'ค่าโฆษณาต่อคลิก', 'บาท', 0.01, 0.01],
    ['conversionRate', 'สัดส่วนคลิกที่ซื้อสินค้า', '%', 0, 0.01],
  ],
  flash: [
    ['discountAmount', 'ส่วนลดต่อชิ้น', 'บาท', 0, 0.01],
    ['slotFee', 'ค่าพื้นที่โปรโมชัน', 'บาท', 0, 0.01],
  ],
  marketing: [
    ['discountAmount', 'ส่วนลดต่อชิ้น', 'บาท', 0, 0.01],
    ['voucher', 'คูปองที่ร้านออก', 'บาท', 0, 0.01],
    ['voucherUsage', 'สัดส่วนลูกค้าที่ใช้คูปอง', '%', 0, 0.01],
    ['platformVoucher', 'คูปองที่แพลตฟอร์มออก', 'บาท', 0, 0.01],
    ['sellerShipping', 'ค่าส่งที่ร้านออกต่อชิ้น', 'บาท', 0, 0.01],
    ['affiliateRate', 'ค่านายหน้า', '%', 0, 0.01],
    ['otherFixedCosts', 'ค่าใช้จ่ายการตลาดอื่น', 'บาท', 0, 0.01],
  ],
  investment: [
    ['loanPrincipal', 'เงินที่ต้องการกู้', 'บาท', 0, 0.01],
    ['apr', 'ดอกเบี้ยต่อปี', '%', 0, 0.01],
    ['loanFees', 'ค่าธรรมเนียมเงินกู้', 'บาท', 0, 0.01],
    ['graceDays', 'ระยะพักชำระ', 'วัน', 0, 1],
    ['installments', 'แบ่งชำระ', 'งวด', 1, 1],
    ['restockUnits', 'สั่งสินค้าเพิ่ม', 'ชิ้น', 0, 1],
    ['restockSpend', 'จ่ายค่าสินค้าที่สั่งเพิ่ม', 'บาท', 0, 0.01],
    ['restockDelay', 'รอสินค้ามาถึง', 'วัน', 0, 1],
  ],
};
const groupNames: Record<Mode, string> = { ads: 'ค่าโฆษณา', flash: 'ราคาที่ร่วมโปรโมชัน', marketing: 'ส่วนลดและคูปอง', investment: 'เงินกู้และการผ่อนชำระ' };
const modeNotes: Record<Mode, string> = {
  ads: 'ใช้สัดส่วนคลิกที่ซื้อสินค้าเพื่อคาดยอดขายเพิ่ม',
  flash: 'ถ้าร่วมโปรโมชันฟรี ให้ใส่ค่าพื้นที่ 0 บาท',
  marketing: 'แยกส่วนลดที่ร้านจ่ายออกจากคูปองของแพลตฟอร์ม',
  investment: 'กรอกวันรับสินค้าและเงื่อนไขกู้ เพื่อดูว่าเงินสดพอถึงวันรับยอดขายไหม',
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
export function PlanDialog({ variant, mode, state, previous, onClose, onSubmit, onDraft }: { variant: Variant; mode: Mode; state: ShopState; previous?: PlanInputs; onClose: () => void; onSubmit: (inputs: PlanInputs) => void; onDraft: (inputs: PlanInputs) => void }) {
  const [inputs, setInputs] = useState(() => previous?.variantId === variant.id && previous.mode === mode ? previous : example(variant.id, mode, 1));
  function update(next: PlanInputs) {
    setInputs(next);
    onDraft(next);
  }
  function field([key, label, unit, min, step]: Field) {
    const isPercent = unit === '%';
    const value = inputs[key];
    const unknown = value === null;
    const numberValue = typeof value === 'number' && isPercent ? Number((value * 100).toFixed(8)) : value;
    const useShop = key === 'cash' || key === 'packingCapacity';
    const fallback = key === 'cash' ? state.defaults.cash : state.defaults.packingCapacity;
    const hint = useShop && !unknown ? count(fallback) : key === 'baselineDemand' ? 'ใช้ยอดย้อนหลัง' : key === 'apr' ? 'ยังไม่ทราบ' : undefined;
    const max = key === 'days' ? 365 : isPercent ? (key === 'apr' ? 1000 : 100) : undefined;
    return <div className="field plan-field" key={key}>
      <label htmlFor={'plan-field-' + key}>{label}</label>
      <div className="plan-number-entry">
        <input id={'plan-field-' + key} type="number" min={min} step={step} max={max}
          value={numberValue ?? ''} placeholder={unknown ? 'ยังไม่ทราบ' : hint}
          disabled={unknown && useShop} aria-label={label + ' (' + unit + ')'}
          required={key === 'days' || key === 'cpc'} onChange={event => {
            const raw = event.currentTarget.value;
            const updated = { ...inputs };
            if (raw.trim() === '') delete updated[key];
            else updated[key] = Number(raw) / (isPercent ? 100 : 1);
            update(updated);
          }}/>
        <span aria-hidden="true">{unit}</span>
      </div>
      {useShop && <label className="check-row"><input type="checkbox" checked={unknown} onChange={event => {
        const updated = { ...inputs };
        if (event.currentTarget.checked) updated[key] = null;
        else delete updated[key];
        update(updated);
      }}/> ยังไม่ทราบ{key === 'cash' ? 'เงินสด' : 'กำลังแพ็ก'}</label>}
    </div>;
  }
  const fields = byMode[mode];
  const mainFields = mode === 'investment' ? fields.slice(0, 5) : mode === 'marketing' ? fields.slice(0, 4) : fields;
  return <Dialog title={modes[mode]} description={variant.productName + ' · ' + variant.sellerSku} onClose={onClose}>
    <form className="plan-form" onSubmit={event => { event.preventDefault(); onSubmit(inputs); }}>
      <div className="plan-form-body">
        <div className="plan-example"><span>ตั้งค่าจากตัวอย่าง</span>
          <div className="choice-row sample-buttons">{[1, 7, 14].map(days => <button key={days} type="button" className={inputs.days === days ? 'active' : ''} aria-label={'ตัวอย่าง ' + days + ' วัน'} onClick={() => update(example(variant.id, mode, days))}>{days} วัน</button>)}</div>
        </div>
        <fieldset className="plan-field-group">
          <legend>{groupNames[mode]}</legend>
          <p>{modeNotes[mode]}</p>
          <div className="form-grid">{mainFields.map(field)}</div>
        </fieldset>
        {mode === 'investment' && <fieldset className="plan-field-group">
          <legend>สั่งสินค้าและวัสดุ</legend><div className="form-grid">{fields.slice(5).map(field)}
            <label className="field plan-field">วัสดุที่สั่งซื้อ<select value={inputs.supplyId ?? ''} onChange={event => {
              update({ ...inputs, supplyId: event.currentTarget.value || null, supplyQuantity: 0, supplySpend: 0, supplyDelay: 0 });
            }}>
              <option value="">ไม่ได้สั่งวัสดุ</option>{state.supplies.map(item => <option value={item.id} key={item.id}>{item.name} · {item.unit}</option>)}
            </select></label>
            {inputs.supplyId && ([['supplyQuantity','ปริมาณที่สั่ง',state.supplies.find(item=>item.id===inputs.supplyId)?.unit ?? 'หน่วย',0,'any'],['supplySpend','จ่ายค่าวัสดุที่สั่งเพิ่ม','บาท',0,0.01],['supplyDelay','รอวัสดุมาถึง','วัน',0,1]] satisfies Field[]).map(field)}
          </div>
        </fieldset>}
        {mode === 'marketing' && <fieldset className="plan-field-group"><legend>ค่าใช้จ่ายของร้าน</legend><div className="form-grid">{fields.slice(4).map(field)}</div></fieldset>}
        <fieldset className="plan-field-group"><legend>ขอบเขตแผน</legend><div className="form-grid">{shared.slice(0, 2).map(field)}</div></fieldset>
        <details className="plan-fold"><summary>สมมติฐานและข้อจำกัด <ChevronDown size={16}/></summary>
          <div className="form-grid">{shared.slice(2).map(field)}</div>
        </details>
      </div>
      <div className="dialog-actions plan-form-actions"><button type="button" className="secondary" onClick={onClose}>ยกเลิก</button><button className="primary" type="submit"><Calculator size={17}/> ประเมินแผนนี้</button></div>
    </form>
  </Dialog>;
}

export function usePlanEvaluation(state: ShopState | undefined, inputs: PlanInputs | undefined, editing: boolean, variantId: string | undefined) {
  const [report, setReport] = useState<{value: Growth; inputs: PlanInputs}>();
  const result = report?.value;
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
      setReport({ value, inputs });
    }).catch(error => { if (!controller.signal.aborted) setError(problem(error)); }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [inputs, runId, revision, variantId, editing, attempt]);
  const current = result?.variantId === variantId && result?.runId === runId ? result : undefined;
  return {
    result: current, error, loading: loading && !editing,
    stale: !!current && (current.revision !== revision || report?.inputs !== inputs || editing || loading || !!error),
    retry: () => setAttempt(value => value + 1),
  };
}

const costNames: Record<string,string> = { product:'ต้นทุนสินค้าเดิม', inboundProduct:'ต้นทุนสินค้าสั่งเพิ่ม', packing:'วัสดุแพ็ก', fee:'ค่าธรรมเนียมช่องทาง', sellerVoucher:'คูปองที่ร้านออก', sellerShipping:'ค่าส่งที่ร้านออก', affiliate:'ค่านายหน้า' };
const requirementNames: Record<string,string> = { stock:'สต็อก', materials:'วัสดุแพ็ก', capacity:'กำลังแพ็ก', quota:'โควตาโปรโมชัน', demand:'ความต้องการ' };
const evidenceRows = z.array(z.object({ units:z.number(), contribution:z.number(), afterAds:z.number() }));
function units(n: number | null | undefined) { return n == null ? 'ยังไม่ทราบ' : count(n) + ' ชิ้น'; }
function baht(value: number | null | undefined) {
  if (value == null) return 'ยังไม่ทราบ';
  return (value < 0 ? '−฿' : '฿') + bahtAmount(Math.abs(value));
}
function signedBaht(value: number) { return (value > 0 ? '+' : value < 0 ? '−' : '') + baht(Math.abs(value)); }

function DemandComparison({ result }: { result: Growth }) {
  const rows = [
    { label: 'ยอดขายปกติ', value: result.baselineUnits, tone: 'base' },
    { label: 'ความต้องการตามแผน', value: result.planDemand, tone: 'demand' },
    { label: 'จำนวนที่ร้านรองรับ', value: result.supportablePlanUnits, tone: 'possible' },
  ];
  const scale = Math.max(1, ...rows.map(row => row.value ?? 0));
  return <div className="plan-demand">{rows.map(row => <div className="plan-demand-row" key={row.tone}>
    <span>{row.label}</span><strong>{units(row.value)}</strong>
    <div className="plan-demand-track" aria-hidden="true"><i data-tone={row.tone} style={{width:(row.value ?? 0) / scale * 100 + '%'}}/></div>
  </div>)}</div>;
}

export function PlanResults({ evaluation, onSave, onDiscuss, onSupplies, onPacking, unavailable }: {
  evaluation: ReturnType<typeof usePlanEvaluation>;
  onSave: () => void; onDiscuss: () => void; onSupplies: () => void; onPacking: () => void; unavailable: boolean;
}) {
  const { result, error, loading, stale, retry } = evaluation;
  const ads = result?.adSpend != null && result.adSpend > 0;
  const adTarget = result?.adTarget ?? (result && result.baselineUnits != null && result.adRecoveryUnits != null ? result.baselineUnits + result.adRecoveryUnits : null);
  const goal = ads ? adTarget : result?.requiredTotalUnits;
  const delta = result && result.baselineContribution != null && result.planContribution != null
    ? Math.round((result.planContribution - result.baselineContribution) * 100) / 100 : null;
  const evidence = evidenceRows.safeParse(result?.unitRecoveryEvidence);
  return <section className="panel plan-results" id="plan-results" aria-busy={loading}>
    <header className="plan-report-heading"><h2>ผลประเมินแผน</h2>{result && <span>{modes[result.mode]}</span>}</header>
    {error && <><Notice error>{error}</Notice><button className="secondary" onClick={retry}><RotateCcw size={14}/> ประเมินอีกครั้ง</button></>}
    {loading && <p role="status" className="muted">กำลังคำนวณจากข้อมูลร้านล่าสุด…</p>}
    {stale && <Notice>กำลังแสดงผลครั้งก่อน</Notice>}
    {!result && !loading && !error && <Empty>เลือกประเภทแผนและกรอกตัวเลขเพื่อดูยอดขายที่ต้องทำให้ถึง</Empty>}
    {result && <>
      <div className="plan-summary">
        <div className="plan-target"><p>{ads ? 'ยอดขายรวมที่พอจ่ายค่าแอด' : 'ยอดขายที่ทำให้คุ้มทั้งแผน'}</p>
          {goal == null ? <strong className="plan-target-unknown">ยังประเมินไม่ได้</strong> : <strong>{count(goal)} <small>ชิ้น</small></strong>}
        </div>
        <DemandComparison result={result}/>
        <div className="plan-answer">
          {ads && result.adSpend != null && result.adRecoveryUnits !== null && adTarget != null
            ? <p>{result.primaryMessage ?? `ถ้าขายเพิ่มจากปกติ ${count(result.adRecoveryUnits)} ชิ้นขึ้นไป รวมอย่างน้อย ${count(adTarget)} ชิ้น เงินที่เหลือหลังหักต้นทุนจะพอจ่ายค่าแอด ${bahtAmount(result.adSpend)} บาทแล้ว`}</p>
            : result.requiredAdditionalUnits != null
              ? <p>แผนนี้ต้องขายเพิ่มจากปกติ {units(result.requiredAdditionalUnits)} เพื่อให้เงินเหลืออย่างน้อยเท่าเดิม</p>
              : <p>{result.unitContribution != null && result.unitContribution <= 0 ? 'เงินเหลือต่อชิ้นต่ำเกินกว่าจะชดเชยค่าใช้จ่ายของแผน' : 'ข้อมูลยังไม่พอคำนวณจุดคุ้มทุน'}</p>}
        </div>
      </div>
      {result.warnings.length > 0 && <ul className="plan-warnings">{result.warnings.map(warning => <li key={warning}><TriangleAlert size={16}/>{warning}</li>)}</ul>}
      <h3 className="plan-section-title">เงินเหลือหลังต้นทุนที่ระบุ</h3>
      <dl className="plan-finances"><div><dt>ขายตามปกติ</dt><dd>{baht(result.baselineContribution)}</dd></div>
        <div><dt>ขายตามแผน</dt><dd>{baht(result.planContribution)}</dd></div>
        <div><dt>ผลต่าง</dt><dd data-negative={delta !== null && delta < 0}>{delta === null ? 'ยังไม่ทราบ' : signedBaht(delta)}</dd></div>
      </dl>
      <div className="plan-capacity">
        <h3>ร้านรองรับได้แค่ไหน</h3>
        <dl><div><dt>สต็อกสำหรับขายออนไลน์</dt><dd>{units(result.allocatableStock)}</dd></div>
        <div><dt>วัสดุแพ็กที่ว่าง</dt><dd>{units(result.materialCapacity)}</dd></div>
        <div><dt>กำลังแพ็กที่เหลือ</dt><dd>{units(result.preparationCapacity)}</dd></div></dl>
        <div className="choice-row"><button className="secondary" onClick={onSupplies}><Package size={15}/> ดูวัสดุแพ็ก</button><button className="secondary" onClick={onPacking}><Timer size={15}/> ดูคิวแพ็ก</button></div>
      </div>
      <details className="plan-fold"><summary>ยอดขาย ต้นทุน และจุดคุ้มทุน <ChevronDown size={16}/></summary>
        <dl className="fact-list">
          <div><dt>รายได้ตามแผน</dt><dd>{baht(result.revenue)}</dd></div>
          <div><dt>เงินเหลือต่อชิ้นก่อนต้นทุนคงที่</dt><dd>{baht(result.unitContribution)}</dd></div>
          <div><dt>ยอดที่คุ้มทั้งแผนเทียบกับยอดปกติ</dt><dd>{result.requiredTotalUnits === null ? 'ยังประเมินไม่ได้' : units(result.requiredTotalUnits) + ' (เพิ่ม ' + units(result.requiredAdditionalUnits) + ')'}</dd></div>
          <div><dt>เงินสดต่ำสุดของแผน</dt><dd>{baht(result.lowestCash)}</dd></div>
          <div><dt>ยอดรอรับหลังจบแผน</dt><dd>{baht(result.receivables)}</dd></div>
          {ads && <><div><dt>คลิกที่คาดว่าจะได้</dt><dd>{count(result.assumedClicks)} คลิก</dd></div>
            <div><dt>ยอดเพิ่มจากแอดตามสมมติฐาน</dt><dd>{units(result.assumedIncrementalAdUnits)}</dd></div>
            <div><dt>รายได้จากแอดเทียบค่าแอด</dt><dd>{result.roas == null ? 'ยังประเมินไม่ได้' : count(result.roas) + ' เท่า'}</dd></div></>}
        </dl>
        {evidence.success && evidence.data.length > 0 && <div className="table-scroll"><table><caption>กรณีขายเพิ่มจากยอดปกติ</caption><thead><tr><th>ขายเพิ่ม</th><th>เงินเหลือจากยอดเพิ่ม</th><th>หลังหักค่าแอด</th></tr></thead><tbody>
          {evidence.data.map(row => <tr key={row.units}><td>{units(row.units)}</td><td>{baht(row.contribution)}</td><td>{signedBaht(row.afterAds)}</td></tr>)}
        </tbody></table></div>}
      </details>
      <details className="plan-fold"><summary>ที่มาของตัวเลขและทรัพยากรที่ต้องใช้ <ChevronDown size={16}/></summary>
        <dl className="fact-list">
          <div><dt>สต็อกที่กันไว้ขายหน้าร้าน</dt><dd>{count(result.posAllowance)} ชิ้น</dd></div>
          <div><dt>คิวเดิมที่ต้องแพ็ก</dt><dd>{count(result.queueUnits)} ชิ้น</dd></div>
          <div><dt>กำลังแพ็กที่กันไว้ให้สินค้าอื่น</dt><dd>{count(result.otherUnits)} ชิ้น</dd></div>
          <div><dt>ต้นทุนคงที่ทั้งแผน</dt><dd>{baht(result.fixedCosts)}</dd></div>
        </dl>
        {result.costs && <div className="table-scroll"><table><thead><tr><th>ต้นทุนต่อชิ้น</th><th>บาท</th></tr></thead><tbody>
          {Object.entries(result.costs).map(([key,value]) => <tr key={key}><td>{costNames[key] ?? key}</td><td>{value == null ? 'ยังไม่ทราบ' : bahtAmount(value)}</td></tr>)}
        </tbody></table></div>}
        {!!result.materials?.length && <div className="table-scroll"><table><thead><tr><th>วัสดุ</th><th>กันให้สินค้าอื่น</th><th>เหลือให้สินค้านี้</th><th>แพ็กได้ (ชิ้น)</th></tr></thead><tbody>
          {result.materials.map(row => <tr key={row.supplyId}><td>{row.name}</td><td>{count(row.reservedForOthers)}</td><td>{count(row.remaining)}</td><td>{count(row.capacity)}</td></tr>)}
        </tbody></table></div>}
        {result.wholePlanRequirements && <div className="table-scroll"><table><thead><tr><th>เงื่อนไขให้คุ้มทั้งแผน</th><th>รองรับ</th><th>ต้องใช้</th><th>ขาด</th></tr></thead><tbody>
          {Object.entries(result.wholePlanRequirements).map(([key,row]) => <tr key={key}><td>{requirementNames[key] ?? key}</td><td>{count(row.available)}</td><td>{count(row.required)}</td><td>{count(row.shortfall)}</td></tr>)}
        </tbody></table></div>}
      </details>
      {!!result.cashTimeline?.length && <details className="plan-fold"><summary>เงินเข้าและออกตามวัน <ChevronDown size={16}/></summary><div className="table-scroll"><table><thead><tr><th>นับจากเริ่มแผน (วัน)</th><th>เงินเข้า</th><th>เงินออก</th><th>ยอดคงเหลือ</th></tr></thead><tbody>{result.cashTimeline.map(row => <tr key={row.day}><td>{row.day}</td><td>{baht(row.in)}</td><td>{baht(row.out)}</td><td>{baht(row.balance)}</td></tr>)}</tbody></table></div></details>}
      {!!result.loanSchedule?.length && <details className="plan-fold"><summary>ตัวอย่างตารางชำระเงินกู้ <ChevronDown size={16}/></summary><div className="table-scroll"><table><thead><tr><th>ครบกำหนด (วัน)</th><th>เงินต้น</th><th>ดอกเบี้ย</th><th>หนี้คงเหลือ</th></tr></thead><tbody>{result.loanSchedule.map(row => <tr key={row.day}><td>{row.day}</td><td>{baht(row.principal)}</td><td>{baht(row.interest)}</td><td>{baht(row.outstanding)}</td></tr>)}</tbody></table></div></details>}

      <div className="plan-save-actions"><button className="secondary" disabled={stale || unavailable} onClick={onDiscuss}><Bot size={16}/> คุยกับผู้จัดการ AI</button><button className="primary" disabled={stale || unavailable} onClick={onSave}><Save size={16}/> บันทึกแผน</button></div>
    </>}
  </section>;
}
