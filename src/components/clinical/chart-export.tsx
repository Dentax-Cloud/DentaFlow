"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { chartToHistory, chartToSummary, type ToothChartData } from "@/lib/clinical/chart-types";
import { formatConditionType } from "@/lib/clinical/condition-config";
import { getDisplayNumber, type ChartNotation } from "@/lib/clinical/odontogram-notation";
import { formatDateTime } from "@/lib/utils";
import { FileDown } from "lucide-react";

type Props = {
  chartData: ToothChartData;
  notation: ChartNotation;
  patientName: string;
  clinicName?: string;
};

export function ChartExportButton({
  chartData,
  notation,
  patientName,
  clinicName = "DentaFlow Clinic",
}: Props) {
  const printRef = useRef<HTMLDivElement>(null);
  const metaRef = useRef<HTMLParagraphElement>(null);

  function handleExport() {
    const content = printRef.current;
    const meta = metaRef.current;
    if (!content || !meta) return;

    const exportedAt = new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "medium",
    }).format(new Date());

    const staticMeta = `${clinicName} · Notation: ${notation}`;
    meta.textContent = `${clinicName} · Exported ${exportedAt} · Notation: ${notation}`;

    const printWindow = window.open("", "_blank", "width=800,height=600");
    if (!printWindow) {
      meta.textContent = staticMeta;
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Dental Chart — ${patientName}</title>
          <style>
            body { font-family: system-ui, sans-serif; padding: 24px; color: #111; }
            h1 { font-size: 20px; margin-bottom: 4px; }
            .meta { color: #666; font-size: 12px; margin-bottom: 24px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background: #f5f5f5; }
            .summary { white-space: pre-wrap; font-size: 12px; background: #fafafa; padding: 12px; border-radius: 4px; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>${content.innerHTML}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();

    meta.textContent = staticMeta;
  }

  const history = chartToHistory(chartData);
  const summary = chartToSummary(chartData);

  return (
    <>
      <div ref={printRef} className="hidden">
        <h1>Dental Chart — {patientName}</h1>
        <p ref={metaRef} className="meta">
          {clinicName} · Notation: {notation}
        </p>
        <h2 style={{ fontSize: "14px", marginTop: "16px" }}>Summary</h2>
        <pre className="summary">{summary}</pre>
        <h2 style={{ fontSize: "14px", marginTop: "24px" }}>Findings history</h2>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Tooth</th>
              <th>Finding</th>
              <th>Surfaces</th>
              <th>Notes</th>
              <th>Provider</th>
            </tr>
          </thead>
          <tbody>
            {history.map((entry) => (
              <tr key={entry.id}>
                <td>{formatDateTime(entry.recordedAt)}</td>
                <td>
                  {getDisplayNumber(entry.toothNumber, notation)} (FDI {entry.toothNumber})
                </td>
                <td>{formatConditionType(entry.type)}</td>
                <td>{entry.surfaces?.join(", ") ?? "—"}</td>
                <td>{entry.notes ?? "—"}</td>
                <td>{entry.recordedByName ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleExport}
        disabled={history.length === 0}
      >
        <FileDown className="mr-2 h-4 w-4" />
        Export chart (PDF)
      </Button>
    </>
  );
}
