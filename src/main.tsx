import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { initReporting } from "./lib/report";

// before the first render, so a crash while starting up is reported too
initReporting();

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
