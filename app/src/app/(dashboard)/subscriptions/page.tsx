import type { Metadata } from "next";
import { can, getSession } from "@/lib/auth/session";
import { getDataProvider } from "@/lib/data";
import { PageHeader } from "@/components/layout/page-header";
import { KpiGrid } from "@/components/kpi/kpi-card";
import { AreaTrend } from "@/components/charts/charts";
import { Donut, Bars } from "@/components/charts/charts-bars";
import { Unauthorized } from "@/components/states";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMoney, formatDate } from "@/lib/utils/format";
import { COUNTRIES, PLANS } from "@/lib/data/types";

export const metadata: Metadata = { title: "Subscriptions" };
export const dynamic = "force-dynamic";

export default async function SubscriptionsPage() {
  const session = await getSession();
  if (!can(session, "subscriptions.read")) return <Unauthorized permission="subscriptions.read" />;

  const provider = getDataProvider();
  const data = await provider.getSubscriptionAnalytics();
  const planColors = ["var(--color-chart-1)", "var(--color-chart-2)", "var(--color-chart-3)"];

  return (
    <>
      <PageHeader
        title="Subscriptions"
        description="Start · Core · Pro across Nigeria, Ghana, Togo, and Ivory Coast — each country priced independently."
      />
      <div className="space-y-5">
        <KpiGrid metrics={data.kpis} />

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle>MRR history</CardTitle></CardHeader>
            <CardContent><AreaTrend data={data.mrrTrend} label="MRR" /></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Plan distribution</CardTitle></CardHeader>
            <CardContent>
              <Donut data={data.planMix.map((p) => ({ name: PLANS[p.plan].name, value: p.count }))} colors={planColors} />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Country split — active subscriptions & local-currency MRR</CardTitle></CardHeader>
          <CardContent>
            <Bars
              data={data.countrySplit.map(row => ({ name: COUNTRIES[row.country].name, value: row.active }))}
              color="var(--color-chart-4)"
              height={180}
            />
            <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
              {data.countrySplit.map((row) => (
                <div key={row.country} className="rounded-md border border-border p-2.5">
                  <p className="font-medium">{COUNTRIES[row.country].name}</p>
                  <p className="mt-0.5 text-muted-foreground">
                    {row.active} active · <span className="tabular-nums">{formatMoney(row.mrrMinor, row.currency, true)}</span>/mo
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Renewals — next 30 days</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Business</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.renewals.map((r) => (
                    <TableRow key={r.businessId + r.date}>
                      <TableCell><a href={`/businesses/${r.businessId}`} className="hover:text-brand hover:underline">{r.name}</a></TableCell>
                      <TableCell>{r.plan ? PLANS[r.plan].name : "Unconfigured"}</TableCell>
                      <TableCell className="tabular-nums">{formatMoney(r.amountMinor, r.currency)}</TableCell>
                      <TableCell className="text-xs">{formatDate(r.date)}</TableCell>
                    </TableRow>
                  ))}
                  {data.renewals.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="py-6 text-center text-xs text-muted-foreground">No renewals in the window.</TableCell></TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Recent cancellations</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Business</TableHead>
                    <TableHead>When</TableHead>
                    <TableHead>Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.cancellations.map((c) => (
                    <TableRow key={c.businessId}>
                      <TableCell><a href={`/businesses/${c.businessId}`} className="hover:text-brand hover:underline">{c.name}</a></TableCell>
                      <TableCell className="text-xs">{formatDate(c.at)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{c.reason ?? "not provided"}</TableCell>
                    </TableRow>
                  ))}
                  {data.cancellations.length === 0 ? (
                    <TableRow><TableCell colSpan={3} className="py-6 text-center text-xs text-muted-foreground">No cancellations recorded.</TableCell></TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}