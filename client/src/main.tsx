import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { Toaster } from "@/components/ui/toaster";
// Import WebSocket fix to resolve port undefined issues
import "@/lib/viteWebSocketFix";

createRoot(document.getElementById("root")!).render(
  <>
    <App />
    <Toaster />
  </>
);
