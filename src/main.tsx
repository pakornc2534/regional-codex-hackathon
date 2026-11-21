import { createRoot } from 'react-dom/client';
import App from './App';
import { CustomerChat } from './CustomerChat';
import '@fontsource-variable/noto-sans-thai/wght.css';
import './styles.css';

const element = document.getElementById('root');
if (element) createRoot(element).render(new URLSearchParams(location.search).has('customer') ? <CustomerChat /> : <App />);
