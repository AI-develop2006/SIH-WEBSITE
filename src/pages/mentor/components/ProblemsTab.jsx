import { memo } from "react";
import { Card } from "@/components/unlumen-ui/card";

export const ProblemsTab = memo(function ProblemsTab({ problems }) {
  return (
    <Card className="p-0 overflow-hidden border border-border/40 bg-card/45">
      {/* Mobile card list */}
      <div className="md:hidden divide-y divide-border/40">
        {problems.length === 0 && (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">No problem statements available.</p>
        )}
        {problems.map((p) => (
          <div key={p.id} className="px-4 py-4 flex flex-col gap-2">
            <p className="font-semibold text-sm text-foreground">{p.title}</p>
            {p.category && (
              <span className="self-start rounded bg-muted px-2.5 py-0.5 text-xs text-muted-foreground font-semibold">{p.category}</span>
            )}
            {p.description && (
              <p className="text-xs text-muted-foreground leading-relaxed">{p.description}</p>
            )}
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <th className="px-5 py-3.5">Title</th>
              <th className="px-5 py-3.5">Category</th>
              <th className="px-5 py-3.5">Description</th>
            </tr>
          </thead>
          <tbody>
            {problems.map((p) => (
              <tr key={p.id} className="border-b border-border/40 last:border-0 hover:bg-muted/10">
                <td className="px-5 py-4 font-semibold text-foreground">{p.title}</td>
                <td className="px-5 py-4">
                  <span className="rounded bg-muted px-2.5 py-0.5 text-xs text-muted-foreground font-semibold">{p.category}</span>
                </td>
                <td className="px-5 py-4 text-xs text-muted-foreground leading-relaxed">{p.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
});