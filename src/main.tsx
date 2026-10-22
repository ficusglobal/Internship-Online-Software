import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/styles.css";
import "./styles/registration-api.css";
import "./styles/acceptance-letter.css";
import "./styles/student-home.css";
import "./styles/responsive-fixes.css";
createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
