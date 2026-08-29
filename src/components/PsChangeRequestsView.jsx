"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  MessageSquare, CheckCircle2, XCircle, Clock, Search, X,
  RefreshCw, AlertTriangle, ChevronDown, ChevronUp, FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SIH2026_PROBLEMS } from "@/lib/sih2026Problems";
import { fetchPsChangeRequests, reviewPsChangeRequest } from "@/lib/data";
import { useToast } from "@/components/ui/toast";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  if (status === "pending")  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border border-amber-500/40 bg-amber-500/10 text-amber-300">
      <Clock className="size-2.5 shrink-0" /> Pending
    </span>
  );
  if (status === "approved") return (
    <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 text-emerald-300">
      <CheckCircle2 className="size-2.5 shrink-0" /> Approved
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border border-red-500/40 bg-red-500/10 text-red-300">
      <XCircle className="size-2.5 shrink-0" /> Rejected
    </span>
  );
}

function PsCard({ psNumber, label }) {
  const ps = psNumber ? SIH2026_PROBLEMS.find((p) => p.psNumber === psNumber) : null;
  return (
    <div className="rounded-xl border border-[rgba(147,197,253,0.12)] bg-[#050b18]/60 px-3 py-2.5 space-y-0.5 min-w-0">
      <p className="text-[9px] font-bold uppercase tracking-wider text-[#94a3b8]">{label}</p>
      {psNumber ? (
        <>
          <p className="text-[11px] font-extrabold font-mono text-violet-300">{psNumber}</p>
          {ps && <p className="text-[9px] text-[#94a3b8] line-clamp-2 leading-snug">{ps.title}</p>}
          {ps && (
            <span className={cn(
              "inline-block text-[9px] font-bold px-1.5 py-0.5 rounded-full border",
              ps.category === "Software"
                ? "border-blue-500/30 bg-blue-500/8 text-blue-300"
                : "border-orange-500/30 bg-orange-500/8 text-orange-300"
            )}>
              {ps.category}
            </span>
          )}
        </>
      ) : (
        <p className="text-[10px] text-[#94a3b8]/50 italic">—</p>
      )}
    </div>
  );
}

function CustomPsCard({ title, label }) {
  return (
    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2.5 space-y-0.5 min-w-0">
      <p className="text-[9px] font-bold uppercase tracking-wider text-amber-400">{label} · Open Innovation</p>
      {title
        ? <p className="text-[10px] text-white leading-snug">{title}</p>
        : <p className="text-[10px] text-[#94a3b8]/50 italic">—</p>}
    </div>
  );
}

