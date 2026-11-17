import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { ClientAuthProvider } from "./context/ClientAuthContext";
import "./index.css";

// Enregistrement du Service Worker PWA
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Ignorer silencieusement les erreurs en environnement restreint
    });
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ClientAuthProvider>
          <App />
        </ClientAuthProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);

