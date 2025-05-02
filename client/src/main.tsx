import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { Toaster } from "@/components/ui/toaster";

// Import WebSocket fixes to handle Vite's HMR connection issues
// These need to be imported as early as possible
import "@/lib/fixViteHmrSocket";    // Registers the global fix function
import "@/lib/viteHmrMonkeyPatch";  // Patches WebSocket for Vite
import "@/lib/viteWebSocketFix";    // General WebSocket patching

// Render the app
createRoot(document.getElementById("root")!).render(
  <>
    <App />
    <Toaster />
  </>
);
