"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, MonoCell } from "@/components/ui/table";
import { Input, Select } from "@/components/ui/input";
import { StatusChip } from "@/components/ui/badge";
import { EmptyState } from "@/components/states";
import { formatMoney, formatRelative } from "@/lib/utils/format";
import { COUNTRIES, PLANS, type BusinessSummary, type CountryCode, type PlanKey } from "@/lib/data/types";

const STATUSES = ["unknown", "active", "trial", "suspended", "cancelled", "churned", "deleting"];

export function BusinessesView({ rows, filters }: {
  rows: BusinessSummary[];
  filters: { query?: string; status?: string; country?: string; plan?: string; sort?: string };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    next.delete("page");
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search aria-hidden className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            defaultValue={filters.query ?? ""}
            placeholder="Search name or ID…"
            className="w-64 pl-8"
            aria-label="Search businesses"
            onKeyDown={(e) => {
              if (e.key === "Enter") setParam("query", (e.target as HTMLInputElement).value);
            }}
            onBlur={(e) => {
              if ((e.target as HTMLInputElement).value !== (filters.query ?? "")) {
                setParam("query", (e.target as HTMLInputElement).value);
              }
            }}
          />
        </div>
        <Select value={filters.status ?? ""} onChange={(e) => setParam("status", e.target.value)} aria-label="Account status">
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
        <Select value={filters.country ?? ""} onChange={(e) => setParam("country", e.target.value)} aria-label="Country">
          <option value="">All countries</option>
          {(Object.keys(COUNTRIES) as CountryCode[]).map((c) => (
            <option key={c} value={c}>{COUNTRIES[c].name}</option>
          ))}
        </Select>
        <Select value={filters.plan ?? ""} onChange={(e) => setParam("plan", e.target.value)} aria-label="Plan">
          <option value="">All plans</option>
          {(Object.keys(PLANS) as PlanKey[]).map((p) => (
            <option key={p} value={p}>{PLANS[p].name}</option>
          ))}
        </Select>
        <span className="ml-auto text-xs text-muted-foreground">{rows.length} shown</span>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No businesses match these filters"
          description="Try clearing the search or filters."
          action={
            <button className="text-xs text-brand underline" onClick={() => router.replace(pathname)}>
              Clear filters
            </button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Business</TableHead>
                <TableHead>Country</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Renews</TableHead>
                <TableHead>Last activity</TableHead>
                <TableHead>GMV (30d)</TableHead>
                <TableHead>Vision</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((b) => (
                <TableRow key={b.businessId}>
                  <TableCell>
                    <Link href={`/businesses/${b.businessId}`} className="font-medium hover:text-brand hover:underline">
                      {b.name}
                    </Link>
                    <div><MonoCell>{b.businessId}</MonoCell></div>
                  </TableCell>
                  <TableCell>{(b.countryCode ? COUNTRIES[b.countryCode]?.name : null) ?? "Unknown country"}</TableCell>
                  <TableCell>{(b.planKey ? PLANS[b.planKey]?.name : null) ?? "Unconfigured"}</TableCell>
                  <TableCell><StatusChip status={b.accountStatus} /></TableCell>
                  <TableCell className="text-xs">{b.renewsAt ? formatRelative(b.renewsAt) : "—"}</TableCell>
                  <TableCell className="text-xs">{formatRelative(b.lastActivityAt)}</TableCell>
                  <TableCell className="tabular-nums text-xs">{b.gmv30dMinor != null ? formatMoney(b.gmv30dMinor, b.currency, true) : "—"}</TableCell>
                  <TableCell>
                    {b.visionStatus === "active" ? (
                      <span className="text-xs">{b.cameraCount} cam{b.cameraCount === 1 ? "" : "s"}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
