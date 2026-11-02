import { createClient } from "@/lib/supabase/server";
import { getSession, can } from "@/lib/auth/session";
import type { DataProvider, BusinessQuery, AuditQuery } from "./provider";
import type { AdminTeamData, AiDataPage, AnalyticsData, AngelMetrics, AuditEntry, BusinessDetail, BusinessSummary, CommandRow, DashboardSummary, HealthData, IncidentDetail, IncidentRow, IntelligenceMetrics, MetricCard, NotificationRow, PaymentsData, PricingData, SeriesPoint, SettingsData, SubscriptionAnalytics, SyncHealth, TimelineEntry, VisionOverview, CountryCode, PlanKey } from "./types";

type Row = Record<string, unknown>;
const text = (v: unknown, fallback = "") => typeof v === "string" ? v : fallback;
const num = (v: unknown): number | null => v == null || !Number.isFinite(Number(v)) ? null : Number(v);
const object = (v: unknown): Row => v && typeof v === "object" && !Array.isArray(v) ? v as Row : {};
const age = (v: unknown) => typeof v === "string" ? Math.max(0, Math.floor((Date.now() - new Date(v).getTime()) / 60_000)) : null;
const since = (days: number) => { const d=new Date(); d.setUTCHours(0,0,0,0); d.setUTCDate(d.getUTCDate()-days+1); return d.toISOString(); };
const plan = (v: unknown): PlanKey | null => ["start", "core", "pro"].includes(text(v)) ? v as PlanKey : null;
const country = (v: unknown): CountryCode | null => ["NG", "GH", "TG", "CI"].includes(text(v)) ? v as CountryCode : null;
function series(rows: Row[], dateKey: string, valueKey?: string): SeriesPoint[] {
  const totals = new Map<string, number>();
  for (const r of rows) { const date = text(r[dateKey]).slice(0, 10); if (date) totals.set(date, (totals.get(date) ?? 0) + (valueKey ? num(r[valueKey]) ?? 0 : 1)); }
  return [...totals].sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({ date, value }));
}
export class SupabaseProvider implements DataProvider {
  private async businessControls(rows: Row[]): Promise<Row[]> {
    const controls = await this.rows("admin_business_control_state");
    const states = new Map(controls.map(r => [text(r.business_ref), text(r.state)]));
    return rows.filter(r => states.get(text(r.business_ref)) !== "deleted").map(r => {
      const state = states.get(text(r.business_ref));
      return state ? { ...r, account_status: state } : r;
    });
  }
  private async rows(table: string): Promise<Row[]> {
    const sb = await createClient(), result: Row[] = [];
    for (let offset = 0; offset < 50000; offset += 1000) {
      let query = sb.from(table).select("*");
      if (table === "platform_businesses") query = query.eq("source_present",true);
      const orders: Record<string,string[]> = { platform_businesses:["business_ref"],admin_subscriptions:["business_ref"],admin_payments:["id"],admin_usage_daily:["business_ref","metric_date","currency"],admin_error_totals:["application","error_code","metric_date"],admin_service_metrics:["service"],vision_metrics:["id"],sync_state:["pipeline"],admin_incidents:["id"],admin_incident_timeline:["id"],admin_audit_logs:["id"],admin_country_prices:["id"],admin_dataset_registry:["id"],admin_dataset_versions:["id"],admin_notifications:["id"],admin_notification_reads:["notification_id","user_id"] };
      if (table === "admin_business_control_state") query=query.order("business_ref");
      for (const key of orders[table] ?? []) query=query.order(key);
      if (table === "admin_payments") query=query.gte("occurred_at",since(30));
      if (table === "admin_usage_daily") query=query.gte("metric_date",since(90).slice(0,10));
      if (table === "vision_metrics") query=query.gte("captured_at",since(30));
      const { data, error } = await query.range(offset, offset + 999);
      if (error) throw new Error("Admin data unavailable: " + table + " (" + error.code + ")");
      result.push(...(data ?? [])); if ((data?.length ?? 0) < 1000) return table === "platform_businesses" ? this.businessControls(result) : result;
    }
    throw new Error("This report requires a narrower server-side reporting window.");
  }
  private mapBusiness(r: Row): BusinessSummary {
    const a = object(r.attributes);
    return { businessId: text(r.business_ref), name: text(r.name, "Unnamed business"), countryCode: country(r.country_code), registeredAt: text(r.created_at) || null, accountStatus: ["active", "trial", "suspended", "cancelled", "churned", "deleting"].includes(text(r.account_status)) ? r.account_status as BusinessSummary["accountStatus"] : "unknown", planKey: plan(r.plan), subscriptionStatus: text(a.subscription_status, "unavailable"), renewsAt: text(a.renews_at) || null, lastActivityAt: text(r.last_active_at) || null, visionStatus: r.vision_enabled === true ? "active" : r.vision_enabled === false ? "none" : "unknown", cameraCount: num(a.camera_count), tx30d: null, gmv30dMinor: null, currency: text(r.currency) };
  }
  async getDashboardSummary(range = "30d"): Promise<DashboardSummary> {
    const session = await getSession(), days = range === "today" ? 1 : range === "7d" ? 7 : range === "90d" ? 90 : 30;
    const businesses = await this.rows("platform_businesses"), sync = await this.getSyncHealth();
    const fresh = { asAt: sync.lastEventAt, slaMinutes: 15, status: sync.status === "healthy" ? "live" as const : "stale" as const };
    const available = sync.lastEventAt != null;
    const metric = (key: string, label: string, value: number | null, section: MetricCard["section"] = "business", currency?: string): MetricCard => ({ key, label, value: available ? value : null, section, currency, unit: currency ? "currency" : "count", freshness: fresh });
    const active = businesses.filter(b => text(b.last_active_at) >= since(days)).length;
    const metrics: MetricCard[] = [metric("M-BIZ-01", "Registered businesses", businesses.length), metric("M-BIZ-02", "Businesses with recorded activity (" + days + "d)", active), metric("M-BIZ-03", "New registrations (" + days + "d)", businesses.filter(b => text(b.created_at) >= since(days)).length)];
    if (can(session, "subscriptions.read")) {
      const subs = (await this.rows("admin_subscriptions")).filter(s => s.present !== false);
      metrics.push(metric("M-SUB-01", "Active subscriptions", subs.filter(s => s.status === "active").length), metric("M-SUB-02", "Trial subscriptions", subs.filter(s => s.status === "trialing").length));
      if (can(session, "revenue.view")) for (const currency of ["NGN", "GHS", "XOF"]) {
        const rows = subs.filter(s => s.status === "active" && s.currency === currency);
        const known = rows.length > 0 && rows.every(s => num(s.amount_minor) != null && (num(s.interval_months) ?? 0) > 0);
        metrics.push(metric("MRR-" + currency, "MRR · " + currency, known ? rows.reduce((n, s) => n + Number(s.amount_minor) / Number(s.interval_months), 0) : null, "odt_revenue", currency));
      }
    }
    let gmvByCurrency: { name: string; color: string; points: SeriesPoint[] }[] = [];
    if (can(session, "sales.view")) {
      const usage = (await this.rows("admin_usage_daily")).filter(r => text(r.metric_date) >= since(days).slice(0, 10));
      gmvByCurrency = ["NGN", "GHS", "XOF"].map((currency, i) => { const rows = usage.filter(r => r.currency === currency); const divisor = currency === "XOF" ? 1 : 100; metrics.push(metric("GMV-" + currency, "Recorded business sales · " + currency, rows.length && rows.every(r => num(r.gmv_minor) != null) ? rows.reduce((n, r) => n + Number(r.gmv_minor), 0) : null, "gmv", currency)); return { name: currency, color: "var(--color-chart-" + (i + 1) + ")", points: series(rows.filter(r => num(r.gmv_minor) != null), "metric_date", "gmv_minor").map(r => ({ ...r, value: r.value / divisor })) }; });
    }
    metrics.push(metric("M-PRODUCTS-01", "Registered products", businesses.every(b=>num(object(b.attributes).product_count)!=null) ? businesses.reduce((n,b)=>n+Number(object(b.attributes).product_count),0) : null));
    metrics.push({ key: "M-APP-01", label: "App installations", section: "services", value: null, unit: "count", freshness: { asAt: null, slaMinutes: 1440, status: "not_instrumented" }, notInstrumented: { reason: "Store and installation telemetry is not connected.", requiredEvents: ["app.install"] } });
    return { metrics, series: { registrations: series(businesses.filter(b => text(b.created_at) >= since(days)), "created_at"), mrr: [], gmv: [] }, gmvByCurrency, recentEvents: [], sync };
  }
  async listBusinesses(q: BusinessQuery): Promise<{ data: BusinessSummary[]; total: number }> {
    const sb = await createClient(), page = Math.min(10000, Math.max(1, Number(q.page) || 1));
    let query = sb.from("platform_businesses").select("*", { count: "exact" }).eq("source_present",true);
    if (q.query) query = /^[0-9a-f-]{36}$/i.test(q.query) ? query.eq("business_ref", q.query) : query.ilike("name", "%" + q.query.replace(/[%_\\]/g, "\\$&") + "%");
    if (q.country && country(q.country)) query = query.eq("country_code", q.country);
    if (q.plan && plan(q.plan)) query = query.eq("plan", q.plan);
    if (q.status) query = query.eq("account_status", q.status);
    const sort = q.sort === "name" ? "name" : q.sort === "activity" ? "last_active_at" : "created_at";
    const { data, count, error } = await query.order(sort, { ascending: sort === "name", nullsFirst: false }).order("business_ref").range((page - 1) * 50, page * 50 - 1);
    if (error) throw new Error("Business directory unavailable (" + error.code + ")");
    return { data: (data ?? []).map(r => this.mapBusiness(r)), total: count ?? 0 };
  }
  async getBusiness(id: string): Promise<BusinessDetail | null> {
    if (!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id)) return null;
    const sb = await createClient(), { data, error } = await sb.from("platform_businesses").select("*").eq("business_ref", id).eq("source_present",true).maybeSingle();
    if (error) throw new Error("Business profile unavailable (" + error.code + ")"); if (!data) return null;
    const controlled = (await this.businessControls([data]))[0]; if (!controlled) return null;
    const base = this.mapBusiness(controlled), a = object(data.attributes), session = await getSession();
    if (can(session, "sales.view")) { const usage = (await this.rows("admin_usage_daily")).filter(r => r.business_ref === id && text(r.metric_date) >= since(30).slice(0, 10)); base.tx30d = usage.length ? usage.reduce((n, r) => n + Number(r.transactions), 0) : null; base.gmv30dMinor = usage.length && usage.every(r => r.currency === base.currency && num(r.gmv_minor) != null) ? usage.reduce((n, r) => n + Number(r.gmv_minor), 0) : null; }
    const lag = age(data.synced_at);
    return { ...base, provider: text(a.payment_provider, "Unconfigured"), autoRenew: typeof a.auto_renew === "boolean" ? a.auto_renew : null, supportOpen: null, integrationHealth: lag == null ? [] : [{ source: "Production reporting projection", freshnessMinutes: lag, status: lag <= 15 ? "ok" : "lagging" }] };
  }
  async getBusinessTimeline(id: string): Promise<TimelineEntry[]> {
    const b = await this.getBusiness(id), session = await getSession(), events: TimelineEntry[] = [];
    if (b?.registeredAt) events.push({ id: id + "-registered", at: b.registeredAt, type: "business", label: "Business registered" });
    if (can(session, "payments.read")) for (const p of (await this.getPayments()).payments.filter(p => p.businessId === id)) events.push({ id: p.id, at: p.occurredAt, type: "payment", label: "Payment " + p.status, actor: p.provider });
    return events.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 50);
  }
  async getSubscriptionAnalytics(): Promise<SubscriptionAnalytics> {
    const subs = (await this.rows("admin_subscriptions")).filter(s => s.present !== false), bs = await this.rows("platform_businesses"), sync = await this.getSyncHealth();
    const active = subs.filter(r => r.status === "active"), names = new Map(bs.map(b => [b.business_ref, text(b.name)]));
    const kpis: MetricCard[] = [{ key: "M-SUB-01", label: "Active subscriptions", section: "business", value: sync.lastEventAt ? active.length : null, unit: "count", freshness: { asAt: sync.lastEventAt, slaMinutes: 15, status: sync.status === "healthy" ? "live" : "stale" } }];
    return { kpis, mrrTrend: [], planMix: (["start", "core", "pro"] as PlanKey[]).map(plan => ({ plan, count: active.filter(r => r.plan_key === plan).length })), countrySplit: sync.lastEventAt ? (["NG","GH","TG","CI"] as CountryCode[]).map(c => { const ids = new Set(bs.filter(b => b.country_code === c).map(b => b.business_ref)); const local = active.filter(s => ids.has(s.business_ref)); const currency = c === "NG" ? "NGN" : c === "GH" ? "GHS" : "XOF"; return { country:c,active:local.length,currency,mrrMinor:local.length && local.every(s => s.currency === currency && num(s.amount_minor) != null && Number(s.interval_months) > 0) ? local.reduce((n,s)=>n+Number(s.amount_minor)/Number(s.interval_months),0) : null }; }) : [], renewals: active.filter(r => text(r.renews_at) >= new Date().toISOString() && text(r.renews_at) <= new Date(Date.now() + 30 * 86400000).toISOString() && plan(r.plan_key)).map(r => ({ businessId: text(r.business_ref), name: names.get(r.business_ref) ?? text(r.business_ref), plan: plan(r.plan_key)!, amountMinor: num(r.amount_minor), currency: text(r.currency), date: text(r.renews_at) })), cancellations: subs.filter(r => r.status === "canceled").map(r => ({ businessId: text(r.business_ref), name: names.get(r.business_ref) ?? text(r.business_ref), at: text(r.source_updated_at), reason: null })) };
  }
  async getPayments(): Promise<PaymentsData> {
    const rows = (await this.rows("admin_payments")).filter(r => text(r.occurred_at) >= since(30)).sort((a, b) => text(b.occurred_at).localeCompare(text(a.occurred_at)));
    const bs = await this.rows("platform_businesses"), names = new Map(bs.map(b => [b.business_ref, text(b.name)]));
    const payments = rows.map(r => ({ id: text(r.id), businessId: text(r.business_ref), businessName: names.get(r.business_ref) ?? text(r.business_ref), provider: text(r.provider), providerRef: text(r.provider_ref), amountMinor: Number(r.amount_minor), currency: text(r.currency), status: (r.status === "verified" ? "success" : "failed") as "success" | "failed", failureCode: null, failureReason: null, occurredAt: text(r.occurred_at), reconciled: null }));
    return { payments, failures: payments.filter(p => p.status === "failed"), webhooks: [], reconciliation: [], successRate: payments.length ? payments.filter(p => p.status === "success").length / payments.length * 100 : null, refundedMinor: null, currency: "", trend: series(rows.filter(r => r.status === "verified"), "occurred_at"), failuresByReason: [] };
  }
  async getAnalytics(): Promise<AnalyticsData> {
    const bs = await this.rows("platform_businesses"), sync = await this.getSyncHealth();
    const geo = (["NG", "GH", "TG", "CI"] as CountryCode[]).map(country => ({ country, businesses: bs.filter(b => b.country_code === country).length }));
    return { funnel: sync.lastEventAt ? [{ label: "Registered businesses", count: bs.length, event: "business.created" }, { label: "Recorded activity (30d)", count: bs.filter(b => text(b.last_active_at) >= since(30)).length, event: "recorded activity" }] : [], conversion: [], retention: [], adoption: [], distribution: [], versions: [], geo, sessionsTrend: [], freshness: { asAt: sync.lastEventAt, slaMinutes: 15, status: sync.status === "healthy" ? "live" : "stale" } };
  }
  async getVisionOverview(): Promise<VisionOverview> {
    const rows = await this.rows("vision_metrics"), latest = rows.sort((a, b) => text(b.captured_at).localeCompare(text(a.captured_at)))[0];
    return { capability: { product: "vision", status: "unknown", lastVerifiedAt: null, note: "Production camera metadata is available when configured. Native service runtime telemetry requires an authorized gateway." }, kpis: { registered: num(latest?.total_cameras), connected: num(latest?.online_cameras), disconnected: num(latest?.offline_cameras), businesses: num(object(latest).businesses), latencyP95Ms: num(latest?.processing_latency_ms), storageBytes: null }, latencyTrend: rows.filter(r => num(r.processing_latency_ms) != null).map(r => ({ date: text(r.captured_at), value: Number(r.processing_latency_ms) })), throughputTrend: [], pipeline: { serverStatus: "unknown", recordingPipeline: "unknown", detectionFailures24h: null }, cameras: [] };
  }
  private async service(service: string): Promise<Row | undefined> { return (await this.rows("admin_service_metrics")).find(r => r.service === service); }
  async getAngelMetrics(): Promise<AngelMetrics> {
    const row = await this.service("angel"), m = object(row?.metrics);
    return { capability: { product: "angel", status: "unknown", lastVerifiedAt: null, note: "Service deployment is separate from usage telemetry. Conversation activity does not establish request success, tokens, cost or uptime." }, kpis: { requests24h: num(m.requests_24h), errorRatePct: num(m.error_rate_pct), latencyP95Ms: num(m.latency_p95_ms), tokensIn: num(m.tokens_in), tokensOut: num(m.tokens_out), estimatedCostMinor: num(m.cost_minor), costCurrency: text(m.currency, "USD"), rateLimitEvents: num(m.rate_limit_events), uptimePct: num(m.uptime_pct) }, requestTrend: [], latencyBands: { p50: [], p95: [], p99: [] }, costByProvider: [], config: null, persistedActivity: row ? { messages24h: num(m.persisted_messages_24h), conversations24h: num(m.conversations_24h), capturedAt: text(row.captured_at) || null } : undefined };
  }
  async getIntelligenceMetrics(): Promise<IntelligenceMetrics> {
    const row = await this.service("intelligence"), m = object(row?.metrics), lag = age(row?.captured_at);
    return { capability: { product: "intelligence", status: "unknown", lastVerifiedAt: null, note: "Native Intelligence exists; this view only reports metrics supplied by the operational adapter." }, kpis: { jobs24h: num(m.jobs_24h), failedJobs24h: num(m.failed_jobs_24h), insightsGenerated: num(m.insights_generated), dataFreshnessMinutes: lag }, jobs: [], models: [], visionFlowHealth: "unknown" };
  }
  async getHealth(): Promise<HealthData> {
    const jobs = await this.rows("sync_state"), sync = await this.getSyncHealth(), errors = await this.rows("admin_error_totals");
    return { services: [{ name: "Production reporting pipeline", status: sync.status === "healthy" ? "operational" : sync.status === "no_data" ? "unknown" : "degraded", latencyMs: null, lastCheckAt: sync.lastEventAt, uptime24hPct: null }], errors: errors.map(r => ({ id: text(r.application) + text(r.error_code) + text(r.metric_date), fingerprint: text(r.error_code), severity: "unknown", service: text(r.application), environment: "production", type: text(r.error_code), message: "Fixed-code application error reported by production.", occurrences: Number(r.occurrences), firstSeenAt: null, lastSeenAt: text(r.last_seen_at), affectedVersions: [], status: "unreviewed" })), syncJobs: jobs.map(r => ({ jobKey: text(r.pipeline), schedule: "Every 5 minutes when enabled", lastRunAt: text(r.last_attempt_at) || null, lastSuccessAt: text(r.last_success_at) || null, lagMinutes: age(r.last_success_at), failures24h: Number(r.consecutive_failures), status: r.status === "failed" ? "failed" : r.status === "running" ? "running" : "idle" })), deadLetters: [], syncLagMinutes: sync.lagMinutes };
  }
  async listIncidents(): Promise<IncidentRow[]> { return (await this.rows("admin_incidents")).sort((a, b) => text(b.opened_at).localeCompare(text(a.opened_at))).map(r => ({ id: text(r.id), reference: "INC-" + r.reference, title: text(r.title), severity: r.severity as IncidentRow["severity"], status: r.status as IncidentRow["status"], services: (r.services ?? []) as string[], openedAt: text(r.opened_at), resolvedAt: text(r.resolved_at) || null })); }
  async getIncident(id: string): Promise<IncidentDetail | null> {
    const incident = (await this.listIncidents()).find(r => r.id === id); if (!incident) return null;
    const timeline = (await this.rows("admin_incident_timeline")).filter(r => r.incident_id === id).map(r => ({ id: text(r.id), at: text(r.occurred_at), entry: text(r.entry), author: text(r.author_id) }));
    return { ...incident, timeline, linkedErrors: [], postmortemUrl: null };
  }
  async getAdminTeam(): Promise<AdminTeamData> {
    const sb = await createClient(); const { data, error } = await sb.rpc("admin_team_directory"); if (error) throw new Error("Administrator directory unavailable."); const rows: Row[] = data ?? [];
    return { admins: rows.map(r => ({ id: text(r.user_id), name: text(r.display_name, "Administrator"), email: text(r.email, "Unavailable"), role: text(r.role_key, text(r.role)), status: r.invitation_accepted_at ? r.active ? "active" : "suspended" : "invited", mfa: r.mfa === true, lastLoginAt: text(r.last_login_at) || null })), commands: [] };
  }
  async listCommands(): Promise<CommandRow[]> { return []; }
  async getCommand(): Promise<CommandRow | null> { return null; }
  async getAudit(q: AuditQuery): Promise<{ entries: AuditEntry[]; total: number }> {
    let rows = await this.rows("admin_audit_logs");
    if (q.actor) rows = rows.filter(r => text(r.actor_user_id).includes(q.actor!));
    if (q.action) rows = rows.filter(r => text(r.action).includes(q.action!));
    if (q.resourceType) rows = rows.filter(r => r.resource_type === q.resourceType);
    if (q.from) rows = rows.filter(r => text(r.occurred_at) >= q.from!);
    if (q.to) rows = rows.filter(r => text(r.occurred_at) < q.to! + "T23:59:59.999Z");
    return { entries: rows.sort((a, b) => text(b.occurred_at).localeCompare(text(a.occurred_at))).map(r => ({ id: text(r.id), occurredAt: text(r.occurred_at), actorName: text(r.actor_user_id, "System"), actorRole: "See administrator directory", action: text(r.action), resourceType: text(r.resource_type), resourceId: text(r.resource_ref), requestId: text(r.request_id), before: null, after: object(r.metadata) })), total: rows.length };
  }
  async getPricing(): Promise<PricingData> {
    const rows = await this.rows("admin_country_prices"), history: PricingData["history"] = {};
    const mapped = rows.map(r => ({ id: text(r.id), countryCode: r.country_code as CountryCode, planKey: r.plan_key as PlanKey, currency: text(r.currency), amountMinor: Number(r.amount_minor), active: Boolean(r.active), effectiveFrom: text(r.effective_from), version: Number(r.version), updatedAt: text(r.created_at) }));
    for (const r of mapped) (history[r.countryCode + ":" + r.planKey] ??= []).push({ version: r.version, amountMinor: r.amountMinor, currency: r.currency, effectiveFrom: r.effectiveFrom, active: r.active, updatedBy: "See audit history", updatedAt: r.updatedAt });
    return { rows: mapped, history };
  }
  async getSettings(): Promise<SettingsData> {
    const session = await getSession(), sync = await this.getSyncHealth();
    return { pricing: can(session, "pricing.read") ? await this.getPricing() : { rows: [], history: {} }, capabilities: [], integrations: [{ name: "Admin Supabase", status: "connected", detail: "Separate Admin Project; user-scoped queries and RLS." }, { name: "Production reporting", status: sync.lastEventAt ? sync.status === "healthy" ? "connected" : "degraded" : "not_configured", detail: sync.lastEventAt ? "Last completed reporting sync: " + sync.lastEventAt : "Awaiting first successful reporting sync." }, { name: "Paystack", status: "not_configured", detail: "No enabled production billing provider or confirmed country prices." }, { name: "Application/store telemetry", status: "not_configured", detail: "Installs, downloads, sessions and crash reporting require their own integrations." }, { name: "Vision runtime monitoring", status: "not_configured", detail: "Camera registration summaries are connected; runtime latency, throughput and recording health are unavailable." }, { name: "Angel operational telemetry", status: "not_configured", detail: "Saved conversation counts are connected; request success, latency, tokens and provider costs are unavailable." }, { name: "Intelligence job telemetry", status: "not_configured", detail: "Job runs, model evaluations and pipeline health require an operational telemetry adapter." }, { name: "External alerts", status: "not_configured", detail: "In-app notifications are available. Email/Slack alert delivery and escalation are not connected." }] };
  }
  async getAiData(): Promise<AiDataPage> {
    const rows = await this.rows("admin_dataset_registry"), versions = await this.rows("admin_dataset_versions"), models = await this.rows("model_registry");
    return { datasets: rows.map(r => ({ id: text(r.id), slug: text(r.slug), name: text(r.name), domain: r.domain as "vision", sensitivity: r.sensitivity as "internal", consentBasis: text(r.consent_basis), retentionPolicy: text(r.retention_policy), includesCustomerData: typeof r.includes_customer_data === "boolean" ? r.includes_customer_data : null, status: (["draft","under_review","approved","deprecated","deleted"].includes(text(r.status)) ? r.status : "unknown") as "draft" | "under_review" | "approved" | "deprecated" | "deleted" | "unknown", ownerName: text(r.owner_id), versions: versions.filter(v => v.dataset_id === r.id).map(v => ({ version: Number(v.version), createdAt: text(v.created_at), sizeBytes: Number(v.size_bytes), rowCount: Number(v.row_count), checksum: text(v.checksum), quality: "unrated", annotation: "unannotated", trainingEligible: false })) })), models: models.map(r => { const metadata = object(r.metadata); return { id:text(r.id),name:text(r.model_name),domain:text(metadata.domain,"Unclassified"),provider:text(metadata.provider,"Unavailable"),modelRef:text(r.model_version),status:(["experimental","evaluated","production","retired"].includes(text(r.status)) ? r.status : "unknown") as "unknown" | "production" | "experimental" | "evaluated" | "retired",evaluation:text(metadata.evaluation)||null }; }) };
  }
  async listNotifications(): Promise<NotificationRow[]> {
    const rows = await this.rows("admin_notifications"), reads = new Set((await this.rows("admin_notification_reads")).map(r => r.notification_id));
    return rows.sort((a, b) => text(b.created_at).localeCompare(text(a.created_at))).slice(0, 30).map(r => ({ id: text(r.id), category: text(r.category), severity: r.severity as NotificationRow["severity"], title: text(r.title), body: text(r.body), href: text(r.href) || undefined, at: text(r.created_at), read: reads.has(r.id) }));
  }
  async getSyncHealth(): Promise<SyncHealth> {
    const sb = await createClient(), { data, error } = await sb.rpc("admin_reporting_status");
    if (error) throw new Error("Reporting freshness unavailable (" + error.code + ")");
    const lastEventAt = text(data?.last_success_at) || null, lagMinutes = age(lastEventAt);
    return { lastEventAt, lagMinutes, status: lagMinutes == null ? "no_data" : data?.status === "failed" ? "down" : data?.status === "running" ? "lagging" : lagMinutes <= 15 ? "healthy" : lagMinutes <= 60 ? "lagging" : "down" };
  }
}
