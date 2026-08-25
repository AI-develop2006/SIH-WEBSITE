"use client";

import { useEffect, useState, useCallback } from "react";
import { CheckCircle2, XCircle, RefreshCw, Shield, Monitor, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchAccessLog } from "@/lib/data";

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

/**
 * AccessLogView — shows SPOC login attempts with IP, device, and outcome.
 * Displayed on the "Access Log" tab inside the SPOC dashboard.
 */
export function AccessLogView() {
  const [log, setLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState("all"); // all | success | failed

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
    <div className="space-y-5">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-[rgba(147,197,253,0.12)] bg-[#0a1226]/60 p-4">
        <div>
          <h2 className="text-sm font-extrabold text-white flex items-center gap-2">
            <Shield className="size-4 text-[#c9a227]" />
            SPOC Portal Access Log
          </h2>
          <p className="text-[11px] text-[#94a3b8] mt-0.5">
            Every login attempt — who tried, when, from where, and whether it succeeded
          </p>
        </div>
        <button
          type="button"
          onClick={() => load(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border border-[rgba(147,197,253,0.14)] text-[#94a3b8] hover:text-white hover:border-[rgba(147,197,253,0.3)] transition-all disabled:opacity-50 self-start cursor-pointer"
        >
          <RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} />
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>

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
        <span className="ml-auto text-xs text-[#94a3b8]">
          Showing <span className="font-bold text-white">{displayed.length}</span> entries
        </span>
      </div>

      {/* Log table */}
      <div className="rounded-2xl border border-[rgba(147,197,253,0.12)] overflow-hidden">
        <div className="overflow-x-auto max-h-[65vh] overflow-y-auto">
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
                <tr>
                  <td colSpan={7} className="py-16 text-center text-sm text-[#94a3b8]">
                    Loading access log…
                  </td>
                </tr>
              ) : displayed.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-sm text-[#94a3b8]">
                    No log entries found.
                  </td>
                </tr>
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
                        row.success
                          ? "hover:bg-emerald-500/4"
                          : "hover:bg-red-500/4"
                      )}
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

                      {/* Name entered */}
                      <td className="px-3 py-2.5">
                        <span className="text-xs font-semibold text-white">{row.attempted_name || "—"}</span>
                      </td>

                      {/* Status */}
                      <td className="px-3 py-2.5">
                        {row.success ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 whitespace-nowrap">
                            <CheckCircle2 className="size-2.5 shrink-0" />
                            Success
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border border-red-500/40 bg-red-500/10 text-red-400 whitespace-nowrap">
                            <XCircle className="size-2.5 shrink-0" />
                            Failed
                          </span>
                        )}
                      </td>

                      {/* Failure reason */}
                      <td className="px-3 py-2.5">
                        <span className="text-[11px] text-[#94a3b8]">{row.failure_reason ?? "—"}</span>
                      </td>

                      {/* IP */}
                      <td className="px-3 py-2.5">
                        <span className="font-mono text-[11px] text-white">{row.ip_address || "—"}</span>
                      </td>

                      {/* Device / Browser */}
                      <td className="px-3 py-2.5">
                        <div className="text-[11px] text-[#94a3b8]">
                          <span>{parseUA(row.user_agent)}</span>
                          {row.user_agent && (
                            <span className="ml-1 text-[#94a3b8]/70">· {parseBrowser(row.user_agent)}</span>
                          )}
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
