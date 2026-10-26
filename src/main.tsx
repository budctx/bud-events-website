import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/readex-pro';
import './tokens.css';
import './styles.css';
import App from './App';
import {prepareOfflineShell} from './offline-shell';
prepareOfflineShell();
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
