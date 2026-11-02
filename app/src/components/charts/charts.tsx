"use client";

import {
  Area, AreaChart, CartesianGrid, Line, LineChart,
  ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis,
} from "recharts";
import { formatNumber } from "@/lib/utils/format";
import type { SeriesPoint } from "@/lib/data/types";

const AXIS = { stroke: "var(--muted-foreground)", fontSize: 11 };
const GRID = "var(--border)";

function shortDate(d: string): string {
  return d.slice(5);
}

export function AreaTrend({ data, color = "var(--brand)", height = 220, label }: {
  data: SeriesPoint[]; color?: string; height?: number; label?: string;
}) {
  if (!data.length) return <p role="status" className="flex min-h-48 items-center justify-center text-xs text-muted-foreground">History unavailable from the connected source.</p>;
  const gradId = `grad-${color.replace(/[^a-z]/gi, "")}`;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.28} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="date" tickFormatter={shortDate} tick={AXIS} tickLine={false} axisLine={false} minTickGap={40} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} width={54} tickFormatter={(v: number) => formatNumber(v, true)} />
        <RTooltip
          contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
          formatter={(value: number) => [formatNumber(value), label ?? ""]}
        />
        <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2} fill={`url(#${gradId})`} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function MultiLine({ series, height = 220 }: {
  series: { name: string; color: string; points: SeriesPoint[] }[]; height?: number;
}) {
  if (!series.some(s => s.points.length)) return <p role="status" className="flex min-h-48 items-center justify-center text-xs text-muted-foreground">Time series unavailable from the connected source.</p>;
  const merged: Record<string, Record<string, number>> = {};
  for (const s of series) for (const p of s.points) (merged[p.date] ??= {})[s.name] = p.value;
  const data = Object.entries(merged).map(([date, values]) => ({ date, ...values }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="date" tickFormatter={shortDate} tick={AXIS} tickLine={false} axisLine={false} minTickGap={40} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} width={54} tickFormatter={(v: number) => formatNumber(v, true)} />
        <RTooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
        {series.map((s) => (
          <Line key={s.name} type="monotone" dataKey={s.name} stroke={s.color} strokeWidth={2} dot={false} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
