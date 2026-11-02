/** Data transfer contracts (docs/11) — operations, governance, platform types. */
import type { CapabilityStatus, CountryCode, Iso, PlanKey } from "./types-core";

export interface ServiceStatus {
  name: string; status: "operational" | "degraded" | "down" | "unknown";
  latencyMs: number | null; lastCheckAt: Iso | null; uptime24hPct: number | null;
}
export interface ErrorGroupRow {
  id: string; fingerprint: string; severity: "S1" | "S2" | "S3" | "S4" | "unknown"; service: string;
  environment: string; type: string; message: string; occurrences: number;
  firstSeenAt: Iso | null; lastSeenAt: Iso; affectedVersions: string[];
  status: "open" | "acknowledged" | "resolved" | "unreviewed"; assignee?: string | null; sentryUrl?: string | null;
}
export interface SyncJobRow {
  jobKey: string; schedule: string; lastRunAt: Iso | null; lastSuccessAt: Iso | null;
  lagMinutes: number | null; failures24h: number; status: "idle" | "running" | "failed";
}
export interface DeadLetterRow {
  id: string; eventId: string; eventType: string; firstFailureAt: Iso;
  failureCount: number; lastError: string; status: "retrying" | "quarantined" | "resolved" | "discarded";
}
export interface SyncHealth { lagMinutes: number | null; lastEventAt: Iso | null; status: "healthy" | "lagging" | "down" | "no_data" }
export interface HealthData {
  services: ServiceStatus[]; errors: ErrorGroupRow[]; syncJobs: SyncJobRow[];
  deadLetters: DeadLetterRow[]; syncLagMinutes: number | null;
}

export interface IncidentRow {
  id: string; reference: string; title: string; severity: "S1" | "S2" | "S3" | "S4";
  status: "open" | "investigating" | "mitigated" | "resolved" | "closed";
  services: string[]; openedAt: Iso; resolvedAt: Iso | null;
}
export interface IncidentDetail extends IncidentRow {
  timeline: { id: string; at: Iso; entry: string; author: string }[];
  linkedErrors: string[]; postmortemUrl: string | null;
}

export interface AdminRow {
  id: string; name: string; email: string; role: string;
  status: "invited" | "active" | "suspended" | "deactivated"; mfa: boolean; lastLoginAt: Iso | null;
}
export type CommandStatus =
  | "pending_approval" | "approved" | "rejected" | "dispatching"
  | "executing" | "completed" | "failed" | "cancelled";
export interface CommandRow {
  id: string; commandType: string; targetType: string; targetId: string; targetLabel?: string;
  payload: Record<string, unknown>; status: CommandStatus; requestedByName: string;
  requestedByRole: string; approverName?: string | null; approvalRequired: boolean;
  idempotencyKey: string; result?: Record<string, unknown> | null; error?: string | null;
  createdAt: Iso; completedAt?: Iso | null;
}
export interface AdminTeamData { admins: AdminRow[]; commands: CommandRow[] }

export interface AuditEntry {
  id: string; occurredAt: Iso; actorName: string; actorRole: string; action: string;
  resourceType: string; resourceId: string; requestId: string;
  before?: Record<string, unknown> | null; after?: Record<string, unknown> | null;
}
export interface AuditPage { entries: AuditEntry[]; total: number }

export interface PriceRow {
  id: string; countryCode: CountryCode; planKey: PlanKey; currency: string;
  amountMinor: number; active: boolean; effectiveFrom: string; version: number; updatedAt: Iso;
}
export interface PricingHistoryEntry {
  version: number; amountMinor: number; currency: string; effectiveFrom: string;
  active: boolean; updatedBy: string; updatedAt: Iso;
}

export interface PricingData {
  rows: PriceRow[];
  history: Record<string, PricingHistoryEntry[]>;
 
}

export interface CapabilityRow { key: string; product: string; name: string; status: CapabilityStatus; lastVerifiedAt: Iso | null }
export interface SettingsData {
  pricing: PricingData;
  capabilities: CapabilityRow[];
  integrations: { name: string; status: "connected" | "not_configured" | "degraded"; detail: string }[];
 
}

export interface DatasetVersion {
  version: number; createdAt: Iso; sizeBytes: number; rowCount: number; checksum: string;
  quality: "unrated" | "passed" | "failed"; annotation: "unannotated" | "partial" | "complete";
  trainingEligible: boolean;
}
export interface DatasetRow {
  id: string; slug: string; name: string; domain: "vision" | "intelligence" | "sales" | "angel";
  sensitivity: "internal" | "confidential" | "restricted"; consentBasis: string;
  includesCustomerData: boolean | null; status: "draft" | "under_review" | "approved" | "deprecated" | "deleted" | "unknown";
  retentionPolicy: string; versions: DatasetVersion[]; ownerName: string;
}
export interface ModelRow {
  id: string; name: string; domain: string; provider: string; modelRef: string;
  status: "experimental" | "evaluated" | "production" | "retired" | "unknown"; evaluation: string | null;
}
export interface AiDataPage { datasets: DatasetRow[]; models: ModelRow[] }

export interface NotificationRow {
  id: string; category: string; severity: "info" | "warning" | "critical";
  title: string; body: string; href?: string; at: Iso; read: boolean;
}

export type DateRange = "today" | "7d" | "30d" | "90d" | "custom";
export const RANGE_OPTIONS: { value: DateRange; label: string }[] = [
  { value: "today", label: "Today (UTC)" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
];
