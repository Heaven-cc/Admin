import type { Metadata } from "next";
import { can, getSession } from "@/lib/auth/session";
import { getDataProvider } from "@/lib/data";
import { PageHeader } from "@/components/layout/page-header";
import { Unauthorized } from "@/components/states";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusChip } from "@/components/ui/badge";
import { IncidentCreate } from "./incident-create";
import { formatDateTime } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Incidents" };
export const dynamic = "force-dynamic";

export default async function IncidentsPage() {
  const session = await getSession();
  if (!can(session, "incidents.read")) return <Unauthorized permission="incidents.read" />;

  const provider = getDataProvider();
  const incidents = await provider.listIncidents();

  return (
    <>
      <PageHeader
        title="Incidents"
        description="Operational incidents with linked errors and full timelines."
        actions={<IncidentCreate canManage={can(session, "incidents.manage")} />}
      />
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Reference</TableHead><TableHead>Severity</TableHead><TableHead>Title</TableHead>
              <TableHead>Services</TableHead><TableHead>Status</TableHead><TableHead>Opened</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {incidents.map((i) => (
              <TableRow key={i.id}>
                <TableCell><a href={`/incidents/${i.id}`} className="font-mono text-xs text-brand hover:underline">{i.reference}</a></TableCell>
                <TableCell><StatusChip status={i.severity === "S1" || i.severity === "S2" ? "open" : "degraded"} /> <span className="font-mono text-[10px]">{i.severity}</span></TableCell>
                <TableCell className="text-sm font-medium">{i.title}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{i.services.join(", ") || "—"}</TableCell>
                <TableCell><StatusChip status={i.status} /></TableCell>
                <TableCell className="text-xs">{formatDateTime(i.openedAt)}</TableCell>
              </TableRow>
            ))}
            {incidents.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="py-8 text-center text-xs text-muted-foreground">No incidents — quiet week.</TableCell></TableRow>
            ) : null}
          </TableBody>
        </Table>
      </CardContent></Card>
    </>
  );
}
