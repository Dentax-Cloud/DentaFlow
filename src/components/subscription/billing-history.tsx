import { ExternalLink, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { StripeInvoiceItem } from "@/app/(dashboard)/features/subscription/actions";

type Props = { invoices: StripeInvoiceItem[] };

export function BillingHistory({ invoices }: Props) {
  if (invoices.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-muted/30 p-8 text-center">
        <FileText className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="mt-2 text-sm text-muted-foreground">
          No subscription invoices yet. Invoices appear after your first payment.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card shadow-sm">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Invoice</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.map((inv) => (
            <TableRow key={inv.id}>
              <TableCell className="font-medium">{inv.number ?? inv.id.slice(-8)}</TableCell>
              <TableCell className="text-muted-foreground">
                {new Date(inv.created * 1000).toLocaleDateString()}
              </TableCell>
              <TableCell>
                <Badge variant={inv.status === "paid" ? "success" : "outline"}>
                  {inv.status ?? "—"}
                </Badge>
              </TableCell>
              <TableCell className="text-right font-medium tabular-nums">
                {inv.amount.toLocaleString(undefined, {
                  style: "currency",
                  currency: inv.currency,
                })}
              </TableCell>
              <TableCell>
                {inv.hostedInvoiceUrl && (
                  <Button variant="ghost" size="icon" asChild>
                    <a href={inv.hostedInvoiceUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
