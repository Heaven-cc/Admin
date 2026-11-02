/** Data transfer contracts (docs/11) — revenue, payments, product analytics. */
import type { CountryCode, Freshness, Iso, MetricCard, PlanKey, RecentEvent, SeriesPoint } from "./types-core";
import type { SyncHealth } from "./types-ops";

export interface DashboardSummary {
  gmvByCurrency?: { name: string; color: string; points: SeriesPoint[] }[];
  metrics: MetricCard[];
  series: { mrr: SeriesPoint[]; registrations: SeriesPoint[]; gmv: SeriesPoint[] };
  recentEvents: RecentEvent[];
  sync: SyncHealth;
 
}

export interface SubscriptionAnalytics {
  kpis: MetricCard[]; mrrTrend: SeriesPoint[];
  planMix: { plan: PlanKey; count: number }[];
  countrySplit: { country: CountryCode; active: number; mrrMinor: number | null; currency: string }[];
  renewals: { businessId: string; name: string; plan: PlanKey | null; amountMinor: number | null; currency: string; date: Iso }[];
  cancellations: { businessId: string; name: string; at: Iso; reason: string | null }[];
 
}

export interface PaymentRecord {
  id: string; businessId: string; businessName: string; provider: string; providerRef: string;
  amountMinor: number; currency: string; status: "success" | "failed" | "pending";
  failureCode?: string | null; failureReason?: string | null; occurredAt: Iso; reconciled: boolean | null;
}
export interface WebhookEvent {
  id: string; provider: string; eventType: string;
  status: "delivered" | "failed" | "retrying"; latencyMs: number; at: Iso; lastError?: string | null;
}
export interface ReconciliationItem {
  id: string; kind: "missing_payment" | "amount_mismatch" | "duplicate"; providerRef: string;
  expectedMinor?: number; actualMinor?: number; currency: string; businessId: string; detectedAt: Iso;
}
export interface PaymentsData {
  payments: PaymentRecord[]; failures: PaymentRecord[]; webhooks: WebhookEvent[];
  reconciliation: ReconciliationItem[]; successRate: number | null; refundedMinor: number | null; currency: string;
  trend: SeriesPoint[]; failuresByReason: { reason: string; count: number }[];
}

export interface FunnelStep { label: string; count: number; event: string }
export interface RetentionCohort { cohort: string; size: number; d1: number; d7: number; d30: number | null }
export interface AnalyticsData {
  funnel: FunnelStep[]; retention: RetentionCohort[];
  adoption: { feature: string; surface: "owner" | "pos"; adoptionPct: number }[];
  distribution: { platform: string; share: number }[];
  versions: { version: string; platform: string; share: number }[];
  geo: { country: CountryCode; businesses: number }[];
  conversion: FunnelStep[]; sessionsTrend: SeriesPoint[];
  freshness: Freshness;
}
