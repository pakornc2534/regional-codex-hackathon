import { useEffect, useRef, type ReactNode } from 'react';
import { AlertCircle, X } from 'lucide-react';

export function Notice({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return <div className={error ? 'notice notice-error' : 'notice'} role={error ? 'alert' : undefined}><AlertCircle size={16}/><span>{children}</span></div>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function Metric({ label, value, detail }: { label: string; value: ReactNode; detail?: ReactNode }) {
  return <div className="metric"><span>{label}</span><strong>{value}</strong>{detail && <small>{detail}</small>}</div>;
}

export function Dialog({ title, description, children, onClose }: { title: string; description?: string; children: ReactNode; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    const lastFocus = document.activeElement;
    element?.showModal();
    document.documentElement.dataset.modal = 'true';
    return () => {
      element?.close();
      if (!document.querySelector('dialog[open]')) delete document.documentElement.dataset.modal;
      if (lastFocus instanceof HTMLElement && lastFocus.isConnected) lastFocus.focus();
    };
  }, []);
  return <dialog ref={dialog} className="dialog" aria-label={title} onCancel={event => { event.preventDefault(); onClose(); }}>
    <header className="dialog-head"><div><h2>{title}</h2>{description && <p>{description}</p>}</div><button className="icon-btn" aria-label="ปิดหน้าต่าง" onClick={onClose}><X size={20}/></button></header>
    <div className="dialog-content">{children}</div>
  </dialog>;
}
