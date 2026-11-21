import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from 'lucide-react';

type Side = 'menu' | 'manager';
type Preference = { collapsed: boolean; width?: number };
type Preferences = Record<Side, Preference>;
const names = { menu: 'เมนูร้าน', manager: 'ผู้จัดการ AI' };
const limits = { menu: { min: 160, max: 340 }, manager: { min: 250, max: 560 } };
const storageKey = 'raan-rao.sidebar-layout.v1';
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(value)));

function readPreferences(): Preferences {
  const prefs: Preferences = { menu: { collapsed: false }, manager: { collapsed: false } };
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? 'null');
    for (const side of ['menu', 'manager'] as const) {
      const item = saved?.[side];
      prefs[side].collapsed = item?.collapsed === true;
      if (Number.isFinite(item?.width)) prefs[side].width = clamp(item.width, limits[side].min, limits[side].max);
    }
  } catch { /* Use the default layout when browser storage is unavailable. */ }
  return prefs;
}

export function useSidebarLayout(ready: boolean) {
  const shell = useRef<HTMLDivElement>(null);
  const [prefs, setPrefs] = useState(readPreferences);
  const [viewport, setViewport] = useState(() => Math.min(document.documentElement.clientWidth, 1960));
  useLayoutEffect(() => {
    const element = shell.current;
    if (!element) return;
    const measure = () => setViewport(element.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ready]);
  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(prefs)); } catch { /* Session layout still works. */ }
  }, [prefs]);

  // Reserve room for the workspace when both panels are open, including after a window resize.
  const budget = Math.max(limits.menu.min + limits.manager.min, viewport - 420);
  const defaultMenu = viewport < 1200 ? 176 : clamp(viewport * .15, 190, 225);
  const defaultManager = viewport < 1200 ? 262 : clamp(viewport * .21, 280, 340);
  const menu = prefs.menu.collapsed ? 54 : clamp(prefs.menu.width ?? defaultMenu, limits.menu.min,
    Math.min(limits.menu.max, budget - (prefs.manager.collapsed ? 50 : limits.manager.min)));
  const manager = prefs.manager.collapsed ? 50 : clamp(prefs.manager.width ?? defaultManager, limits.manager.min,
    Math.min(limits.manager.max, budget - menu));

  function panel(side: Side) {
    const otherWidth = side === 'menu' ? manager : menu;
    return {
      side, shell, collapsed: prefs[side].collapsed, width: side === 'menu' ? menu : manager,
      min: limits[side].min, max: Math.min(limits[side].max, budget - otherWidth),
      expand: () => setPrefs(previous => previous[side].collapsed ? { ...previous, [side]: { ...previous[side], collapsed: false } } : previous),
      toggle: () => setPrefs(previous => ({ ...previous, [side]: { ...previous[side], collapsed: !previous[side].collapsed } })),
      resize: (width: number) => setPrefs(previous => ({ ...previous, [side]: { ...previous[side], width } })),
    };
  }
  const style = { '--menu-width': menu + 'px', '--manager-width': manager + 'px' } as CSSProperties;
  return { shell, style, menu: panel('menu'), manager: panel('manager') };
}

type Panel = ReturnType<typeof useSidebarLayout>['menu'];

export function SidebarToggle({ panel }: { panel: Panel }) {
  const { side, collapsed } = panel;
  const Icon = side === 'menu' ? (collapsed ? PanelLeftOpen : PanelLeftClose) : (collapsed ? PanelRightOpen : PanelRightClose);
  const text = (collapsed ? 'ขยาย' : 'ย่อ') + names[side];
  return <button type="button" className={'sidebar-toggle sidebar-toggle--' + side} aria-label={text} title={text}
    aria-expanded={!collapsed} aria-controls={'shop-' + side} onClick={panel.toggle}><Icon size={18} aria-hidden="true"/></button>;
}

export function SidebarDivider({ panel }: { panel: Panel }) {
  const { side, shell, width, min, max } = panel;
  const drag = useRef<{ id: number; origin: number; width: number } | null>(null);
  const direction = side === 'menu' ? 1 : -1;
  const at = (clientX: number, start: NonNullable<typeof drag.current>) =>
    clamp(start.width + direction * (clientX - start.origin), min, max);
  function finish(event: PointerEvent<HTMLDivElement>, commit: boolean) {
    const start = drag.current;
    if (!start || start.id !== event.pointerId) return;
    drag.current = null;
    const next = commit ? at(event.clientX, start) : width;
    shell.current?.style.setProperty('--' + side + '-width', next + 'px');
    delete event.currentTarget.dataset.dragging;
    event.currentTarget.setAttribute('aria-valuenow', String(next));
    if (commit) panel.resize(next);
  }
  if (panel.collapsed) return null;
  return <div className={'sidebar-divider sidebar-divider--' + side} role="separator" tabIndex={0}
    aria-label={'ปรับความกว้าง' + names[side]} aria-controls={'shop-' + side} aria-orientation="vertical"
    aria-valuemin={min} aria-valuemax={max} aria-valuenow={width} title={'ลากเพื่อปรับความกว้าง' + names[side]}
    onPointerDown={event => {
      if (event.button !== 0 || !event.isPrimary) return;
      event.preventDefault();
      event.currentTarget.focus({ preventScroll: true });
      event.currentTarget.setPointerCapture(event.pointerId);
      drag.current = { id: event.pointerId, origin: event.clientX, width };
      event.currentTarget.dataset.dragging = 'true';
    }}
    onPointerMove={event => {
      const start = drag.current;
      if (!start || start.id !== event.pointerId) return;
      const next = at(event.clientX, start);
      shell.current?.style.setProperty('--' + side + '-width', next + 'px');
      event.currentTarget.setAttribute('aria-valuenow', String(next));
    }}
    onPointerUp={event => finish(event, true)} onPointerCancel={event => finish(event, false)}
    onLostPointerCapture={event => finish(event, false)}
    onKeyDown={event => {
      const values: Record<string, number> = { ArrowLeft: width - direction * 16, ArrowRight: width + direction * 16, Home: min, End: max };
      if (!Object.hasOwn(values, event.key)) return;
      event.preventDefault();
      panel.resize(clamp(values[event.key], min, max));
    }}
  />;
}
