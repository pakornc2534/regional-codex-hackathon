import { useEffect, useRef, useState, type ReactNode } from 'react';
import { BookOpen, ChevronDown, History, Pause, PencilLine, Play, SendHorizontal, ShieldCheck, UserRound } from 'lucide-react';
import { ShopIcon } from './ShopIcon';
import './manager.css';
import { Empty, Notice } from './components';
import { baht, count, statusLabel, time, type Case, type Command, type ShopState, type Variant } from './model';

type Action = (command: Command) => Promise<boolean>;
type Room = { name: string; title: string; caseId?: string; variantId?: string };

function CaseMark({ type }: { type: Case['type'] }) {
  const name = type === 'product' ? 'inbox' : type === 'preparation' ? 'packing' : 'campaign';
  return <span className="case-mark"><ShopIcon name={name} size={25}/></span>;
}

function needsDecision(item: Case) {
  return ['open', 'proposed', 'awaiting_approval', 'stale'].includes(item.status);
}

function CaseStatus({ item }: { item: Case }) {
  const urgent = item.priority === 'high' && needsDecision(item);
  return <span className={urgent ? 'case-state urgent' : 'case-state'}>
    {urgent && <strong>ด่วน </strong>}{statusLabel(item.status)}
  </span>;
}

export function CaseList({ state, onOpen }: { state: ShopState; onOpen: (item: Case) => void }) {
  return <section className="panel case-queue">
    <div className="section-head"><div><h2>เคสที่ต้องติดตาม</h2></div><span className="queue-total">{count(state.cases.length)} เคส</span></div>
    {state.cases.length ? <div className="case-rows">{state.cases.map(item => <button key={item.id} className="case-row" onClick={() => onOpen(item)}>
      <CaseMark type={item.type}/><span className="case-row-copy"><strong>{item.title}</strong><small>{item.evidence.at(-1)}</small></span>
      <CaseStatus item={item}/>
    </button>)}</div> : <Empty>ยังไม่มีเคสของร้าน</Empty>}
  </section>;
}

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
    <div className="choice-row"><CaseStatus item={item}/><button className="secondary" onClick={ask}><ShopIcon name="manager" size={18}/> คุยกับผู้จัดการเรื่องนี้</button>
      {orderId && <button className="secondary" onClick={() => openOrder(orderId)}>ดูออเดอร์</button>}
      {conversationId && <button className="secondary" onClick={() => openInbox(conversationId)}>ดูแชทลูกค้า</button>}
    </div>
    <h3>ข้อมูลล่าสุดของเคส</h3>
    <ul className="bullet-list">{item.evidence.map((fact, index) => <li key={index}>{fact}</li>)}</ul>
    {proposal?.status === 'stale' && <Notice>ข้อเสนอนี้อ้างอิงข้อมูลเก่า กรุณาตรวจข้อมูลล่าสุด</Notice>}
    <div className="section-head"><div><h3>ทางเลือกของคุณ</h3><p>{proposal?.source === 'fixture' ? 'ข้อเสนอจากระบบจำลอง' : proposal?.source === 'ai' ? 'ข้อเสนอจากผู้จัดการ AI' : 'ตรวจสต็อกและสถานะล่าสุดก่อนเลือก'}</p></div><button className="secondary" onClick={() => void analyze()}>วิเคราะห์เคส</button>{!verified && <button className="secondary" onClick={() => void action({type:'defer_case',caseId:item.id})}>พักเคส</button>}</div>
    <div className="record-list">{options.map((option, index) => <article className="option" key={option.id}>
      <strong>{option.label ?? option.title ?? `ทางเลือก ${index + 1}`}</strong><p>{option.reason}</p>
      {option.action?.text && <blockquote>{option.action.text}</blockquote>}
      {option.action?.dailyBudget !== undefined && <p>งบต่อวัน {baht(option.action.dailyBudget)}</p>}
      {proposal && !verified && proposal.status !== 'stale' && <button className="primary" onClick={() => void action({ type: 'choose_option', caseId: item.id, proposalId: proposal.id, optionId: option.id }).then(ok => { if (ok) { setChosen(option.id); setSetting(true); } })}>{option.action?.type === 'customer_reply' ? 'ส่งข้อความนี้' : 'เลือกทางนี้'}</button>}
    </article>)}</div>
    {verified && <Notice>ระบบตรวจสอบผลการดำเนินการในร้านจำลองแล้ว</Notice>}
    {proposal && setting && <div className="option policy-choice">
      <h3>งานแบบนี้ครั้งหน้าให้ทำเองตามกฎ หรือถามทุกครั้ง?</h3>
      <p>กำหนดเงื่อนไขสำหรับเคสนี้ได้ที่นี่ คุณแก้กฎภายหลังได้</p>
      {canAutomate && <div className="form-grid"><label className="field">สต็อกสูงสุดที่ให้ใช้กฎนี้<input type="number" value={maxStock} min="0" onChange={event => setMaxStock(Number(event.target.value))}/></label><div className="field"><label>งบสูงสุดต่อวัน (บาท)<input type="number" min="0" value={maxBudget} disabled={!limitBudget} onChange={event => setMaxBudget(Number(event.target.value))}/></label><label className="check-row"><input type="checkbox" checked={limitBudget} onChange={event => setLimitBudget(event.target.checked)}/> จำกัดงบตามจำนวนนี้</label></div></div>}
      <div className="choice-row"><button className="secondary" onClick={() => setSetting(false)}>ถามทุกครั้ง</button>
      {canAutomate && <button className="primary" onClick={() => void action({ type: 'set_policy', caseId: item.id, proposalId: proposal.id, optionId: chosen, enabled: true, maxStock, ...(limitBudget ? {maxDailyBudget:maxBudget} : {}) }).then(ok => { if (ok) setSetting(false); })}>เปิดใช้กฎนี้</button>}</div>
    </div>}
    {policies.length > 0 && <p className="muted">มีกฎที่เกี่ยวข้อง {count(policies.length)} รายการ</p>}
  </div>;
}

