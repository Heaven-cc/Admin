"use client";

import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis,
} from "recharts";
import { formatNumber } from "@/lib/utils/format";
import type { FunnelStep } from "@/lib/data/types";

const AXIS = { stroke: "var(--muted-foreground)", fontSize: 11 };
const GRID = "var(--border)";

export function Donut({ data, height = 220, colors = ["var(--color-chart-1)", "var(--color-chart-2)", "var(--color-chart-3)", "var(--color-chart-4)", "var(--color-chart-5)"] }: {
  data: { name: string; value: number }[]; height?: number; colors?: string[];
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="80%" paddingAngle={2} strokeWidth={0}>
          {data.map((_, i) => (
            <Cell key={i} fill={colors[i % colors.length]} />
          ))}
        </Pie>
        <RTooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function Bars({ data, color = "var(--color-chart-1)", height = 220, horizontal }: {
  data: { name: string; value: number }[]; color?: string; height?: number; horizontal?: boolean;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout={horizontal ? "vertical" : "horizontal"} margin={{ top: 8, right: 8, left: horizontal ? 40 : 0, bottom: 0 }}>
        <CartesianGrid stroke={GRID} strokeDasharray="3 3" horizontal={!horizontal} vertical={horizontal} />
        {horizontal ? (
          <>
            <XAxis type="number" tick={AXIS} tickLine={false} axisLine={false} />
            <YAxis type="category" dataKey="name" tick={AXIS} tickLine={false} axisLine={false} width={150} />
          </>
        ) : (
          <>
            <XAxis dataKey="name" tick={AXIS} tickLine={false} axisLine={false} />
            <YAxis tick={AXIS} tickLine={false} axisLine={false} width={48} tickFormatter={(v: number) => formatNumber(v, true)} />
          </>
        )}
        <RTooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
        <Bar dataKey="value" fill={color} radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]} maxBarSize={36} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function FunnelChart({ steps }: { steps: FunnelStep[] }) {
  if (!steps.length) return <p className="py-8 text-center text-xs text-muted-foreground">Funnel events are unavailable from the connected source.</p>;
  const max = steps[0]?.count || 1;
  return (
    <div className="space-y-2.5">
      {steps.map((step, i) => {
        const pct = Math.round((step.count / max) * 100);
        const prev = i > 0 ? steps[i - 1].count : step.count;
        const conv = prev ? Math.round((step.count / prev) * 100) : 0;
        return (
          <div key={step.label}>
            <div className="flex items-baseline justify-between text-xs">
              <span className="font-medium">{step.label}</span>
              <span className="tabular-nums text-muted-foreground">
                {formatNumber(step.count)} · {pct}%{i > 0 ? ` · ${conv}% of previous` : ""}
              </span>
            </div>
            <div className="mt-1 h-6 overflow-hidden rounded-md bg-surface-muted">
              <div
                className="h-full rounded-md bg-brand/85"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="mt-0.5 font-mono text-[10px] text-muted-foreground/70">event: {step.event}</p>
          </div>
        );
      })}
    </div>
  );
}
