"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Download,
  FileSpreadsheet,
  HelpCircle,
  History,
  Loader2,
  RotateCcw,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { parseImportFileForPreview } from "@/lib/import/parse-upload-file";
import type { ImportEntity } from "@/lib/import/template-generator";
import type { ImportBatchResult, ImportMode } from "@/lib/import/import-processor";

type HistoryRow = {
  id: string;
  entity: string;
  fileName: string;
  totalRows: number;
  successRows: number;
  warningRows: number;
  errorRows: number;
  skippedRows: number;
  mode: string;
  status: string;
  canRollback: boolean;
  rolledBackAt: string | null;
  createdAt: string;
  completedAt: string | null;
  errorReport: unknown;
};

type Props = {
  clinicName: string;
  countryCode: string;
  countryName: string;
  countryFlag: string;
  dateFormat: string;
  currency: string;
  dialCode: string;
  phoneExample: string;
  identityDocs: Array<{
    label: string;
    format: string;
    example: string;
    mandatory: boolean;
  }>;
  insuranceProviders: string[];
  customFields: Array<{ fieldKey: string; fieldLabel: string }>;
  importHistory: HistoryRow[];
};

const ENTITIES: ImportEntity[] = ["PATIENT", "INVENTORY", "STAFF"];

const MODE_LABELS: Record<ImportMode, string> = {
  CREATE_ONLY: "Create only",
  UPDATE_ONLY: "Update only",
  UPSERT: "Upsert (create + update)",
};

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DataImportClient({
  clinicName,
  countryCode,
  countryName,
  countryFlag,
  dateFormat,
  currency,
  dialCode,
  phoneExample,
  identityDocs,
  insuranceProviders,
  customFields,
  importHistory,
}: Props) {
  const router = useRouter();
  const [entity, setEntity] = useState<ImportEntity>("PATIENT");
  const [mode, setMode] = useState<ImportMode>("UPSERT");
  const [file, setFile] = useState<File | null>(null);
  const [previewRows, setPreviewRows] = useState<Record<string, unknown>[]>([]);
  const [totalRowCount, setTotalRowCount] = useState(0);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportBatchResult | null>(null);
  const [viewErrorsBatch, setViewErrorsBatch] = useState<HistoryRow | null>(null);

  const downloadTemplate = useCallback(() => {
    window.location.href = `/api/import/template?entity=${entity}`;
  }, [entity]);

  const handleFileSelect = useCallback(
    async (selected: File) => {
      setResult(null);
      setFile(selected);
      setProgress(0);

      try {
        const buffer = await selected.arrayBuffer();
        const rows = parseImportFileForPreview(
          buffer,
          selected.name,
          countryCode,
          currency,
          customFields,
        );
        setPreviewRows(rows.slice(0, 5));
        setTotalRowCount(rows.length);
        if (rows.length === 0) {
          toast.error("No data rows found. Fill data from row 4 (remove the example row).");
        }
      } catch {
        setPreviewRows([]);
        toast.error("Could not preview file");
      }
    },
    [countryCode, currency, customFields],
  );

  async function startImport() {
    if (!file) {
      toast.error("Select a file first");
      return;
    }

    setImporting(true);
    setProgress(15);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("mode", mode);
      formData.append("entity", entity);

      setProgress(40);
      const res = await fetch("/api/import/process", {
        method: "POST",
        body: formData,
      });

      setProgress(85);
      const data = (await res.json()) as ImportBatchResult & { error?: string };

      if (!res.ok) {
        toast.error(data.error ?? "Import failed");
        return;
      }

      setResult(data);
      setProgress(100);
      toast.success("Import complete");
      router.refresh();
    } catch {
      toast.error("Import failed");
    } finally {
      setImporting(false);
    }
  }

  async function rollbackBatch(batchId: string) {
    setImporting(true);
    try {
      const res = await fetch("/api/import/rollback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchId }),
      });
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Rollback failed");
        return;
      }
      toast.success(data.message ?? "Rollback complete");
      setResult(null);
      router.refresh();
    } catch {
      toast.error("Rollback failed");
    } finally {
      setImporting(false);
    }
  }

  function downloadErrorReport() {
    if (!result) return;
    const lines = result.results
      .filter((r) => r.status === "ERROR" || r.status === "WARNING")
      .map(
        (r) =>
          `Row ${r.rowNumber},${r.status},"${(r.message ?? "").replace(/"/g, '""')}","${(r.warnings ?? []).join("; ")}"`,
      );
    const csv = ["Row,Status,Message,Warnings", ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "import-error-report.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const createdCount =
    result?.results.filter((r) => r.action === "CREATED").length ?? 0;
  const updatedCount =
    result?.results.filter((r) => r.action === "UPDATED").length ?? 0;

  const canRollbackResult = result != null && createdCount > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Data import</h1>
        <p className="text-muted-foreground">
          {countryFlag} {countryName} ({countryCode}) · {clinicName} · Dates: {dateFormat} ·{" "}
          {currency}
        </p>
      </div>

      <Tabs defaultValue="import">
        <TabsList>
          <TabsTrigger value="import">Import</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="help">Help</TabsTrigger>
        </TabsList>

        {/* Tab 1: Import wizard */}
        <TabsContent value="import" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileSpreadsheet className="h-4 w-4" />
                Import wizard
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-sm font-medium">1. Select entity</p>
                  <Select value={entity} onValueChange={(v) => setEntity(v as ImportEntity)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ENTITIES.map((e) => (
                        <SelectItem key={e} value={e}>
                          {e.charAt(0) + e.slice(1).toLowerCase()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">3. Import mode</p>
                  <Select value={mode} onValueChange={(v) => setMode(v as ImportMode)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(MODE_LABELS) as ImportMode[]).map((m) => (
                        <SelectItem key={m} value={m}>
                          {MODE_LABELS[m]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">2. Download template</p>
                <Button type="button" variant="outline" onClick={downloadTemplate}>
                  <Download className="mr-2 h-4 w-4" />
                  Download {entity.toLowerCase()} template (.xlsx)
                </Button>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">4. Upload file</p>
                <div
                  className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const dropped = e.dataTransfer.files[0];
                    if (dropped) void handleFileSelect(dropped);
                  }}
                >
                  <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Drag &amp; drop or browse · .xlsx, .xls, .csv
                  </p>
                  <label className="mt-3 cursor-pointer">
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void handleFileSelect(f);
                        e.target.value = "";
                      }}
                    />
                    <Button type="button" variant="secondary" asChild>
                      <span>Browse files</span>
                    </Button>
                  </label>
                  {file && (
                    <p className="mt-3 text-sm">
                      {file.name} · {formatFileSize(file.size)}
                      {previewRows.length > 0 && ` · ${totalRowCount} row(s) detected`}
                    </p>
                  )}
                </div>
              </div>

              {previewRows.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">5. Preview (first rows)</p>
                  <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50">
                        <tr>
                          {Object.keys(previewRows[0]).slice(0, 6).map((key) => (
                            <th key={key} className="p-2 text-left font-medium">
                              {key}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {previewRows.map((row, i) => (
                          <tr key={i} className="border-t">
                            {Object.keys(previewRows[0])
                              .slice(0, 6)
                              .map((key) => (
                                <td key={key} className="p-2 text-muted-foreground">
                                  {String(row[key] ?? "")}
                                </td>
                              ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <p className="text-sm font-medium">6. Start import</p>
                <Button
                  type="button"
                  disabled={!file || importing || previewRows.length === 0}
                  onClick={() => void startImport()}
                >
                  {importing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Start import
                </Button>
                {importing && <Progress value={progress} className="h-2" />}
              </div>

              {result && (
                <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
                  <p className="font-semibold">Import complete</p>
                  <div className="grid gap-2 text-sm sm:grid-cols-2">
                    <p>✓ Created: {createdCount}</p>
                    <p>↺ Updated: {updatedCount}</p>
                    <p>⚠ Warnings: {result.warnings}</p>
                    <p>✗ Errors: {result.errors}</p>
                    <p>— Skipped: {result.skipped}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(result.errors > 0 || result.warnings > 0) && (
                      <Button size="sm" variant="outline" onClick={downloadErrorReport}>
                        Download error report
                      </Button>
                    )}
                    {canRollbackResult && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void rollbackBatch(result.batchId)}
                      >
                        <RotateCcw className="mr-1 h-3 w-3" />
                        Rollback
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: History */}
        <TabsContent value="history" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <History className="h-4 w-4" />
                Import history
              </CardTitle>
            </CardHeader>
            <CardContent>
              {importHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground">No imports yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs text-muted-foreground">
                        <th className="p-2">Date</th>
                        <th className="p-2">File</th>
                        <th className="p-2">Entity</th>
                        <th className="p-2">Mode</th>
                        <th className="p-2">Results</th>
                        <th className="p-2">Status</th>
                        <th className="p-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importHistory.map((batch) => {
                        const canRollback =
                          batch.canRollback &&
                          !batch.rolledBackAt &&
                          Date.now() - new Date(batch.createdAt).getTime() < 24 * 3600000;

                        return (
                          <tr key={batch.id} className="border-b">
                            <td className="p-2 whitespace-nowrap">
                              {new Date(batch.createdAt).toLocaleString()}
                            </td>
                            <td className="p-2">{batch.fileName}</td>
                            <td className="p-2">{batch.entity}</td>
                            <td className="p-2">{batch.mode}</td>
                            <td className="p-2 text-xs">
                              {batch.successRows} ok · {batch.warningRows} warn ·{" "}
                              {batch.errorRows} err · {batch.skippedRows} skip
                            </td>
                            <td className="p-2">
                              <Badge variant="secondary">{batch.status}</Badge>
                              {batch.rolledBackAt && (
                                <span className="ml-1 text-xs text-amber-600">Rolled back</span>
                              )}
                            </td>
                            <td className="p-2">
                              <div className="flex gap-1">
                                {batch.errorRows > 0 && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setViewErrorsBatch(batch)}
                                  >
                                    View errors
                                  </Button>
                                )}
                                {canRollback && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={importing}
                                    onClick={() => void rollbackBatch(batch.id)}
                                  >
                                    Rollback
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Help */}
        <TabsContent value="help" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <HelpCircle className="h-4 w-4" />
                Country-specific guidance — {countryName}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              {identityDocs.map((doc) => (
                <div key={doc.label} className="rounded-lg border p-3">
                  <p className="font-medium">
                    {doc.label}
                    {doc.mandatory && " (required)"}
                  </p>
                  <p className="text-muted-foreground">Format: {doc.format}</p>
                  <p className="text-muted-foreground">Example: {doc.example}</p>
                </div>
              ))}

              <div className="rounded-lg border p-3">
                <p className="font-medium">Phone numbers</p>
                <p className="text-muted-foreground">
                  Must include country code {dialCode} (e.g. {phoneExample})
                </p>
              </div>

              <div className="rounded-lg border p-3">
                <p className="font-medium">Dates</p>
                <p className="text-muted-foreground">Use {dateFormat} format throughout</p>
              </div>

              {insuranceProviders.length > 0 && (
                <div className="rounded-lg border p-3">
                  <p className="font-medium">Insurance providers</p>
                  <p className="text-muted-foreground">
                    Select from approved list: {insuranceProviders.slice(0, 8).join(", ")}
                    {insuranceProviders.length > 8 && ` +${insuranceProviders.length - 8} more`}
                  </p>
                </div>
              )}

              {customFields.length > 0 && (
                <div className="rounded-lg border p-3">
                  <p className="font-medium">Custom fields</p>
                  <ul className="mt-1 list-inside list-disc text-muted-foreground">
                    {customFields.map((f) => (
                      <li key={f.fieldKey}>{f.fieldLabel}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-2">
                {ENTITIES.map((e) => (
                  <Button
                    key={e}
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEntity(e);
                      window.location.href = `/api/import/template?entity=${e}`;
                    }}
                  >
                    <Download className="mr-1 h-3 w-3" />
                    {e} template
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {viewErrorsBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="max-h-[80vh] w-full max-w-lg overflow-hidden">
            <CardHeader>
              <CardTitle className="text-base">Import errors — {viewErrorsBatch.fileName}</CardTitle>
            </CardHeader>
            <CardContent className="max-h-96 overflow-y-auto text-xs">
              <pre className="whitespace-pre-wrap">
                {JSON.stringify(viewErrorsBatch.errorReport, null, 2)}
              </pre>
            </CardContent>
            <div className="p-4 pt-0">
              <Button variant="outline" onClick={() => setViewErrorsBatch(null)}>
                Close
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
