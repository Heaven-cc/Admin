import type { Metadata } from "next";
import { can, getSession } from "@/lib/auth/session";
import { getDataProvider } from "@/lib/data";
import { PageHeader } from "@/components/layout/page-header";
import { AreaTrend } from "@/components/charts/charts";
import { CapabilityBanner } from "@/components/domain/capability-banner";
import { Unauthorized } from "@/components/states";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, MonoCell } from "@/components/ui/table";
import { StatusChip } from "@/components/ui/badge";
import { ShieldOff } from "lucide-react";
import { formatNumber, formatRelative } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Vision" };
export const dynamic = "force-dynamic";

export default async function VisionPage() {
  const session = await getSession();
  if (!can(session, "vision.read")) return <Unauthorized permission="vision.read" />;

  const provider = getDataProvider();
  const data = await provider.getVisionOverview();
  const k = data.kpis;

  return (
    <>
      <PageHeader
        title="Vision"
        description="Multi-camera fleet health and processing telemetry — operational metadata only."
      />
      <CapabilityBanner capability={data.capability} />
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
          {[
            { label: "Registered cameras", value: formatNumber(k.registered) },
            { label: "Connected", value: formatNumber(k.connected) },
            { label: "Disconnected", value: formatNumber(k.disconnected) },
            { label: "Vision businesses", value: formatNumber(k.businesses) },
            { label: "Processing latency p95", value: k.latencyP95Ms != null ? `${k.latencyP95Ms} ms` : "—" },
            { label: "Storage (aggregate)", value: k.storageBytes != null ? `${(k.storageBytes / 1024 ** 4).toFixed(1)} TB` : "—" },
          ].map((s) => (
            <Card key={s.label}><CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="mt-1 text-xl font-semibold tabular-nums">{s.value}</p>
            </CardContent></Card>
          ))}
        </div>

        <div className="rounded-md border border-border bg-surface-muted p-3">
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldOff aria-hidden className="h-4 w-4 shrink-0 text-danger" />
            <span>
              <strong className="text-foreground">No customer camera media is accessible from this platform.</strong>{" "}
              Footage, recordings, and live streams never sync (E3 classification, docs/02 §3). Exceptional access is
              disabled by default and requires documented legal authorization.
            </span>
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Processing latency p95 (ms)</CardTitle></CardHeader>
            <CardContent><AreaTrend data={data.latencyTrend} color="var(--color-chart-3)" label="latency p95 (ms)" height={200} /></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Event throughput (events/day)</CardTitle></CardHeader>
            <CardContent><AreaTrend data={data.throughputTrend} color="var(--color-chart-1)" label="events" height={200} /></CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader><CardTitle>Pipeline status</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="flex justify-between"><span className="text-muted-foreground">Vision server</span><StatusChip status={data.pipeline.serverStatus} /></p>
              <p className="flex justify-between"><span className="text-muted-foreground">Recording pipeline</span><StatusChip status={data.pipeline.recordingPipeline} /></p>
              <p className="flex justify-between"><span className="text-muted-foreground">Detection failures (24h)</span><span className="tabular-nums">{data.pipeline.detectionFailures24h ?? "—"}</span></p>
            </CardContent>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle>Camera fleet</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Business</TableHead><TableHead>Camera</TableHead>
                    <TableHead>Status</TableHead><TableHead>Last heartbeat</TableHead><TableHead>Model</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.cameras.slice(0, 14).map((c) => (
                    <TableRow key={c.cameraId}>
                      <TableCell><a href={`/businesses/${c.businessId}`} className="hover:text-brand hover:underline">{c.businessName}</a></TableCell>
                      <TableCell>{c.label} <MonoCell>{c.cameraId}</MonoCell></TableCell>
                      <TableCell><StatusChip status={c.status} /></TableCell>
                      <TableCell className="text-xs">{formatRelative(c.lastHeartbeatAt)}</TableCell>
                      <TableCell className="text-xs">{c.modelVersion}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
