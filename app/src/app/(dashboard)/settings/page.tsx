import type { Metadata } from "next";
import { can, getSession } from "@/lib/auth/session";
import { getDataProvider } from "@/lib/data";
import { PageHeader } from "@/components/layout/page-header";
import { Unauthorized } from "@/components/states";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusChip } from "@/components/ui/badge";
import { Badge } from "@/components/ui/badge";
import { PricingMatrix } from "@/components/domain/pricing-matrix";
import { formatRelative } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await getSession();
  if (!can(session, "settings.view")) return <Unauthorized permission="settings.view" />;

  const provider = getDataProvider();
  const data = await provider.getSettings();
  const canEditPricing = false;

  return (
    <>
      <PageHeader
        title="Settings"
        description="Platform configuration, country price drafts, capability metadata and connected integrations."
      />
      <div className="space-y-5">
        {can(session,"pricing.read") ? <Card>
          <CardHeader><CardTitle>Country pricing (NG · GH · TG · CI)</CardTitle></CardHeader>
          <CardContent>
            <PricingMatrix pricing={data.pricing} canEdit={canEditPricing} />{can(session,"pricing.read") ? <a href="/settings/pricing" className="mt-3 inline-block text-xs text-brand">View pricing and manage drafts</a> : null}
          </CardContent>
        </Card> : null}

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Capability flags</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {data.capabilities.map((c) => (
                <div key={c.key} className="flex items-center justify-between rounded-md border border-border p-2.5">
                  <div>
                    <p className="font-medium">{c.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {c.product} · {c.lastVerifiedAt ? `verified ${formatRelative(c.lastVerifiedAt)}` : "never verified"}
                    </p>
                  </div>
                  <Badge tone={c.status === "deployed" ? "success" : c.status === "tested" ? "warning" : c.status === "implemented" ? "info" : "neutral"}>
                    {c.status}
                  </Badge>
                </div>
              ))}
              {data.capabilities.length === 0 ? <p className="py-4 text-center text-xs text-muted-foreground">No service capability verification feed is connected.</p> : null}
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Integrations</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {data.integrations.map((i) => (
                  <div key={i.name} className="flex items-center justify-between rounded-md border border-border p-2.5">
                    <div>
                      <p className="font-medium">{i.name}</p>
                      <p className="text-[11px] text-muted-foreground">{i.detail}</p>
                    </div>
                    <StatusChip status={i.status} />
                  </div>
                ))}
                <p className="text-[11px] text-muted-foreground">Secrets are never displayed — metadata only (FR-994).</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Notification routing</CardTitle></CardHeader>
              <CardContent className="space-y-1.5 text-sm text-muted-foreground">
                <p className="flex justify-between"><span>Critical errors (S1/S2)</span><span className="text-foreground">Email and Slack not configured</span></p>
                <p className="flex justify-between"><span>Sync failures</span><span className="text-foreground">In-app: authorized technical staff</span></p>
                <p className="flex justify-between"><span>Payment anomalies</span><span className="text-foreground">External anomaly detection unavailable</span></p>
                <p className="flex justify-between"><span>Pending approvals</span><span className="text-foreground">Command processing disabled</span></p>
                <p className="mt-2 text-[11px]">In-app incident and sync notifications are scoped by role. External notification channels are not connected.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
