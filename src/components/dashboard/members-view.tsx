"use client";

import { useEffect, useState } from "react";
import type { EnrichedTeam, Profile } from "@/lib/types";
import * as data from "@/lib/data";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/unlumen-ui/toast";
import { Button } from "@/components/unlumen-ui/button";
import { Input } from "@/components/unlumen-ui/input";
import { Card } from "@/components/unlumen-ui/card";
import { GlowingBadge } from "@/components/unlumen-ui/glowing-badge";
import { Avatar } from "@/components/unlumen-ui/avatar";

const STACKS = [
  "Frontend",
  "Backend",
  "ML",
  "AI",
  "UI/UX",
  "Database",
  "Mobile",
  "DevOps",
  "Cloud",
  "Testing",
  "IoT",
  "Cyber",
];

export function MembersView({
  profile,
  myTeam,
}: {
  profile: Profile;
  myTeam: EnrichedTeam | null;
}) {
  const toast = useToast();
  const [q, setQ] = useState("");
  const [stack, setStack] = useState<string | null>(null);
  const [results, setResults] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [invited, setInvited] = useState<string[]>([]);

  async function runSearch(query = q, filter = stack) {
    setLoading(true);
    const res = await data.searchProfiles({
      q: query || undefined,
      stack: filter || undefined,
      excludeId: profile.id,
    });
    if (res.error) toast("error", res.error);
    setResults(res.data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    runSearch("", null);
  }, []);

  function toggleStack(tag: string) {
    const next = stack === tag ? null : tag;
    setStack(next);
    runSearch(q, next);
  }

  async function invite(member: Profile) {
    if (!myTeam) return;
    setBusyId(member.id);
    const res = await data.api.sendInvite(myTeam.team.id, member.id);
    if (res.error) {
      toast("error", res.error);
    } else {
      setInvited((s) => [...s, member.id]);
      toast("success", `Invite sent to ${member.name}`);
    }
    setBusyId(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-bold">Find members</h2>
        <p className="text-sm text-muted-foreground">
          Search by name, department, section or language — or filter by tech stack.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            runSearch();
          }}
          className="flex gap-2"
        >
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search teammates…"
            className="max-w-md"
          />
          <Button type="submit" variant="outline" loading={loading}>
            Search
          </Button>
        </form>

        <div className="flex flex-wrap gap-1.5">
          {STACKS.map((tag) => (
            <button
              key={tag}
              onClick={() => toggleStack(tag)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs font-medium transition-all",
                stack === tag
                  ? "border-ring/60 bg-ring/15 text-ring shadow-[0_0_12px_-4px_var(--ring)]"
                  : "border-border text-muted-foreground hover:border-ring/40 hover:text-foreground"
              )}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {!myTeam && (
        <div className="glass rounded-2xl px-5 py-4 text-sm text-muted-foreground">
          Create or join a team first, then invite members from here.
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center text-sm text-muted-foreground">Searching…</div>
      ) : results.length === 0 ? (
        <div className="glass rounded-2xl p-10 text-center text-sm text-muted-foreground">
          No members match — try clearing the filters.
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {results.map((m) => (
            <Card key={m.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Avatar name={m.name} />
                  <div>
                    <p className="text-sm font-bold">{m.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {m.department ?? "—"} · {m.section ?? "—"} · {m.gender}
                    </p>
                    {m.language && (
                      <p className="text-xs text-muted-foreground">Prefers {m.language}</p>
                    )}
                  </div>
                </div>
                {m.gender === "Female" && <GlowingBadge variant="info" pulse={false}>♀</GlowingBadge>}
              </div>

              {m.tech_stack.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {m.tech_stack.map((t) => (
                    <span
                      key={t}
                      className="rounded-md border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-3 flex items-center justify-between gap-2">
                {m.github ? (
                  <a
                    href={/^https?:\/\//.test(m.github) ? m.github : `https://${m.github}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-ring hover:underline"
                  >
                    GitHub ↗
                  </a>
                ) : (
                  <span className="text-xs text-muted-foreground">No GitHub</span>
                )}
                {myTeam && (
                  <Button
                    className="px-3 py-1.5 text-xs"
                    disabled={invited.includes(m.id) || myTeam.members.some((x) => x.id === m.id)}
                    loading={busyId === m.id}
                    onClick={() => invite(m)}
                  >
                    {myTeam.members.some((x) => x.id === m.id)
                      ? "In your team"
                      : invited.includes(m.id)
                        ? "Invite sent"
                        : "Invite to my team"}
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
