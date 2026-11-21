import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { CalendarDays, PanelsTopLeft, BookOpen, Calculator, ChevronRight, Maximize2, Menu, Minimize2, RotateCcw, Settings2, X } from 'lucide-react';
import { ShopIcon } from './ShopIcon';
import { CatalogFeature, OverviewMetrics, ProductFinder } from './Overview';
import { DotEntry, DotPanel } from './DotPanel';
import { Briefs, Competitors, Memory, Sales, SalesChart, Settings } from './Business';
import { Dialog, Empty, Notice } from './components';
import { CaseDetail, CaseList, Inboxes, Manager } from './Manager';
import { Fulfillment, ProductFacts, Stock, Supplies } from './Operations';
import { PlanDialog, PlanResults, usePlanEvaluation } from './Planner';
import { baht, count, modes, post, problem, readStamp, readState, timestamp, type Command, type Mode, type PlanInputs, type ShopState, type Variant } from './model';
import type { SceneZone } from './scene/ShopScene';
const ShopScene = lazy(() => import('./scene/ShopScene'));

const navigation = [
  { group: 'หน้าร้าน', items: [
    { id: 'overview', title: 'ภาพรวม' }, { id: 'scene', title: 'ร้าน 3D' },
    { id: 'cases', title: 'เคส' }, { id: 'inbox', title: 'แชทลูกค้า' }, { id: 'dot', title: 'แจ้งเตือน Dot' },
  ] },
  { group: 'การดำเนินงาน', items: [
    { id: 'stock', title: 'สต็อกกลาง' }, { id: 'supplies', title: 'วัสดุแพ็ก' },
    { id: 'plan', title: 'ลองปรับแผน' }, { id: 'orders', title: 'ส่งของและของคืน' },
    { id: 'finance', title: 'การเงิน' }, { id: 'insights', title: 'ผลการขายและสุขภาพบัญชี' },
  ] },
  { group: 'ข้อมูลและการตั้งค่า', items: [
    { id: 'settings', title: 'จัดการร้าน' }, { id: 'briefs', title: 'บรีฟข่าว' },
    { id: 'research', title: 'สินค้าและคู่แข่ง' }, { id: 'memory', title: 'ความจำและกฎของร้าน' },
  ] },
] as const;
type Page = typeof navigation[number]['items'][number]['id'];
type Layer = { kind: 'zone'; zone: SceneZone; variantId?: string; orderId?: string } | { kind: 'case'; id: string } | { kind: 'reset' } | { kind: 'selector' };

const titles: Record<Page, string> = {
  overview: 'ภาพรวมร้าน', scene: 'ร้าน 3D', cases: 'เคสของร้าน', inbox: 'แชทลูกค้า', stock: 'สต็อกกลาง', supplies: 'วัสดุแพ็ก',
  plan: 'ลองปรับแผน', orders: 'ส่งของและของคืน', finance: 'การเงิน', insights: 'ผลการขายและสุขภาพบัญชี', settings: 'จัดการร้าน',
  briefs: 'บรีฟข่าว', research: 'สินค้าและคู่แข่ง', memory: 'ความจำและกฎของร้าน', dot: 'แจ้งเตือน Dot',
};
const descriptions: Record<Page, string> = {
  overview: '',
  dot: 'ดูยอดซื้อที่เข้าเกณฑ์แจ้งเตือนและงานที่ควรทำวันนี้',
  scene: 'เลือกสินค้าและจุดทำงานเพื่อเปิดข้อมูลของร้าน',
  cases: 'เปิดเคสเพื่อดูหลักฐานและเลือกว่าจะทำอย่างไรต่อ',
  inbox: 'อ่านข้อความลูกค้าและเลือกผู้ดูแลแต่ละบทสนทนา',
  stock: 'ดูของที่เหลือขายและจำนวนที่ร้านแจ้งช่องทางออนไลน์',
  supplies: 'ตรวจวัสดุที่จองแล้วและรับวัสดุใหม่เข้าร้าน',
  plan: 'เลือกสินค้าแล้วลองเปลี่ยนงบ ราคา หรือกำลังแพ็ก',
  orders: 'ติดตามออเดอร์ตั้งแต่รอหยิบจนถึงปลายทาง',
  finance: 'ติดตามยอดขายและเงินรับตามวันที่เกิดรายการ',
  insights: 'ดูผลตามช่วงเวลาและแหล่งที่มาของสถานะบัญชี',
  settings: 'ดูการตั้งค่าและเริ่มรอบทดลองของร้าน',
  briefs: 'อ่านสรุปงานประจำวันและข่าวที่เกี่ยวข้อง',
  research: 'ติดตามสินค้าและราคาเปรียบเทียบจากข้อมูลตัวอย่าง',
  memory: 'จัดการบริบทของร้านและขอบเขตที่ผู้จัดการทำได้',
};
const zones: Record<SceneZone, { title: string; page: Page }> = {
  product: { title: 'สินค้าบนชั้น', page: 'stock' }, picking: { title: 'คิวหยิบสินค้า', page: 'orders' },
  packing: { title: 'โต๊ะแพ็กของ', page: 'orders' }, staging: { title: 'จุดรอขนส่งรับ', page: 'orders' },
  carrier: { title: 'ลานขนส่ง', page: 'orders' }, returns: { title: 'จุดรับของคืน', page: 'orders' },
  cashier: { title: 'เคาน์เตอร์การเงิน', page: 'finance' }, insights: { title: 'จอผลการขาย', page: 'insights' },
  computer: { title: 'โต๊ะจัดการร้าน', page: 'settings' },
};
const zoneTab: Partial<Record<SceneZone, string>> = { picking: 'picking', packing: 'packing', staging: 'ready', carrier: 'collected', returns: 'returns' };

