import React from "react";
import ReactDOM from "react-dom/client";

// Suppress ResizeObserver loop error from CRA dev overlay — it's a benign browser notification
const _wr = window.onerror;
window.onerror = (msg, ...args) => {
  if (typeof msg === 'string' && msg.includes('ResizeObserver loop')) return true;
  return _wr ? _wr(msg, ...args) : false;
};
import "@/index.css";
import App from "@/App";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
