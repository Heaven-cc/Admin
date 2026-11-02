import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface MetricDefinition {
  key: string;
  name: string;
  definition: string;
  source: string;
  sla: string;
  permission: string;
  status: string;
}

/** The definitions panel from docs/04 §4.6 — first-class honesty surface. */
export function DefinitionsPanel({ definitions, defaultOpen = true }: {
  definitions: MetricDefinition[];
  defaultOpen?: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Metric definitions</CardTitle>
      </CardHeader>
      <CardContent>
        <details open={defaultOpen}>
          <summary className="cursor-pointer text-xs text-brand">Show / hide definitions</summary>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="py-1.5 pr-3 font-medium">Metric</th>
                  <th className="py-1.5 pr-3 font-medium">Definition</th>
                  <th className="py-1.5 pr-3 font-medium">Source</th>
                  <th className="py-1.5 pr-3 font-medium">Freshness SLA</th>
                  <th className="py-1.5 pr-3 font-medium">Permission</th>
                  <th className="py-1.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {definitions.map((d) => (
                  <tr key={d.key} className="border-b border-border/60 last:border-0">
                    <td className="py-1.5 pr-3 font-mono text-[10px]">{d.key}</td>
                    <td className="py-1.5 pr-3">
                      <span className="font-medium">{d.name}</span> — {d.definition}
                    </td>
                    <td className="py-1.5 pr-3 text-muted-foreground">{d.source}</td>
                    <td className="py-1.5 pr-3 text-muted-foreground">{d.sla}</td>
                    <td className="py-1.5 pr-3 font-mono text-[10px] text-muted-foreground">{d.permission}</td>
                    <td className="py-1.5">{d.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </CardContent>
    </Card>
  );
}
