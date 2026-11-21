import { createRoot } from 'react-dom/client';
import { FloatingDot } from './FloatingDot';
import avatarStyle from './dot-avatar.css?inline';
import floatingStyle from './floating-dot.css?inline';

// The guide is a standalone document whose slide styles address every button,
// paragraph and heading. Keep the shared shop control in its own style scope.
const host = document.createElement('div');
document.body.append(host);
const shadow = host.attachShadow({ mode: 'open' });
const style = document.createElement('style');
style.textContent = `
  :host {
    --ink:#202a32; --muted:#586169; --white:#fffefa; --paper:#fcfbf8;
    --green:#263e50; --soft:#e9eef0; --line:#d7d9d5; --navy:#253744; --ivory:#fbf6e9; --radius:5px;
    font:16px/1.55 'Leelawadee UI','Thonburi',system-ui,sans-serif; color:var(--ink);
  }
  *, *::before, *::after { box-sizing:border-box; }
  button { font:inherit; cursor:pointer; }
  a { color:var(--green); }
  h2, p { margin:0; }
  :focus-visible { outline:3px solid #27669b; outline-offset:3px; }
  ${avatarStyle}
  ${floatingStyle}
`;
const root = document.createElement('div');
shadow.append(style, root);
createRoot(root).render(<FloatingDot message="คุณกำลังอ่านคู่มือร้านจำลองค่ะ เปิดหน้าแจ้งเตือน Dot เพื่อดูยอดซื้อและงานที่ควรทำวันนี้ได้เลยค่ะ" />);
