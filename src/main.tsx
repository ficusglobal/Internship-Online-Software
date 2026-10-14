import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";
import "./registration-api.css";
import "./acceptance-letter.css";
import "./student-home.css";
import "./responsive-fixes.css";
createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
