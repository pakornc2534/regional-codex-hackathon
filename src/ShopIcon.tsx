import type { ReactNode } from 'react';
import type { Variant } from './model';

const ink = 'currentColor';
const accent = 'var(--shop-icon-accent, #bd5438)';

const artwork = {
  storemark: <>
    <path d="M3 9.5 5.5 4h13L21 9.5V11a2.2 2.2 0 0 1-4 .9 2.6 2.6 0 0 1-5 0 2.6 2.6 0 0 1-5 0 2.2 2.2 0 0 1-4-.9z" />
    <path d="M8.2 4.6h3.3l-.8 5.2H6.9zm7 0h2.7l1.8 5.2h-3.6z" fill={accent} stroke="none" />
    <path d="M4.8 13.6v6.6h14.4v-6.6M8 20v-5h3v5" />
    <path d="M13.8 15h3.3v2.8h-3.3z" fill={ink} stroke="none" />
  </>,
  overview: <>
    <path d="M5 3.5h14a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H5z" />
    <path d="M5.3 4h3.5v16H5.3z" fill={ink} stroke="none" />
    <path d="M11.5 7.1H17v3.3h-5.5z" fill={accent} stroke="none" />
    <path d="M11.8 14h5.1m-5.1 3h3.5" />
  </>,
  scene: <>
    <path d="M2.7 6.4 11.9 3l9.4 3.4v10.9l-9.4 4.3-9.2-4.3z" />
    <path d="M11.9 3.3v6.9m-8.7 6.9 5.1-2.2m7.4 0 5 2.2M5.2 8.7l3.1-1.2" />
    <path d="m8.2 12.8 3.7-1.5 3.8 1.5-3.8 1.8z" fill={accent} stroke={accent} strokeWidth="1" />
    <path d="M8.2 13.3v2.8l3.7 1.8 3.8-1.8v-2.8m-3.8 1.5v2.7" />
  </>,
  cases: <>
    <path d="m3 14.5 2.5-6h2.2m8.6 0h2.2l2.5 6v5.4H3z" />
    <path d="M7.8 11.8V3.7h8.4v8.1M10.5 7h3" />
    <path d="M3.6 14.6h5.2l1.5 2h3.4l1.5-2h5.2v4.6H3.6z" fill={accent} stroke="none" />
    <path d="M3.4 14.5h5.7l1.2 1.8h3.4l1.2-1.8h5.7" />
  </>,
  dot: <>
    <path d="M4 16.5h16l-2.2-3.3v-3.1a5.8 5.8 0 0 0-11.6 0v3.1L4 16.5zM9.5 19a2.7 2.7 0 0 0 5 0"/>
    <circle cx="17.8" cy="5.4" r="3" fill={accent} stroke="none"/>
  </>,
  inbox: <>
    <path d="M3.4 4.3h15.2v10.3h-8.4l-4.7 3.6v-3.6H3.4z" />
    <path d="M6.5 7.6h8.6v2H6.5z" fill={accent} stroke="none" />
    <path d="M21 8.7v9h-3v3.1l-4.1-3.1H12" />
  </>,
  stock: <>
    <path d="m3.2 7.4 8.8-4.3 8.8 4.3v10l-8.8 4-8.8-4z" />
    <path d="m7.5 5.7 8.6 4.1v3.9l-2.7 1.2V11l-8.5-4z" fill={accent} stroke="none" />
    <path d="m3.6 7.6 8.4 4 8.4-4M12 11.6v9.1m-6.2-5.3 2.8 1.3" />
  </>,
  supplies: <>
    <path d="M3.1 11.4a5.5 5.5 0 1 1 10.6 2l3.5 1 1.7-3.9h2.2v8.7H5.2L3.5 14a7 7 0 0 1-.4-2.6z" />
    <circle cx="8.6" cy="11.4" r="2.8" fill={accent} stroke="none" />
    <circle cx="8.6" cy="11.4" r="1" fill={ink} stroke="none" />
    <path d="m12.3 8.3 6.6 2.2" />
  </>,
  plan: <>
    <path d="M5.1 3.1h13.8v17.8H5.1z" />
    <path d="M8.1 6h7.8v4.3H8.1z" fill={accent} stroke="none" />
    <path d="M8.4 13.6h1.8m3.6 0h1.8m-7.2 3.5h1.8m3.6 0h1.8" />
  </>,
  orders: <>
    <path d="M2.5 5.5h11.7v11H2.5zm11.8 3h3.9l3.3 4.1v3.9h-7.2" />
    <path d="M16 9h1.9l2.2 3h-4.1z" fill={accent} stroke="none" />
    <path d="M4.8 9.1h6.7m-6.7 3.1h3.8" />
    <circle cx="6.9" cy="17.7" r="2.1" fill={ink} stroke="none" />
    <circle cx="17.3" cy="17.7" r="2.1" fill={ink} stroke="none" />
  </>,
  finance: <>
    <path d="M5.1 9.9V3.4h10.6v6.5M4.8 10.1h11.6l3.1 5.3H3zM3 15.4h17.3v4.9H3z" />
    <path d="M7.6 5.8h5.6v2H7.6z" fill={accent} stroke="none" />
    <path d="M7.2 12.7h2.9m-1.5 5.2h4.1" />
  </>,
  insights: <>
    <path d="M3.1 3.8v16.1h17.7" />
    <path d="M6.6 13.2h3.1v4.2H6.6zm5.3-3.6H15v7.8h-3.1z" fill={ink} stroke="none" />
    <path d="M17.2 5h3.1v12.4h-3.1z" fill={accent} stroke="none" />
  </>,
  settings: <>
    <path d="M3 7h7m5 0h6M3 17h3m5 0h10" />
    <path d="M10 4.2h5v5.6h-5z" fill={accent} />
    <path d="M6 14.2h5v5.6H6z" />
  </>,
  briefs: <>
    <path d="M16.7 6.4h4v12a2 2 0 0 1-2 2H5.5a2 2 0 0 1-2-2V3.8h13.2v14.6a2 2 0 0 0 2 2" />
    <path d="M6.2 7h7.9v2.2H6.2z" fill={accent} stroke="none" />
    <path d="M6.3 12.2h4v4.1h-4z" fill={ink} stroke="none" />
    <path d="M12.6 12.6H14m-1.4 3.2H14" />
  </>,
  research: <>
    <path d="m3 10.2 6.5-6.6h7.3v6.2M3 10.2l5.8 5.9 2.1-2.2" />
    <circle cx="12.9" cy="6.8" r="1.2" fill={accent} stroke="none" />
    <circle cx="15.1" cy="14" r="4" />
    <path d="m18.2 17.1 3.1 3.1" strokeWidth="2.7" />
  </>,
  memory: <>
    <path d="M3.9 4.2h5v16h-5zm5 0H14v16H8.9z" />
    <path d="m14 5.4 4.6-.9 3 14.7-4.6.9z" />
    <path d="M4.6 7h3.6v2.6H4.6zm5 5.7h3.8v2.6H9.6z" fill={accent} stroke="none" />
  </>,
  manager: <>
    <path d="M3.3 16.1h17.4M5 15.7a7 7 0 0 1 14 0M2.7 19.5h18.6" />
    <path d="M8.5 13.2a3.8 3.8 0 0 1 3.5-2.1" stroke={accent} strokeWidth="1.8" />
    <path d="M12 8.2V5.9" />
    <path d="M9.5 3.8h5v2.7h-5z" fill={accent} stroke="none" />
  </>,
  packing: <>
    <path d="m4 11.8 8-3.4 8 3.4v5.8l-8 3.6-8-3.6z" />
    <path d="m4.4 12 7.6 3.4 7.6-3.4M12 15.4v5.1" />
    <path d="m4 11.8-2-3.7 7.6-3.6L12 8.4zm8-3.4 2.5-3.9L22 8.1l-2 3.7z" fill={accent} />
  </>,
  campaign: <>
    <path d="M3.2 9.9h4.9l9.6-5v14.2l-9.6-5H3.2zM8.2 10.1v3.7m-2.3.8 1.7 5.1h2.8l-1.9-4.5" />
    <path d="M14.7 7.3 17 6.1v11.8l-2.3-1.2z" fill={accent} stroke="none" />
    <path d="M20.3 10.1a3 3 0 0 1 0 3.8" stroke={accent} />
  </>,
  mecha: <>
    <path d="m5.1 8.9 2.4-4 4.5-1.6 4.5 1.6 2.4 4 .7 6.8-4.4 3.4-3.2 1.7-3.2-1.7-4.4-3.4z" />
    <path d="M2.7 4.1 12 9l9.3-4.9-2.1 4.6L12 12 4.8 8.7z" fill={accent} stroke="none" />
    <path d="m7.2 12.8 3.1.6m3.4 0 3.1-.6m-6.9 5.7.6-2.7h3l.6 2.7" />
  </>,
  'blind-box': <>
    <path d="M4.2 6.4 7.1 3h11.7l1.1 3.4v13.9H4.2zM4.6 6.7h14.9" />
    <path d="m12 8.3 1.3 3.1 3.2.8-2.5 2.3.3 3.5-2.3-1.4L9.7 18l.3-3.5-2.5-2.3 3.2-.8z" fill={accent} stroke="none" />
  </>,
  figure: <>
    <path d="m5.8 8.6.6-4.5 3.8 2a9.4 9.4 0 0 1 4.2 0l3.9-2 .2 4.8c3 5.9-1.7 8.2-6.4 8.2-5.2 0-9.2-2.5-6.3-8.5z" />
    <path d="M9 17.2 8.5 20l2.8.4.7-1.2.8 1.2 2.7-.4-.5-2.8" />
    <circle cx="9.1" cy="11.6" r="1" fill={ink} stroke="none" />
    <circle cx="14.9" cy="11.6" r="1" fill={ink} stroke="none" />
    <path d="m6.6 8.2.3-2.4L9 7zm8.5-1.1 2.1-1.3.1 2.5z" fill={accent} stroke="none" />
  </>,
  disc: <>
    <path d="M3.3 3.7h16.9v16.7H3.3zM6.4 4v16" />
    <circle cx="13.1" cy="12.1" r="4.9" />
    <circle cx="13.1" cy="12.1" r="1.4" fill={accent} stroke="none" />
    <path d="M15.5 11a2.7 2.7 0 0 0-1.5-1.4" stroke={accent} />
  </>,
  photo: <>
    <path d="M5 3.4h14v17.2H5z" />
    <path d="M7.7 6h8.6v8.7H7.7z" />
    <path d="m8.2 14 2.7-3 1.7 1.8 1.7-2 1.6 1.7v1.9z" fill={accent} stroke="none" />
    <path d="M8.2 17.5h5.3" />
  </>,
  'model-car': <>
    <path d="m2.7 12.4 3.4-.9 3.2-4.4h5.8l3.9 4.4 2.3 1.1v4H2.7z" />
    <path d="m7.7 11.7 2.5-3.1h3.7l2.6 3.1z" fill={accent} stroke="none" />
    <circle cx="7.4" cy="17.1" r="2.1" fill={ink} stroke="none" />
    <circle cx="16.8" cy="17.1" r="2.1" fill={ink} stroke="none" />
  </>,
  pack: <>
    <path d="m3.5 6.7 4.4-3.1h12.6v14.2l-4.4 3H3.5zm.2.1H16v13.5m.3-13.7 4-2.7" />
    <path d="M7.3 7h3.3v6l-1.6-1-1.7 1z" fill={accent} stroke="none" />
    <path d="M6.6 17.7h4.7" />
  </>,
  keychain: <>
    <circle cx="8.2" cy="6.2" r="3.2" />
    <path d="m9.8 8.6 2.9 3.2m-.5-2.7 4.6.5 4.1 6-5.8 5.3-5.4-5.3z" />
    <path d="m16.5 12.5.2 2.2 1.7 1-2.3.7-.6 2-1.2-1.9-2.1.1 1.4-1.7-.6-2.1 2.1.9z" fill={accent} stroke="none" />
  </>,
  signed: <>
    <path d="m3 5.1 16.9-1.3 1.2 14.8-16.9 1.3z" />
    <path d="M7.3 14.9c1.2-.4 2-1.8 2.8-3.6.4-.8 1.4-3 2.1-2.8.9.3-2.4 6.6-.8 6.2l2.8-2 .5 1.5 2.7-1.3" stroke={accent} />
  </>,
  pin: <>
    <path d="M12 21c-2.1-2.5-7.3-7.8-7.3-12a7.3 7.3 0 1 1 14.6 0c0 4.2-5.2 9.5-7.3 12Z" />
    <circle cx="12" cy="9" r="2.8" fill={accent} stroke="none" />
  </>,
} satisfies Record<string, ReactNode>;

export type ShopIconName = keyof typeof artwork;

export function productIconName({ sellerSku, category }: Pick<Variant, 'sellerSku' | 'category'>): ShopIconName {
  if (sellerSku.startsWith('KIBOU-')) return 'pack';
  if (sellerSku.endsWith('-CD')) return 'disc';
  if (sellerSku.endsWith('-PH')) return 'photo';
  switch (sellerSku) {
    case 'ROBOT': return 'mecha';
    case 'FOREST': return 'blind-box';
    case 'RARE-CAR': return 'model-car';
    case 'SONIC': return 'keychain';
    case 'FORTUNE': return 'signed';
    default: return category === 'ฟิกเกอร์' ? 'figure' : 'stock';
  }
}

type ShopIconProps = {
  name: ShopIconName;
  size?: number;
  className?: string;
  label?: string;
};

export function ShopIcon({ name, size = 20, className, label }: ShopIconProps) {
  return <svg
    xmlns="http://www.w3.org/2000/svg" width={size} height={size}
    viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65"
    strokeLinecap="round" strokeLinejoin="round" className={className}
    focusable="false" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}
  >{artwork[name]}</svg>;
}
