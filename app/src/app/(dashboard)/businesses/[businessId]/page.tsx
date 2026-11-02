import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { can, getSession } from "@/lib/auth/session";
import { getDataProvider } from "@/lib/data";
import { PageHeader } from "@/components/layout/page-header";
import { Unauthorized } from "@/components/states";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusChip } from "@/components/ui/badge";
import { MonoCell } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatMoney, formatDate, formatRelative } from "@/lib/utils/format";
import { COUNTRIES, PLANS } from "@/lib/data/types";
import { BusinessActions } from "@/components/domain/business-actions";
import { Timeline } from "@/components/domain/timeline";

export const metadata: Metadata = { title: "Business profile" };
export const dynamic = "force-dynamic";

const TABS = ["overview", "subscription", "payments", "pos", "vision", "support", "timeline", "actions"] as const;

export default async function BusinessDetailPage({
  params, searchParams,
}: {
  params: Promise<{ businessId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await getSession();
  if (!can(session, "businesses.read")) return <Unauthorized permission="businesses.read" />;

  const { businessId } = await params;
  const { tab = "overview" } = await searchParams;
  const activeTab = (TABS as readonly string[]).includes(tab) ? tab : "overview";
  const provider = getDataProvider();
  const business = await provider.getBusiness(businessId);
  if (!business) notFound();

  const payments = can(session, "payments.read") ? (await provider.getPayments()).payments.filter((p) => p.businessId === businessId).slice(0, 12) : [];
  const timeline = await provider.getBusinessTimeline(businessId);

  return (
    <>
      <PageHeader
        title={business.name}
        breadcrumbs={[{ href: "/businesses", label: "Businesses" }]}
        description={`${(business.countryCode ? COUNTRIES[business.countryCode]?.name : null) ?? "Unknown country"} · registered ${formatDate(business.registeredAt)}`}
        meta={<div className="mt-2 flex flex-wrap items-center gap-2"><MonoCell>{business.businessId}</MonoCell><StatusChip status={business.accountStatus} /><StatusChip status={business.subscriptionStatus} /></div>}
      />

      <Tabs value={activeTab} className="space-y-4">
        <TabsList className="flex-wrap">
          {TABS.map((t) => (
            <TabsTrigger key={t} value={t} asChild>
              <Link href={`/businesses/${businessId}?tab=${t}`} className="capitalize">{t}</Link>
            </TabsTrigger>
          ))}
        </TabsList>

        {activeTab === "overview" && (
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Subscription</CardTitle></CardHeader>
              <CardContent className="space-y-1.5 text-sm">
                <p className="flex justify-between"><span className="text-muted-foreground">Plan</span><span>{(business.planKey ? PLANS[business.planKey]?.name : null) ?? "Unconfigured"}</span></p>
                <p className="flex justify-between"><span className="text-muted-foreground">Status</span><StatusChip status={business.subscriptionStatus} /></p>
                <p className="flex justify-between"><span className="text-muted-foreground">Renews</span><span>{business.renewsAt ? formatRelative(business.renewsAt) : "—"}</span></p>
                <p className="flex justify-between"><span className="text-muted-foreground">Provider</span><span>{business.provider}</span></p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>POS usage (30 days)</CardTitle></CardHeader>
              <CardContent className="space-y-1.5 text-sm">
                <p className="flex justify-between"><span className="text-muted-foreground">Transactions</span><span className="tabular-nums">{business.tx30d?.toLocaleString("en") ?? "Unavailable"}</span></p>
                <p className="flex justify-between"><span className="text-muted-foreground">Recorded sales</span><span className="tabular-nums">{formatMoney(business.gmv30dMinor, business.currency)}</span></p>
                <p className="mt-2 text-[11px] text-muted-foreground">E0/E1 aggregates only — no customer-level data.</p>
              </CardContent>
            </Card>
            <Card className="md:col-span-2">
              <CardHeader><CardTitle>Integration health</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {business.integrationHealth.map((h) => (
                  <p key={h.source} className="flex items-center justify-between">
                    <span className="text-muted-foreground">{h.source}</span>
                    <span className="flex items-center gap-2">
                      <StatusChip status={h.status} />
                      <span className="text-xs">{h.freshnessMinutes} min ago</span>
                    </span>
                  </p>
                ))}
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "subscription" && (
          <Card>
            <CardHeader><CardTitle>Subscription detail</CardTitle></CardHeader>
            <CardContent className="space-y-1.5 text-sm">
              <p className="flex justify-between"><span className="text-muted-foreground">Plan</span><span>{business.planKey ? PLANS[business.planKey].name : "Unconfigured"}</span></p>
              <p className="flex justify-between"><span className="text-muted-foreground">Auto-renew</span><span>{business.autoRenew == null ? "Unavailable" : business.autoRenew ? "On" : "Off"}</span></p>
              <p className="flex justify-between"><span className="text-muted-foreground">Renewal date</span><span>{business.renewsAt ? formatDate(business.renewsAt) : "—"}</span></p>
              <p className="mt-3 rounded-md bg-surface-muted p-2.5 text-xs text-muted-foreground">
                Authorized plan adjustments are executed as commands (Phase 4) — see docs/15.
              </p>
            </CardContent>
          </Card>
        )}

        {activeTab === "payments" && (
          <Card>
            <CardHeader><CardTitle>Payments (recent)</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {payments.length === 0 ? (
                <p className="py-6 text-center text-xs text-muted-foreground">No payments synced for this business.</p>
              ) : (
                payments.map((p) => (
                  <p key={p.id} className="flex items-center justify-between border-b border-border/60 pb-2 last:border-0">
                    <span className="text-xs">{formatDate(p.occurredAt)}</span>
                    <span className="tabular-nums">{formatMoney(p.amountMinor, p.currency)}</span>
                    <StatusChip status={p.status} />
                    <MonoCell>{p.providerRef}</MonoCell>
                  </p>
                ))
              )}
              <p className="pt-1 text-[11px] text-muted-foreground">Card data never syncs — amounts, currency, and provider refs only (E2).</p>
            </CardContent>
          </Card>
        )}

        {activeTab === "pos" && (
          <Card>
            <CardHeader><CardTitle>POS usage</CardTitle></CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <p>Transactions (30d): <strong className="text-foreground">{business.tx30d?.toLocaleString("en") ?? "Unavailable"}</strong></p>
              <p className="mt-1">Recorded sales (30d): <strong className="text-foreground">{formatMoney(business.gmv30dMinor, business.currency)}</strong></p>
              <p className="mt-3 text-xs">Device heartbeats are not instrumented yet — active-device counts appear once POS apps emit <code className="font-mono">device.heartbeat</code> (docs/10 §8).</p>
            </CardContent>
          </Card>
        )}

        {activeTab === "vision" && (
          <Card>
            <CardHeader><CardTitle>Vision</CardTitle></CardHeader>
            <CardContent className="text-sm">
              {business.visionStatus === "active" ? (
                <>
                  <p className="flex justify-between"><span className="text-muted-foreground">Activation</span><StatusChip status="active" /></p>
                  <p className="mt-1.5 flex justify-between"><span className="text-muted-foreground">Cameras</span><span>{business.cameraCount}</span></p>
                  <p className="mt-3 rounded-md bg-surface-muted p-2.5 text-xs text-muted-foreground">
                    Media is never accessible from the Admin Platform — camera metadata and heartbeats only (docs/04 §4.7).
                  </p>
                </>
              ) : (
                <p className="text-muted-foreground">Vision is not active for this business.</p>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === "support" && (
          <Card>
            <CardHeader><CardTitle>Support history</CardTitle></CardHeader>
            <CardContent className="text-sm">
              <p className="flex justify-between"><span className="text-muted-foreground">Open cases</span><span>{business.supportOpen ?? "Unavailable"}</span></p>
              <p className="mt-3 text-xs text-muted-foreground">Support cases sync with the operations module (Phase 3).</p>
            </CardContent>
          </Card>
        )}

        {activeTab === "timeline" && (
          <Card>
            <CardHeader><CardTitle>Activity timeline</CardTitle></CardHeader>
            <CardContent><Timeline entries={timeline} /></CardContent>
          </Card>
        )}

        {activeTab === "actions" && (
          <Card>
            <CardHeader><CardTitle>Account actions</CardTitle></CardHeader>
            <CardContent>
              <BusinessActions
                businessId={business.businessId}
                businessName={business.name}
                accountStatus={business.accountStatus}
                canSuspend={can(session, "businesses.suspend")}
                canRestore={can(session, "businesses.restore")}
                canDelete={session?.role === "super_admin" && can(session, "businesses.delete")}
                backendReady={process.env.ADMIN_BUSINESS_CONTROLS_ENABLED === "true"}
              />
            </CardContent>
          </Card>
        )}
      </Tabs>
    </>
  );
}
