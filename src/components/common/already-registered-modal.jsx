import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { UserCheck } from "lucide-react";
import { Button } from "@/components/unlumen-ui/button";

/**
 * Shown when a user tries to register with an email / register number
 * that already exists in Supabase auth or the profiles table.
 */
export function AlreadyRegisteredModal({ isOpen, onClose, email }) {
  const navigate = useNavigate();
  const modalRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
      setTimeout(() => modalRef.current?.focus(), 10);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        className="relative w-full max-w-lg rounded-2xl border border-[#c9a227]/35 bg-[#0b1329] p-6 sm:p-8 shadow-2xl text-center overflow-hidden outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Gold top accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#c9a227] to-transparent" />

        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3.5 right-3.5 flex size-8 items-center justify-center rounded-full bg-slate-800/60 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors cursor-pointer"
          aria-label="Close"
        >
          ✕
        </button>

        {/* Icon */}
        <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-2xl border border-[#c9a227]/40 bg-[#c9a227]/10 text-[#e8c058] shadow-inner">
          <UserCheck className="size-8" strokeWidth={1.75} />
        </div>

        {/* Title */}
        <h3 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Already Registered
        </h3>

        {/* Message */}
        <p className="mt-3 text-sm text-slate-300 sm:text-base leading-relaxed">
          An account{email ? <> with <span className="font-semibold text-[#e8c058]">{email}</span></> : ""} already exists.
          <br />
          Please log in using your <span className="font-semibold text-white">Register Number</span> and password.
        </p>

        <p className="mt-3 text-xs text-slate-400 leading-relaxed">
          If you forgot your password, use the <span className="text-[#c9a227] font-medium">Forgot Password</span> option on the login page.
        </p>

        {/* Actions */}
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 text-sm font-semibold border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            ← Back to Form
          </Button>

          <Button
            onClick={() => navigate("/login")}
            className="w-full sm:w-auto px-6 py-2.5 text-sm font-bold bg-[#c9a227] text-[#06090f] hover:bg-[#e8c058] border-0"
          >
            Log In Now →
          </Button>
        </div>
      </div>
    </div>
  );
}
