import { useEffect, useRef, useState } from 'react';
import { ArrowUp, Bot, CirclePause, CirclePlay, Headphones, MessageCircle, ShieldCheck, Sparkles } from 'lucide-react';
import { Empty, Notice } from './components';
import { baht, count, statusLabel, time, type Case, type Command, type ShopState, type Variant } from './model';

type Action = (command: Command) => Promise<boolean>;
type Room = { name: string; title: string; caseId?: string; variantId?: string };

export function CaseList({ state, onOpen }: { state: ShopState; onOpen: (item: Case) => void }) {
  return <section className="panel">
    <div className="section-head"><div><h2>เคสที่ต้องติดตาม</h2><p>งานจากสต็อก คำสั่งซื้อ และแชทลูกค้า</p></div><ClipboardIcon/></div>
    {state.cases.length ? <div className="record-list">{state.cases.map(item => <button key={item.id} className="record" onClick={() => onOpen(item)}><span><strong>{item.title}</strong><small>{item.evidence.at(-1)}</small></span><span className={item.priority === 'high' ? 'badge warm' : 'badge neutral'}>{statusLabel(item.status)}</span></button>)}</div> : <Empty>ยังไม่มีเคสของร้าน</Empty>}
  </section>;
}

function ClipboardIcon() { return <ShieldCheck size={22} className="subtle-icon"/>; }

export function CaseDetail({ item, state, action, analyze, ask, openOrder, openInbox }: { item: Case; state: ShopState; action: Action; analyze: () => Promise<boolean>; ask: () => void; openOrder: (id: string) => void; openInbox: (id: string) => void }) {
  const [chosen, setChosen] = useState(() => typeof item.proposal?.decision === 'object' && item.proposal.decision !== null && 'optionId' in item.proposal.decision && typeof item.proposal.decision.optionId === 'string' ? item.proposal.decision.optionId : '');
  const [setting, setSetting] = useState(!!chosen && item.proposal?.status === 'verified' && !state.policies.some(policy => policy.caseId === item.id));
  const [maxStock, setMaxStock] = useState(1);
  const [maxBudget, setMaxBudget] = useState(0);
  const [limitBudget, setLimitBudget] = useState(false);
  const proposal = item.proposal;
  const options = proposal?.options ?? item.options ?? [];
  const verified = item.status === 'verified' || proposal?.status === 'verified';
  const selected = options.find(option => option.id === chosen);
  const canAutomate = selected && selected.action?.type !== 'prepare_order' && selected.action?.type !== 'campaign_enable' && selected.action?.type !== 'campaign_increase';
  const { orderId, conversationId } = item.entityRefs;
  const policies = state.policies.filter(policy => policy.caseId === item.id || (policy.scope && typeof policy.scope === 'object' && 'caseId' in policy.scope && policy.scope.caseId === item.id));
  return <div className="case-detail">
    <div className="choice-row"><span className="badge warm">{statusLabel(item.status)}</span><button className="secondary" onClick={ask}><MessageCircle size={15}/> คุยกับผู้จัดการเรื่องนี้</button>
      {orderId && <button className="secondary" onClick={() => openOrder(orderId)}>ดูออเดอร์</button>}
      {conversationId && <button className="secondary" onClick={() => openInbox(conversationId)}>ดูแชทลูกค้า</button>}
    </div>
    <h3>ข้อมูลประกอบการตัดสินใจ</h3>
    <ul className="bullet-list">{item.evidence.map((fact, index) => <li key={index}>{fact}</li>)}</ul>
    {proposal?.status === 'stale' && <Notice>ข้อเสนอนี้อ้างอิงข้อมูลเก่า กรุณาตรวจข้อมูลล่าสุด</Notice>}
    <div className="section-head"><div><h3>ทางเลือกที่ทำได้</h3><p>{proposal?.source === 'fixture' ? 'ข้อเสนอจากระบบจำลอง' : proposal?.source === 'ai' ? 'ข้อเสนอจากผู้จัดการ AI' : 'ตรวจสต็อกและสถานะล่าสุดก่อนเลือก'}</p></div><button className="secondary" onClick={() => void analyze()}>วิเคราะห์เคส</button>{!verified && <button className="secondary" onClick={() => void action({type:'defer_case',caseId:item.id})}>พักเคส</button>}</div>
    <div className="record-list">{options.map((option, index) => <article className="option" key={option.id}>
      <strong>{option.label ?? option.title ?? `ทางเลือก ${index + 1}`}</strong><p>{option.reason}</p>
      {option.action?.text && <blockquote>{option.action.text}</blockquote>}
      {option.action?.dailyBudget !== undefined && <p>งบต่อวัน {baht(option.action.dailyBudget)}</p>}
      {proposal && !verified && proposal.status !== 'stale' && <button className="primary" onClick={() => void action({ type: 'choose_option', caseId: item.id, proposalId: proposal.id, optionId: option.id }).then(ok => { if (ok) { setChosen(option.id); setSetting(true); } })}>{option.action?.type === 'customer_reply' ? 'ส่งข้อความนี้' : 'เลือกทางนี้'}</button>}
    </article>)}</div>
    {verified && <Notice>ระบบตรวจสอบผลการดำเนินการในร้านจำลองแล้ว</Notice>}
    {proposal && setting && <div className="option policy-choice">
      <h3>งานแบบนี้ครั้งหน้าให้ทำเองตามกฎ หรือถามทุกครั้ง?</h3>
      <p>กฎนี้ใช้กับงานขอบเขตเดียวกับข้อเสนอที่เลือก และแก้ไขหรือยกเลิกได้</p>
      {canAutomate && <div className="form-grid"><label className="field">สต็อกสูงสุดที่ให้ใช้กฎนี้<input type="number" value={maxStock} min="0" onChange={event => setMaxStock(Number(event.target.value))}/></label><label className="field">งบสูงสุดต่อวัน (บาท)<input type="number" min="0" value={maxBudget} disabled={!limitBudget} onChange={event => setMaxBudget(Number(event.target.value))}/><span className="check-row"><input type="checkbox" checked={limitBudget} onChange={event => setLimitBudget(event.target.checked)}/> จำกัดงบตามจำนวนนี้</span></label></div>}
      <div className="choice-row"><button className="secondary" onClick={() => setSetting(false)}>ถามทุกครั้ง</button>
      {canAutomate && <button className="primary" onClick={() => void action({ type: 'set_policy', caseId: item.id, proposalId: proposal.id, optionId: chosen, enabled: true, maxStock, ...(limitBudget ? {maxDailyBudget:maxBudget} : {}) }).then(ok => { if (ok) setSetting(false); })}>เปิดใช้กฎนี้</button>}</div>
    </div>}
    {policies.length > 0 && <p className="muted">มีกฎที่เกี่ยวข้อง {count(policies.length)} รายการ</p>}
  </div>;
}

