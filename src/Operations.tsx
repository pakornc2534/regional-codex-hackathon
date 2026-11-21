import { useState } from 'react';
import { Boxes, ClipboardCheck, PackagePlus, Search, Truck } from 'lucide-react';
import { Empty, Metric, Notice } from './components';
import { baht, count, date, stages, statusLabel, time, type Command, type Order, type ShopState, type Variant } from './model';

type Action = (command: Command) => Promise<boolean>;
export function ProductFacts({ variant, state, action }: { variant: Variant; state: ShopState; action: Action }) {
  const stock = state.channelStock.find(row => row.variantId === variant.id);
  const [quantity, setQuantity] = useState(1);
  const [failSync, setFailSync] = useState(false);
  return <>
    <div className="metric-grid three">
      <Metric label="อยู่ที่ร้าน" value={count(variant.physical)} detail="ชิ้น"/>
      <Metric label="จองแล้ว" value={count(variant.reserved)} detail="ชิ้น"/>
      <Metric label="เหลือขาย" value={count(variant.available)} detail="ชิ้น"/>
    </div>
    <dl className="fact-list">
      <div><dt>ราคาขาย</dt><dd>{baht(variant.price)}</dd></div>
      <div><dt>ต้นทุนสินค้า</dt><dd>{variant.cost === null ? 'ยังไม่ทราบต้นทุน' : baht(variant.cost)}</dd></div>
      <div><dt>จำนวนที่ส่งให้ Shopee จำลอง</dt><dd>{count(stock?.desiredQuantity)}</dd></div>
      <div><dt>จำนวนล่าสุดที่ Shopee จำลองยืนยัน</dt><dd>{count(stock?.verifiedQuantity)}</dd></div>
      <div><dt>สถานะสต็อกออนไลน์</dt><dd>{stock ? statusLabel(stock.syncStatus) : 'ยังไม่มีข้อมูล'}</dd></div>
    </dl>
    {stock?.syncStatus === 'failed' && <button className="secondary" onClick={() => void action({ type: 'retry_sync', variantId: variant.id })}>ลองส่งสต็อกอีกครั้ง</button>}
    <details className="assumptions"><summary>จำลองการขายสินค้านี้</summary>
      <div className="form-grid"><label className="field">จำนวน (ชิ้น)<input type="number" min="1" step="1" value={quantity} onChange={event => setQuantity(Number(event.target.value))}/></label>
      <label className="check-row"><input type="checkbox" checked={failSync} onChange={event => setFailSync(event.target.checked)}/> จำลองส่งสต็อกไม่สำเร็จ</label></div>
      <div className="choice-row">
        <button disabled={quantity < 1 || quantity > variant.available} className="secondary" onClick={() => void action({ type: 'pos_sale', variantId: variant.id, quantity, failSync })}>ขายที่หน้าร้าน</button>
        <button disabled={quantity < 1 || quantity > variant.available} className="secondary" onClick={() => void action({ type: 'accept_order', variantId: variant.id, quantity, failSync })}>รับออเดอร์ออนไลน์</button>
      </div>
    </details>
  </>;
}
export function Stock({ variants, open, state }: { variants: Variant[]; open: (variantId: string) => void; state: ShopState }) {
  const [query, setQuery] = useState('');
  const rows = variants.filter(variant => `${variant.productName} ${variant.name} ${variant.sellerSku}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <section className="panel">
    <div className="section-head"><div><h2>สินค้าของร้าน</h2><p>{state.products.length} รายการ · {variants.length} รุ่น</p></div><Boxes size={22} className="subtle-icon"/></div>
    <label className="search"><Search size={17}/><input aria-label="ค้นหาสินค้า" placeholder="ค้นหาชื่อสินค้า รุ่น หรือ SKU" value={query} onChange={event => setQuery(event.target.value)}/></label>
    {rows.length ? <div className="table-scroll"><table><thead><tr><th>สินค้า</th><th>อยู่ที่ร้าน</th><th>จองแล้ว</th><th>เหลือขาย</th><th>สต็อกออนไลน์</th></tr></thead><tbody>
      {rows.map(variant => <tr key={variant.id}><td><button className="text-btn table-name" onClick={() => open(variant.id)}>{variant.productName}<small>{variant.name ? `${variant.name} · ` : ''}{variant.sellerSku}</small></button></td>
        <td>{count(variant.physical)}</td><td>{count(variant.reserved)}</td><td><span className={variant.available <= 1 ? 'badge warm' : 'badge green'}>{count(variant.available)}</span></td>
        <td>{statusLabel(state.channelStock.find(stock => stock.variantId === variant.id)?.syncStatus ?? 'ยังไม่มีข้อมูล')}</td></tr>)}
    </tbody></table></div> : <Empty>ไม่มีสินค้าตรงกับคำค้น</Empty>}
  </section>;
}
export function Supplies({ state, action }: { state: ShopState; action: Action }) {
  const [id, setId] = useState(state.supplies[0]?.id ?? '');
  const [quantity, setQuantity] = useState(10);
  return <section className="panel"><div className="section-head"><div><h2>วัสดุที่พร้อมใช้</h2><p>หักวัสดุที่จองไว้ให้รายการชำระแล้ว</p></div><PackagePlus size={22} className="subtle-icon"/></div>
    <div className="table-scroll"><table><thead><tr><th>วัสดุ</th><th>คงเหลือ</th><th>จอง</th><th>พร้อมใช้</th><th>พอใช้</th><th>รอของ</th></tr></thead><tbody>
      {state.supplies.map(row => <tr key={row.id}><td><strong>{row.name}</strong><small>{row.unit}</small></td><td>{count(row.quantity)}</td><td>{count(row.reserved)}</td><td>{count(row.free)}</td><td>{row.daysRemaining === null ? 'ยังประเมินไม่ได้' : `${count(row.daysRemaining)} วัน`}</td><td>{row.leadDays} วัน</td></tr>)}
    </tbody></table></div>
    <form className="inline-form" onSubmit={event => { event.preventDefault(); void action({ type: 'receive_supply', supplyId: id, quantity }); }}>
      <label className="field">วัสดุที่ได้รับ<select value={id} onChange={event => setId(event.target.value)}>{state.supplies.map(supply => <option key={supply.id} value={supply.id}>{supply.name}</option>)}</select></label>
      <label className="field">จำนวน<input type="number" min="0.01" step="0.01" value={quantity} onChange={event => setQuantity(Number(event.target.value))}/></label>
      <button className="primary" disabled={!id || quantity <= 0}><PackagePlus size={17}/> บันทึกวัสดุเข้าร้าน</button>
    </form>
  </section>;
}

const orderTabs = ['picking', 'packing', 'ready', 'collected', 'transit', 'delivered', 'returns'];
const orderActions: Record<string, [type: string, label: string][]> = {
  picking: [['prepare_order', 'เตรียมใบปะหน้า'], ['start_packing', 'เริ่มแพ็ก'], ['cancel_order', 'ยกเลิกออเดอร์']],
  packing: [['pack', 'ยืนยันว่าแพ็กแล้ว'], ['prepare_order', 'เตรียมใบปะหน้า']],
  ready: [['pickup', 'จำลองขนส่งรับ']],
  collected: [['ship', 'จำลองออกเดินทาง']],
  transit: [['deliver', 'จำลองส่งสำเร็จ']],
};
const visibleOrderIds = (search: string, order: Order, variants: Variant[]) => {
  if (!search) return true;
  return order.id.toLowerCase().includes(search) || order.items.some(item => variants.some(variant => variant.id === item.variantId && `${variant.sellerSku} ${variant.productName}`.toLowerCase().includes(search)));
};
export function Fulfillment({ state, variants, action, initial = 'picking', forOrder }: { state: ShopState; variants: Variant[]; action: Action; initial?: string; forOrder?: string }) {
  const [tab, setTab] = useState(initial);
  const [query, setQuery] = useState('');
  const [orderId, setOrderId] = useState(forOrder ?? '');
  const [page, setPage] = useState(0);
  const orders = state.orders.filter(order => order.channel === 'online' && order.paymentStatus === 'paid' && order.fulfillmentStatus === tab && visibleOrderIds(query.toLowerCase().trim(), order, variants)).slice().reverse();
  const active = state.orders.find(order => order.id === orderId);
  const titles = new Map(variants.map(item => [item.id, item.sellerSku]));
  return <section className="panel">
    <div className="section-head"><div><h2>ส่งของและของคืน</h2><p>ออเดอร์จ่ายแล้ว · 1 ออเดอร์เท่ากับ 1 พัสดุ</p></div><Truck size={22} className="subtle-icon"/></div>
    <div className="choice-row status-tabs">{orderTabs.map(stage => <button className={tab === stage ? 'active' : ''} key={stage} onClick={() => { setTab(stage); setOrderId(''); setPage(0); }}>{stage === 'returns' ? 'ของคืน' : stages[stage]} <small>{stage === 'returns' ? state.returns.length : state.metrics.stages[stage]?.orders ?? 0}</small></button>)}</div>
    {tab === 'returns' ? <>
      <Notice>ของที่ถึงร้านจะรอตรวจสภาพก่อน จึงยังไม่รวมในจำนวนพร้อมขาย</Notice>
      <div className="record-list">{state.returns.map(row => <div key={row.id} className="record"><div><strong>{row.stage === 'transit' ? 'ระหว่างทางกลับ' : 'ถึงร้านรอตรวจ'}</strong><small>{row.orderId}</small></div>
      {row.stage === 'transit' && <button className="secondary" onClick={() => void action({ type: 'receive_return', returnId: row.id })}>ยืนยันของคืนถึงร้าน</button>}</div>)}</div>
    </> : <>
      <label className="search"><Search size={17}/><input aria-label="ค้นหาออเดอร์" placeholder="ค้นหาเลขออเดอร์ สินค้า หรือ SKU" value={query} onChange={event => { setQuery(event.target.value); setPage(0); }}/></label>
      <p className="muted">{count(state.metrics.stages[tab]?.orders ?? 0)} พัสดุ · {count(state.metrics.stages[tab]?.units ?? 0)} ชิ้น</p>
      {active && <div className="order-detail">
        <div className="section-head"><div><h3>{active.items.map(item => `${titles.get(item.variantId)} × ${item.quantity}`).join(', ')}</h3><p>{active.id} · {stages[active.fulfillmentStatus] ?? active.fulfillmentStatus}</p></div><ClipboardCheck size={22}/></div>
        {active.prepareBy && <p>กำหนดเตรียม {date(active.prepareBy)} เวลา {time(active.prepareBy)} น.</p>}
        {active.documents && <dl className="fact-list"><div><dt>รายการหยิบสินค้า</dt><dd>{active.documents.pickList}</dd></div><div><dt>ใบปะหน้า</dt><dd>{active.documents.label}</dd></div></dl>}
        <div className="choice-row">{(orderActions[active.fulfillmentStatus] ?? []).map(([type, label]) => <button key={type} className="secondary" onClick={() => void action({ type, orderId: active.id })}>{label}</button>)}</div>
      </div>}
      {orders.length ? <>
        <div className="record-list">{orders.slice(page * 10, (page + 1) * 10).map(order => <button className={order.id === orderId ? 'record active' : 'record'} key={order.id} onClick={() => setOrderId(order.id)}>
          <span><strong>{order.items.map(item => `${titles.get(item.variantId)} × ${item.quantity}`).join(', ')}</strong><small>{order.id}</small></span><span className="badge neutral">{order.prepareBy ? time(order.prepareBy) + ' น.' : date(order.createdAt)}</span>
        </button>)}</div>
        {orders.length > 10 && <div className="choice-row paging"><button className="secondary" disabled={!page} onClick={() => setPage(value => value - 1)}>ก่อนหน้า</button><span>หน้า {page + 1} / {Math.ceil(orders.length / 10)}</span><button className="secondary" disabled={(page + 1) * 10 >= orders.length} onClick={() => setPage(value => value + 1)}>ถัดไป</button></div>}
      </> : <Empty>ไม่มีออเดอร์ในรายการนี้</Empty>}
    </>}
  </section>;
}
