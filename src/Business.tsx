import { useState } from 'react';
import { CalendarDays, Mail, Newspaper, ShieldCheck, Store, TrendingUp } from 'lucide-react';
import { Empty, Metric, Notice } from './components';
import { baht, count, date, isoDate, statusLabel, timestamp, type Command, type ShopState } from './model';

type Action = (command: Command) => Promise<boolean>;
type RecordFields = Record<string, unknown>;
export const fieldText = (entry: RecordFields, key: string): string => typeof entry[key] === 'string' ? entry[key] : '';
const fieldNumber = (entry: RecordFields, key: string): number | undefined => typeof entry[key] === 'number' ? entry[key] : undefined;

export function SalesChart({ state, from, to }: { state: ShopState; from?: string; to?: string }) {
  const data = state.metrics.daily.filter(row => (!from || row.date >= from) && (!to || row.date <= to));
  const [showTable, setShowTable] = useState(false);
  const highest = Math.max(1, ...data.map(row => row.online + row.pos));
  return <div className="sales-chart" aria-label="กราฟยอดขายออนไลน์และหน้าร้าน">
    <div className="chart-bars" aria-hidden="true">{data.map((row, index) => <div className="chart-day" key={row.date}>
      <div className="bar-track" title={`${date(row.date)} · ออนไลน์ ${baht(row.online)} · หน้าร้าน ${baht(row.pos)}`} aria-label={`${date(row.date)} ยอดขาย ${baht(row.online + row.pos)}`}>
        <span className="bar-online" style={{ height: (row.online / highest * 100) + '%' }}/><span className="bar-pos" style={{ height: (row.pos / highest * 100) + '%' }}/>
      </div>
      <small>{data.length <= 10 || index % Math.ceil(data.length / 7) === 0 ? row.date.slice(-2) : ' '}</small>
    </div>)}</div>
    <div className="chart-legend"><span><i className="legend-online"/> ออนไลน์</span><span><i className="legend-pos"/> หน้าร้าน</span></div>
    {data.length > 0 && <details className="chart-values" onToggle={event => setShowTable(event.currentTarget.open)}>
      <summary>ดูตัวเลขรายวัน</summary>
      {showTable && <div className="table-scroll"><table aria-label="ยอดขายรายวันแยกตามช่องทาง"><thead><tr><th scope="col">วันที่</th><th scope="col">ออนไลน์</th><th scope="col">หน้าร้าน</th><th scope="col">รวม</th></tr></thead>
        <tbody>{data.map(row => <tr key={row.date}><th scope="row">{date(row.date)}</th><td>{baht(row.online)}</td><td>{baht(row.pos)}</td><td>{baht(row.online + row.pos)}</td></tr>)}</tbody>
      </table></div>}
    </details>}
  </div>;
}
export function Sales({ state, finance = false }: { state: ShopState; finance?: boolean }) {
  const [from, setFrom] = useState(state.metrics.period?.from ?? state.metrics.daily.slice(-7)[0]?.date ?? '');
  const [to, setTo] = useState(isoDate(state.clock));
  const [channel, setChannel] = useState('all');
  const [health, setHealth] = useState(false);
  const ranged = state.orders.filter(order => {
    const key = order.createdAt ? isoDate(order.createdAt) : '';
    return order.paymentStatus === 'paid' && key >= from && key <= to && (channel === 'all' || channel === order.channel);
  });
  const paid = ranged.reduce((sum, order) => sum + order.paidAmount, 0);
  const cash = state.orders.filter(order => {
    const key = order.settlement ? isoDate(order.settlement.date) : '';
    return key && key >= from && key <= to && (channel === 'all' || channel === order.channel);
  }).reduce((sum, order) => sum + (order.settlement?.amount ?? 0), 0);
  const missing = ranged.filter(order => !order.settlement).length;
  return <section className="panel">
    <div className="section-head"><div><h2>{finance ? 'รายได้และเงินรับ' : 'ผลการขายและสุขภาพบัญชี'}</h2><p>รวมเฉพาะออเดอร์ที่ชำระเงินแล้ว</p></div><TrendingUp size={22} className="subtle-icon"/></div>
    {!finance && <div className="choice-row status-tabs"><button className={!health ? 'active' : ''} onClick={() => setHealth(false)}>ผลการขาย</button><button className={health ? 'active' : ''} onClick={() => setHealth(true)}>สุขภาพบัญชี</button></div>}
    {health && !finance ? <>
      {state.health && <div className="option"><span className="badge warm">{state.health.stale ? 'ข้อมูลเก่า' : 'ข้อมูลตามรอบ'}</span><h3>{state.health.status}</h3><p>{state.health.source} · ตรวจ {date(state.health.observedAt)}</p><p>{date(state.health.period.from)} – {date(state.health.period.to)}</p></div>}
      <h3>สัญญาณจากร้านจำลอง</h3><dl className="fact-list"><div><dt>ออเดอร์เกินกำหนดเตรียม</dt><dd>{count(state.metrics.overdueOrders)}</dd></div><div><dt>สต็อกออนไลน์ส่งไม่สำเร็จ</dt><dd>{state.channelStock.filter(item => item.syncStatus === 'failed').length}</dd></div><div><dt>รุ่นที่ยังไม่ทราบต้นทุน</dt><dd>{state.products.flatMap(item => item.variants).filter(item => item.cost === null).length}</dd></div></dl>
    </> : <>
      <div className="inline-form range-form"><label className="field">ตั้งแต่<input type="date" value={from} max={to || undefined} onChange={event => setFrom(event.target.value)}/></label><label className="field">ถึง<input type="date" value={to} min={from || undefined} onChange={event => setTo(event.target.value)}/></label><label className="field">ช่องทาง<select value={channel} onChange={event => setChannel(event.target.value)}><option value="all">ทุกช่องทาง</option><option value="online">ออนไลน์</option><option value="pos">หน้าร้าน</option></select></label></div>
      <div className="metric-grid three"><Metric label="ยอดขายที่ชำระแล้ว" value={baht(paid)}/><Metric label="ออเดอร์" value={count(ranged.length)} detail="รายการ"/><Metric label="เงินรับในช่วงวันที่เลือก" value={baht(cash)}/></div>
      <p className="muted">ออเดอร์ในช่วงนี้ยังไม่มีข้อมูลการรับเงิน {count(missing)} รายการ</p>
      {channel === 'all' && <SalesChart state={state} from={from} to={to}/>}
      {finance && <dl className="fact-list"><div><dt>เงินสดตั้งต้นที่ใช้วางแผน</dt><dd>{baht(state.defaults.cash)}</dd></div><div><dt>ยอดขายสะสมของร้านจำลอง</dt><dd>{baht(state.metrics.sales)}</dd></div><div><dt>เงินรับสะสมที่ยืนยันแล้ว</dt><dd>{baht(state.metrics.confirmedCash)}</dd></div><div><dt>กำไรสุทธิ</dt><dd>ยังมีข้อมูลต้นทุนไม่ครบ</dd></div></dl>}
    </>}
  </section>;
}

