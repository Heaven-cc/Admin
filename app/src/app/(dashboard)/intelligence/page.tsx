import type { Metadata } from "next";
import { can, getSession } from "@/lib/auth/session";
import { getDataProvider } from "@/lib/data";
import { PageHeader } from "@/components/layout/page-header";
import { CapabilityBanner } from "@/components/domain/capability-banner";
import { Unauthorized, NotInstrumented } from "@/components/states";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, MonoCell } from "@/components/ui/table";
import { StatusChip } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Intelligence" };
export const dynamic = "force-dynamic";

export default async function IntelligencePage() {
  const session = await getSession();
  if (!can(session, "intelligence.read")) return <Unauthorized permission="intelligence.read" />;

  const provider = getDataProvider();
  const data = await provider.getIntelligenceMetrics();
  const k = data.kpis;

  return (
    <>
      <PageHeader
        title="Intelligence"
        description="Insight generation, anomaly detection, and the Vision → Intelligence data flow."
      />
      <CapabilityBanner capability={data.capability} />
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: "Jobs (24h)", value: k.jobs24h },
            { label: "Failed jobs (24h)", value: k.failedJobs24h },
            { label: "Insights generated", value: k.insightsGenerated },
            { label: "Data freshness", value: k.dataFreshnessMinutes != null ? `${k.dataFreshnessMinutes} min` : null },
          ].map((s) => (
            <Card key={s.label}><CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="mt-1 text-xl font-semibold tabular-nums">{s.value ?? "—"}</p>
            </CardContent></Card>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader><CardTitle>Vision → Intelligence flow</CardTitle></CardHeader>
            <CardContent><StatusChip status={data.visionFlowHealth} /></CardContent>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle>Model versions & evaluations</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {data.models.map((m) => (
                <div key={m.name + m.version} className="flex items-center justify-between rounded-md border border-border p-2.5">
                  <div>
                    <p className="font-medium">{m.name} <span className="font-mono text-xs text-muted-foreground">{m.version}</span></p>
                    <p className="text-xs text-muted-foreground">{m.evaluation ?? "no evaluation recorded"}</p>
                  </div>
                  <StatusChip status={m.status} />
                </div>
              ))}
              {data.models.length === 0 ? <p className="py-4 text-center text-xs text-muted-foreground">No models registered yet.</p> : null}
            </CardContent>
          </Card>
        </div>

        {data.jobs.length > 0 ? (
          <Card>
            <CardHeader><CardTitle>Recent job runs</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead><TableHead>Type</TableHead><TableHead>Scope</TableHead>
                    <TableHead>Status</TableHead><TableHead>Duration</TableHead><TableHead>Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.jobs.map((j) => (
                    <TableRow key={j.id}>
                      <TableCell className="text-xs">{formatDateTime(j.at)}</TableCell>
                      <TableCell><MonoCell>{j.type}</MonoCell></TableCell>
                      <TableCell className="text-xs">{j.scope}</TableCell>
                      <TableCell><StatusChip status={j.status} /></TableCell>
                      <TableCell className="text-xs tabular-nums">{(j.durationMs / 1000).toFixed(1)}s</TableCell>
                      <TableCell className="text-xs text-danger">{j.error ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent></Card>
        ) : (
          <NotInstrumented
            requiredEvents={["intelligence.job.batch.v1", "ai.usage.daily.v1"]}
            note="Intelligence jobs will appear here once the service emits job telemetry through the bridge."
          />
        )}
      </div>
    </>
  );
}
