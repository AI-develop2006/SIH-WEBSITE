import { useState, useEffect, useMemo, useCallback } from "react";
import { Search, RotateCcw, ChevronUp, ChevronDown } from "lucide-react";
import { MINISTRIES, DEPARTMENTS, OUTDATED_MINISTRIES, NEW_MINISTRIES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Card } from "@/components/unlumen-ui/card";
import { Button } from "@/components/unlumen-ui/button";
import { NewMinistryBadge } from "@/components/common/NewMinistryBadge";
import { useToast } from "@/components/unlumen-ui/toast";
import { fetchMinistrySeats, saveMinistrySeats } from "@/lib/data";

const DEFAULT_CAP = 6;
const MAX_CAP = 30;
const MIN_CAP = 1;

const DEPT_ABBR = {
  "Computer Science and Engineering": "CSE",
  "Information Technology": "IT",
  "Artificial Intelligence and Data Science": "AI&DS",
  "Civil Engineering": "CIVIL",
  "Mechanical Engineering": "MECH",
  "Instrumentation and Control Engineering": "ICE",
  "Computer Science and Engineering and Business Systems": "CSEBS",
  "Computer and Communication Engineering": "CCE",
  "Mechatronics": "MCTR",
  "Electrical and Electronics Engineering": "EEE",
  "Electronics and Communication Engineering": "ECE",
  "BioMedical Engineering": "BME",
  "Master of Computer Applications": "MCA",
  "Master of Business Administration": "MBA",
};

const ACTIVE_MINISTRIES = MINISTRIES.filter((m) => !OUTDATED_MINISTRIES.has(m));

function seatKey(ministry, dept) {
  return `${ministry}|||${dept}`;
}