export function Inboxes({ state, action, conversationId, onSelect }: { state: ShopState; action: Action; conversationId?: string; onSelect: (id: string) => void }) {
  const [message, setMessage] = useState('');
  const conversation = state.conversations.find(room => room.id === conversationId) ?? state.conversations[0];
  const acknowledgement = state.acknowledgement;
  const [ack, setAck] = useState(acknowledgement?.text ?? '');
  const [enabled, setEnabled] = useState(acknowledgement?.enabled ?? false);
  return <div className="stack"><section className="panel">
    <div className="section-head"><div><h2>กล่องข้อความร้านจำลอง</h2><p>ห้องแชทแยกตามลูกค้า</p></div><Headphones size={22} className="subtle-icon"/></div>
    {conversation ? <>
      <div className="choice-row status-tabs">{state.conversations.map(room => <button key={room.id} className={room.id === conversation.id ? 'active' : ''} onClick={() => { onSelect(room.id); setMessage(''); }}>{room.title}</button>)}</div>
      <div className="section-head"><div><h3>{conversation.title}</h3><p>{conversation.owner === 'human' ? 'เจ้าของร้านรับช่วง' : 'ผู้จัดการ AI ดูแล'}</p></div>
      <button className="secondary" onClick={() => void action({ type: conversation.owner === 'human' ? 'resume_agent' : 'take_over', conversationId: conversation.id })}>{conversation.owner === 'human' ? 'ให้ผู้จัดการดูแลต่อ' : 'รับช่วงแชทนี้'}</button></div>
      <div className="customer-thread">{conversation.messages.map(item => <div className={item.author === 'customer' ? 'message incoming' : 'message outgoing'} key={item.id}><small>{item.author === 'customer' ? 'ลูกค้าจำลอง' : item.author === 'human' ? 'เจ้าของร้าน' : 'ผู้จัดการร้าน'} · {time(item.at)}</small><p>{item.text}</p></div>)}</div>
      <form className="inline-form" onSubmit={event => { event.preventDefault(); const text = message.trim(); if (text) void action({ type: 'customer_message', conversationId: conversation.id, text }).then(success => { if (success) setMessage(''); }); }}>
        <label className="field">จำลองข้อความใหม่จากลูกค้า<input value={message} placeholder="เช่น ยังมีของอยู่ไหมคะ" onChange={event => setMessage(event.target.value)}/></label>
        <button className="secondary" disabled={!message.trim()}>สร้างข้อความจำลอง</button>
      </form>
    </> : <Empty>ยังไม่มีข้อความลูกค้า</Empty>}
  </section>
  <section className="panel"><h2>ข้อความรับเรื่องอัตโนมัติ</h2><p className="muted">ส่งหนึ่งครั้งต่อรอบที่ลูกค้ารอคำตอบ โดยไม่รับปากเรื่องสินค้า ราคา หรือวันส่ง</p>
  <form className="stack" onSubmit={event => { event.preventDefault(); void action({ type: 'set_acknowledgement', enabled, text: ack }); }}>
    <label className="check-row"><input type="checkbox" checked={enabled} onChange={event => setEnabled(event.target.checked)}/> เปิดข้อความรับเรื่องอัตโนมัติ</label>
    <label className="field">ข้อความที่อนุญาต<textarea value={ack} onChange={event => setAck(event.target.value)} maxLength={280}/></label><div><button className="primary" disabled={!ack.trim()}>บันทึกข้อความรับเรื่อง</button></div>
  </form></section></div>;
}

