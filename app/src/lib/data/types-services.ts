/** Data transfer contracts (docs/11) — Vision, Angel, Intelligence telemetry. */
import type { CapabilityInfo, CameraRow, Iso, SeriesPoint } from "./types-core";
export type { CameraRow };

export interface VisionOverview {
  capability: CapabilityInfo;
  kpis: { registered: number | null; connected: number | null; disconnected: number | null; businesses: number | null; latencyP95Ms: number | null; storageBytes: number | null };
  latencyTrend: SeriesPoint[]; throughputTrend: SeriesPoint[];
  pipeline: { serverStatus: "operational" | "degraded" | "down" | "unknown"; recordingPipeline: "ok" | "lagging" | "down" | "unknown"; detectionFailures24h: number | null };
  cameras: CameraRow[];
}

export interface AngelMetrics {
  persistedActivity?: { messages24h: number | null; conversations24h: number | null; capturedAt: Iso | null };
  capability: CapabilityInfo;
  kpis: { requests24h: number | null; errorRatePct: number | null; latencyP95Ms: number | null; tokensIn: number | null; tokensOut: number | null; estimatedCostMinor: number | null; costCurrency: string; rateLimitEvents: number | null; uptimePct: number | null };
  requestTrend: SeriesPoint[];
  latencyBands: { p50: SeriesPoint[]; p95: SeriesPoint[]; p99: SeriesPoint[] };
  costByProvider: { provider: string; costMinor: number }[];
  config: { model: string; provider: string; version: string; rateLimits: string } | null;
 
}

export interface IntelligenceMetrics {
  capability: CapabilityInfo;
  kpis: { jobs24h: number | null; failedJobs24h: number | null; insightsGenerated: number | null; dataFreshnessMinutes: number | null };
  jobs: { id: string; type: string; scope: string; status: "succeeded" | "failed" | "running"; durationMs: number; at: Iso; error?: string | null }[];
  models: { name: string; version: string; status: string; evaluation?: string | null }[];
  visionFlowHealth: "ok" | "lagging" | "down" | "unknown";
 
}