export function Briefs({ state, action, openCase, research }: { state: ShopState; action: Action; openCase: (id: string) => void; research: () => void }) {
  const [failMail, setFailMail] = useState(false);
  return <div className="stack">
    <section className="panel"><div className="section-head"><div><h2>บรีฟร้านเวลา 07:00 น.</h2><p>ตามเวลาจำลองประเทศไทย · {timestamp(state.clock)}</p></div><CalendarDays size={23} className="subtle-icon"/></div>
      <div className="choice-row"><button className="secondary" onClick={() => void action({ type: 'advance_clock', minutes: 15, failMail })}>เลื่อนเวลา 15 นาที</button><button className="secondary" onClick={() => void action({ type: 'advance_clock', minutes: 1440, failMail })}>เลื่อนไปวันถัดไป</button><label className="check-row"><input type="checkbox" checked={failMail} onChange={event => setFailMail(event.target.checked)}/> จำลองส่งอีเมลไม่สำเร็จ</label></div>
      {state.briefs.length ? [...state.briefs].reverse().map(brief => {
        const key = fieldText(brief, 'date');
        const delivery = state.mail.find(mail => mail.date === key);
        const caseIds = Array.isArray(brief.caseIds) ? brief.caseIds.filter((item): item is string => typeof item === 'string') : [];
        return <article className="option" key={key}><div className="section-head"><div><h3>บรีฟวันที่ {date(key)}</h3><p>ยอดขาย 7 วัน {baht(fieldNumber(brief, 'sales7d'))} · {count(fieldNumber(brief, 'orders7d'))} ออเดอร์</p></div><Mail size={18}/></div>
          <p>รอแพ็ก {count(fieldNumber(brief, 'queueUnits'))} ชิ้น · ออเดอร์เกินกำหนด {count(fieldNumber(brief, 'overdueOrders'))}</p>
          {delivery && <p>กล่องอีเมลจำลอง · {delivery.status === 'delivered' ? 'ส่งแล้ว' : statusLabel(delivery.status)} {delivery.status === 'failed' && <button className="text-btn" onClick={() => void action({ type: 'retry_mail', date: key })}>ลองส่งอีกครั้ง</button>}</p>}
          <div className="choice-row">{caseIds.map(id => <button key={id} className="secondary" onClick={() => openCase(id)}>{state.cases.find(item => item.id === id)?.title ?? id}</button>)}</div>
        </article>;
      }) : <Empty>ยังไม่มีบรีฟของวันนี้ ระบบจะสร้างเมื่อถึง 07:00 น.</Empty>}
    </section>
    <section className="panel"><div className="section-head"><div><h2>ข่าวที่เกี่ยวข้องกับร้าน</h2><p>ข่าวตัวอย่างสำหรับร้านจำลอง</p></div><Newspaper size={22} className="subtle-icon"/></div>
      <div className="record-list">{state.news.map(item => <article className="option" key={fieldText(item, 'id')}><h3>{fieldText(item, 'title')}</h3><p>{fieldText(item, 'summary')}</p><small className="muted">{fieldText(item, 'source')} · เผยแพร่ {date(fieldText(item, 'publishedAt'))} · มีผล {date(fieldText(item, 'effectiveAt'))} · ตรวจ {date(fieldText(item, 'checkedAt'))}</small></article>)}</div>
      <button className="secondary" onClick={research}>ค้นคว้าข่าวจริงกับผู้จัดการ</button>
    </section>
  </div>;
}
export function Competitors({ state, research }: { state: ShopState; research: () => void }) {
  return <section className="panel"><div className="section-head"><div><h2>สินค้าและคู่แข่ง</h2><p>ข้อมูลสังเกตการณ์จำลอง</p></div><Store className="subtle-icon" size={22}/></div>
    <div className="record-list">{state.competitors.map(row => <article className="record" key={fieldText(row, 'id')}><div><strong>{fieldText(row, 'product')}</strong><small>{fieldText(row, 'name')} · {fieldText(row, 'source')} · {date(fieldText(row, 'observedAt'))}</small></div><b>{baht(fieldNumber(row, 'price'))}</b></article>)}</div>
    <p className="muted">ควรเทียบรุ่น สภาพ จำนวนต่อแพ็ก ของแถม และค่าส่ง ก่อนใช้ราคาที่เห็นในการตั้งราคา</p>
    <button className="secondary" onClick={research}>ขอค้นคว้าคู่แข่งจากแหล่งสาธารณะ</button>
  </section>;
}

