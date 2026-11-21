import { createRoot } from 'react-dom/client';
import { FloatingDot } from './FloatingDot';
import avatarStyle from './dot-avatar.css?inline';
import floatingStyle from './floating-dot.css?inline';

// Keep the avatar isolated from the standalone guide's slide styles.
const host = document.createElement('div');
document.body.append(host);
const shadow = host.attachShadow({ mode: 'open' });
const style = document.createElement('style');
style.textContent = avatarStyle + '\n' + floatingStyle;
const root = document.createElement('div');
shadow.append(style, root);
createRoot(root).render(<FloatingDot />);
