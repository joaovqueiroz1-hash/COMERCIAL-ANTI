import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Aplica tema salvo antes da primeira renderização (sem flash)
const savedTheme = localStorage.getItem('lv-theme');
if (savedTheme === 'light') {
  document.documentElement.classList.add('light');
}

createRoot(document.getElementById("root")!).render(<App />);