export function Manager({ state, room, variant, draft, setDraft, send, reconnect, action, busy, cancel }: {
  state: ShopState; room: Room; variant?: Variant;
  draft: string; setDraft: (text: string) => void; send: () => Promise<boolean>; reconnect: () => void; action: Action; busy: boolean; cancel: (jobId: string) => void;
}) {
  const messages = state.owner.messages.filter(item => item.room === room.name && (!room.caseId || item.caseId === room.caseId));
  const field = useRef<HTMLTextAreaElement>(null);
  const history = useRef<HTMLDivElement>(null);
  const connected = (state.connection.status === 'ready' || state.connection.status === 'thinking') && !state.hosted?.stale;
  useEffect(() => { if (history.current) history.current.scrollTop = history.current.scrollHeight; }, [messages.length, room.name, room.caseId]);
  const prompts = room.caseId ? ['เคสนี้ต้องตัดสินใจเรื่องอะไร?', 'ข้อมูลล่าสุดเปลี่ยนทางเลือกไหม?'] : ['วันนี้ควรทำอะไรก่อน?', variant ? `ช่วยดูแผนยิงแอด ${variant.sellerSku}` : 'มีสินค้าอะไรใกล้หมด?'];
  return <aside className="assistant-pane" aria-label="ผู้จัดการ AI">
    <div className="assistant-head"><div className="assistant-avatar"><Sparkles size={20}/></div><div><h2>ผู้จัดการ AI</h2><div className={connected && !state.managerPaused ? 'assistant-status ready' : 'assistant-status'}><i/>{state.managerPaused ? 'พักผู้จัดการแล้ว' : connected ? 'เชื่อมต่อ Codex แล้ว' : 'ยังไม่ได้เชื่อมต่อ AI'}</div></div>
      <button className="icon-btn pause" disabled={busy || state.hosted?.stale} aria-label={state.managerPaused ? 'ให้ผู้จัดการทำงานต่อ' : 'พักผู้จัดการ'} title={state.managerPaused ? 'ให้ทำงานต่อ' : 'พักผู้จัดการ'} onClick={() => void action({ type:'pause_manager', paused:!state.managerPaused })}>{state.managerPaused ? <CirclePlay size={19}/> : <CirclePause size={19}/>}</button></div>
    <div className="assistant-context"><span>{state.hosted?.publicDemo ? 'ห้องสนทนาสาธารณะ' : 'ห้องสนทนาเจ้าของร้าน'}</span><strong>{room.title}</strong>{variant && <small>{variant.productName} · {variant.sellerSku}</small>}</div>
    <div className="assistant-history" ref={history} aria-live="polite">
      {messages.length ? messages.map(item => <div className={item.role === 'owner' ? 'message outgoing' : 'message incoming'} key={item.id}>
        <small>{item.role === 'owner' ? 'เจ้าของร้าน' : 'ผู้จัดการ AI'} · {time(item.createdAt)}</small><p>{item.text}</p>{item.status && !['completed', 'verified', 'sent'].includes(item.status) && <small>{statusLabel(item.status)}</small>}
      </div>) : <div className="assistant-intro"><Bot size={24}/><p>ดูข้อมูลร้าน ช่วยวางแผน และเสนอทางเลือกให้คุณตัดสินใจ</p></div>}
      {state.connection.status === 'thinking' && <p className="muted" role="status">กำลังตรวจข้อมูลร้าน…</p>}
    </div>
    <div className="assistant-compose">
      {!connected && <div className="disconnected"><span>{state.hosted?.stale ? 'รอตัวเชื่อมต่อร้านจำลอง' : 'ใช้ข้อมูลร้านและเครื่องมือประเมินแผนได้'}</span><button className="text-btn" disabled={busy || !!state.hosted?.stale} onClick={reconnect}>เชื่อมต่ออีกครั้ง</button>{state.connection.detail && <details><summary>รายละเอียดการเชื่อมต่อ</summary><p>{state.connection.detail}</p></details>}</div>}
      <div className="prompts">{prompts.map(prompt => <button key={prompt} onClick={() => { setDraft(prompt); field.current?.focus(); }}>{prompt}</button>)}</div>
      <form className="message-box" onSubmit={event => { event.preventDefault(); if (draft.trim()) void send(); }}>
        <textarea ref={field} aria-label="ข้อความถึงผู้จัดการ AI" placeholder="ถามผู้จัดการเรื่องร้านของคุณ…" value={draft} onChange={event => setDraft(event.target.value)} maxLength={4000} rows={2}/>
        <button type="submit" aria-label="ส่งให้ผู้จัดการ AI" disabled={!connected || busy || state.managerPaused || !draft.trim()}><ArrowUp size={18}/></button>
      </form>
    </div>
  </aside>;
}
