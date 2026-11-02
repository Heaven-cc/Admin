import type { Metadata } from "next";
import { Download } from "lucide-react";
import { can, getSession } from "@/lib/auth/session";
import { getDataProvider } from "@/lib/data";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Unauthorized } from "@/components/states";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, MonoCell } from "@/components/ui/table";
import { formatDateTime } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Audit Logs" };
export const dynamic = "force-dynamic";

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; resourceType?: string }>;
}) {
  const session = await getSession();
  if (!can(session, "audit.read")) return <Unauthorized permission="audit.read" />;

  const sp = await searchParams;
  const provider = getDataProvider();
  const { entries, total } = await provider.getAudit(sp);
  const canExport = can(session, "audit.export");
  const exportQuery = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]).toString();

  return (
    <>
      <PageHeader
        title="Audit Logs"
        description={`${total} entries. Append-only and immutable — even Super Admins cannot edit or delete records (docs/09 §7).`}
        actions={
          canExport ? (
            <a className={buttonVariants({ variant: "outline" })} href={`/api/v1/audit/export?${exportQuery}`} download>
              <Download aria-hidden /> Export CSV
            </a>
          ) : null
        }
      />
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead><TableHead>Actor</TableHead><TableHead>Action</TableHead>
              <TableHead>Resource</TableHead><TableHead>Request ID</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="text-xs">{formatDateTime(e.occurredAt)}</TableCell>
                <TableCell>
                  <p className="text-xs font-medium">{e.actorName}</p>
                  <p className="text-[10px] text-muted-foreground">{e.actorRole}</p>
                </TableCell>
                <TableCell><MonoCell>{e.action}</MonoCell></TableCell>
                <TableCell className="text-xs">
                  {e.resourceType} <MonoCell>{e.resourceId}</MonoCell>
                </TableCell>
                <TableCell><MonoCell>{e.requestId}</MonoCell></TableCell>
              </TableRow>
            ))}
            {entries.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="py-8 text-center text-xs text-muted-foreground">No audit entries match.</TableCell></TableRow>
            ) : null}
          </TableBody>
        </Table>
      </CardContent></Card>
    </>
  );
}
