import { MetadataForm } from "@/components/domain/metadata-form";
import type { Metadata } from "next";
import { can, getSession } from "@/lib/auth/session";
import { getDataProvider } from "@/lib/data";
import { PageHeader } from "@/components/layout/page-header";
import { Unauthorized } from "@/components/states";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, MonoCell } from "@/components/ui/table";
import { StatusChip } from "@/components/ui/badge";
import { formatBytes } from "@/lib/utils/format-extra";

export const metadata: Metadata = { title: "AI Data" };
export const dynamic = "force-dynamic";

export default async function AiDataPage() {
  const session = await getSession();
  if (!can(session, "ai_data.read")) return <Unauthorized permission="ai_data.read" />;

  const provider = getDataProvider();
  const data = await provider.getAiData();

  return (
    <>
      <PageHeader
        actions={can(session, "ai_data.manage") ? <MetadataForm title="Register dataset metadata" description="Register an existing synthetic or licensed dataset. This saves metadata only; upload, training and deletion are unavailable." endpoint="/api/v1/datasets" fields={[{key:"name",label:"Dataset name",minLength:3,maxLength:160},{key:"slug",label:"Unique slug",pattern:"[a-z0-9][a-z0-9-]{2,79}"},{key:"domain",label:"Domain",options:["vision","intelligence","sales","angel"].map(value=>({value,label:value}))},{key:"basis",label:"Synthetic data or licensing basis",minLength:8,maxLength:2000},{key:"retention",label:"Retention policy",minLength:8,maxLength:2000},{key:"checksum",label:"SHA-256 checksum",pattern:"[a-f0-9]{64}"},{key:"rows",label:"Row count",type:"number"},{key:"bytes",label:"Size in bytes",type:"number"}]} /> : undefined}
        title="AI Data"
        description="Governed registries for future TREXVEN Intelligence and Vision training. Customer business data never becomes training data without an explicit, documented consent basis (FR-906)."
      />
      <div className="space-y-5">
        <Card>
          <CardHeader><CardTitle>Dataset registry</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dataset</TableHead><TableHead>Domain</TableHead><TableHead>Sensitivity</TableHead>
                  <TableHead>Consent basis</TableHead><TableHead>Customer data</TableHead>
                  <TableHead>Quality</TableHead><TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.datasets.map((d) => {
                  const latest = d.versions[d.versions.length - 1];
                  return (
                    <TableRow key={d.id}>
                      <TableCell>
                        <p className="text-sm font-medium">{d.name}</p>
                        <MonoCell>{d.slug}</MonoCell>
                      </TableCell>
                      <TableCell className="text-xs">{d.domain}</TableCell>
                      <TableCell className="text-xs">{d.sensitivity}</TableCell>
                      <TableCell><MonoCell>{d.consentBasis}</MonoCell></TableCell>
                      <TableCell className="text-xs">{d.includesCustomerData === null ? "Unavailable" : d.includesCustomerData ? "yes — restricted" : "no"}</TableCell>
                      <TableCell className="text-xs">
                        {latest ? <StatusChip status={latest.quality === "passed" ? "ok" : latest.quality === "failed" ? "failed" : "unknown"} /> : "—"}
                        {latest ? <span className="ml-1.5">{d.versions.length} v{d.versions.length}</span> : null}
                      </TableCell>
                      <TableCell><StatusChip status={d.status} /></TableCell>
                    </TableRow>
                  );
                })}
                {data.datasets.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="py-8 text-center text-xs text-muted-foreground">No datasets registered yet.</TableCell></TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Model registry</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {data.models.map((m) => (
                <div key={m.id} className="flex items-center justify-between rounded-md border border-border p-2.5">
                  <div>
                    <p className="font-medium">{m.name} <span className="font-mono text-xs text-muted-foreground">{m.modelRef}</span></p>
                    <p className="text-xs text-muted-foreground">{m.evaluation ?? "no evaluation recorded"}</p>
                  </div>
                  <StatusChip status={m.status} />
                </div>
              ))}
              {data.models.length === 0 ? <p className="py-4 text-center text-xs text-muted-foreground">No models registered.</p> : null}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Registry scope</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-xs text-muted-foreground">
              <p>· Assets live only in private storage buckets — the database stores metadata and checksums (ADR-007).</p>
              <p>· Dataset deletion and training commands are disabled.</p>
              <p>· Consent/licensing basis is mandatory at dataset creation; synthetic or contractual bases are explicit strings.</p>
              <p>· Retention is documented in metadata; automated purges are not configured.</p>
              <p>· No training jobs are initiated from this platform in Phases 1–5 (docs/15 Phase 5 scope).</p>
              <p className="pt-1 text-[11px]">Latest dataset sizes: {data.datasets.map((d) => d.versions[d.versions.length - 1]).filter(Boolean).map((v) => formatBytes(v!.sizeBytes)).join(" · ") || "—"}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