export function Memory({ state, action, save }: { state: ShopState; action: Action; save: (text: string) => Promise<boolean> }) {
  const [memory, setMemory] = useState('');
  return <div className="stack"><section className="panel"><div className="section-head"><div><h2>ความจำของร้าน</h2><p>ข้อมูลและข้อจำกัดที่ใช้ในการคุยกับผู้จัดการ</p></div><ShieldCheck size={23} className="subtle-icon"/></div>
    {state.owner.memories.length ? <ul className="bullet-list">{state.owner.memories.map(item => <li key={item.id}>{item.text}</li>)}</ul> : <Empty>ยังไม่มีความจำที่บันทึกไว้</Empty>}
    <form className="inline-form" onSubmit={event => { event.preventDefault(); const text = memory.trim(); if (text) void save(text).then(ok => { if (ok) setMemory(''); }); }}>
      <label className="field">เพิ่มข้อมูลร้าน<textarea value={memory} onChange={event => setMemory(event.target.value)} maxLength={2000}/></label>
      <button className="primary" disabled={!memory.trim()}>บันทึกความจำ</button>
    </form></section>
    <section className="panel"><h2>กฎที่อนุญาตให้ทำงานเอง</h2><p className="muted">ตั้งกฎได้หลังเลือกและตรวจผลการดำเนินการในเคส</p>
    {state.policies.length ? <div className="record-list">{state.policies.map(policy => <div className="record" key={fieldText(policy, 'id')}><div><strong>{policy.enabled ? 'เปิดใช้' : 'ปิดใช้'}</strong><small>{fieldText(policy, 'actionType')}</small></div>{policy.enabled === true && <button className="secondary" onClick={() => void action({ type: 'set_policy', enabled:false, policyId: fieldText(policy, 'id') })}>ปิดใช้กฎนี้</button>}</div>)}</div> : <Empty>ยังไม่มีกฎที่เจ้าของอนุญาต</Empty>}
    </section></div>;
}

export function Settings({ state, reset }: { state: ShopState; reset: () => void }) {
  return <section className="panel"><div className="section-head"><div><h2>ข้อมูลร้าน</h2><p>พื้นที่ทดลองควบคุมร้านจากข้อมูลเดียวกัน</p></div><Store size={22} className="subtle-icon"/></div>
    <dl className="fact-list"><div><dt>ชื่อร้าน</dt><dd>{state.shop.name}</dd></div><div><dt>ช่องทาง</dt><dd>{state.shop.platform} จำลอง · หน้าร้าน</dd></div><div><dt>เวลาของร้าน</dt><dd>{timestamp(state.clock)}</dd></div><div><dt>กำลังแพ็กตั้งต้น</dt><dd>{count(state.defaults.packingCapacity)} ชิ้น/วัน</dd></div><div><dt>เงินสดตั้งต้นสำหรับแผน</dt><dd>{baht(state.defaults.cash)}</dd></div></dl>
    <Notice>ร้านนี้ใช้ข้อมูลจำลองและเวลาทดลอง กิจกรรมของร้านไม่เชื่อมกับบัญชี Shopee จริง</Notice>
    <button className="secondary" onClick={reset}>เริ่มรอบทดลองใหม่</button>
  </section>;
}
