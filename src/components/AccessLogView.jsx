"use client";

import { useEffect, useState, useCallback } from "react";
import {
  CheckCircle2, XCircle, RefreshCw, Shield, Monitor, Clock,
  FilePlus2, FileEdit, Trash2, Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchAccessLog, fetchAuditLog } from "@/lib/data";

// ─── UA parsers ───────────────────────────────────────────────────────────────
function parseUA(ua) {
  if (!ua) return "Unknown";
  if (/mobile/i.test(ua)) return "📱 Mobile";
  if (/tablet/i.test(ua)) return "📲 Tablet";
  return "🖥 Desktop";
}

function parseBrowser(ua) {
  if (!ua) return "";
  if (/edg\//i.test(ua)) return "Edge";
  if (/chrome\//i.test(ua) && !/chromium/i.test(ua)) return "Chrome";
  if (/firefox\//i.test(ua)) return "Firefox";
  if (/safari\//i.test(ua) && !/chrome/i.test(ua)) return "Safari";
  if (/opr\//i.test(ua)) return "Opera";
  return "Browser";
}

// ─── Audit action helpers ─────────────────────────────────────────────────────
const ACTION_META = {
  CREATE_FINAL_TEAM: {
    label: "Created Team",
    icon: FilePlus2,
    color: "text-emerald-300",
    bg: "bg-emerald-500/10 border-emerald-500/30",
  },
  UPDATE_FINAL_TEAM: {
    label: "Updated Team",
    icon: FileEdit,
    color: "text-[#e8c058]",
    bg: "bg-[#c9a227]/10 border-[#c9a227]/30",
  },
  DELETE_FINAL_TEAM: {
    label: "Deleted Team",
    icon: Trash2,
    color: "text-red-400",
    bg: "bg-red-500/10 border-red-500/30",
  },
};

function formatDetails(action, details) {
  if (!details) return null;
  const parts = [];

  if (action === "CREATE_FINAL_TEAM") {
    if (details.ministry)      parts.push(`Ministry: ${details.ministry}`);
    if (details.member_count != null) parts.push(`${details.member_count} members`);
  }

  if (action === "UPDATE_FINAL_TEAM") {
    if (details.renamed)       parts.push(`Renamed "${details.renamed.from}" → "${details.renamed.to}"`);
    if (details.ministry != null) parts.push(`Ministry: ${details.ministry || "cleared"}`);
    if (details.members_added)    parts.push(`+${details.members_added} member${details.members_added > 1 ? "s" : ""} added`);
    if (details.members_removed)  parts.push(`-${details.members_removed} member${details.members_removed > 1 ? "s" : ""} removed`);
    if (details.members_kept)     parts.push(`${details.members_kept} unchanged`);
  }

  if (action === "DELETE_FINAL_TEAM") {
    if (details.ministry)      parts.push(`Ministry: ${details.ministry}`);
    if (details.member_count != null) parts.push(`${details.member_count} members released`);
  }

  return parts.length > 0 ? parts.join(" · ") : null;
}

// ─── Login Attempts sub-view ──────────────────────────────────────────────────
function LoginLog() {
  const [log, setLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState("all");

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    const { data } = await fetchAccessLog(300);
    setLog(data ?? []);
    if (!silent) setLoading(false);
    else setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const displayed = filter === "all" ? log
    : filter === "success" ? log.filter((r) => r.success)
    : log.filter((r) => !r.success);

  const successCount = log.filter((r) => r.success).length;
  const failCount    = log.filter((r) => !r.success).length;
  const uniqueIPs    = new Set(log.map((r) => r.ip_address).filter(Boolean)).size;

  return (
    <div className="space-y-4">
      {/* Stat pills */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Attempts",    value: log.length,    color: "text-white",        filter: "all"     },
          { label: "Successful Logins", value: successCount,  color: "text-emerald-300",  filter: "success" },
          { label: "Failed Attempts",   value: failCount,     color: "text-red-400",      filter: "failed"  },
          { label: "Unique IPs",        value: uniqueIPs,     color: "text-[#c9a227]",    filter: null      },
        ].map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => s.filter && setFilter(filter === s.filter ? "all" : s.filter)}
            className={cn(
              "rounded-2xl border p-3 text-left transition-all bg-[#0a1226]/60",
              s.filter ? "cursor-pointer" : "cursor-default",
              filter === s.filter
                ? "border-[#c9a227]/40 ring-1 ring-[#c9a227]/20 scale-[1.02]"
                : "border-[rgba(147,197,253,0.10)] hover:border-[rgba(147,197,253,0.22)]"
            )}
          >
            <p className={cn("text-2xl font-black tabular-nums", s.color)}>{s.value}</p>
            <p className="text-[10px] text-[#94a3b8] font-semibold uppercase tracking-wide mt-0.5 leading-tight">{s.label}</p>
          </button>
        ))}
      </div>

      {/* Filter pills */}
      <div className="flex items-center gap-2">
        {[
          { id: "all",     label: "All" },
          { id: "success", label: "✓ Successful" },
          { id: "failed",  label: "✕ Failed" },
        ].map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer",
              filter === f.id
                ? f.id === "success"
                  ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                  : f.id === "failed"
                  ? "bg-red-500/20 border-red-500/40 text-red-300"
                  : "bg-[#c9a227] text-black border-[#c9a227]"
                : "bg-[#0a1226]/60 border-[rgba(147,197,253,0.14)] text-[#94a3b8] hover:text-white"
            )}
          >
            {f.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-[#94a3b8]">
            Showing <span className="font-bold text-white">{displayed.length}</span> entries
          </span>
          <button
            type="button"
            onClick={() => load(true)}
            disabled={refreshing}
            className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-xl border border-[rgba(147,197,253,0.14)] text-[#94a3b8] hover:text-white transition-all disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={cn("size-3", refreshing && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-[rgba(147,197,253,0.12)] overflow-hidden">
        <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10">
              <tr>
                {["#", "Time", "Name Entered", "Status", "Reason", "IP Address", "Device / Browser"].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-[#94a3b8] whitespace-nowrap border-b border-[rgba(147,197,253,0.10)] bg-[#0a1226]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="py-16 text-center text-sm text-[#94a3b8]">Loading access log…</td></tr>
              ) : displayed.length === 0 ? (
                <tr><td colSpan={7} className="py-16 text-center text-sm text-[#94a3b8]">No log entries found.</td></tr>
              ) : (
                displayed.map((row, idx) => {
                  const dt = new Date(row.created_at);
                  const dateStr = dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
                  const timeStr = dt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
                  return (
                    <tr
                      key={row.id}
                      className={cn(
                        "transition-colors border-b border-[rgba(147,197,253,0.06)]",
                        row.success ? "hover:bg-emerald-500/[0.04]" : "hover:bg-red-500/[0.04]"
                      )}
                    >
                      <td className="px-3 py-2.5 text-[10px] text-[#94a3b8] tabular-nums">{idx + 1}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1.5 text-[11px] text-[#94a3b8] whitespace-nowrap">
                          <Clock className="size-3 shrink-0" />
                          <div>
                            <p className="text-white font-medium">{timeStr}</p>
                            <p className="text-[10px]">{dateStr}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="text-xs font-semibold text-white">{row.attempted_name || "—"}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        {row.success ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 whitespace-nowrap">
                            <CheckCircle2 className="size-2.5 shrink-0" /> Success
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border border-red-500/40 bg-red-500/10 text-red-400 whitespace-nowrap">
                            <XCircle className="size-2.5 shrink-0" /> Failed
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="text-[11px] text-[#94a3b8]">{row.failure_reason ?? "—"}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="font-mono text-[11px] text-white">{row.ip_address || "—"}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="text-[11px] text-[#94a3b8]">
                          <span>{parseUA(row.user_agent)}</span>
                          {row.user_agent && <span className="ml-1 text-[#94a3b8]/70">· {parseBrowser(row.user_agent)}</span>}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Audit Trail sub-view ─────────────────────────────────────────────────────
function AuditTrail() {
  const [log, setLog]           = useState([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionFilter, setActionFilter] = useState("all");

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    const { data } = await fetchAuditLog(300);
    setLog(data ?? []);
    if (!silent) setLoading(false);
    else setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const displayed = actionFilter === "all"
    ? log
    : log.filter((r) => r.action === actionFilter);

  const createCount = log.filter((r) => r.action === "CREATE_FINAL_TEAM").length;
  const updateCount = log.filter((r) => r.action === "UPDATE_FINAL_TEAM").length;
  const deleteCount = log.filter((r) => r.action === "DELETE_FINAL_TEAM").length;

  return (
    <div className="space-y-4">
      {/* Stat pills */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Actions",   value: log.length,    color: "text-white",           filter: "all"                },
          { label: "Teams Created",   value: createCount,   color: "text-emerald-300",      filter: "CREATE_FINAL_TEAM"  },
          { label: "Teams Updated",   value: updateCount,   color: "text-[#e8c058]",        filter: "UPDATE_FINAL_TEAM"  },
          { label: "Teams Deleted",   value: deleteCount,   color: "text-red-400",          filter: "DELETE_FINAL_TEAM"  },
        ].map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => setActionFilter(actionFilter === s.filter ? "all" : s.filter)}
            className={cn(
              "rounded-2xl border p-3 text-left transition-all bg-[#0a1226]/60 cursor-pointer",
              actionFilter === s.filter
                ? "border-[#c9a227]/40 ring-1 ring-[#c9a227]/20 scale-[1.02]"
                : "border-[rgba(147,197,253,0.10)] hover:border-[rgba(147,197,253,0.22)]"
            )}
          >
            <p className={cn("text-2xl font-black tabular-nums", s.color)}>{s.value}</p>
            <p className="text-[10px] text-[#94a3b8] font-semibold uppercase tracking-wide mt-0.5 leading-tight">{s.label}</p>
          </button>
        ))}
      </div>

      {/* Action filter chips */}
      <div className="flex items-center gap-2 flex-wrap">
        {[
          { id: "all",                label: "All Actions" },
          { id: "CREATE_FINAL_TEAM",  label: "Created" },
          { id: "UPDATE_FINAL_TEAM",  label: "Updated" },
          { id: "DELETE_FINAL_TEAM",  label: "Deleted" },
        ].map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setActionFilter(f.id)}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer",
              actionFilter === f.id
                ? f.id === "CREATE_FINAL_TEAM"
                  ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                  : f.id === "UPDATE_FINAL_TEAM"
                  ? "bg-[#c9a227]/20 border-[#c9a227]/40 text-[#e8c058]"
                  : f.id === "DELETE_FINAL_TEAM"
                  ? "bg-red-500/20 border-red-500/40 text-red-300"
                  : "bg-[#c9a227] text-black border-[#c9a227]"
                : "bg-[#0a1226]/60 border-[rgba(147,197,253,0.14)] text-[#94a3b8] hover:text-white"
            )}
          >
            {f.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-[#94a3b8]">
            Showing <span className="font-bold text-white">{displayed.length}</span> entries
          </span>
          <button
            type="button"
            onClick={() => load(true)}
            disabled={refreshing}
            className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-xl border border-[rgba(147,197,253,0.14)] text-[#94a3b8] hover:text-white transition-all disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={cn("size-3", refreshing && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Audit table */}
      <div className="rounded-2xl border border-[rgba(147,197,253,0.12)] overflow-hidden">
        <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10">
              <tr>
                {["#", "Time", "Action", "Team Name", "Summary", "IP Address"].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-[#94a3b8] whitespace-nowrap border-b border-[rgba(147,197,253,0.10)] bg-[#0a1226]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="py-16 text-center text-sm text-[#94a3b8]">Loading audit trail…</td></tr>
              ) : displayed.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-sm text-[#94a3b8]">
                    {log.length === 0
                      ? "No actions recorded yet. Actions will appear here once you create, edit, or delete final teams."
                      : "No entries match the selected filter."}
                  </td>
                </tr>
              ) : (
                displayed.map((row, idx) => {
                  const meta = ACTION_META[row.action] ?? {
                    label: row.action,
                    icon: Activity,
                    color: "text-[#94a3b8]",
                    bg: "bg-[#0a1226]/60 border-[rgba(147,197,253,0.14)]",
                  };
                  const Icon = meta.icon;
                  const dt = new Date(row.created_at);
                  const dateStr = dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
                  const timeStr = dt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
                  const summary = formatDetails(row.action, row.details);

                  return (
                    <tr
                      key={row.id}
                      className="transition-colors border-b border-[rgba(147,197,253,0.06)] hover:bg-white/[0.02]"
                    >
                      <td className="px-3 py-2.5 text-[10px] text-[#94a3b8] tabular-nums">{idx + 1}</td>

                      {/* Time */}
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1.5 text-[11px] text-[#94a3b8] whitespace-nowrap">
                          <Clock className="size-3 shrink-0" />
                          <div>
                            <p className="text-white font-medium">{timeStr}</p>
                            <p className="text-[10px]">{dateStr}</p>
                          </div>
                        </div>
                      </td>

                      {/* Action badge */}
                      <td className="px-3 py-2.5">
                        <span className={cn(
                          "inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap",
                          meta.bg, meta.color
                        )}>
                          <Icon className="size-2.5 shrink-0" />
                          {meta.label}
                        </span>
                      </td>

                      {/* Team name */}
                      <td className="px-3 py-2.5">
                        <span className="text-xs font-semibold text-white truncate max-w-[160px] block">
                          {row.entity_name || <span className="text-[#94a3b8] italic">—</span>}
                        </span>
                        {row.entity_id && (
                          <span className="text-[9px] font-mono text-[#94a3b8]/50">id: {row.entity_id}</span>
                        )}
                      </td>

                      {/* Details / diff summary */}
                      <td className="px-3 py-2.5 max-w-[260px]">
                        <span className="text-[11px] text-[#94a3b8] leading-snug">
                          {summary ?? "—"}
                        </span>
                      </td>

                      {/* IP */}
                      <td className="px-3 py-2.5">
                        <span className="font-mono text-[11px] text-white">{row.ip_address || "—"}</span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── AccessLogView — main export ──────────────────────────────────────────────
/**
 * Shows two sub-tabs:
 *   • Login Attempts — every login attempt (success / failure)
 *   • Audit Trail   — every mutating action (create / update / delete final team)
 */
export function AccessLogView() {
  const [subTab, setSubTab] = useState("login"); // "login" | "audit"

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-[rgba(147,197,253,0.12)] bg-[#0a1226]/60 p-4">
        <div>
          <h2 className="text-sm font-extrabold text-white flex items-center gap-2">
            <Shield className="size-4 text-[#c9a227]" />
            SPOC Portal Logs
          </h2>
          <p className="text-[11px] text-[#94a3b8] mt-0.5">
            Login attempts and a full audit trail of every action performed
          </p>
        </div>
      </div>

      {/* Sub-tab switcher */}
      <div className="flex items-center gap-1 bg-[#0a1226]/60 border border-[rgba(147,197,253,0.10)] rounded-2xl p-1">
        {[
          { id: "login", label: "Login Attempts", icon: Monitor },
          { id: "audit", label: "Audit Trail",    icon: Activity },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSubTab(t.id)}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer",
              subTab === t.id
                ? "bg-[#c9a227] text-black shadow"
                : "text-[#94a3b8] hover:text-white hover:bg-[rgba(147,197,253,0.06)]"
            )}
          >
            <t.icon className="size-3.5 shrink-0" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Sub-tab content */}
      {subTab === "login" ? <LoginLog /> : <AuditTrail />}
    </div>
  );
}
