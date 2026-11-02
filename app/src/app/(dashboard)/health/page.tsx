import { SyncButton } from "./sync-button";
import type { Metadata } from "next";
import { can, getSession } from "@/lib/auth/session";
import { getDataProvider } from "@/lib/data";
import { PageHeader } from "@/components/layout/page-header";
import { Unauthorized } from "@/components/states";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, MonoCell } from "@/components/ui/table";
import { StatusChip } from "@/components/ui/badge";
import { DeadLetterActions } from "./dlq-actions";
import { formatNumber, formatRelative } from "@/lib/utils/format";

export const metadata: Metadata = { title: "System Health" };
export const dynamic = "force-dynamic";

export default async function HealthPage() {
  const session = await getSession();
  if (!can(session, "health.read")) return <Unauthorized permission="health.read" />;

  const provider = getDataProvider();
  const data = await provider.getHealth();
  const canManageSync = can(session, "health.manage_sync");

  return (
    <>
      <PageHeader
        actions={canManageSync ? <SyncButton /> : undefined}
        title="System Health"
        description="Centralized observability: services, error groups, and the sync pipeline that feeds this platform."
      />
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {data.services.map((s) => (
            <Card key={s.name}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-medium">{s.name}</p>
                  <StatusChip status={s.status} />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {s.latencyMs != null ? `${s.latencyMs} ms · ` : ""}
                  {s.lastCheckAt ? `checked ${formatRelative(s.lastCheckAt)}` : "awaiting probe"}
                  {s.uptime24hPct != null ? ` · ${s.uptime24hPct.toFixed(1)}% uptime` : ""}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader><CardTitle>Reported application errors</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Severity</TableHead><TableHead>Service</TableHead><TableHead>Error</TableHead>
                  <TableHead>Count</TableHead><TableHead>Last seen</TableHead><TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.errors.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell><StatusChip status={e.severity === "unknown" ? "unknown" : e.severity === "S1" || e.severity === "S2" ? "open" : "degraded"} /> <MonoCell>{e.severity}</MonoCell></TableCell>
                    <TableCell className="text-xs">{e.service}</TableCell>
                    <TableCell>
                      <p className="text-xs font-medium">{e.type}</p>
                      <p className="line-clamp-1 text-[11px] text-muted-foreground">{e.message}</p>
                    </TableCell>
                    <TableCell className="tabular-nums text-xs">{formatNumber(e.occurrences)}</TableCell>
                    <TableCell className="text-xs">{formatRelative(e.lastSeenAt)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <StatusChip status={e.status} />
                        {e.sentryUrl ? (
                          <a href={e.sentryUrl} target="_blank" rel="noreferrer" className="text-[10px] text-brand underline">Sentry</a>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {data.errors.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="py-6 text-center text-xs text-muted-foreground">No error aggregates are available for this reporting source. Detailed crash monitoring is not connected.</TableCell></TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Sync jobs</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job</TableHead><TableHead>Schedule</TableHead>
                    <TableHead>Last run</TableHead><TableHead>Consecutive failures</TableHead><TableHead>State</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.syncJobs.map((j) => (
                    <TableRow key={j.jobKey}>
                      <TableCell><MonoCell>{j.jobKey}</MonoCell></TableCell>
                      <TableCell className="text-xs">{j.schedule}</TableCell>
                      <TableCell className="text-xs">{j.lastRunAt ? formatRelative(j.lastRunAt) : "never"}</TableCell>
                      <TableCell className="tabular-nums text-xs">{j.failures24h}</TableCell>
                      <TableCell><StatusChip status={j.status === "failed" ? "failed" : j.status === "running" ? "running" : "idle"} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p className="border-t border-border p-3 text-[11px] text-muted-foreground">
                Sync lag: <strong className="text-foreground">{data.syncLagMinutes != null ? `${data.syncLagMinutes} min` : "unknown"}</strong> · SLA 15 min for operational events (NFR-07).
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Dead-letter queue</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event</TableHead><TableHead>Failures</TableHead>
                    <TableHead>Last error</TableHead><TableHead>Status</TableHead>
                    {canManageSync ? <TableHead>Actions</TableHead> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.deadLetters.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell><MonoCell>{d.eventType}</MonoCell></TableCell>
                      <TableCell className="tabular-nums text-xs">{d.failureCount}</TableCell>
                      <TableCell className="line-clamp-1 max-w-[220px] text-xs text-danger">{d.lastError}</TableCell>
                      <TableCell><StatusChip status={d.status} /></TableCell>
                      {canManageSync ? (
                        <TableCell><DeadLetterActions id={d.id} status={d.status} /></TableCell>
                      ) : null}
                    </TableRow>
                  ))}
                  {data.deadLetters.length === 0 ? (
                    <TableRow><TableCell colSpan={canManageSync ? 5 : 4} className="py-6 text-center text-xs text-muted-foreground">This snapshot pipeline uses checkpoint retries; an event dead-letter queue is not connected.</TableCell></TableRow>
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