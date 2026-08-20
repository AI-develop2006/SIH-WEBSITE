"use client";

import { Avatar } from "@/components/unlumen-ui/avatar";
import { Button } from "@/components/unlumen-ui/button";
import { Card } from "@/components/unlumen-ui/card";
import { GlowingBadge } from "@/components/unlumen-ui/glowing-badge";

export function TeamCard({
  team,
  actionLabel,
  onAction,
  busy,
  disabled,
}) {
  const s = team.stats;

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold tracking-tight">{team.team.name}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Led by {team.leader?.name ?? "—"} {team.leader?.gender === "Female" && "♀"}
          </p>
        </div>
        {s.valid ? (
          <GlowingBadge variant="success">Valid · {s.memberCount}/6</GlowingBadge>
        ) : (
          <GlowingBadge variant="warning">{s.reason}</GlowingBadge>
        )}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>👥 {s.memberCount} / 6 members</span>
        <span>♀ {s.girlCount} female</span>
        <span>🏛 {s.deptCount} departments</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {team.members.map((m) => (
          <span
            key={m.id}
            className="glass inline-flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-xs font-medium"
          >
            <Avatar name={m.name} src={m.avatar_url} className="size-6 text-[9px]" />
            {m.name}
          </span>
        ))}
      </div>

      {actionLabel && onAction && (
        <Button onClick={onAction} loading={busy} disabled={disabled} className="w-full">
          {actionLabel}
        </Button>
      )}
    </Card>
  );
}
