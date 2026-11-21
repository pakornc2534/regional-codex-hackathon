import { useEffect, useRef, useState, type FormEvent } from 'react';
import { z } from 'zod';
import { post, problem } from './model';
import { ShopIcon } from './ShopIcon';
import { FloatingDot } from './FloatingDot';
import './customer-chat.css';

const replySchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('pending'), id: z.string().optional() }),
  z.object({ status: z.literal('completed'), text: z.string(), source: z.enum(['ai', 'catalog']) }),
]);
type Line = { role: 'buyer' | 'shop'; text: string; source?: 'ai' | 'catalog' };

export function CustomerChat() {
  const [draft, setDraft] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const end = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }); }, [lines, pending, error]);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = draft.trim();
    if (pending || !message) return;
    setPending(true);
    setError('');
    setDraft('');
    setLines(current => [...current, { role: 'buyer', text: message }]);
    try {
      let reply = replySchema.parse(await post('/api/customer/ask', { message }));
      const id = reply.status === 'pending' ? reply.id : undefined;
      const deadline = Date.now() + 65000;
      while (reply.status === 'pending' && id && Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 2200));
        reply = replySchema.parse(await post('/api/customer/status', { id }));
      }
      if (reply.status !== 'completed') throw Error('รอคำตอบนานเกินไป กรุณาลองอีกครั้ง');
      const {text, source} = reply;
      setLines(current => [...current, { role: 'shop', text, source }]);
    } catch (cause) {
      setError(problem(cause));
      setDraft(message);
    } finally {
      setPending(false);
    }
  }

  return <><main className="buyer-chat">
    <header><ShopIcon name="storemark" size={38}/><h1>ถามร้านเรา</h1><a href="/">กลับหน้าร้าน</a></header>
    <p>ลองถามราคา รุ่น หรือของที่เหลือในร้านจำลอง กรุณาอย่าใส่ข้อมูลส่วนตัว</p>
    <div className="buyer-thread" role="log" aria-label="บทสนทนากับร้าน">
      {lines.length === 0 && <div className="buyer-examples">
        {['Sonic ยังมีของไหม', 'โมเดลหุ่นยนต์ราคาเท่าไหร่', 'Kiss me มีรุ่นอะไรบ้าง'].map(example =>
          <button key={example} onClick={() => { setDraft(example); input.current?.focus(); }}>{example}</button>)}
      </div>}
      {lines.map((line, index) => <article className={'buyer-line ' + line.role} key={index}>
        <strong>{line.role === 'buyer' ? 'คุณ' : line.source === 'ai' ? 'ร้านเรา · AI' : 'ร้านเรา · ข้อมูลแค็ตตาล็อก'}</strong>
        <p>{line.text}</p>
      </article>)}
      {pending && <p role="status">กำลังตรวจแค็ตตาล็อก…</p>}
      {error && <p role="alert">{error}</p>}
      <div ref={end}/>
    </div>
    <form onSubmit={send}>
      <label htmlFor="buyer-question">คำถามเกี่ยวกับสินค้า</label>
      <textarea ref={input} id="buyer-question" value={draft} onChange={e => setDraft(e.target.value)} maxLength={300} rows={2} readOnly={pending}/>
      <button className="primary" disabled={pending || !draft.trim()}>ส่งคำถาม</button>
    </form>
  </main><FloatingDot/></>;
}
