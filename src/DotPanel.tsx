import { useEffect } from 'react';
import { Activity, BellRing, CalendarClock, Clock3, MessageCircle, Sunrise } from 'lucide-react';
import { dotSummary } from '../shared/dot-monitor.mjs';
import { baht, count, timestamp, type ShopState } from './model';
import './dot-panel.css';

export function DotEntry({ onOpen }: { onOpen: () => void }) {
  return <button className="dot-entry" onClick={onOpen} type="button">
    <span className="dot-entry-icon"><BellRing size={21} aria-hidden="true"/></span>
    <span className="dot-entry-copy"><strong>แจ้งเตือน Dot</strong><span>ยอดซื้อพุ่งและสรุปงานเช้า 08.00 น.</span></span>
    <span className="dot-entry-action">ดูรายละเอียด</span>
  </button>;
}

type WorkArea = 'orders' | 'cases' | 'returns' | 'supplies';

export function DotPanel({ state, stale, onWork }: {
  state: ShopState;
  stale: boolean;
  onWork: (area: WorkArea) => void;
}) {
  const snapshot = dotSummary(state, stale);
  useEffect(() => {
    function showLinkedSection() {
      const section = location.hash.slice(1);
      if (section === 'sales-watch' || section === 'morning-work') {
        document.getElementById(section)?.scrollIntoView({ block: 'start' });
      }
    }
    showLinkedSection();
    window.addEventListener('hashchange', showLinkedSection);
    return () => window.removeEventListener('hashchange', showLinkedSection);
  }, []);
  const queueDetail = snapshot.overdue === null ? 'ยังไม่ทราบจำนวนที่เลยกำหนด'
    : snapshot.overdue > 0 ? `เลยกำหนดแล้ว ${count(snapshot.overdue)} ออเดอร์ ควรจัดการก่อน` : 'ตรวจใบหยิบและเตรียมแพ็กสินค้า';
  const work: { area: WorkArea; title: string; detail: string; value: number; unit: string }[] = [
    { area: 'orders', title: 'ออเดอร์รอเตรียมส่ง', detail: queueDetail, value: snapshot.queue, unit: 'ออเดอร์' },
    { area: 'cases', title: 'เคสรออนุมัติ', detail: 'ตรวจข้อเสนอและเลือกวิธีดำเนินการ', value: snapshot.approval, unit: 'เคส' },
    { area: 'returns', title: 'ของคืนรอตรวจ', detail: 'ตรวจสภาพพัสดุที่กลับถึงร้าน', value: snapshot.returns, unit: 'พัสดุ' },
    { area: 'supplies', title: 'วัสดุแพ็กที่ควรสั่งเพิ่ม', detail: 'เช็กจำนวนพร้อมใช้และเวลารอของ', value: snapshot.supplies, unit: 'รายการ' },
  ];
  const pending = work.filter(item => item.value > 0);

  return <div className="dot-panel">
    <div className="dot-links" aria-label="Dot ใน ChatGPT">
      <a className="primary" href="https://chatgpt.com/dots" target="_blank" rel="noopener noreferrer"><MessageCircle size={17} aria-hidden="true"/>เปิด Dot ของฉัน</a>
      <a className="secondary" href="https://chatgpt.com/scheduled" target="_blank" rel="noopener noreferrer"><CalendarClock size={17} aria-hidden="true"/>จัดการตารางใน ChatGPT</a>
    </div>
    <section id="sales-watch" className="panel dot-watch" aria-labelledby="dot-orders-heading">
      <div className="dot-section-head">
        <h2 id="dot-orders-heading"><Activity size={21} aria-hidden="true"/>เฝ้ายอดซื้อพุ่ง</h2>
        <span className="dot-cadence"><Clock3 size={15} aria-hidden="true"/>ทุก 15 นาที</span>
      </div>
      <p className={'dot-result' + (!stale && snapshot.spike ? ' dot-result-spike' : '')}>
        {stale ? 'ข้อมูลร้านค้าง · รอข้อมูลใหม่เพื่อตรวจยอดซื้อ' : snapshot.spike ? 'ยอดซื้อเข้าเกณฑ์แจ้งเตือน' : 'ยอดซื้อยังไม่ถึงเกณฑ์แจ้งเตือน'}
      </p>
      <dl className="dot-numbers">
        <div><dt>ชำระแล้วใน 60 นาที</dt><dd>{count(snapshot.orders)} <small>ออเดอร์</small></dd></div>
        <div><dt>เฉลี่ยช่วงเดียวกัน 7 วัน</dt><dd>{count(snapshot.baseline)} <small>ออเดอร์</small></dd></div>
        <div><dt>ยอดชำระใน 60 นาที</dt><dd>{baht(snapshot.amount)}</dd></div>
      </dl>
      <p className="dot-shop-time">เวลาของร้านจำลอง <time dateTime={state.clock}>{timestamp(state.clock)}</time></p>
      <details className="dot-rule">
        <summary>เกณฑ์แจ้งเตือนยอดพุ่ง</summary>
        <p>Dot เตือนเมื่อมีออเดอร์ชำระแล้วอย่างน้อย 5 ออเดอร์ในหนึ่งชั่วโมง และจำนวนออเดอร์สูงถึง 3 เท่าของค่าเฉลี่ยช่วงเดียวกันย้อนหลัง 7 วัน ถ้าค่าเฉลี่ยเป็นศูนย์ ใช้เกณฑ์ 5 ออเดอร์ โดยเตือนครั้งเดียวต่อช่วงที่ยอดพุ่ง</p>
        <a className="dot-source" href="/api/dot-summary" target="_blank" rel="noopener noreferrer">ดูข้อมูลสรุปที่ Dot ใช้ตรวจ</a>
      </details>
    </section>
    <section id="morning-work" className="panel dot-morning" aria-labelledby="dot-work-heading">
      <div className="dot-section-head">
        <h2 id="dot-work-heading"><Sunrise size={21} aria-hidden="true"/>สรุปงานเช้า</h2>
        <span className="dot-cadence">ทุกวัน 08.00 น. เวลาไทย</span>
      </div>
      <p className="dot-list-label">{stale ? 'งานค้างตามข้อมูลล่าสุดที่ร้านได้รับ' : 'งานที่ต้องทำจากข้อมูลร้านขณะนี้'}</p>
      {pending.length ? <ul className="dot-work-list">
        {pending.map(item => <li key={item.area}>
          <button type="button" onClick={() => onWork(item.area)}>
            <span className="dot-work-copy"><strong>{item.title}</strong><span>{item.detail}</span></span>
            <span className="dot-work-count">{count(item.value)} <small>{item.unit}</small></span>
          </button>
        </li>)}
      </ul> : <p className="dot-empty">{stale ? 'ข้อมูลรอบล่าสุดไม่มีงานค้างในรายการนี้' : 'ตอนนี้ไม่มีงานค้างในรายการนี้'}</p>}
    </section>
  </div>;
}