function pageFromLocation(): Page {
  if (new URLSearchParams(location.search).has('dot')) return 'dot';
  const saved = history.state?.shopPage;
  return typeof saved === 'string' && Object.hasOwn(titles, saved) ? saved as Page : 'overview';
}

function useShopState() {
  const [state, setState] = useState<ShopState>();
  const [loadError, setLoadError] = useState('');
  const seen = useRef<string>(undefined);
  const inFlight = useRef<Promise<ShopState | undefined>>(undefined);
  const refresh = useCallback((force = true): Promise<ShopState | undefined> => {
    if (inFlight.current) return force ? inFlight.current.then(() => refresh(true)) : inFlight.current;
    const load = async () => {
      try {
        const tag = await readStamp();
        if (!force && seen.current === tag) return;
        const next = await readState();
        seen.current = tag;
        setState(next);
        setLoadError('');
        return next;
      } catch (error) {
        seen.current = undefined;
        setLoadError(problem(error));
        return undefined;
      }
    };
    const request = load().finally(() => { inFlight.current = undefined; });
    inFlight.current = request;
    return request;
  }, []);
  useEffect(() => {
    void refresh();
    const events = new EventSource('/api/events');
    const update = () => void refresh(false);
    events.onmessage = update;
    events.addEventListener('state', update);
    events.addEventListener('change', update);
    events.addEventListener('revision', update);
    const interval = window.setInterval(update, 3500);
    return () => { events.close(); window.clearInterval(interval); };
  }, [refresh]);
  return { state, loadError, refresh };
}

function ProductSelector({ state, variants, selected, onSelect, children }: { state: ShopState; variants: Variant[]; selected?: Variant; onSelect: (id: string) => void; children: ReactNode }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const categories = [...new Set(state.products.map(item => item.category))];
  function filter(search: string, group: string) {
    const text = search.trim().toLowerCase();
    return variants.filter(v => (!group || v.category === group) && [v.productName,v.name,v.sellerSku].join(' ').toLowerCase().includes(text));
  }
  function changeFilter(search: string, group: string) {
    setQuery(search);
    setCategory(group);
    const next = filter(search, group);
    if (next[0] && !next.some(v => v.id === selected?.id)) onSelect(next[0].id);
  }
  const matches = filter(query, category);
  const products = state.products.filter(p => matches.some(variant => variant.productId === p.id));
  const product = products.find(p => p.id === selected?.productId) ?? products[0];
  const models = product ? matches.filter(variant => variant.productId === product.id) : [];
  return <><div className="product-selector">
    <label className="field">ค้นหาสินค้า<input value={query} placeholder="ชื่อ รุ่น หรือ SKU" onChange={event => changeFilter(event.target.value, category)}/></label>
    <label className="field">หมวดหมู่<select value={category} onChange={event => changeFilter(query, event.target.value)}><option value="">ทุกหมวดหมู่</option>{categories.map(key => <option key={key}>{key}</option>)}</select></label>
    <label className="field">สินค้า<select value={product?.id ?? ''} disabled={!products.length} onChange={event => {
      const variant = matches.find(row => row.productId === event.target.value);
      if (variant) onSelect(variant.id);
    }}>{products.length ? products.map(p => <option key={p.id} value={p.id}>{p.name}</option>) : <option value="">ไม่มีสินค้าที่ตรงกัน</option>}</select></label>
    <label className="field">รุ่น<select value={models.some(item => item.id === selected?.id) ? selected?.id : ''} disabled={!models.length} onChange={event => onSelect(event.target.value)}>
      {!models.some(item => item.id === selected?.id) && <option value="">เลือกรุ่นสินค้า</option>}
      {models.map(item => <option key={item.id} value={item.id}>{item.name ? `${item.name} · ` : ''}{item.sellerSku}</option>)}</select></label>
  </div>{matches.length ? children : <p role="status" className="empty">ไม่พบสินค้า ลองเปลี่ยนหมวดหมู่หรือคำค้น</p>}</>;
}

