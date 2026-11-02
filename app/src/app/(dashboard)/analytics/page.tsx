import type { Metadata } from "next";
import { can, getSession } from "@/lib/auth/session";
import { getDataProvider } from "@/lib/data";
import { PageHeader } from "@/components/layout/page-header";
import { AreaTrend } from "@/components/charts/charts";
import { Bars, Donut, FunnelChart } from "@/components/charts/charts-bars";
import { DefinitionsPanel } from "@/components/domain/definitions-panel";
import { Unauthorized } from "@/components/states";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Product Analytics" };
export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const session = await getSession();
  if (!can(session, "analytics.read")) return <Unauthorized permission="analytics.read" />;

  const provider = getDataProvider();
  const data = await provider.getAnalytics();

  return (
    <>
      <PageHeader
        title="Product Analytics"
        description="How people actually use TREXVEN. Installations ≠ downloads ≠ registrations ≠ active users — definitions below are authoritative (docs/01 §7)."
      />
      <div className="space-y-5">
        <DefinitionsPanel
          definitions={[
            { key: "install", name: "Installation", definition: "first launch of the app on a device after install", source: "app.install event", sla: "24 h", permission: "analytics.read", status: "not instrumented yet" },
            { key: "download", name: "Download", definition: "store-listing download — before first launch", source: "store data (future)", sla: "24 h", permission: "analytics.read", status: "planned" },
            { key: "registration", name: "Registration", definition: "a business account created", source: "Production business registry", sla: "15 min", permission: "analytics.read", status: data.freshness.status },
            { key: "active", name: "Active business", definition: "A completed sale or product change in the reporting window", source: "Production aggregate", sla: "15 min", permission: "analytics.read", status: data.freshness.status },
          ]}
        />

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Activation funnel</CardTitle></CardHeader>
            <CardContent><FunnelChart steps={data.funnel} /></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Registration → paid conversion</CardTitle></CardHeader>
            <CardContent><FunnelChart steps={data.conversion} /></CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Sessions per day</CardTitle></CardHeader>
            <CardContent><AreaTrend data={data.sessionsTrend} color="var(--color-chart-4)" label="sessions" height={200} /></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Platform distribution</CardTitle></CardHeader>
            <CardContent><Donut data={data.distribution.map((item) => ({ name: item.platform, value: item.share }))} /></CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Feature adoption</CardTitle></CardHeader>
            <CardContent>
              <Bars data={data.adoption.map((a) => ({ name: `${a.surface}: ${a.feature}`, value: a.adoptionPct }))} color="var(--color-chart-5)" horizontal height={240} />
              <p className="mt-2 text-[11px] text-muted-foreground">Requires <code className="font-mono">feature.used</code> events from Owner and POS apps (docs/10 §8).</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Geographic distribution (country level only)</CardTitle></CardHeader>
            <CardContent>
              <Bars data={data.geo.map((g) => ({ name: g.country, value: g.businesses }))} color="var(--color-chart-2)" height={200} />
              <p className="mt-2 text-[11px] text-muted-foreground">Precise location is never collected — country codes only.</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Retention cohorts (D1 / D7 / D30)</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="py-1.5 pr-3 font-medium">Cohort</th>
                  <th className="py-1.5 pr-3 font-medium">Size</th>
                  <th className="py-1.5 pr-3 font-medium">D1</th>
                  <th className="py-1.5 pr-3 font-medium">D7</th>
                  <th className="py-1.5 font-medium">D30</th>
                </tr>
              </thead>
              <tbody>
                {data.retention.map((c) => (
                  <tr key={c.cohort} className="border-b border-border/60 last:border-0">
                    <td className="py-1.5 pr-3 font-medium">{c.cohort}</td>
                    <td className="py-1.5 pr-3 tabular-nums">{c.size}</td>
                    <td className="py-1.5 pr-3 tabular-nums">{c.d1}%</td>
                    <td className="py-1.5 pr-3 tabular-nums">{c.d7}%</td>
                    <td className="py-1.5 tabular-nums">{c.d30 === null ? <span className="text-muted-foreground">pending</span> : `${c.d30}%`}</td>
                  </tr>
                ))}
                {!data.retention.length ? <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">Retention telemetry is unavailable.</td></tr> : null}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
