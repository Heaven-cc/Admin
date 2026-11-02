import {
  Banknote, Building2, FileClock, ShieldQuestion, Wrench,
  type LucideIcon,
} from "lucide-react";
import { formatDateTime } from "@/lib/utils/format";
import type { TimelineEntry } from "@/lib/data/types";

const ICONS: Record<string, { icon: LucideIcon; tone: string }> = {
  payment: { icon: Banknote, tone: "text-success" },
  command: { icon: ShieldQuestion, tone: "text-warning" },
  business: { icon: Building2, tone: "text-brand" },
  support: { icon: Wrench, tone: "text-info" },
};

export function Timeline({ entries }: { entries: TimelineEntry[] }) {
  if (entries.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No events recorded yet.</p>;
  }
  return (
    <ol className="relative space-y-4 border-l border-border pl-5">
      {entries.map((entry) => {
        const cfg = ICONS[entry.type] ?? { icon: FileClock, tone: "text-muted-foreground" };
        const Icon = cfg.icon;
        return (
          <li key={entry.id} className="relative">
            <span
              aria-hidden
              className="absolute -left-[27px] flex h-5 w-5 items-center justify-center rounded-full border border-border bg-surface"
            >
              <Icon className={`h-3 w-3 ${cfg.tone}`} />
            </span>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-medium">{entry.label}</p>
              <time className="text-[11px] text-muted-foreground">{formatDateTime(entry.at)}</time>
            </div>
            {entry.detail ? <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{entry.detail}</p> : null}
            {entry.actor ? <p className="mt-0.5 text-[11px] text-muted-foreground">via {entry.actor}</p> : null}
          </li>
        );
      })}
    </ol>
  );
}
