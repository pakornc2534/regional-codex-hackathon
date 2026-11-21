import { createRoot } from 'react-dom/client';
import App from './App';
import '@fontsource-variable/noto-sans-thai/wght.css';
import './styles.css';

const element = document.getElementById('root');
if (element) createRoot(element).render(<App />);