export function Inboxes({ state, action, conversationId, onSelect }: { state: ShopState; action: Action; conversationId?: string; onSelect: (id: string) => void }) {
  const [message, setMessage] = useState('');
  const [reply, setReply] = useState('');
  const conversation = state.conversations.find(room => room.id === conversationId) ?? state.conversations[0];
  const acknowledgement = state.acknowledgement;
  const [ack, setAck] = useState(acknowledgement?.text ?? '');
  const [enabled, setEnabled] = useState(acknowledgement?.enabled ?? false);
  return <div className="stack inbox-workspace"><section className="panel">
    <div className="section-head"><h2>กล่องข้อความลูกค้า</h2><span className="queue-total">{count(state.conversations.length)} ห้อง</span></div>
    {conversation ? <>
      <nav className="inbox-rooms" aria-label="เลือกห้องแชทลูกค้า">{state.conversations.map(room => <button key={room.id} aria-pressed={room.id === conversation.id} className={room.id === conversation.id ? 'active' : ''} onClick={() => { onSelect(room.id); setMessage(''); setReply(''); }}><ShopIcon name="inbox" size={20}/>{room.title}</button>)}</nav>
      <div className="section-head"><div><h3>{conversation.title}</h3><p>{conversation.owner === 'human' ? 'เจ้าของร้านรับช่วง' : 'ผู้จัดการ AI ดูแล'}</p></div>
      <button className="secondary" onClick={() => void action({ type: conversation.owner === 'human' ? 'resume_agent' : 'take_over', conversationId: conversation.id })}>{conversation.owner === 'human' ? 'ให้ผู้จัดการดูแลต่อ' : 'รับช่วงแชทนี้'}</button></div>
      <div className="customer-thread">{conversation.messages.map(item => <div className={item.author === 'customer' ? 'message incoming' : 'message outgoing'} key={item.id}><small>{item.author === 'customer' ? 'ลูกค้าจำลอง' : item.author === 'human' ? 'เจ้าของร้าน' : 'ผู้จัดการร้าน'} <time dateTime={item.at}>{time(item.at)}</time></small><p>{item.text}</p></div>)}</div>
      {conversation.owner === 'human' && <form className="inline-form" onSubmit={event => { event.preventDefault(); const text = reply.trim(); if (text) void action({type:'human_reply',conversationId:conversation.id,text}).then(ok => { if (ok) setReply(''); }); }}>
        <label className="field">ตอบลูกค้าด้วยตัวเอง<textarea value={reply} maxLength={1000} onChange={event => setReply(event.target.value)}/></label><button className="primary" disabled={!reply.trim()}>ส่งข้อความนี้</button>
      </form>}
      <form className="inline-form" onSubmit={event => { event.preventDefault(); const text = message.trim(); if (text) void action({ type: 'customer_message', conversationId: conversation.id, text }).then(success => { if (success) setMessage(''); }); }}>
        <label className="field">จำลองข้อความใหม่จากลูกค้า<input value={message} placeholder="เช่น ยังมีของอยู่ไหมคะ" onChange={event => setMessage(event.target.value)}/></label>
        <button className="secondary" disabled={!message.trim()}>สร้างข้อความจำลอง</button>
      </form>
    </> : <Empty>ยังไม่มีข้อความลูกค้า</Empty>}
  </section>
  <section className="panel"><h2>ข้อความรับเรื่องอัตโนมัติ</h2><p className="muted">ส่งครั้งเดียวเมื่อลูกค้าเริ่มรอคำตอบ ใช้ข้อความรับเรื่องสั้น ๆ เช่น "ได้รับข้อความแล้วค่ะ ขอเวลาตรวจสอบก่อนนะคะ"</p>
  <form className="stack" onSubmit={event => { event.preventDefault(); void action({ type: 'set_acknowledgement', enabled, text: ack }); }}>
    <label className="check-row"><input type="checkbox" checked={enabled} onChange={event => setEnabled(event.target.checked)}/> เปิดข้อความรับเรื่องอัตโนมัติ</label>
    <label className="field">ข้อความที่อนุญาต<textarea value={ack} onChange={event => setAck(event.target.value)} maxLength={280}/></label><div><button className="primary" disabled={!ack.trim()}>บันทึกข้อความรับเรื่อง</button></div>
  </form></section></div>;
}

