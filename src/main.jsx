import React from 'react'
import ReactDOM from 'react-dom/client'
import './i18n/index.js'
import App from './App.jsx'
import './App.css'

const originalWarn = console.warn;
console.warn = (...args) => {
  const msg = args.join('');
  if (msg.includes("Can't get DOM width or height")) return;
  if (msg.includes('deprecated') && (msg.includes('Clock') || msg.includes('PCFSoftShadowMap') || msg.includes('Timer'))) return;
  originalWarn.apply(console, args);
};

ReactDOM.createRoot(document.getElementById('root')).render(<App />)
