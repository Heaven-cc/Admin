import { notFound } from "next/navigation";
import { can, getSession } from "@/lib/auth/session";
import { getDataProvider } from "@/lib/data";
import { PageHeader } from "@/components/layout/page-header";
import { Unauthorized } from "@/components/states";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusChip } from "@/components/ui/badge";
import { Timeline } from "@/components/domain/timeline";
import { IncidentControls } from "./incident-controls";
import { formatDateTime } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function IncidentDetailPage({ params }: { params: Promise<{ incidentId: string }> }) {
  const session = await getSession();
  if (!can(session, "incidents.read")) return <Unauthorized permission="incidents.read" />;

  const { incidentId } = await params;
  const provider = getDataProvider();
  const incident = await provider.getIncident(incidentId);
  if (!incident) notFound();

  return (
    <>
      <PageHeader
        title={`${incident.reference} — ${incident.title}`}
        breadcrumbs={[{ href: "/incidents", label: "Incidents" }]}
        meta={<div className="mt-2 flex flex-wrap items-center gap-2"><StatusChip status={incident.severity === "S1" || incident.severity === "S2" ? "open" : "degraded"} /><span className="font-mono text-[10px]">{incident.severity}</span><StatusChip status={incident.status} /><span className="text-xs text-muted-foreground">opened {formatDateTime(incident.openedAt)}</span></div>}
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Timeline</CardTitle></CardHeader>
          <CardContent>
            <Timeline entries={incident.timeline.map((t) => ({ id: t.id, at: t.at, type: "command", label: t.entry, actor: t.author }))} />
          </CardContent>
        </Card>
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Details</CardTitle></CardHeader>
            <CardContent className="space-y-1.5 text-sm">
              <p className="flex justify-between"><span className="text-muted-foreground">Services</span><span className="text-xs">{incident.services.join(", ") || "—"}</span></p>
              <p className="flex justify-between"><span className="text-muted-foreground">Linked errors</span><span className="text-xs">{incident.linkedErrors.length}</span></p>
              <p className="flex justify-between"><span className="text-muted-foreground">Postmortem</span><span className="text-xs">{incident.postmortemUrl ? <a className="text-brand underline" href={incident.postmortemUrl}>view</a> : "—"}</span></p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Manage</CardTitle></CardHeader>
            <CardContent>
              <IncidentControls incidentId={incident.id} status={incident.status} canManage={can(session, "incidents.manage")} />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
