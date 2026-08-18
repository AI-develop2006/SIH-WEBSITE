import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, Clock } from "lucide-react";
import { Button } from "@/components/unlumen-ui/button";

export function RegistrationClosedModal({ isOpen, onClose, message, closingDate }) {
  const navigate = useNavigate();
  const modalRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
      setTimeout(() => {
        modalRef.current?.focus();
      }, 10);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const formattedDate = closingDate
    ? new Date(closingDate).toLocaleString("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : null;

  return (
    <div 
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md"
      onClick={onClose}
    >
      <div 
        ref={modalRef}
        tabIndex={-1}
        className="relative w-full max-w-lg rounded-2xl border border-red-500/35 bg-[#0b1329] p-6 sm:p-8 shadow-2xl text-center overflow-hidden z-[100000] outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Gold Accent Bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#c9a227] to-transparent" />

        {/* Close (X) button at top right */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3.5 right-3.5 flex size-8 items-center justify-center rounded-full bg-slate-800/60 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors cursor-pointer"
          aria-label="Close modal"
        >
          ✕
        </button>

        {/* Lock / Alert Icon Badge */}
        <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-2xl border border-red-500/40 bg-red-500/10 text-red-400 shadow-inner">
          <Lock className="size-8" strokeWidth={1.75} />
        </div>

        {/* Title */}
        <h3 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Registration Closed
        </h3>

        {/* Dynamic Details / Message */}
        <p className="mt-3 text-sm text-slate-300 sm:text-base leading-relaxed">
          {message || "Registrations for the SIH Internal Hackathon 2026 are currently closed by the administrator."}
        </p>

        {formattedDate && (
          <div className="mt-4 inline-flex items-center gap-2 rounded-xl border border-[rgba(201,162,39,0.3)] bg-[rgba(201,162,39,0.1)] px-3.5 py-1.5 text-xs font-semibold text-[#e8c058]">
            <Clock className="size-4 shrink-0" />
            Closing Deadline Passed: {formattedDate}
          </div>
        )}

        <p className="mt-4 text-xs text-slate-400">
          If you have already registered, you can log in to your account to view your dashboard.
        </p>

        {/* Action Buttons */}
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button
            variant="outline"
            onClick={() => {
              if (onClose) onClose();
              navigate("/");
            }}
            className="w-full sm:w-auto px-5 py-2.5 text-sm font-semibold border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            ← Back to Home
          </Button>

          <Button
            onClick={() => {
              if (onClose) onClose();
              navigate("/login");
            }}
            className="w-full sm:w-auto px-6 py-2.5 text-sm font-bold bg-[#c9a227] text-[#06090f] hover:bg-[#e8c058] border-0"
          >
            Log In Existing Account
          </Button>
        </div>
      </div>
    </div>
  );
}
