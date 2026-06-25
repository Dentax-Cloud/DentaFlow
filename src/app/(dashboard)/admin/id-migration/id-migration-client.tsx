"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  getIdMigrationStatus,
  runIdMigration,
} from "@/app/(dashboard)/features/admin/id-migration-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertTriangle } from "lucide-react";

type Status = Awaited<ReturnType<typeof getIdMigrationStatus>>;

export function IdMigrationClient({ initialStatus }: { initialStatus: Status }) {
  const [status, setStatus] = useState(initialStatus);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  const patientPct =
    status.patientsTotal > 0
      ? Math.round((status.patientsWithId / status.patientsTotal) * 100)
      : 100;

  async function handleMigrate() {
    setRunning(true);
    try {
      const res = await runIdMigration();
      setResult(res as Record<string, unknown>);
      const updated = await getIdMigrationStatus();
      setStatus(updated);
      toast.success("Migration complete");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Migration failed");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">ID Migration</h1>
        <p className="text-muted-foreground">
          Assign structured tenant, branch, and patient IDs to existing records
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tenant code</CardTitle>
          </CardHeader>
          <CardContent>
            {status.tenantCode ? (
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="font-mono font-semibold">{status.tenantCode}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-amber-600">
                <AlertTriangle className="h-4 w-4" />
                Not assigned
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Branches</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {status.branchesWithCode === status.branchesTotal ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-amber-600" />
              )}
              <span>
                {status.branchesWithCode}/{status.branchesTotal} with codes
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Patients</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span>
              {status.patientsWithId}/{status.patientsTotal} with structured IDs
            </span>
            <Badge variant={status.patientsPending > 0 ? "secondary" : "default"}>
              {status.patientsPending} pending
            </Badge>
          </div>
          <Progress value={patientPct} />
        </CardContent>
      </Card>

      <Button onClick={() => void handleMigrate()} disabled={running}>
        {running ? "Running migration..." : "Run migration"}
      </Button>

      {result && (
        <Card>
          <CardContent className="pt-6 font-mono text-sm">
            <pre>{JSON.stringify(result, null, 2)}</pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
