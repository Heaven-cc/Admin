import type { Metadata } from "next";
import { can, getSession } from "@/lib/auth/session";
import { getDataProvider } from "@/lib/data";
import { PageHeader } from "@/components/layout/page-header";
import { AreaTrend, MultiLine } from "@/components/charts/charts";
import { Bars } from "@/components/charts/charts-bars";
import { CapabilityBanner } from "@/components/domain/capability-banner";
import { Unauthorized } from "@/components/states";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KeyRound } from "lucide-react";
import { formatMoney, formatNumber } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Angel" };
export const dynamic = "force-dynamic";

export default async function AngelPage() {
  const session = await getSession();
  if (!can(session, "angel.read")) return <Unauthorized permission="angel.read" />;

  const provider = getDataProvider();
  const data = await provider.getAngelMetrics();
  const k = data.kpis;

  return (
    <>
      <PageHeader
        title="Angel"
        description="AI assistant service monitoring — usage, latency, token consumption, and estimated provider cost. Credentials stay server-side and are never displayed."
      />
      <CapabilityBanner capability={data.capability} />
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: "Requests (24h)", value: k.requests24h != null ? formatNumber(k.requests24h) : null },
            { label: "Error rate", value: k.errorRatePct != null ? `${k.errorRatePct.toFixed(1)}%` : null },
            { label: "Latency p95", value: k.latencyP95Ms != null ? `${formatNumber(k.latencyP95Ms)} ms` : null },
            { label: "Uptime", value: k.uptimePct != null ? `${k.uptimePct.toFixed(2)}%` : null },
            { label: "Tokens in (24h)", value: k.tokensIn != null ? formatNumber(k.tokensIn, true) : null },
            { label: "Tokens out (24h)", value: k.tokensOut != null ? formatNumber(k.tokensOut, true) : null },
            { label: "Est. cost (24h)", value: k.estimatedCostMinor != null ? formatMoney(k.estimatedCostMinor, k.costCurrency, true) : null },
            { label: "Rate-limit events", value: k.rateLimitEvents != null ? formatNumber(k.rateLimitEvents) : null },
          ].map((s) => (
            <Card key={s.label}><CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="mt-1 text-xl font-semibold tabular-nums">{s.value ?? "—"}</p>
            </CardContent></Card>
          ))}
        </div>

        {data.persistedActivity ? <Card><CardHeader><CardTitle>Persisted conversation activity (24h)</CardTitle></CardHeader><CardContent className="text-sm"><p>{formatNumber(data.persistedActivity.messages24h)} saved messages / {formatNumber(data.persistedActivity.conversations24h)} conversations</p><p className="mt-2 text-xs text-muted-foreground">This counts saved records. Request success, token use, latency and provider costs remain unavailable.</p></CardContent></Card> : null}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Request volume</CardTitle></CardHeader>
            <CardContent><AreaTrend data={data.requestTrend} color="var(--color-chart-5)" label="requests" height={200} /></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Latency percentile bands (ms)</CardTitle></CardHeader>
            <CardContent>
              <MultiLine
                series={[
                  { name: "p50", color: "var(--color-chart-2)", points: data.latencyBands.p50 },
                  { name: "p95", color: "var(--color-chart-3)", points: data.latencyBands.p95 },
                  { name: "p99", color: "var(--color-chart-6)", points: data.latencyBands.p99 },
                ]}
                height={200}
              />
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Estimated cost by provider</CardTitle></CardHeader>
            <CardContent>
              <Bars data={data.costByProvider.map((c) => ({ name: c.provider, value: c.costMinor }))} color="var(--color-chart-4)" horizontal height={160} />
              <p className="mt-2 text-[11px] text-muted-foreground">Estimated from token usage — actual invoicing may differ.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Model & provider configuration</CardTitle></CardHeader>
            <CardContent className="text-sm">
              {data.config ? (
                <div className="space-y-1.5">
                  <p className="flex justify-between"><span className="text-muted-foreground">Model</span><span>{data.config.model} <span className="text-xs text-muted-foreground">({data.config.version})</span></span></p>
                  <p className="flex justify-between"><span className="text-muted-foreground">Provider</span><span>{data.config.provider}</span></p>
                  <p className="flex justify-between"><span className="text-muted-foreground">Rate limits</span><span className="text-xs">{data.config.rateLimits}</span></p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Model and provider configuration is not available to this monitoring integration.</p>
              )}
              <p className="mt-3 flex items-center gap-1.5 rounded-md bg-surface-muted p-2.5 text-xs text-muted-foreground">
                <KeyRound aria-hidden className="h-3.5 w-3.5 shrink-0" />
                API keys live only in server-side secret stores — never in this dashboard, never in the browser.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
