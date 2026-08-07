import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Routes, Route, Navigate } from "react-router-dom";
import "./globals.css";
import { ToastProvider } from "@/components/unlumen-ui/toast";
import { AuroraBackground } from "@/components/aurora-background";
import LandingPage from "@/pages/Landing";
import LoginPage from "@/pages/Login";
import RegisterPage from "@/pages/Register";
import DashboardPage from "@/pages/Dashboard";
import AdminPage from "@/pages/Admin";
import FooterDemoPage from "@/pages/FooterDemo";

// Prevent direct URL bypass (e.g. typing /admin) by cleaning the address bar path on load
if (window.location.pathname !== "/") {
  window.history.replaceState({}, "", "/");
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MemoryRouter>
      <ToastProvider>
        <AuroraBackground />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/demo" element={<FooterDemoPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>
  </StrictMode>
);
