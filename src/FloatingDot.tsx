import { DotRobot } from './DotAvatar';
import './floating-dot.css';

export const chatgptDotUrl = 'https://chatgpt.com/dots';

export function FloatingDot() {
  return <div className="floating-dot">
    <a className="floating-dot-launcher" href={chatgptDotUrl} target="_blank" rel="noopener noreferrer"
      aria-label="เปิด Dot ใน ChatGPT (แท็บใหม่)" title="เปิด Dot ใน ChatGPT (แท็บใหม่)">
      <span className="floating-dot-figure"><DotRobot/></span>
      <span className="floating-dot-name" aria-hidden="true">Dot</span>
    </a>
  </div>;
}
