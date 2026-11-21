import { useState } from 'react';
import { Check, ChevronDown, ScanSearch, Search } from 'lucide-react';
import { ProductPicture } from './ProductPicture';
import { ShopIcon } from './ShopIcon';
import { workspaceNames } from './workspaces';
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
      <span className="kpi-label"><ShopIcon name="finance"/>{workspaceNames.finance}</span>
      <span className="kpi-data"><strong>{baht(metrics.sales7d)}</strong><SevenDays values={days.map(d => d.online + d.pos)}/></span>
      <small>ยอดขาย 7 วัน รวมออนไลน์และหน้าร้าน</small>
    </button>
    <button className="kpi" onClick={onOrders}>
      <span className="kpi-label"><ShopIcon name="insights"/>{workspaceNames.insights}</span>
      <span className="kpi-data"><strong>{count(metrics.orders7d)}</strong><SevenDays values={days.map(d => d.orders)}/></span>
      <small>ออเดอร์ชำระแล้วใน 7 วัน</small>
    </button>
    <button className="kpi packing-kpi" onClick={onPacking}>
      <span className="kpi-label"><ShopIcon name="orders"/>{workspaceNames.orders}</span>
      <span className="kpi-data"><strong>{count(metrics.queueUnits)} <em>ชิ้น</em></strong></span>
      <small>คิวแพ็กจาก {count(metrics.queueOrders)} ออเดอร์</small>
    </button>
  </div>;
}

export function CatalogFeature({ variant, choose, showStock, plan }: {
  variant: Variant; choose: () => void; showStock: () => void; plan: () => void;
}) {
  return <section className="catalog-feature" aria-label="สินค้าที่เลือก">
    <button type="button" className="catalog-art" aria-label={`ดูรายละเอียด ${variant.productName} ${variant.sellerSku}`} title="ดูรายละเอียดสินค้า" onClick={showStock}>
      <ProductPicture variant={variant} featured/><span className="catalog-inspect" aria-hidden="true"><ScanSearch size={18}/></span>
    </button>
    <div className="catalog-copy">
      <div className="catalog-index"><span>{variant.category}</span><button className="catalog-pick" onClick={choose}>เลือกสินค้า <ChevronDown size={16}/></button></div>
      <h2>{variant.productName.split(/\s+/).map((word, index) => <span key={index}>{index > 0 && ' '}<span className="catalog-word">{word}</span></span>)}</h2>
      <p className="catalog-edition">{variant.name} <span>{variant.sellerSku}</span></p>
      <div className="catalog-values"><span className="catalog-price">{baht(variant.price)} <small>ต่อชิ้น</small></span>
        <button onClick={showStock} title="ดูรายละเอียดสต็อกสินค้า"><ShopIcon name="stock" size={18}/>เหลือขาย {count(variant.available)} ชิ้น</button>
      </div>
      <button className="catalog-plan" onClick={plan}><ShopIcon name="campaign" size={20}/>ลองแผนยิงแอด</button>
    </div>
  </section>;
}

export function ProductFinder({ variants, selected, choose }: {variants: Variant[]; selected?: string; choose: (id: string) => void}) {
  const [query, setQuery] = useState('');
  const term = query.trim().toLowerCase();
  const found = variants.filter(item => [item.productName, item.name, item.sellerSku, item.category].join(' ').toLowerCase().includes(term));
  return <div className="finder">
    <label className="finder-search"><Search size={19}/><input aria-label="ค้นหาสินค้าบนแท่น" placeholder="ค้นหาชื่อสินค้า รุ่น หรือ SKU" autoFocus value={query} onChange={e => setQuery(e.target.value)}/></label>
    <div className="finder-list">{found.map(item => <button key={item.id} onClick={() => choose(item.id)} aria-pressed={selected === item.id}>
      <span className="finder-picture"><ProductPicture variant={item}/></span>
      <span><strong>{item.productName}</strong><small>{item.name} · {item.sellerSku}</small></span>
      <span className="finder-stock">{count(item.available)} ชิ้น</span>
      {selected === item.id && <Check size={16}/>}
    </button>)}</div>
    {found.length === 0 && <p role="status" className="empty">ไม่พบสินค้า ลองค้นด้วยชื่อรุ่นหรือ SKU</p>}
  </div>;
}
