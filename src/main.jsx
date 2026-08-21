import { StrictMode, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./globals.css";
import { ToastProvider } from "@/components/unlumen-ui/toast";
import { AuroraBackground } from "@/components/ui/aurora-background";

// Lazy-load all pages — cuts initial bundle significantly
const LandingPage         = lazy(() => import("@/pages/Landing"));
const LoginPage           = lazy(() => import("@/pages/Login"));
const RegisterPage        = lazy(() => import("@/pages/Register"));
const DashboardPage       = lazy(() => import("@/pages/Dashboard"));
const MentorDashboardPage = lazy(() => import("@/pages/mentor/MentorDashboard"));
const FooterDemoPage      = lazy(() => import("@/pages/FooterDemo"));
const ForgotPasswordPage  = lazy(() => import("@/pages/ForgotPassword"));

function PageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#06090f]">
      <div className="size-6 animate-spin rounded-full border-2 border-[#c9a227] border-t-transparent" />
    </div>
  );
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <AuroraBackground />
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/"                element={<LandingPage />} />
            <Route path="/login"           element={<LoginPage />} />
            <Route path="/register"        element={<RegisterPage />} />
            <Route path="/dashboard"       element={<DashboardPage />} />
            <Route path="/mentor"          element={<MentorDashboardPage />} />
            <Route path="/demo"            element={<FooterDemoPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="*"                element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>
);