export function MinistrySeatsView() {
  const toast = useToast();
  const [seats, setSeats] = useState({});     // saved in DB
  const [pending, setPending] = useState({}); // local unsaved edits
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deptFilter, setDeptFilter] = useState("All");
  const [ministrySearch, setMinistrySearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await fetchMinistrySeats();
    if (error) toast("error", error);
    setSeats(data ?? {});
    setPending({});
    setLoading(false);
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  function getSeat(ministry, dept) {
    const k = seatKey(ministry, dept);
    return pending[k] ?? seats[k] ?? DEFAULT_CAP;
  }

  function setSeat(ministry, dept, value) {
    const k = seatKey(ministry, dept);
    const val = Math.max(MIN_CAP, Math.min(MAX_CAP, value));
    setPending((prev) => ({ ...prev, [k]: val }));
  }

  function resetSeat(ministry, dept) {
    const k = seatKey(ministry, dept);
    // Remove from pending — will fall back to DEFAULT_CAP
    setPending((prev) => {
      const next = { ...prev };
      delete next[k];
      return next;
    });
    // Also remove from saved seats so it falls back to DEFAULT_CAP
    setSeats((prev) => {
      const next = { ...prev };
      delete next[k];
      return next;
    });
  }

  const pendingCount = Object.keys(pending).length;

  const displayedDepts = deptFilter === "All" ? DEPARTMENTS : [deptFilter];

  const filteredMinistries = useMemo(() => {
    const needle = ministrySearch.trim().toLowerCase();
    return ACTIVE_MINISTRIES.filter((m) =>
      !needle || m.toLowerCase().includes(needle)
    );
  }, [ministrySearch]);

  async function handleSave() {
    setSaving(true);
    // Merge pending into seats, strip entries that equal DEFAULT_CAP (no need to persist defaults)
    const merged = { ...seats, ...pending };
    const cleaned = Object.fromEntries(
      Object.entries(merged).filter(([, v]) => v !== DEFAULT_CAP)
    );
    const { success, error } = await saveMinistrySeats(cleaned);
    if (!success) {
      toast("error", error || "Failed to save seat configuration");
    } else {
      setSeats(cleaned);
      setPending({});
      toast("success", "Seat configuration saved!");
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="size-6 animate-spin rounded-full border-2 border-[#c9a227] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-2xl border border-[rgba(201,162,39,0.25)] bg-card/30 p-4 space-y-1">
        <h2 className="text-base font-extrabold text-white">Ministry Seat Configuration</h2>
        <p className="text-xs text-muted-foreground">
          Set the maximum number of team members allowed per ministry per department.
          Default cap is <span className="text-white font-semibold">{DEFAULT_CAP}</span> per combination.
          Changes apply immediately after saving.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search ministry…"
            value={ministrySearch}
            onChange={(e) => setMinistrySearch(e.target.value)}
            className="w-full rounded-xl border border-border/50 bg-card/60 text-xs text-white pl-9 pr-3 py-2 focus:outline-none focus:border-[#c9a227] placeholder:text-muted-foreground"
          />
        </div>
        <select
          value={deptFilter}
          onChange={(e) => setDeptFilter(e.target.value)}
          className="rounded-xl border border-border/50 bg-card/60 text-xs text-white px-3 py-2 focus:outline-none focus:border-[#c9a227] cursor-pointer min-w-[180px]"
        >
          <option value="All">All departments</option>
          {DEPARTMENTS.map((d) => (
            <option key={d} value={d}>{DEPT_ABBR[d] ?? d}</option>
          ))}
        </select>
      </div>

      {/* Unsaved changes bar */}
      {pendingCount > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-[#c9a227]/30 bg-[#c9a227]/[0.08] px-4 py-2.5">
          <span className="text-xs text-[#e8c058] font-semibold">
            {pendingCount} unsaved change{pendingCount !== 1 ? "s" : ""}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPending({})}
              className="text-xs text-muted-foreground hover:text-white transition-colors font-semibold flex items-center gap-1"
            >
              <RotateCcw className="size-3" /> Reset
            </button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="text-xs px-4 py-1.5 bg-[#c9a227] text-black hover:bg-[#e8c058] font-bold"
            >
              {saving ? "Saving…" : "Save All Changes"}
            </Button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {filteredMinistries.length === 0 && (
        <div className="py-12 text-center text-sm text-muted-foreground rounded-2xl border border-border/20 bg-card/10">
          No ministries match your search.
        </div>
      )}

      {/* Ministry cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {filteredMinistries.map((ministry) => {
          const isNew = NEW_MINISTRIES.has(ministry);
          const hasCustom = displayedDepts.some((d) => {
            const k = seatKey(ministry, d);
            const v = pending[k] ?? seats[k];
            return v !== undefined && v !== DEFAULT_CAP;
          });
          const hasPending = displayedDepts.some((d) => pending[seatKey(ministry, d)] !== undefined);

          return (
            <Card
              key={ministry}
              className={cn(
                "p-4 border bg-card/40 space-y-3 transition-all",
                hasPending
                  ? "border-[#c9a227]/50 shadow-sm shadow-[#c9a227]/10"
                  : "border-border/40"
              )}
            >
              {/* Ministry header */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className="text-xs font-extrabold text-white leading-snug">{ministry}</h3>
                    {isNew && <NewMinistryBadge ministry={ministry} inline />}
                    {hasPending && (
                      <span className="text-[9px] font-bold text-[#c9a227] bg-[#c9a227]/10 border border-[#c9a227]/30 px-1.5 py-0.5 rounded-full">
                        Unsaved
                      </span>
                    )}
                  </div>
                </div>
                {hasCustom && (
                  <button
                    type="button"
                    onClick={() => {
                      displayedDepts.forEach((d) => resetSeat(ministry, d));
                    }}
                    title="Reset all dept caps for this ministry to default (6)"
                    className="shrink-0 text-[10px] text-muted-foreground hover:text-red-400 transition-colors font-semibold flex items-center gap-0.5"
                  >
                    <RotateCcw className="size-2.5" /> Reset all
                  </button>
                )}
              </div>

              {/* Dept rows */}
              <div className="space-y-1.5">
                {displayedDepts.map((dept) => {
                  const val = getSeat(ministry, dept);
                  const isModified = val !== DEFAULT_CAP;
                  const isPendingItem = pending[seatKey(ministry, dept)] !== undefined;

                  return (
                    <div
                      key={dept}
                      className={cn(
                        "flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg",
                        isPendingItem
                          ? "bg-[#c9a227]/5 border border-[#c9a227]/20"
                          : "bg-muted/10"
                      )}
                    >
                      <span
                        className={cn(
                          "text-[10px] font-bold truncate flex-1",
                          isModified ? "text-white" : "text-muted-foreground"
                        )}
                      >
                        {DEPT_ABBR[dept] ?? dept}
                      </span>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {isModified && (
                          <button
                            type="button"
                            onClick={() => resetSeat(ministry, dept)}
                            title="Reset to default (6)"
                            className="text-[9px] text-muted-foreground hover:text-red-400 font-bold transition-colors"
                          >
                            <RotateCcw className="size-2.5" />
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => setSeat(ministry, dept, val - 1)}
                          disabled={val <= MIN_CAP}
                          className="size-5 flex items-center justify-center rounded border border-border/40 text-muted-foreground hover:text-white hover:border-border/70 disabled:opacity-30 transition-colors cursor-pointer disabled:cursor-not-allowed"
                        >
                          <ChevronDown className="size-3" />
                        </button>

                        <span
                          className={cn(
                            "text-xs font-extrabold w-5 text-center tabular-nums",
                            isModified ? "text-[#c9a227]" : "text-muted-foreground"
                          )}
                        >
                          {val}
                        </span>

                        <button
                          type="button"
                          onClick={() => setSeat(ministry, dept, val + 1)}
                          disabled={val >= MAX_CAP}
                          className="size-5 flex items-center justify-center rounded border border-border/40 text-muted-foreground hover:text-white hover:border-border/70 disabled:opacity-30 transition-colors cursor-pointer disabled:cursor-not-allowed"
                        >
                          <ChevronUp className="size-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
