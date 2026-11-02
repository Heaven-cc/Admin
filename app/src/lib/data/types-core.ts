/**
 * Data transfer contracts (docs/11) — metrics, business, money.
 * Every read carries freshness so the UI renders honest states (docs/01 P-1).
 */
export type Iso = string;

export interface Freshness {
  asAt: Iso | null;
  slaMinutes: number;
  status: "live" | "estimated" | "not_instrumented" | "stale";
}

export type MetricSection = "odt_revenue" | "business" | "gmv" | "services";
export type MetricUnit = "count" | "currency" | "percent" | "ms" | "minutes" | "bytes";

export interface MetricCard {
  key: string; label: string; section: MetricSection;
  value: number | null; unit: MetricUnit; currency?: string;
  previousValue?: number | null; deltaPercent?: number | null;
  freshness: Freshness; href?: string;
  notInstrumented?: { reason: string; requiredEvents: string[] };
}

export interface SeriesPoint { date: string; value: number }
export interface RecentEvent {
  id: string; type: string; label: string;
  severity?: "info" | "warning" | "critical"; at: Iso; href?: string;
}

export type AccountStatus = "active" | "trial" | "suspended" | "cancelled" | "churned" | "deleting";
export type PlanKey = "start" | "core" | "pro";
export type CountryCode = "NG" | "GH" | "TG" | "CI";
export type VisionStatus = "none" | "active" | "suspended" | "unknown";
export const COUNTRIES: Record<CountryCode, { name: string; currency: string }> = {
  NG: { name: "Nigeria", currency: "NGN" },
  GH: { name: "Ghana", currency: "GHS" },
  TG: { name: "Togo", currency: "XOF" },
  CI: { name: "Ivory Coast", currency: "XOF" },
};
export const PLANS: Record<PlanKey, { name: string }> = {
  start: { name: "Start" }, core: { name: "Core" }, pro: { name: "Pro" },
};

export interface BusinessSummary {
  businessId: string; name: string; countryCode: CountryCode | null; registeredAt: Iso | null;
  accountStatus: AccountStatus | "unknown"; planKey: PlanKey | null; subscriptionStatus: string;
  renewsAt: Iso | null; lastActivityAt: Iso | null; visionStatus: VisionStatus;
  cameraCount: number | null; tx30d: number | null; gmv30dMinor: number | null; currency: string;
}

export interface BusinessDetail extends BusinessSummary {
  provider: string; autoRenew: boolean | null; supportOpen: number | null;
  integrationHealth: { source: string; freshnessMinutes: number; status: "ok" | "lagging" | "down" }[];
}

export interface TimelineEntry { id: string; at: Iso; type: string; label: string; detail?: string; actor?: string }
export interface Paged<T> { data: T[]; nextCursor: string | null; total: number }

export type CapabilityStatus = "planned" | "implemented" | "tested" | "deployed" | "unknown";
export interface CapabilityInfo { product: string; status: CapabilityStatus; lastVerifiedAt: Iso | null; note?: string }

export interface CameraRow {
  cameraId: string; businessId: string; businessName: string; label: string;
  status: "online" | "offline" | "disabled"; lastHeartbeatAt: Iso; modelVersion: string;
}

