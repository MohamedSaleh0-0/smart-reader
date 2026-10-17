import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import './ui/styles.css';

if (__SMART_READER_GOATCOUNTER_ENABLED__ && import.meta.env.PROD && location.hostname === 'ayasseen11.github.io') {
  const goatCounter = document.createElement('script');
  goatCounter.dataset.goatcounter = 'https://smart-reader.goatcounter.com/count';
  goatCounter.async = true;
  goatCounter.src = 'https://gc.zgo.at/count.js';
  document.head.append(goatCounter);
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