export default function App() {
  const { state, loadError, refresh } = useShopState();
  const [page, setPage] = useState<Page>(pageFromLocation);
  const [mobile, setMobile] = useState<'menu' | 'manager' | undefined>();
  const [selectedId, setSelectedId] = useState('');
  const [inboxId, setInboxId] = useState<string>();
  const [layer, setLayer] = useState<Layer>();
  const [mode, setMode] = useState<Mode>();
  const [inputs, setInputs] = useState<PlanInputs>();
  const planDrafts = useRef(new Map<string,PlanInputs>());
  const [sceneMode, setSceneMode] = useState<'3d' | '2d'>('3d');
  const [resetKey, setResetKey] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [orderStage, setOrderStage] = useState('picking');
  const [roomCase, setRoomCase] = useState<string>();
  const [draft, setDraft] = useState('');
  const [research, setResearch] = useState(false);
  const [discussPlan, setDiscussPlan] = useState(false);
  const [busy, setBusy] = useState(false);
  const [commandError, setCommandError] = useState('');
  const [feedback, setFeedback] = useState('');
  const busyRef = useRef(false);
  const variants = useMemo(() => state?.products.flatMap(product => product.variants.map(variant => ({
    ...variant, productName: product.name, productId: product.id, category: product.category,
  }))) ?? [], [state]);
  const selected = variants.find(variant => variant.id === selectedId) ?? variants.find(variant => variant.sellerSku === 'ROBOT') ?? variants[0];
  const layerVariant = layer?.kind === 'zone' && layer.variantId ? variants.find(item => item.id === layer.variantId) ?? selected : selected;
  const selectedCase = layer?.kind === 'case' ? state?.cases.find(item => item.id === layer.id) : undefined;
  const roomCaseData = roomCase ? state?.cases.find(item => item.id === roomCase) : undefined;
  const room = research ? {name:'research', title:'ค้นคว้าจากแหล่งสาธารณะ', caseId:undefined, variantId:selected?.id} : roomCaseData ? {name: 'case', title: roomCaseData.title, caseId: roomCaseData.id, variantId: roomCaseData.entityRefs.variantId} : {name: page, title: titles[page], variantId: selected?.id};
  const evaluation = usePlanEvaluation(state, inputs, !!mode, selected?.id);
  const scrollResults = useRef(false);
  useEffect(() => {
    if (scrollResults.current && evaluation.result && !evaluation.loading && !evaluation.stale) {
      scrollResults.current = false;
      document.getElementById('plan-results')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
    }
  }, [evaluation.result, evaluation.loading, evaluation.stale]);
  useEffect(() => {
    if (!fullscreen) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape' && !document.querySelector('dialog[open]')) setFullscreen(false); };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [fullscreen]);

  useEffect(() => {
    if (!mobile) return;
    const prior = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
    const drawer = document.querySelector<HTMLElement>(mobile === 'menu' ? '.sidebar' : '.manager-slot');
    const focusables = () => Array.from(drawer?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input, textarea:not([disabled]), [tabindex="0"]') ?? []).filter(el => el.offsetWidth > 0);
    focusables()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (document.querySelector('dialog[open]')) return;
      if (e.key === 'Escape') setMobile(undefined);
      if (e.key === 'Tab') {
        const items = focusables(), first = items[0], last = items.at(-1);
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    };
    const wide = window.matchMedia('(min-width: 950px)');
    const closeOnDesktop = () => { if (wide.matches) setMobile(undefined); };
    wide.addEventListener('change', closeOnDesktop);
    document.documentElement.dataset.drawer = 'open';
    document.addEventListener('keydown', onKey);
    return () => { delete document.documentElement.dataset.drawer; document.removeEventListener('keydown', onKey); wide.removeEventListener('change', closeOnDesktop); prior?.focus({preventScroll:true}); };
  }, [mobile]);

  const displayPage = useCallback((next: Page) => {
    setPage(next);
    setLayer(undefined);
    setMode(undefined);
    setFullscreen(false);
    setMobile(undefined);
    setRoomCase(undefined);
    setResearch(false);
    setDiscussPlan(false);
    window.scrollTo(0, 0);
  }, []);
  useEffect(() => {
    function restorePage() {
      displayPage(pageFromLocation());
    }
    window.addEventListener('popstate', restorePage);
    return () => window.removeEventListener('popstate', restorePage);
  }, [displayPage]);
  function go(next: Page) {
    if (next !== page && (next === 'dot' || page === 'dot')) {
      const url = new URL(location.href);
      if (next === 'dot') url.searchParams.set('dot', '');
      else {
        url.searchParams.delete('dot');
        if (url.hash === '#sales-watch' || url.hash === '#morning-work') url.hash = '';
      }
      history.replaceState({ ...history.state, shopPage: page }, '');
      history.pushState({ ...history.state, shopPage: next }, '', url);
    } else if (next !== page && history.state?.shopPage) {
      history.replaceState({ ...history.state, shopPage: next }, '');
    }
    displayPage(next);
  }
  const open = useCallback((zone: SceneZone, variantId?: string) => {
    if (variantId) setSelectedId(variantId);
    setLayer({ kind: 'zone', zone, variantId });
  }, []);
  function openCase(id: string) { setMobile(undefined); setResearch(false); setDiscussPlan(false); setRoomCase(id); setLayer({ kind: 'case', id }); }
  function ask(question: string, options: { caseId?: string; research?: boolean; plan?: boolean } = {}) {
    setRoomCase(options.caseId);
    setResearch(!!options.research);
    setDiscussPlan(!!options.plan);
    setDraft(question);
    if (window.matchMedia('(max-width: 949px)').matches) setMobile('manager');
    requestAnimationFrame(() => document.querySelector<HTMLTextAreaElement>('.manager-slot textarea')?.focus());
    setLayer(undefined);
    setFullscreen(false);
  }
  async function invoke(path: string, body: unknown, success?: string) {
    if (busyRef.current) return false;
    setCommandError('');
    setFeedback('');
    if (loadError || state?.hosted?.stale) {
      setCommandError('ยังส่งคำสั่งไม่ได้ กรุณารอให้เชื่อมต่อร้านอีกครั้ง');
      return false;
    }
    busyRef.current = true;
    setBusy(true);
    try {
      await post(path, body);
      await refresh();
      if (success) setFeedback(success);
      return true;
    } catch (error) {
      setCommandError(problem(error));
      return false;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  function action(command: Command) {
    if (!state) return Promise.resolve(false);
    return invoke('/api/sim/command', { ...command, actor: 'owner', runId: state.runId, expectedVersion: state.revision, idempotencyKey: crypto.randomUUID() }, 'บันทึกในร้านจำลองแล้ว');
  }
  async function send() {
    if (!state || !draft.trim()) return false;
    const ok = await invoke('/api/chat', { message: draft.trim(), room: room.name, caseId: roomCaseData?.id, variantId: room.variantId, runId: state.runId, ...(research ? {research:true} : {}), ...(discussPlan && inputs && !evaluation.stale ? {plan:inputs} : {}) });
    if (ok) setDraft('');
    return ok;
  }
  function submitPlan(next: PlanInputs) {
    setInputs(next);
    setMode(undefined);
    setLayer(undefined);
    setFullscreen(false);
    if (page !== 'overview' && page !== 'scene' && page !== 'plan') go('plan');
    scrollResults.current = true;
  }

  if (!state) {
    return <div className="boot"><div className="brand-glyph"><ShopIcon name="storemark" size={36}/></div><h1>ร้านเรา</h1>
      {loadError ? <><Notice error>{loadError}</Notice><button className="primary" onClick={() => void refresh()}>ลองเชื่อมต่อร้านอีกครั้ง</button></> : <p role="status">กำลังเปิดร้านจำลอง…</p>}
    </div>;
  }
  const { metrics } = state;
  const awaiting = state.cases.filter(item => ['open', 'awaiting_approval', 'proposed', 'stale'].includes(item.status)).length;
  const unavailable = busy || !!loadError || !!state.hosted?.stale;
  const sceneLabels = {
    product: {title: 'สินค้าบนชั้น', detail: selected ? `${selected.sellerSku} · เหลือขาย ${count(selected.available)} ชิ้น` : 'เลือกสินค้า'},
    picking: {title: 'คิวหยิบสินค้า', detail: `${count(metrics.stages.picking?.orders)} พัสดุรอหยิบ`},
    packing: {title: 'โต๊ะแพ็กของ', detail: `${count(metrics.queueUnits)} ชิ้นรอเตรียมและแพ็ก`},
    staging: {title: 'จุดรอขนส่งรับ', detail: `${count(metrics.stages.ready?.orders)} พัสดุ · ${count(metrics.stages.ready?.units)} ชิ้น`},
    carrier: {title: 'ลานขนส่ง', detail: `${count(metrics.stages.collected?.orders)} รับแล้ว · ${count(metrics.stages.transit?.orders)} ระหว่างทาง`},
    returns: {title: 'จุดรับของคืน', detail: `${state.returns.filter(row => row.stage === 'transit').length} กำลังกลับ · ${state.returns.filter(row => row.stage === 'received').length} รอตรวจ`},
    cashier: {title: 'เคาน์เตอร์การเงิน', detail: `ยอดขาย 7 วัน ${baht(metrics.sales7d)}`},
    insights: {title: 'จอผลการขาย', detail: `${count(metrics.orders7d)} ออเดอร์ชำระแล้วใน 7 วัน`},
    computer: {title: 'โต๊ะจัดการร้าน', detail: `${state.shop.name} · ${state.shop.platform} จำลอง`},
  };
  const sceneVariants = variants.map(item => ({
    id: item.id, name: [item.productName, item.name].filter(Boolean).join(' · '), sku: item.sellerSku, category: item.category, available: item.available,
  }));
  const planButtons = <div className="choice-row plan-buttons">{Object.entries(modes).map(([key, label]) =>
    <button key={key} className={key === 'ads' ? 'primary' : 'secondary'} disabled={!selected} onClick={() => {
      if (key === 'ads' || key === 'flash' || key === 'marketing' || key === 'investment') setMode(key);
    }}>{key === 'ads' && <Calculator size={15}/>} {label}</button>)}</div>;
  const productSelector = <ProductSelector state={state} variants={variants} selected={selected} onSelect={setSelectedId}>
    {page === 'scene' && selected && <div className="choice-row"><button className="secondary" onClick={() => open('product', selected.id)}>เปิดรายละเอียด {selected.sellerSku}</button></div>}
    {planButtons}
  </ProductSelector>;
  const scene = <section className={fullscreen ? 'scene-card scene-fullscreen' : 'scene-card'} aria-label="แผนผังร้าน">
    <div className="scene-head"><div className="scene-name"><ShopIcon name="scene" size={23}/><h2>{page === 'overview' && sceneMode === '3d' ? 'ร้านของสะสม 3D' : 'แผนผังร้าน'}</h2></div>
      <div className="scene-tools"><div className="segmented" aria-label="มุมมองร้าน"><button className={sceneMode === '3d' ? 'active' : ''} aria-pressed={sceneMode === '3d'} onClick={() => setSceneMode('3d')}>3D</button><button className={sceneMode === '2d' ? 'active' : ''} aria-pressed={sceneMode === '2d'} onClick={() => setSceneMode('2d')}>2D</button></div>
      <button className="icon-btn scene-tool" title="คืนมุมกล้อง" aria-label="คืนมุมกล้อง" disabled={sceneMode === '2d'} onClick={() => setResetKey(value => value + 1)}><RotateCcw size={16}/></button>
      <button className="icon-btn scene-tool" title={fullscreen ? 'ออกจากเต็มจอ' : 'ดูเต็มจอ'} aria-label={fullscreen ? 'ออกจากเต็มจอ' : 'ดูเต็มจอ'} onClick={() => setFullscreen(value => !value)}>{fullscreen ? <Minimize2 size={17}/> : <Maximize2 size={17}/>}</button></div>
    </div>
    <div className={sceneMode === '2d' ? 'stage stage-flat' : 'stage'}>
      {sceneMode === '3d' ? <Suspense fallback={<div className="stage-loading" role="status">กำลังจัดชั้นสินค้า…</div>}>
        <ShopScene shopName={state.shop.name} variants={sceneVariants} selectedVariantId={selected?.id} labels={sceneLabels} resetKey={resetKey} fullScreen={fullscreen} active={!layer && !mode} onOpen={open}/>
      </Suspense> : <div className="flat-grid">{Object.entries(sceneLabels).map(([key, label]) => {
        if (!isZone(key)) return null;
        return <button key={key} onClick={() => open(key, key === 'product' ? selected?.id : undefined)}><strong>{label.title}</strong><small>{label.detail}</small><ChevronRight size={18}/></button>;
      })}</div>}
    </div>
    <div className="scene-caption"><span>{sceneMode === '3d' ? 'ลากเพื่อหมุนร้าน · แตะจุดเพื่อดูงาน' : 'เลือกจุดทำงาน'}</span>{selected && <button onClick={() => open('product', selected.id)}><ShopIcon name="stock" size={17}/><span>{selected.sellerSku} · เหลือขาย {count(selected.available)} ชิ้น</span><ChevronRight size={16}/></button>}</div>
  </section>;
  const resetShop = () => setLayer({ kind: 'reset' });
  const results = <PlanResults evaluation={evaluation} unavailable={unavailable} onSave={() => { if (inputs) void action({type: 'save_plan', plan: inputs}); }}
    onDiscuss={() => ask(`ช่วยอธิบายผลประเมินแผน${inputs ? modes[inputs.mode] : ''}ของ ${selected?.sellerSku ?? 'สินค้านี้'} ให้หน่อย`, {plan:true})}
    onSupplies={() => go('supplies')} onPacking={() => open('packing')}/>;
  const insight = () => <Sales state={state}/>;
  const finances = () => <Sales state={state} finance/>;
  let content;
  switch (page) {
    case 'overview': content = <>
      <OverviewMetrics state={state} onSales={() => go('finance')} onOrders={() => go('insights')} onPacking={() => { setOrderStage('picking'); go('orders'); }}/>
      <DotEntry onOpen={() => go('dot')}/>
      {selected && <CatalogFeature variant={selected} choose={() => setLayer({kind:'selector'})} showStock={() => open('product', selected.id)} plan={() => setMode('ads')}/>}
      {inputs && results}
      <div className="dashboard-lower">
        <CaseList state={state} onOpen={item => openCase(item.id)}/>
        {scene}
      </div>
      <section className="panel dashboard-sales"><div className="section-head"><h2>ยอดขายรายวัน</h2><button className="text-btn" onClick={() => go('insights')}>ดูรายงาน</button></div><SalesChart state={state} from={metrics.period?.from} to={metrics.period?.to}/></section>
    </>; break;
    case 'dot': content = <DotPanel state={state} stale={Boolean(loadError || state.hosted?.stale)} onWork={area => {
      if (area === 'orders' || area === 'returns') {
        setOrderStage(area === 'returns' ? 'returns' : 'picking');
        go('orders');
      } else go(area);
    }}/>; break;
    case 'scene': content = <>{scene}<section className="panel"><h2>เลือกสินค้าบนชั้น</h2>{productSelector}</section>{inputs && results}</>; break;
    case 'cases': content = <CaseList state={state} onOpen={item => openCase(item.id)}/>; break;
    case 'inbox': content = <Inboxes state={state} action={action} conversationId={inboxId} onSelect={setInboxId}/>; break;
    case 'stock': content = <Stock state={state} variants={variants} open={id => open('product', id)}/>; break;
    case 'supplies': content = <Supplies state={state} action={action}/>; break;
    case 'plan': content = <><section className="panel"><h2>สินค้าและประเภทแผน</h2>{productSelector}</section>{results}{state.plans.length > 0 && <section className="panel"><h2>แผนที่บันทึก</h2><p>มีแผนที่บันทึกไว้ {count(state.plans.length)} แผน</p></section>}</>; break;
    case 'orders': content = <Fulfillment key={orderStage} state={state} variants={variants} action={action} initial={orderStage}/>; break;
    case 'finance': content = finances(); break;
    case 'insights': content = insight(); break;
    case 'briefs': content = <Briefs state={state} action={action} openCase={openCase} research={() => ask('ช่วยค้นคว้าข่าวจริงที่เกี่ยวกับร้านของสะสมในประเทศไทย พร้อมวันที่และลิงก์แหล่งอ้างอิง', {research:true})}/>; break;
    case 'research': content = <Competitors state={state} research={() => ask('ช่วยค้นคว้าราคาคู่แข่งจากแหล่งสาธารณะ เทียบสินค้ารุ่นเดียวกันและอ้างอิงลิงก์พร้อมวันที่ตรวจ', {research:true})}/>; break;
    case 'memory': content = <Memory state={state} action={action} save={text => invoke('/api/memories', {text}, 'บันทึกความจำแล้ว')}/>; break;
    case 'settings': content = <Settings state={state} reset={resetShop}/>; break;
  }
  let dialogContent;
  if (layer?.kind === 'zone') {
    if (layer.zone === 'product' && layerVariant) dialogContent = <><ProductFacts key={layerVariant.id} variant={layerVariant} state={state} action={action}/><h3>ลองปรับแผนสำหรับสินค้านี้</h3>{planButtons}</>;
    else if (layer.zone === 'cashier') dialogContent = finances();
    else if (layer.zone === 'insights') dialogContent = insight();
    else if (layer.zone === 'computer') dialogContent = <Settings state={state} reset={resetShop}/>;
    else dialogContent = <Fulfillment key={layer.zone} state={state} variants={variants} action={action} initial={zoneTab[layer.zone] ?? 'picking'} forOrder={layer.orderId}/>;
  }

  return <div className="app-shell">
    <header className="mobile-bar"><button className="icon-btn" aria-label="เปิดเมนูร้าน" onClick={() => setMobile(mobile === 'menu' ? undefined : 'menu')}><Menu size={21}/></button><button className="mobile-brand" onClick={() => go('overview')}><ShopIcon name="storemark" size={29}/> ร้านเรา</button><button className="icon-btn" aria-label="เปิดผู้จัดการ AI" onClick={() => setMobile(mobile === 'manager' ? undefined : 'manager')}><ShopIcon name="manager" size={25}/></button></header>
    {mobile && <button className="mobile-scrim" aria-label="ปิดแผง" onClick={() => setMobile(undefined)}/>}
    <aside className={mobile === 'menu' ? 'sidebar open' : 'sidebar'} role={mobile === 'menu' ? 'dialog' : undefined} aria-modal={mobile === 'menu' || undefined} aria-label="เมนูร้าน">
      <button className="brand" onClick={() => go('overview')}><span className="brand-glyph"><ShopIcon name="storemark" size={43}/></span><span><strong>ร้านเรา</strong></span></button>
      <button className="shop-card" onClick={() => go('settings')}><span className="shop-avatar"><ShopIcon name="stock" size={26}/></span><span><strong>{state.shop.name}</strong><small>ร้านของสะสมจำลอง</small></span><Settings2 size={15}/></button>
      <nav aria-label="เมนูร้าน">{navigation.map(group => <div className="nav-group" key={group.group}><span>{group.group}</span>{group.items.map(({ id, title }) => <button key={id} className={page === id ? 'nav-item active' : 'nav-item'} aria-current={page === id ? 'page' : undefined} onClick={() => go(id)}><ShopIcon name={id} size={21}/><span>{title}</span>{id === 'cases' && awaiting > 0 && <small>{awaiting}</small>}</button>)}</div>)}</nav>
      <a className="sidebar-bottom" href={import.meta.env.DEV ? '/docs/guide/' : '/guide/'} target="_blank" rel="noopener noreferrer"><BookOpen size={17}/> คู่มือเดโม</a>
    </aside>
    <main className="workspace" inert={mobile ? true : undefined}>
      <div className="workspace-top"><span><ShopIcon name="storemark" size={19}/> {state.shop.name} <ChevronRight size={13}/> {titles[page]}</span><time dateTime={state.clock} title="เวลาร้านจำลอง"><CalendarDays size={15}/> {timestamp(state.clock)}</time></div>
      <div className="page-heading"><div><h1>{titles[page]}</h1>{page !== 'overview' && <p>{descriptions[page]}</p>}</div>{page === 'overview' && <button className="case-jump" onClick={() => go('cases')}><ShopIcon name="cases" size={19}/> งานรอตัดสินใจ <b>{count(awaiting)}</b></button>}</div>
      {state.hosted?.publicDemo && <div className="public-notice"><span aria-hidden="true"><PanelsTopLeft size={16}/></span><p>เดโมสาธารณะ ทุกคนเห็นและแก้ข้อมูลร้านจำลองร่วมกัน กรุณาอย่ากรอกข้อมูลส่วนตัว</p></div>}
      {(state.hosted?.stale || loadError) && <Notice error>{loadError || 'ขาดการเชื่อมต่อกับร้าน กำลังแสดงข้อมูลล่าสุด'}</Notice>}
      {!layer && commandError && <Notice error>{commandError}</Notice>}{!layer && feedback && <p className="feedback" role="status">{feedback}</p>}
      {page === 'overview' && <a className="buyer-entry" href="/?customer"><ShopIcon name="inbox" size={20}/> ทดลองถามสินค้าในแชทลูกค้า</a>}
      <div className="workspace-content">{content}</div>
    </main>
    <div className="mobile-tabs" role="group" aria-label="ทางลัด">
      <button aria-current={page === 'overview' ? 'page' : undefined} onClick={() => go('overview')}><ShopIcon name="overview"/>ภาพรวม</button>
      <button aria-current={page === 'scene' ? 'page' : undefined} onClick={() => go('scene')}><ShopIcon name="scene"/>ร้าน 3D</button>
      <button aria-current={page === 'cases' ? 'page' : undefined} onClick={() => go('cases')}><ShopIcon name="cases"/>เคส</button>
      <button onClick={() => setMobile('manager')}><ShopIcon name="manager"/>ผู้จัดการ AI</button>
    </div>
    <div role={mobile === 'manager' ? 'dialog' : undefined} aria-modal={mobile === 'manager' || undefined} aria-label="ผู้จัดการ AI" className={mobile === 'manager' ? 'manager-slot open' : 'manager-slot'}>{mobile === 'manager' && <button className="manager-close icon-btn" aria-label="ปิดผู้จัดการ" onClick={() => setMobile(undefined)}><X size={18}/></button>}
      <Manager onOpenCase={openCase} state={state} room={room} variant={variants.find(item => item.id === room.variantId)} openCase={roomCaseData ? () => openCase(roomCaseData.id) : undefined} draft={draft} setDraft={setDraft} send={send} cancel={jobId => void invoke('/api/chat/cancel', {jobId,runId:state.runId})}
        reconnect={() => void invoke('/api/reconnect', {}, 'ตรวจการเชื่อมต่อแล้ว')} action={action} busy={unavailable}/>
    </div>
    {layer?.kind === 'zone' && <Dialog title={layer.zone === 'product' ? layerVariant?.productName ?? zones.product.title : zones[layer.zone].title}
      description={layer.zone === 'product' && layerVariant ? `${layerVariant.name ?? ''} · ${layerVariant.sellerSku}` : sceneLabels[layer.zone].detail} onClose={() => setLayer(undefined)}>
      {commandError && <Notice error>{commandError}</Notice>}{feedback && <p role="status" className="feedback">{feedback}</p>}
      {dialogContent}<div className="dialog-actions"><button className="secondary" onClick={() => { if (zoneTab[layer.zone]) setOrderStage(zoneTab[layer.zone] ?? 'picking'); go(zones[layer.zone].page); }}>เปิดหน้าเต็ม</button></div>
    </Dialog>}
    {selectedCase && <Dialog title={selectedCase.title} onClose={() => setLayer(undefined)}>
      {commandError && <Notice error>{commandError}</Notice>}{feedback && <p role="status" className="feedback">{feedback}</p>}
      <CaseDetail key={selectedCase.id} item={selectedCase} state={state} action={action}
        analyze={() => invoke('/api/sim/analyze', { caseId: selectedCase.id, runId: state.runId })}
        ask={() => ask('ช่วยตรวจทางเลือกจากข้อมูลล่าสุดของเคสนี้', {caseId:selectedCase.id})}
        openOrder={id => setLayer({kind: 'zone', zone: 'picking', orderId: id})}
        openInbox={id => { setInboxId(id); go('inbox'); }}/>
    </Dialog>}
    {layer?.kind === 'selector' && <Dialog title="เลือกสินค้าบนแท่น" onClose={() => setLayer(undefined)}>
      <ProductFinder variants={variants} selected={selected?.id} choose={id => { setSelectedId(id); setLayer(undefined); }}/>
    </Dialog>}
    {layer?.kind === 'reset' && <Dialog title="เริ่มรอบทดลองใหม่" onClose={() => setLayer(undefined)}>
      <p>ระบบจะเก็บรอบปัจจุบันไว้ แล้วเปิดร้านใหม่ด้วยข้อมูลเริ่มต้น</p>
      {commandError && <Notice error>{commandError}</Notice>}
      <div className="dialog-actions"><button className="secondary" onClick={() => setLayer(undefined)}>ยกเลิก</button><button className="primary" disabled={unavailable} onClick={() => void action({type:'reset_run'}).then(ok => { if (ok) { setInputs(undefined); planDrafts.current.clear(); setSelectedId(''); go('overview'); } })}>เริ่มรอบใหม่</button></div>
    </Dialog>}
    {mode && selected && <PlanDialog key={`${selected.id}:${mode}`} mode={mode} variant={selected} state={state} previous={planDrafts.current.get(`${selected.id}:${mode}`) ?? inputs}
      onDraft={next => planDrafts.current.set(`${selected.id}:${mode}`,next)}
      onClose={() => setMode(undefined)} onSubmit={submitPlan}/>}
    {!selected && page === 'plan' && <Empty>ร้านนี้ยังไม่มีสินค้าให้ประเมิน</Empty>}
  </div>;
}
function isZone(key: string): key is SceneZone { return Object.hasOwn(zones, key); }