// ─── Single request card ──────────────────────────────────────────────────────
function RequestCard({ req, onReview, readOnly = false }) {
  const [expanded, setExpanded] = useState(req.status === "pending");
  const [reviewing, setReviewing] = useState(false);
  const [reviewNote, setReviewNote] = useState("");
  const [confirmAction, setConfirmAction] = useState(null); // "approve" | "reject" | null
  const toast = useToast();

  const isCustom = !req.current_ps && !!req.current_custom;
  const isNewCustom = !req.new_ps && !!req.new_custom;

  async function handleReview(action) {
    setReviewing(true);
    const { ok, error } = await reviewPsChangeRequest(req.id, action, reviewNote);
    setReviewing(false);
    setConfirmAction(null);
    if (!ok) {
      toast("error", error ?? "Review failed");
    } else {
      toast("success", action === "approve" ? "Request approved — team PS updated" : "Request rejected");
      onReview();
    }
  }

  return (
    <div className={cn(
      "rounded-2xl border overflow-hidden transition-all",
      req.status === "pending"  ? "border-amber-500/25 bg-amber-500/4"   :
      req.status === "approved" ? "border-emerald-500/20 bg-emerald-500/4" :
                                  "border-red-500/20 bg-red-500/4"
    )}>
      {/* Header row */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-5 py-3.5 text-left cursor-pointer"
      >
        <div className="flex items-center gap-3 min-w-0 flex-wrap">
          <StatusBadge status={req.status} />
          <span className="text-sm font-extrabold text-white truncate">{req.team_name}</span>
          {req.requester_name && (
            <span className="text-[10px] text-[#94a3b8]">
              by {req.requester_name}
              {req.requester_dept ? ` · ${req.requester_dept}` : ""}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <span className="text-[9px] text-[#94a3b8] whitespace-nowrap">
            {new Date(req.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
          </span>
          {expanded
            ? <ChevronUp className="size-3.5 text-[#94a3b8]" />
            : <ChevronDown className="size-3.5 text-[#94a3b8]" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-[rgba(147,197,253,0.08)] px-5 pb-5 pt-4 space-y-4">

          {/* Current vs Requested PS */}
          <div className="grid sm:grid-cols-2 gap-3">
            {isCustom
              ? <CustomPsCard title={req.current_custom} label="Current PS" />
              : <PsCard psNumber={req.current_ps} label="Current PS" />}
            <div className="flex items-center justify-center text-[#94a3b8] font-extrabold text-lg sm:hidden">↓</div>
            <div className="hidden sm:flex items-center justify-center">
              <span className="text-[#c9a227] font-extrabold text-base">→</span>
            </div>
            {isNewCustom
              ? <CustomPsCard title={req.new_custom} label="Requested PS" />
              : <PsCard psNumber={req.new_ps} label="Requested PS" />}
          </div>

          {/* Reason */}
          <div className="rounded-xl border border-[rgba(147,197,253,0.10)] bg-[#050b18]/40 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#94a3b8] mb-1.5">Reason from Team</p>
            <p className="text-xs text-white leading-relaxed whitespace-pre-wrap">{req.reason}</p>
          </div>

          {/* Review note (if reviewed) */}
          {req.review_note && (
            <div className={cn(
              "rounded-xl border px-4 py-3",
              req.status === "approved"
                ? "border-emerald-500/20 bg-emerald-500/5"
                : "border-red-500/20 bg-red-500/5"
            )}>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#94a3b8] mb-1.5">SPOC Note</p>
              <p className="text-xs text-white leading-relaxed">{req.review_note}</p>
            </div>
          )}

          {/* Reviewed at */}
          {req.reviewed_at && (
            <p className="text-[9px] text-[#94a3b8]/60">
              Reviewed on {new Date(req.reviewed_at).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            </p>
          )}

          {/* Review actions (only for pending and master session) */}
          {req.status === "pending" && !readOnly && (
            <div className="space-y-3 border-t border-[rgba(147,197,253,0.08)] pt-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#94a3b8]">Review this Request</p>

              {/* Optional note */}
              <textarea
                rows={2}
                placeholder="Optional note to the team (e.g. reason for rejection)…"
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                maxLength={500}
                className="w-full rounded-xl border border-[rgba(147,197,253,0.15)] bg-[#050b18] px-3 py-2 text-xs text-white placeholder:text-[#94a3b8]/40 focus:outline-none focus:border-[#c9a227]/50 transition-all resize-none"
              />

              {/* Confirm state */}
              {confirmAction ? (
                <div className={cn(
                  "rounded-xl border px-4 py-3 space-y-2",
                  confirmAction === "approve"
                    ? "border-emerald-500/30 bg-emerald-500/8"
                    : "border-red-500/30 bg-red-500/8"
                )}>
                  <p className="text-xs font-bold text-white">
                    {confirmAction === "approve"
                      ? "Approve this request? The team's PS will be updated immediately."
                      : "Reject this request? The team will be notified."}
                  </p>
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      disabled={reviewing}
                      onClick={() => handleReview(confirmAction)}
                      className={cn(
                        "flex items-center gap-1.5 px-4 py-2 rounded-xl font-extrabold text-xs transition-all disabled:opacity-50",
                        confirmAction === "approve"
                          ? "bg-emerald-500 hover:bg-emerald-400 text-white"
                          : "bg-red-500 hover:bg-red-400 text-white"
                      )}
                    >
                      {reviewing && <RefreshCw className="size-3 animate-spin" />}
                      Yes, {confirmAction === "approve" ? "Approve" : "Reject"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmAction(null)}
                      className="px-4 py-2 rounded-xl border border-[rgba(147,197,253,0.15)] text-xs text-[#94a3b8] hover:text-white transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setConfirmAction("approve")}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25 font-extrabold text-xs transition-all cursor-pointer"
                  >
                    <CheckCircle2 className="size-3.5 shrink-0" />
                    Approve & Apply PS Change
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmAction("reject")}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 hover:bg-red-500/25 font-extrabold text-xs transition-all cursor-pointer"
                  >
                    <XCircle className="size-3.5 shrink-0" />
                    Reject Request
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Read-only notice for pending requests when not master */}
          {req.status === "pending" && readOnly && (
            <div className="border-t border-[rgba(147,197,253,0.08)] pt-4">
              <p className="text-[10px] text-[#94a3b8] flex items-center gap-1.5">
                🔒 <span>Log in with the <span className="font-bold text-white">master password</span> to approve or reject this request.</span>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────
export function PsChangeRequestsView({ readOnly = false }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [statusFilter, setStatusFilter] = useState("pending");

  const loadRequests = useCallback(async () => {
    setLoading(true);
    const { data } = await fetchPsChangeRequests();
    setRequests(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  const counts = useMemo(() => ({
    all:      requests.length,
    pending:  requests.filter((r) => r.status === "pending").length,
    approved: requests.filter((r) => r.status === "approved").length,
    rejected: requests.filter((r) => r.status === "rejected").length,
  }), [requests]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return requests.filter((r) => {
      if (statusFilter && r.status !== statusFilter) return false;
      if (needle) {
        const hay = [r.team_name, r.current_ps ?? "", r.new_ps ?? "", r.reason, r.requester_name ?? ""]
          .join(" ").toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [requests, search, statusFilter]);

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="rounded-2xl border border-[rgba(147,197,253,0.12)] bg-[#0a1226]/60 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-extrabold text-white flex items-center gap-2">
            <MessageSquare className="size-4 text-[#c9a227]" />
            PS Change Requests
          </h2>
          <p className="text-[11px] text-[#94a3b8] mt-0.5">
            Review and approve/reject team requests to change their locked problem statement
          </p>
        </div>
        <button
          type="button"
          onClick={loadRequests}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border border-[rgba(147,197,253,0.14)] text-[#94a3b8] hover:text-white hover:border-[rgba(147,197,253,0.3)] transition-all disabled:opacity-50 self-start cursor-pointer"
        >
          <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {/* Stat pills */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { id: "",         label: "All",      value: counts.all,      color: "text-white"       },
          { id: "pending",  label: "Pending",  value: counts.pending,  color: "text-amber-300"   },
          { id: "approved", label: "Approved", value: counts.approved, color: "text-emerald-300" },
          { id: "rejected", label: "Rejected", value: counts.rejected, color: "text-red-300"     },
        ].map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setStatusFilter(statusFilter === s.id ? "" : s.id)}
            className={cn(
              "rounded-2xl border p-3 text-left transition-all cursor-pointer bg-[#0a1226]/60",
              statusFilter === s.id
                ? "border-[#c9a227]/40 ring-1 ring-[#c9a227]/20 scale-[1.02]"
                : "border-[rgba(147,197,253,0.10)] hover:border-[rgba(147,197,253,0.22)]"
            )}
          >
            <p className={cn("text-2xl font-black tabular-nums", s.color)}>{s.value}</p>
            <p className="text-[10px] text-[#94a3b8] font-semibold uppercase tracking-wide mt-0.5">{s.label}</p>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-[#94a3b8] pointer-events-none" />
        <input
          type="text"
          placeholder="Search team name, PS number, reason…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-[rgba(147,197,253,0.14)] bg-[#0a1226]/60 pl-9 pr-8 py-2 text-xs text-white outline-none placeholder:text-[#94a3b8]/50 focus:border-[#c9a227]/50 transition-all"
        />
        {search && (
          <button type="button" onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-white">
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {/* Results */}
      {loading ? (
        <div className="py-16 text-center rounded-2xl border border-[rgba(147,197,253,0.08)] bg-[#0a1226]/40">
          <RefreshCw className="size-6 text-[#94a3b8]/40 mx-auto mb-3 animate-spin" />
          <p className="text-sm text-[#94a3b8]">Loading requests…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center rounded-2xl border border-[rgba(147,197,253,0.08)] bg-[#0a1226]/40">
          <MessageSquare className="size-8 text-[#94a3b8]/40 mx-auto mb-3" />
          <p className="text-sm text-[#94a3b8] font-semibold">
            {counts.all === 0 ? "No change requests yet." : "No requests match the current filter."}
          </p>
          {statusFilter === "pending" && counts.all > 0 && (
            <p className="text-xs text-[#94a3b8]/60 mt-1">All requests have been reviewed.</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-[#94a3b8]">
            Showing <span className="text-white font-bold">{filtered.length}</span> request{filtered.length !== 1 ? "s" : ""}
          </p>
          {filtered.map((req) => (
            <RequestCard key={req.id} req={req} readOnly={readOnly} onReview={loadRequests} />
          ))}
        </div>
      )}
    </div>
  );
}
