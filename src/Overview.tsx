import { useState } from 'react';
import { ArrowUpRight, Boxes, Check, PackageCheck, Search, ShoppingBag, Wallet } from 'lucide-react';
import { baht, count, type ShopState, type Variant } from './model';

function SevenDays({ values }: { values: number[] }) {
  const peak = Math.max(1, ...values);
  return <span className="week-bars" aria-hidden="true">{values.map((value, index) =>
    <i key={index} style={{ height: `${Math.max(3, value / peak * 100)}%` }} />)}</span>;
}

export function OverviewMetrics({ state, onSales, onOrders, onPacking }: {
  state: ShopState; onSales: () => void; onOrders: () => void; onPacking: () => void;
}) {
  const {metrics} = state;
  const period = metrics.period;
  const days = metrics.daily.filter(day => period && day.date >= period.from && day.date <= period.to);
  return <div className="overview-metrics" aria-label="ตัวเลขสรุปร้าน">
    <button className="kpi sales-kpi" onClick={onSales}>
      <span className="kpi-label"><Wallet/>ยอดขาย 7 วัน<ArrowUpRight/></span>
      <span className="kpi-data"><strong>{baht(metrics.sales7d)}</strong><SevenDays values={days.map(d => d.online + d.pos)}/></span>
      <small>รวมออนไลน์และหน้าร้าน</small>
    </button>
    <button className="kpi" onClick={onOrders}>
      <span className="kpi-label"><ShoppingBag/>ออเดอร์ 7 วัน<ArrowUpRight/></span>
      <span className="kpi-data"><strong>{count(metrics.orders7d)}</strong><SevenDays values={days.map(d => d.orders)}/></span>
      <small>ชำระเงินแล้ว</small>
    </button>
    <button className="kpi packing-kpi" onClick={onPacking}>
      <span className="kpi-label"><PackageCheck/>คิวแพ็ก<ArrowUpRight/></span>
      <span className="kpi-data"><strong>{count(metrics.queueUnits)} <em>ชิ้น</em></strong></span>
      <small>จาก {count(metrics.queueOrders)} ออเดอร์</small>
    </button>
  </div>;
}

export function ProductFinder({ variants, selected, choose }: {variants: Variant[]; selected?: string; choose: (id: string) => void}) {
  const [query, setQuery] = useState('');
  const term = query.trim().toLowerCase();
  const found = variants.filter(item => [item.productName, item.name, item.sellerSku, item.category].join(' ').toLowerCase().includes(term));
  return <div className="finder">
    <label className="finder-search"><Search size={19}/><input aria-label="ค้นหาสินค้าบนแท่น" placeholder="ค้นหาชื่อสินค้า รุ่น หรือ SKU" autoFocus value={query} onChange={e => setQuery(e.target.value)}/></label>
    <div className="finder-list">{found.map(item => <button key={item.id} onClick={() => choose(item.id)} aria-pressed={selected === item.id}>
      <span className="finder-icon"><Boxes size={20}/></span>
      <span><strong>{item.productName}</strong><small>{item.name} · {item.sellerSku}</small></span>
      <span className="finder-stock">{count(item.available)} ชิ้น</span>
      {selected === item.id && <Check size={16}/>}
    </button>)}</div>
    {found.length === 0 && <p role="status" className="empty">ไม่พบสินค้า ลองค้นด้วยชื่อรุ่นหรือ SKU</p>}
  </div>;
}
