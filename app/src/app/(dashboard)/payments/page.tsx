import type { Metadata } from "next";
import { can, getSession } from "@/lib/auth/session";
import { getDataProvider } from "@/lib/data";
import { PageHeader } from "@/components/layout/page-header";
import { AreaTrend } from "@/components/charts/charts";
import { Bars } from "@/components/charts/charts-bars";
import { Unauthorized } from "@/components/states";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, MonoCell } from "@/components/ui/table";
import { StatusChip } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PaymentTable } from "./payment-table";
import { formatMoney, formatDateTime, formatNumber } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Payments" };
export const dynamic = "force-dynamic";

export default async function PaymentsPage() {
  const session = await getSession();
  if (!can(session, "payments.read")) return <Unauthorized permission="payments.read" />;

  const provider = getDataProvider();
  const data = await provider.getPayments();

  return (
    <>
      <PageHeader
        title="Payments"
        description="Provider-sourced payment events and reconciliation state. The admin platform can never fabricate or mutate a payment."
      />
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Card><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Success rate (30d)</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{data.successRate == null ? "Unavailable" : data.successRate.toFixed(1) + "%"}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Failed payments</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{formatNumber(data.payments.length ? data.failures.length : null)}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Refunded (30d)</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{formatMoney(data.refundedMinor, data.currency, true)}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Reconciliation items</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">Unavailable</p>
          </CardContent></Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Successful payments per day</CardTitle></CardHeader>
            <CardContent><AreaTrend data={data.trend} color="var(--color-chart-2)" label="successful payments" height={200} /></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Failures by reason</CardTitle></CardHeader>
            <CardContent>
              {data.failuresByReason.length === 0 ? (
                <p className="py-8 text-center text-xs text-muted-foreground">No failure breakdown available.</p>
              ) : (
                <Bars data={data.failuresByReason.map((r) => ({ name: r.reason, value: r.count }))} color="var(--color-chart-6)" horizontal height={200} />
              )}
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="transactions">
          <TabsList>
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
            <TabsTrigger value="failures">Failed queue ({data.payments.length ? data.failures.length : "unavailable"})</TabsTrigger>
            <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
            <TabsTrigger value="reconciliation">Reconciliation (unavailable)</TabsTrigger>
          </TabsList>

          <TabsContent value="transactions">
            <Card><CardContent className="p-0">
              <PaymentTable
                rows={data.payments.slice(0, 60).map((p) => ({
                  id: p.id, date: p.occurredAt, businessId: p.businessId, businessName: p.businessName,
                  amount: formatMoney(p.amountMinor, p.currency), status: p.status,
                  providerRef: p.providerRef, reconciled: p.reconciled,
                }))}
              />
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="failures">
            <Card><CardContent className="p-0">
              <PaymentTable
                rows={data.failures.slice(0, 40).map((p) => ({
                  id: p.id, date: p.occurredAt, businessId: p.businessId, businessName: p.businessName,
                  amount: formatMoney(p.amountMinor, p.currency), status: p.status,
                  providerRef: p.failureCode || p.failureReason ? [p.failureCode, p.failureReason].filter(Boolean).join(" - ") : p.providerRef, reconciled: p.reconciled,
                }))}
                showReason
              />
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="webhooks">
            <Card><CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead><TableHead>Event</TableHead>
                    <TableHead>Status</TableHead><TableHead>Latency</TableHead><TableHead>Last error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.webhooks.slice(0, 30).map((w) => (
                    <TableRow key={w.id}>
                      <TableCell className="text-xs">{formatDateTime(w.at)}</TableCell>
                      <TableCell><MonoCell>{w.eventType}</MonoCell></TableCell>
                      <TableCell><StatusChip status={w.status} /></TableCell>
                      <TableCell className="text-xs tabular-nums">{w.latencyMs} ms</TableCell>
                      <TableCell className="text-xs text-danger">{w.lastError ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                  {data.webhooks.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="py-6 text-center text-xs text-muted-foreground">Payment-provider webhook monitoring is not connected.</TableCell></TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="reconciliation">
            <Card><CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Detected</TableHead><TableHead>Kind</TableHead>
                    <TableHead>Provider ref</TableHead><TableHead>Expected</TableHead>
                    <TableHead>Actual</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.reconciliation.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs">{formatDateTime(r.detectedAt)}</TableCell>
                      <TableCell><MonoCell>{r.kind}</MonoCell></TableCell>
                      <TableCell><MonoCell>{r.providerRef}</MonoCell></TableCell>
                      <TableCell className="tabular-nums text-xs">{r.expectedMinor != null ? formatMoney(r.expectedMinor, r.currency) : "—"}</TableCell>
                      <TableCell className="tabular-nums text-xs">{r.actualMinor != null ? formatMoney(r.actualMinor, r.currency) : "—"}</TableCell>
                    </TableRow>
                  ))}
                  {data.reconciliation.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="py-6 text-center text-xs text-muted-foreground">Reconciliation is unavailable until payment-provider records and bank settlement data are connected.</TableCell></TableRow>
                  ) : null}
                </TableBody>
              </Table>
              <p className="border-t border-border p-3 text-[11px] text-muted-foreground">
                Mismatches open review tasks only — the admin platform never mutates financial truth (FR-405).
              </p>
            </CardContent></Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}