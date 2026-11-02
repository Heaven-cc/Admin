import type { Metadata } from "next";
import { Suspense } from "react";
import { getSession, can } from "@/lib/auth/session";
import { getDataProvider } from "@/lib/data";
import { PageHeader } from "@/components/layout/page-header";
import { DateRangePicker } from "@/components/layout/date-range";
import { KpiGrid, SectionHeader } from "@/components/kpi/kpi-card";
import { AreaTrend, MultiLine } from "@/components/charts/charts";
import { Bars } from "@/components/charts/charts-bars";
import { StaleBanner, Unauthorized } from "@/components/states";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusChip } from "@/components/ui/badge";
import { formatRelative } from "@/lib/utils/format";
import type { MetricCard, SeriesPoint } from "@/lib/data/types";

export const metadata: Metadata = { title: "Overview" };
export const dynamic = "force-dynamic";

function sliceByRange(series: SeriesPoint[], range: string): SeriesPoint[] {
  const n = range === "today" ? 1 : range === "7d" ? 7 : range === "90d" ? 90 : 30;
  return series.slice(-n);
}

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const session = await getSession();
  const provider = getDataProvider();
  const { range = "30d" } = await searchParams;
  const summary = await provider.getDashboardSummary(range);

  if (!can(session, "dashboard.view")) {
    return <Unauthorized permission="dashboard.view" />;
  }

  const show = (m: MetricCard): boolean => {
    if (m.section === "odt_revenue") return can(session, "revenue.view");
    if (m.section === "gmv") return can(session, "sales.view");
    if (m.key.startsWith("M-VIS")) return can(session, "vision.read");
    if (m.key.startsWith("M-AI")) return can(session, "angel.read");
    if (m.key.startsWith("M-SYS") || m.key.startsWith("M-SYNC")) return can(session, "health.read");
    return true;
  };
  const visible = summary.metrics.filter(show);
  const section = (s: MetricCard["section"]) => visible.filter((m) => m.section === s);

  return (
    <>
      <PageHeader
        title="Overview"
        description="How the TREXVEN business is doing — ODT subscription revenue is reported separately from customer businesses' sales."
        actions={<Suspense><DateRangePicker /></Suspense>}
      />
      <StaleBanner
        lagMinutes={summary.sync.lagMinutes !== null && summary.sync.lagMinutes > 60 ? summary.sync.lagMinutes : null}
        lastEventAt={summary.sync.lastEventAt}
      />

      <div className="space-y-6">
        <section>
          <SectionHeader title="ODT revenue" hint="subscription revenue earned by ODT" accent="brand" />
          <KpiGrid metrics={section("odt_revenue")} />
        </section>

        <section>
          <SectionHeader title="Businesses" />
          <KpiGrid metrics={section("business")} />
        </section>

        <section>
          <SectionHeader
            title="Customer sales — GMV"
            hint="revenue recorded by customer businesses · not ODT income"
            accent="gmv"
          />
          <KpiGrid metrics={section("gmv")} />
        </section>

        <section>
          <SectionHeader title="Services" />
          <KpiGrid metrics={section("services")} />
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>MRR history</CardTitle>
            </CardHeader>
            <CardContent>
              <AreaTrend data={sliceByRange(summary.series.mrr, range)} label="MRR" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Recent platform events</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {summary.recentEvents.length === 0 ? (
                <p className="py-6 text-center text-xs text-muted-foreground">No recent events.</p>
              ) : (
                summary.recentEvents.map((e) => (
                  <a key={e.id} href={e.href ?? "#"} className="block rounded-md border border-border p-2.5 transition-colors hover:bg-surface-muted">
                    <div className="flex items-center justify-between gap-2">
                      <StatusChip status={e.severity === "critical" ? "open" : e.severity === "warning" ? "degraded" : "operational"} />
                      <span className="text-[10px] text-muted-foreground">{formatRelative(e.at)}</span>
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-xs">{e.label}</p>
                  </a>
                ))
              )}
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Registrations per day</CardTitle></CardHeader>
            <CardContent>
              <Bars data={sliceByRange(summary.series.registrations, range).slice(-30).map((p) => ({ name: p.date.slice(5), value: p.value }))} color="var(--color-chart-4)" height={200} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Customer sales (GMV) per day</CardTitle></CardHeader>
            <CardContent>
              {can(session, "sales.view") && summary.gmvByCurrency ? <div className="space-y-4">{summary.gmvByCurrency.map(s => <div key={s.name}><p className="mb-2 text-xs font-medium">{s.name}</p><AreaTrend data={s.points} color={s.color} label={s.name} height={160} /></div>)}</div> : <MultiLine series={can(session,"sales.view") ? [{name:"GMV",color:"var(--color-chart-2)",points:sliceByRange(summary.series.gmv,range)}] : []} height={200} />}
            </CardContent>
          </Card>
        </section>

      </div>
    </>
  );
}
