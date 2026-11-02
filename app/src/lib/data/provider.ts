/** RLS-scoped reads and authorized writes against the Admin Supabase. */
import type {
  AdminTeamData, AiDataPage, AnalyticsData, AngelMetrics, AuditEntry, BusinessDetail,
  BusinessSummary, CommandRow, DashboardSummary, HealthData, IncidentDetail, IncidentRow,
  IntelligenceMetrics, NotificationRow, PaymentsData, PricingData, SubscriptionAnalytics,
  SyncHealth, TimelineEntry, VisionOverview,
} from "./types";

export interface BusinessQuery {
  query?: string;
  status?: string;
  country?: string;
  plan?: string;
  sort?: string;
  page?: string;
}

export interface AuditQuery {
  actor?: string;
  action?: string;
  resourceType?: string;
  from?: string;
  to?: string;
}

export interface DataProvider {
  getDashboardSummary(range?: string): Promise<DashboardSummary>;
  listBusinesses(q: BusinessQuery): Promise<{ data: BusinessSummary[]; total: number }>;
  getBusiness(id: string): Promise<BusinessDetail | null>;
  getBusinessTimeline(id: string): Promise<TimelineEntry[]>;
  getSubscriptionAnalytics(): Promise<SubscriptionAnalytics>;
  getPayments(): Promise<PaymentsData>;
  getAnalytics(): Promise<AnalyticsData>;
  getVisionOverview(): Promise<VisionOverview>;
  getAngelMetrics(): Promise<AngelMetrics>;
  getIntelligenceMetrics(): Promise<IntelligenceMetrics>;
  getHealth(): Promise<HealthData>;
  listIncidents(): Promise<IncidentRow[]>;
  getIncident(id: string): Promise<IncidentDetail | null>;
  getAdminTeam(): Promise<AdminTeamData>;
  listCommands(status?: string): Promise<CommandRow[]>;
  getCommand(id: string): Promise<CommandRow | null>;
  getAudit(q: AuditQuery): Promise<{ entries: AuditEntry[]; total: number }>;
  getPricing(): Promise<PricingData>;
  getSettings(): Promise<SettingsData2>;
  getAiData(): Promise<AiDataPage>;
  listNotifications(): Promise<NotificationRow[]>;
  getSyncHealth(): Promise<SyncHealth>;
}

type SettingsData2 = import("./types").SettingsData;

/** Server-side mutation surface (doc 07 §7 command intake). */
export interface MutationBackend {
  createCommand(input: {
    commandType: string; targetType: string; targetId: string;
    payload: Record<string, unknown>; idempotencyKey: string;
    actor: { userId: string; name: string; role: string };
  }): Promise<CommandRow>;
  approveCommand(commandId: string, actor: { userId: string; name: string; role: string }): Promise<CommandRow>;
  rejectCommand(commandId: string, actor: { userId: string; name: string; role: string }, reason: string): Promise<CommandRow>;
  retryDeadLetter(id: string, actor: { userId: string; name: string; role: string }): Promise<void>;
  inviteAdmin(input: { email: string; role: string; note?: string }, actor: { userId: string; name: string; role: string }): Promise<{ id: string }>;
  createIncident(input: { title: string; severity: string; services: string[]; note?: string }, actor: { userId: string; name: string; role: string }): Promise<{ id: string }>;
  updateIncident(id: string, input: { status?: string; entry?: string }, actor: { userId: string; name: string; role: string }): Promise<void>;
  markNotificationsRead(): Promise<void>;
  exportAudit(q: AuditQuery): Promise<AuditEntry[]>;
}
