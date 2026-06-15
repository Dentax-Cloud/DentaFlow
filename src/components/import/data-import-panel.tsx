"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Download, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { csvRowsToObjects, downloadCsv, parseCsv } from "@/lib/import/csv";
import { IMPORT_TEMPLATES, type ImportKind } from "@/lib/import/templates";
import {
  importInventoryItems,
  importPatients,
  importProcedures,
  type ImportResult,
} from "@/app/(dashboard)/features/import/actions";
import {
  inventoryImportRowSchema,
  patientImportRowSchema,
  procedureImportRowSchema,
} from "@/app/(dashboard)/features/import/schemas";

type PreviewRow = { row: number; valid: boolean; message?: string; data: Record<string, string> };

const IMPORT_ACTIONS = {
  patients: importPatients,
  inventory: importInventoryItems,
  procedures: importProcedures,
} as const;

const ROW_SCHEMAS = {
  patients: patientImportRowSchema,
  inventory: inventoryImportRowSchema,
  procedures: procedureImportRowSchema,
} as const;

export function DataImportPanel() {
  const [kind, setKind] = useState<ImportKind>("patients");
  const [duplicateMode, setDuplicateMode] = useState<"skip" | "update">("skip");
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [lastResult, setLastResult] = useState<ImportResult | null>(null);

  const validRows = preview.filter((p) => p.valid).map((p) => p.data);

  const handleFile = useCallback(
    async (file: File) => {
      setLastResult(null);
      const text = await file.text();
      const matrix = parseCsv(text);
      const { records } = csvRowsToObjects<Record<string, string>>(matrix);
      const schema = ROW_SCHEMAS[kind];

      const rows: PreviewRow[] = records.map((record, idx) => {
        const parsed = schema.safeParse(record);
        return {
          row: idx + 2,
          valid: parsed.success,
          message: parsed.success ? undefined : parsed.error.issues[0]?.message,
          data: record,
        };
      });

      setPreview(rows);
      setProgress(0);
    },
    [kind],
  );

  async function runImport() {
    if (validRows.length === 0) {
      toast.error("No valid rows to import");
      return;
    }

    setImporting(true);
    setProgress(10);

    const action = IMPORT_ACTIONS[kind];
    const result = await action({
      rows: validRows as never,
      duplicateMode,
    });

    setProgress(100);
    setImporting(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    setLastResult(result.data);
    toast.success(
      `Import complete — ${result.data.created} created, ${result.data.updated} updated, ${result.data.skipped} skipped`,
    );
  }

  function downloadTemplate() {
    const t = IMPORT_TEMPLATES[kind];
    downloadCsv(t.filename, [...t.headers], t.sample.map((r) => [...r]));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Data import</h1>
        <p className="text-muted-foreground">
          Bulk upload patients, inventory, or procedure price lists via CSV. Save Excel files as CSV before uploading.
        </p>
      </div>

      <Tabs value={kind} onValueChange={(v) => { setKind(v as ImportKind); setPreview([]); setLastResult(null); }}>
        <TabsList>
          <TabsTrigger value="patients">Patients</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="procedures">Procedures</TabsTrigger>
        </TabsList>

        {(["patients", "inventory", "procedures"] as const).map((tab) => (
          <TabsContent key={tab} value={tab} className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileSpreadsheet className="h-4 w-4" />
                  {tab.charAt(0).toUpperCase() + tab.slice(1)} import
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-3">
                  <Button type="button" variant="outline" onClick={downloadTemplate}>
                    <Download className="mr-2 h-4 w-4" />
                    Download template
                  </Button>
                  <label className="inline-flex cursor-pointer">
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void handleFile(file);
                        e.target.value = "";
                      }}
                    />
                    <Button type="button" variant="secondary" asChild>
                      <span>
                        <Upload className="mr-2 h-4 w-4" />
                        Upload CSV
                      </span>
                    </Button>
                  </label>
                </div>

                <div className="flex items-center gap-3 text-sm">
                  <span className="text-muted-foreground">Duplicates:</span>
                  <Button
                    type="button"
                    size="sm"
                    variant={duplicateMode === "skip" ? "default" : "outline"}
                    onClick={() => setDuplicateMode("skip")}
                  >
                    Skip
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={duplicateMode === "update" ? "default" : "outline"}
                    onClick={() => setDuplicateMode("update")}
                  >
                    Update existing
                  </Button>
                </div>

                {preview.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span>
                        {preview.filter((p) => p.valid).length} valid / {preview.length} rows
                      </span>
                      <Button type="button" onClick={runImport} disabled={importing || validRows.length === 0}>
                        {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Import {validRows.length} rows
                      </Button>
                    </div>
                    {importing && <Progress value={progress} />}
                    <div className="max-h-64 overflow-auto rounded-lg border">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/50 sticky top-0">
                          <tr>
                            <th className="p-2 text-left">Row</th>
                            <th className="p-2 text-left">Status</th>
                            <th className="p-2 text-left">Details</th>
                          </tr>
                        </thead>
                        <tbody>
                          {preview.slice(0, 100).map((row) => (
                            <tr key={row.row} className="border-t">
                              <td className="p-2">{row.row}</td>
                              <td className="p-2">
                                <Badge variant={row.valid ? "success" : "destructive"}>
                                  {row.valid ? "OK" : "Error"}
                                </Badge>
                              </td>
                              <td className="p-2 text-muted-foreground">
                                {row.message ?? Object.values(row.data).slice(0, 3).join(" · ")}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {preview.length > 100 && (
                        <p className="p-2 text-xs text-muted-foreground">Showing first 100 rows…</p>
                      )}
                    </div>
                  </div>
                )}

                {lastResult && (
                  <div className="rounded-lg border bg-muted/30 p-4 text-sm">
                    <p className="font-medium">Last import result</p>
                    <p className="mt-1 text-muted-foreground">
                      Created {lastResult.created} · Updated {lastResult.updated} · Skipped {lastResult.skipped}
                      {lastResult.errors.length > 0 && ` · ${lastResult.errors.length} errors`}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
