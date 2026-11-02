import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, MonoCell } from "@/components/ui/table";
import { StatusChip } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils/format";

interface PaymentRow {
  id: string; date: string; businessId: string; businessName: string;
  amount: string; status: string; providerRef: string; reconciled: boolean | null;
}

export function PaymentTable({ rows, showReason }: { rows: PaymentRow[]; showReason?: boolean }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead><TableHead>Business</TableHead>
          <TableHead>Amount</TableHead><TableHead>Status</TableHead>
          <TableHead>{showReason ? "Reason / ref" : "Provider ref"}</TableHead>
          {!showReason ? <TableHead>Reconciled</TableHead> : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((p) => (
          <TableRow key={p.id}>
            <TableCell className="text-xs">{formatDateTime(p.date)}</TableCell>
            <TableCell><a href={`/businesses/${p.businessId}`} className="hover:text-brand hover:underline">{p.businessName}</a></TableCell>
            <TableCell className="tabular-nums">{p.amount}</TableCell>
            <TableCell><StatusChip status={p.status} /></TableCell>
            <TableCell><MonoCell>{p.providerRef}</MonoCell></TableCell>
            {!showReason ? <TableCell className="text-xs">{p.reconciled == null ? "Unavailable" : p.reconciled ? "yes" : "pending"}</TableCell> : null}
          </TableRow>
        ))}
        {rows.length === 0 ? (
          <TableRow><TableCell colSpan={6} className="py-6 text-center text-xs text-muted-foreground">Nothing here yet.</TableCell></TableRow>
        ) : null}
      </TableBody>
    </Table>
  );
}
