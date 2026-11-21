import { useEffect, useId, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { BellRing, Square, Volume2, X } from 'lucide-react';
import { DotRobot, useDotVoice } from './DotAvatar';
import './floating-dot.css';

export type FloatingDotHandle = { listen: () => void };

export function FloatingDot({ message = 'ดอตพร้อมช่วยดูยอดซื้อพุ่งและสรุปงานเช้าของร้านค่ะ',
  onDetails, detailsLabel = 'ดูแจ้งเตือนของร้าน', ref }: {
  message?: string; onDetails?: () => void; detailsLabel?: string; ref?: Ref<FloatingDotHandle>;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const root = useRef<HTMLDivElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const voice = useDotVoice(message);
  const { stop } = voice;

  function close() {
    stop();
    setOpen(false);
    launcher.current?.focus({ preventScroll: true });
  }
  useImperativeHandle(ref, () => ({
    listen() {
      setOpen(true);
      launcher.current?.focus({ preventScroll: true });
      if (!voice.active) voice.play();
    },
  }));
  useEffect(() => {
    if (!open) return;
    const dismissOutside = (event: Event) => {
      if (root.current && !event.composedPath().includes(root.current)) { stop(); setOpen(false); }
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || document.querySelector('dialog[open]')) return;
      event.preventDefault();
      event.stopPropagation();
      stop();
      setOpen(false);
      launcher.current?.focus({ preventScroll: true });
    };
    document.addEventListener('pointerdown', dismissOutside, true);
    document.addEventListener('focusin', dismissOutside, true);
    document.addEventListener('keydown', escape, true);
    return () => {
      document.removeEventListener('pointerdown', dismissOutside, true);
      document.removeEventListener('focusin', dismissOutside, true);
      document.removeEventListener('keydown', escape, true);
    };
  }, [open, stop]);

  return <div ref={root} className="floating-dot">
    <button type="button" ref={launcher} className="floating-dot-launcher" aria-label={open ? 'ปิดผู้ช่วย Dot' : 'เปิดผู้ช่วย Dot'}
      title={open ? 'ปิดผู้ช่วย Dot' : 'เปิดผู้ช่วย Dot'} aria-expanded={open} aria-controls={open ? panelId : undefined}
      onClick={() => { if (open) close(); else setOpen(true); }}>
      <span className="floating-dot-figure"><DotRobot talking={voice.talking}/></span>
      <span className="floating-dot-name" aria-hidden="true">Dot</span>
    </button>
    {open && <section id={panelId} className="floating-dot-panel" aria-label="ผู้ช่วย Dot">
      <div className="floating-dot-heading"><h2>Dot ผู้ช่วยร้าน</h2>
        <button type="button" className="floating-dot-close" aria-label="ปิดหน้าต่าง Dot" onClick={close}><X size={18} aria-hidden="true"/></button>
      </div>
      <p className="floating-dot-message">{voice.sample && <strong>ตัวอย่างเสียง · </strong>}{voice.caption}</p>
      <div className="floating-dot-actions">
        <button type="button" className="dot-avatar-play" onClick={voice.active ? stop : voice.play}>
          {voice.active ? <Square size={14} aria-hidden="true"/> : <Volume2 size={17} aria-hidden="true"/>}
          {voice.active ? 'หยุดเสียง' : 'ฟังเสียง Dot'}
        </button>
        {onDetails
          ? <button type="button" className="floating-dot-details" onClick={() => { close(); onDetails(); }}>{detailsLabel}</button>
          : <a className="floating-dot-details" href="/?dot"><BellRing size={15} aria-hidden="true"/>{detailsLabel}</a>}
      </div>
      <p role="status" className="floating-dot-status">{voice.notice}</p>
    </section>}
  </div>;
}
