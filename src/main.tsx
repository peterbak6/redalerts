import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

// Suppress a benign deck.gl/luma.gl race condition where a ResizeObserver
// fires before the WebGL device finishes initializing. Doesn't affect rendering.
window.addEventListener("error", (e) => {
  if (e.message?.includes("maxTextureDimension2D")) e.preventDefault();
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