// Render model replies as React text and a small set of formatting elements.
// Only explicit HTTP(S) destinations are linkable.
function inlineText(text: string) {
  const pattern = /(\*\*([^*\n]+)\*\*|\x60([^\x60\n]+)\x60|\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\))/gu;
  const result: ReactNode[] = [];
  let start = 0;
  for (const match of text.matchAll(pattern)) {
    const offset = match.index;
    result.push(text.slice(start, offset));
    if (match[2]) result.push(<strong key={offset}>{match[2]}</strong>);
    else if (match[3]) result.push(<code key={offset}>{match[3]}</code>);
    else result.push(<a key={offset} href={match[5]} target="_blank" rel="noreferrer noopener">{match[4]}</a>);
    start = offset + match[0].length;
  }
  result.push(text.slice(start));
  return result;
}

function Answer({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let items: string[] = [];
  let kind = '';
  function flush() {
    if (!items.length) return;
    const key = blocks.length;
    if (kind === 'ol' || kind === 'ul') {
      const List = kind;
      blocks.push(<List key={key}>{items.map((item, index) => <li key={index}>{inlineText(item)}</li>)}</List>);
    } else if (kind === 'quote') blocks.push(<blockquote key={key}>{inlineText(items.join('\n'))}</blockquote>);
    else blocks.push(<p key={key}>{inlineText(items.join('\n'))}</p>);
    items = [];
  }
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) { flush(); continue; }
    const marker = trimmed.match(/^(#{1,6}\s+|[-*•]\s+|\d+[.)]\s+|>\s*)/u)?.[0] ?? '';
    if (marker.startsWith('#')) {
      flush();
      blocks.push(<p className="desk-answer-title" key={blocks.length}>{inlineText(trimmed.slice(marker.length))}</p>);
      continue;
    }
    const next = !marker ? 'p' : marker[0] === '>' ? 'quote' : /^\d/u.test(marker) ? 'ol' : 'ul';
    if (kind !== next) flush();
    kind = next;
    items.push(trimmed.slice(marker.length));
  }
  flush();
  return <div className="desk-answer">{blocks}</div>;
}

function Conversation({ messages, shared, cancel, onEarlier }: {
  messages: ShopState['owner']['messages']; shared: boolean; cancel: (jobId: string) => void; onEarlier: () => void;
}) {
  const [firstId, setFirstId] = useState(() => messages.filter(item => item.role === 'owner').at(-1)?.id);
  const start = firstId ? messages.findIndex(item => item.id === firstId) : 0;
  return <>
    {start > 0 && <button className="desk-older" onClick={() => { onEarlier(); setFirstId(undefined); }}><History size={14} aria-hidden="true"/>ดูข้อความก่อนหน้า ({count(start)})</button>}
    <div role="log" aria-live="polite" aria-relevant="additions text">{messages.slice(Math.max(start, 0)).map(item => {
        const owner = item.role === 'owner';
        const working = item.status === 'thinking' || item.status === 'queued';
        return <article className={owner ? 'desk-entry desk-owner' : 'desk-entry desk-manager'} key={item.id} data-message-id={item.id}>
          <div className="desk-byline"><span>{owner ? <UserRound size={15} aria-hidden="true"/> : <ShopIcon name="manager" size={18}/>} {owner ? (shared ? 'ผู้ใช้เดโม' : 'เจ้าของร้าน') : 'ผู้จัดการ AI'}</span><time dateTime={item.createdAt}>{time(item.createdAt)} น.</time></div>
          {owner ? <p className="desk-owner-text">{item.text}</p> : item.text && <Answer text={item.text}/>}
          {working && <div className="desk-working"><span>{item.status === 'queued' ? 'รอตอบ' : 'กำลังตรวจข้อมูลร้าน…'}</span><button type="button" onClick={() => cancel(item.id)}>ยกเลิก</button></div>}
          {item.status === 'failed' && <span className="desk-failed">งานนี้ไม่สำเร็จ</span>}
        </article>;
      })}</div>
  </>;
}

export function Manager({ state, room, variant, draft, setDraft, send, reconnect, action, busy, cancel, openCase, onOpenCase }: {
  state: ShopState; room: Room; variant?: Variant;
  draft: string; setDraft: (text: string) => void; send: () => Promise<boolean>; reconnect: () => void; action: Action; busy: boolean; cancel: (jobId: string) => void; openCase?: () => void; onOpenCase?: (id:string) => void;
}) {
  const messages = state.owner.messages.filter(item => item.room === room.name && (item.caseId || null) === (room.caseId || null));
  const field = useRef<HTMLTextAreaElement>(null);
  const history = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  const connected = (state.connection.status === 'ready' || state.connection.status === 'thinking') && !state.hosted?.stale;
  const allowed = connected && !busy && !state.managerPaused;
  const last = messages.at(-1);
  useEffect(() => { follow.current = true; }, [room.name, room.caseId]);
  useEffect(() => {
    const pane = history.current;
    if (!pane || !last) return;
    function revealLatest() {
      if (!pane || !pane.clientHeight || !follow.current) return;
      const latest = pane.querySelector('[role="log"]')?.lastElementChild;
      if (!latest) return;
      const entry = latest.getBoundingClientRect();
      pane.scrollTop = entry.height > pane.clientHeight - 24
        ? pane.scrollTop + entry.top - pane.getBoundingClientRect().top - 12
        : pane.scrollHeight;
    }
    revealLatest();
    const resize = new ResizeObserver(revealLatest);
    resize.observe(pane);
    return () => resize.disconnect();
  }, [room.caseId, room.name, last?.id, last?.status, last?.text]);

  const prompts = room.caseId
    ? ['เคสนี้ต้องตัดสินใจเรื่องอะไร?', 'ถ้าเลือกแต่ละทาง จะเกิดอะไรขึ้น?']
    : room.name === 'overview'
      ? ['สรุปยอดขาย 7 วันให้หน่อย', 'วันนี้ควรเริ่มจัดออเดอร์ไหนก่อน?']
      : room.name === 'research'
        ? ['ช่วยหาแหล่งข้อมูลพร้อมวันที่ตรวจสอบ', 'สินค้าที่เทียบกันต่างกันตรงไหน?']
        : variant ? [`ถ้ายิงแอด ${variant.sellerSku} ต้องขายเพิ่มกี่ชิ้น?`, 'วัสดุแพ็กพอกับแผนนี้ไหม?']
          : ['วันนี้มีเรื่องไหนต้องตัดสินใจ?', 'สินค้าอะไรใกล้หมด?'];
  const pendingCases = state.cases.filter(needsDecision);
  const showCases = room.name === 'overview' && pendingCases.length > 0 && onOpenCase;
  function usePrompt(prompt: string) {
    setDraft(prompt);
    field.current?.focus();
  }
  function submit() {
    if (!allowed || !draft.trim()) return;
    follow.current = true;
    void send();
  }
  return <aside className="desk-pane" aria-label="ผู้จัดการ AI">
    <header className="desk-head">
      <span className="desk-avatar"><ShopIcon name="manager" size={40}/></span>
      <div><h2>ผู้จัดการ AI</h2><span className={connected && !state.managerPaused ? 'desk-status ready' : 'desk-status'}><i aria-hidden="true"/>{state.managerPaused ? 'พักงานอยู่' : connected ? 'เชื่อมต่อ Codex แล้ว' : 'ออฟไลน์'}</span></div>
      <button type="button" className="desk-pause" disabled={busy} aria-label={state.managerPaused ? 'ให้ผู้จัดการทำงานต่อ' : 'พักผู้จัดการ'} title={state.managerPaused ? 'ให้ผู้จัดการทำงานต่อ' : 'พักผู้จัดการ'} onClick={() => void action({ type:'pause_manager', paused:!state.managerPaused })}>{state.managerPaused ? <Play size={17} aria-hidden="true"/> : <Pause size={17} aria-hidden="true"/>}</button>
    </header>
    <div className="desk-context">
      <div className="desk-context-heading"><span>หัวข้อ</span><strong>{room.title}</strong></div>
      {room.name !== 'overview' && variant && <p className="desk-reference"><span>{variant.sellerSku}</span>{variant.productName}</p>}
      {openCase && <button className="desk-link" onClick={openCase}>ดูข้อมูลเคส</button>}
    </div>
    <div className="desk-thread" aria-label="ประวัติสนทนา" tabIndex={-1} ref={history} onScroll={event => {
      const el = event.currentTarget;
      follow.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    }}>
      {messages.length ? <Conversation key={JSON.stringify([state.runId, room.name, room.caseId])} messages={messages} shared={!!state.hosted?.publicDemo} cancel={cancel} onEarlier={() => {
        follow.current = false;
        if (history.current) { history.current.scrollTop = 0; history.current.focus({preventScroll:true}); }
      }}/> : <div className="desk-start">
        <h3>เริ่มจากคำถาม</h3>
        <div className="desk-starters">{prompts.map(prompt => <button key={prompt} type="button" onClick={() => usePrompt(prompt)}><span>{prompt}</span><PencilLine size={16} aria-hidden="true"/></button>)}</div>
        {showCases && <details className="desk-open-cases">
          <summary><ShopIcon name="cases" size={21}/><span>เคสที่รอคุณเลือก ({count(pendingCases.length)})</span><ChevronDown size={15} aria-hidden="true"/></summary>
          {pendingCases.map(item => <button key={item.id} type="button" onClick={() => onOpenCase(item.id)}><CaseMark type={item.type}/><span>{item.title}</span></button>)}
        </details>}
      </div>}
    </div>
    <div className="desk-compose">
      {!connected && <div className="disconnected"><span>{state.hosted?.stale ? 'รอเครื่องที่ดูแลร้านกลับมาออนไลน์' : 'ผู้จัดการยังตอบแชทไม่ได้'}</span><button className="text-btn" disabled={busy || !!state.hosted?.stale} onClick={reconnect}>เชื่อมต่ออีกครั้ง</button>{state.connection.detail && <details><summary>รายละเอียด</summary><p>{state.connection.detail}</p></details>}</div>}
      {messages.length > 0 && <details className="desk-prompt-menu" key={room.name + (room.caseId ?? '')}><summary><BookOpen size={16} aria-hidden="true"/> คำถามที่แนะนำ</summary><div className="desk-starters">{prompts.map(prompt => <button type="button" key={prompt} onClick={event => { event.currentTarget.closest('details')?.removeAttribute('open'); usePrompt(prompt); }}><span>{prompt}</span><PencilLine size={14}/></button>)}</div></details>}
      <form className="desk-form" onSubmit={event => { event.preventDefault(); submit(); }}>
        <label className="desk-draft-label" htmlFor="manager-draft">ข้อความถึงผู้จัดการ</label>
        <textarea id="manager-draft" ref={field} aria-label="ข้อความถึงผู้จัดการ AI" placeholder={state.managerPaused ? 'ผู้จัดการพักงานอยู่' : 'ถามเรื่องร้าน…'} value={draft} onChange={event => setDraft(event.target.value)} maxLength={4000} rows={2}
          onKeyDown={event => {if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); submit(); }}}/>
        <div className="desk-form-foot"><span title={state.hosted?.publicDemo ? 'ทุกคนที่เข้าเดโมเห็นแชทนี้' : 'สนทนากับผู้จัดการร้าน'}>{state.hosted?.publicDemo ? <ShopIcon name="inbox" size={16}/> : <ShieldCheck size={15} aria-hidden="true"/>} {state.hosted?.publicDemo ? 'แชทสาธารณะ' : 'แชทเจ้าของร้าน'}</span>
          <button type="submit" aria-label="ส่งให้ผู้จัดการ AI" title="ส่งข้อความ" disabled={!allowed || !draft.trim()}><SendHorizontal size={17} aria-hidden="true"/> ส่ง</button>
        </div>
      </form>
    </div>
  </aside>;
}
