"use client";

import { formatCurrency } from "@/lib/countries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Summary = {
  invoiceCount: number;
  invoiceTotal: number;
  collected: number;
  cash: number;
  card: number;
  outstandingCount: number;
  outstanding: number;
  newPatients: number;
};

export function EndOfDayClient({
  date,
  countryCode,
  summary,
}: {
  date: string;
  countryCode: string;
  summary: Summary;
}) {
  const money = (amount: number) => formatCurrency(amount, countryCode);
  function handlePrint() {
    window.print();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">End of day report</h1>
          <p className="text-muted-foreground">{date.slice(0, 10)}</p>
        </div>
        <Button onClick={handlePrint}>Print report</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.invoiceCount}</div>
            <div className="text-sm text-muted-foreground">{money(summary.invoiceTotal)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Collected</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{money(summary.collected)}</div>
            <div className="text-sm text-muted-foreground">
              Cash {money(summary.cash)} · Card {money(summary.card)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Outstanding</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.outstandingCount}</div>
            <div className="text-sm text-muted-foreground">{money(summary.outstanding)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">New patients</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.newPatients}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
