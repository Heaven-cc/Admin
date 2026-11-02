"use client";

import * as React from "react";
import { Pencil } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CommandDialog } from "./command-dialog";
import { PLANS, COUNTRIES, type CountryCode, type PlanKey, type PriceRow, type PricingData } from "@/lib/data/types";
import { formatMoney, formatDate } from "@/lib/utils/format";

/** Country-specific active prices and saved drafts. Activation is disabled. */
export function PricingMatrix({ pricing, canEdit }: { pricing: PricingData; canEdit: boolean }) {
  const [edit, setEdit] = React.useState<{ country: CountryCode; plan: PlanKey; row: PriceRow } | null>(null);
  const countries = Object.keys(COUNTRIES) as CountryCode[];
  const plans = Object.keys(PLANS) as PlanKey[];

  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Country</TableHead>
              {plans.map((plan) => (
                <TableHead key={plan}>{PLANS[plan].name}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {countries.map((country) => (
              <TableRow key={country}>
                <TableCell className="font-medium">
                  {COUNTRIES[country].name}{" "}
                  <span className="font-mono text-[10px] text-muted-foreground">{country}</span>
                </TableCell>
                {plans.map((plan) => {
                  const row = pricing.rows.find(
                    (r) => r.countryCode === country && r.planKey === plan && r.active
                  );
                  const draft = pricing.rows.filter(r => r.countryCode === country && r.planKey === plan && !r.active).sort((a,b)=>b.version-a.version)[0];
                  return (
                    <TableCell key={plan}>
                      {row ? (
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold tabular-nums">
                              {formatMoney(row.amountMinor, row.currency)}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              v{row.version} · from {formatDate(row.effectiveFrom)}
                            </p>
                          </div>
                          {canEdit ? (
                            <Button variant="ghost" size="icon" aria-label={`Edit ${country} ${plan} price`} onClick={() => setEdit({ country, plan, row })}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          ) : (
                            <Badge tone="neutral">read-only</Badge>
                          )}
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground">Unconfigured{draft ? <p className="mt-1">Draft v{draft.version}: {formatMoney(draft.amountMinor,draft.currency)} - {formatDate(draft.effectiveFrom)}</p> : null}</div>
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {pricing.rows.length ? <details className="mt-4 rounded-lg border border-border bg-surface p-4 text-xs"><summary className="cursor-pointer font-medium">Price version history</summary><div className="mt-3 space-y-2">{[...pricing.rows].sort((a,b)=>b.version-a.version).map(r=><p key={r.id}>{COUNTRIES[r.countryCode].name} / {PLANS[r.planKey].name} / v{r.version}: {formatMoney(r.amountMinor,r.currency)} / {r.active ? "active" : "draft"} / {formatDate(r.effectiveFrom)}</p>)}</div></details> : null}
      {edit ? (
        <PricingEditDialog
          open
          onOpenChange={(o) => !o && setEdit(null)}
          country={edit.country}
          plan={edit.plan}
          row={edit.row}
        />
      ) : null}
    </>
  );
}

function PricingEditDialog({
  open, onOpenChange, country, plan, row,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  country: CountryCode;
  plan: PlanKey;
  row: PriceRow;
}) {
  const [amount, setAmount] = React.useState(String(row.amountMinor));
  const [effectiveFrom, setEffectiveFrom] = React.useState(new Date().toISOString().slice(0, 10));
  const valid = Number(amount) > 0 && Number.isFinite(Number(amount)) && /^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom);
  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      commandType="pricing.upsert"
      targetType="pricing"
      targetId={`${country}:${plan}`}
      targetLabel={`${COUNTRIES[country].name} · ${PLANS[plan].name}`}
      consequences={[
        `New price version replaces ${formatMoney(row.amountMinor, row.currency)} (v${row.version}).`,
        `Takes effect ${effectiveFrom}. Historical versions are never mutated.`,
        "Requires approval from a second Finance/Super Admin.",
      ]}
      payload={{ countryCode: country, planKey: plan, currency: row.currency, amountMinor: Number(amount), effectiveFrom }}
      extraFields={
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">New amount (minor units)</span>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="numeric"
              className="h-9 w-full rounded-md border border-border bg-surface px-3 text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Effective from</span>
            <input
              type="date"
              value={effectiveFrom}
              onChange={(e) => setEffectiveFrom(e.target.value)}
              className="h-9 w-full rounded-md border border-border bg-surface px-3 text-sm"
            />
          </label>
        </div>
      }
      disableSubmit={!valid}
    />
  );
}
