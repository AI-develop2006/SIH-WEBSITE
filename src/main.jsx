import { StrictMode, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./globals.css";
import { ToastProvider } from "@/components/ui/toast";
import { MaintenanceGate } from "@/components/MaintenanceGate";

const LoginPage   = lazy(() => import("@/pages/Login"));
const SpocPage    = lazy(() => import("@/pages/SpocDashboard"));

function Loader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#050b18]">
      <div className="size-6 animate-spin rounded-full border-2 border-[#c9a227] border-t-transparent" />
    </div>
  );
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <MaintenanceGate>
          <Suspense fallback={<Loader />}>
            <Routes>
              <Route path="/"         element={<LoginPage />} />
              <Route path="/login"    element={<LoginPage />} />
              <Route path="/dashboard" element={<SpocPage />} />
              <Route path="*"         element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </MaintenanceGate>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>
);
