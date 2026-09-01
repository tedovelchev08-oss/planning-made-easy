import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { initReporting } from "./lib/report";

// observability boots before React — crashes during first render still land
// in Sentry (when VITE_SENTRY_DSN is set) or the /api/report sink
initReporting();

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
