"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  updateEmergencyStatus,
  updateTriageLevel,
  generateEmergencySOAP,
  convertToChairside,
  saveEmergencyNote,
} from "@/app/(dashboard)/features/clinical/emergency-actions";
import {
  TRIAGE_CONFIG,
  STATUS_CONFIG,
  getWaitTimeMinutes,
  getComplaintLabel,
  sortByTriagePriority,
  type TriageLevel,
  type EmergencyStatus,
} from "@/lib/clinical/emergency-types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

type IntakeRecord = {
  id: string;
  patientId: string;
  chiefComplaint: string;
  painScore: number;
  triageLevel: string;
  status: string;
  clinicalNote: string | null;
  createdAt: Date | string;
  patient: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string | null;
  };
};

type Props = {
  intakes: IntakeRecord[];
  canWrite?: boolean;
  selectedIntakeId?: string | null;
};

export function EmergencyQueue({ intakes, canWrite = true, selectedIntakeId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [expandedId, setExpandedId] = useState<string | null>(selectedIntakeId ?? null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    const timer = setInterval(() => {
      router.refresh();
    }, 60000);
    return () => clearInterval(timer);
  }, [router]);

  const sorted = sortByTriagePriority(intakes);
  const waiting = sorted.filter((i) => i.status === "WAITING");
  const inProgress = sorted.filter((i) => ["IN_TRIAGE", "IN_CHAIR"].includes(i.status));
  const completed = sorted.filter((i) => ["COMPLETED", "REFERRED"].includes(i.status));

  function handleStatusChange(intakeId: string, status: string) {
    startTransition(async () => {
      try {
        await updateEmergencyStatus(intakeId, status);
        router.refresh();
      } catch {
        toast.error("Failed to update status");
      }
    });
  }

  function handleGenerateSOAP(intakeId: string) {
    startTransition(async () => {
      try {
        const soap = await generateEmergencySOAP(intakeId);
        setNotes((prev) => ({ ...prev, [intakeId]: soap }));
        toast.success("SOAP note generated");
        router.refresh();
      } catch {
        toast.error("Failed to generate SOAP");
      }
    });
  }

  function handleSaveNote(intakeId: string) {
    const note = notes[intakeId];
    if (!note) return;
    startTransition(async () => {
      try {
        await saveEmergencyNote(intakeId, note);
        toast.success("Note saved");
        router.refresh();
      } catch {
        toast.error("Failed to save note");
      }
    });
  }

  function handleMoveToChairside(intakeId: string) {
    startTransition(async () => {
      try {
        const result = await convertToChairside(intakeId);
        router.push(result.redirectUrl);
      } catch {
        toast.error("Failed to open chairside");
      }
    });
  }

  function IntakeCard({ intake }: { intake: IntakeRecord }) {
    const triage = TRIAGE_CONFIG[intake.triageLevel as TriageLevel] ?? TRIAGE_CONFIG.ROUTINE;
    const statusCfg = STATUS_CONFIG[intake.status as EmergencyStatus];
    const waitMins = getWaitTimeMinutes(new Date(intake.createdAt));
    const isExpanded = expandedId === intake.id;

    return (
      <Card className={`border-l-4 transition-all ${triage.borderColor}`}>
        <div
          className="cursor-pointer p-4"
          onClick={() => setExpandedId(isExpanded ? null : intake.id)}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={`flex-shrink-0 rounded px-2 py-1 text-xs font-bold ${triage.bgColor} ${triage.color}`}
              >
                {triage.label.toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-semibold">
                  {intake.patient.firstName} {intake.patient.lastName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {getComplaintLabel(intake.chiefComplaint)} · Pain {intake.painScore}/10
                </p>
              </div>
            </div>
            <div className="flex flex-shrink-0 items-center gap-2">
              <span
                className={`text-xs font-medium ${
                  waitMins >= 30 && intake.status === "WAITING"
                    ? "text-red-600"
                    : "text-muted-foreground"
                }`}
              >
                {waitMins < 1 ? "Just arrived" : `${waitMins}m ago`}
              </span>
              <Badge className={statusCfg?.color ?? ""}>{statusCfg?.label ?? intake.status}</Badge>
              <span className="text-xs text-muted-foreground">{isExpanded ? "▲" : "▼"}</span>
            </div>
          </div>
        </div>

        {isExpanded && (
          <div className="space-y-4 border-t px-4 pb-4 pt-4">
            {intake.patient.phone && (
              <p className="text-sm text-muted-foreground">📞 {intake.patient.phone}</p>
            )}

            {canWrite ? (
            <div>
              <p className="mb-2 text-xs font-medium">Change triage level:</p>
              <div className="flex flex-wrap gap-2">
                {(Object.entries(TRIAGE_CONFIG) as [TriageLevel, (typeof TRIAGE_CONFIG)[TriageLevel]][]).map(
                  ([level, cfg]) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => {
                        startTransition(async () => {
                          await updateTriageLevel(intake.id, level);
                          router.refresh();
                        });
                      }}
                      disabled={isPending}
                      className={`rounded border px-2 py-1 text-xs font-medium transition-all ${
                        intake.triageLevel === level
                          ? `${cfg.bgColor} ${cfg.color} border-current`
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      {cfg.label}
                    </button>
                  ),
                )}
              </div>
            </div>
            ) : null}

            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-medium">Clinical note</p>
                {canWrite ? (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleGenerateSOAP(intake.id)}
                    disabled={isPending}
                    className="h-7 text-xs"
                    type="button"
                  >
                    ✨ Generate SOAP
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleSaveNote(intake.id)}
                    disabled={isPending}
                    className="h-7 text-xs"
                    type="button"
                  >
                    Save
                  </Button>
                </div>
                ) : null}
              </div>
              {canWrite ? (
              <textarea
                value={notes[intake.id] ?? intake.clinicalNote ?? ""}
                onChange={(e) =>
                  setNotes((prev) => ({
                    ...prev,
                    [intake.id]: e.target.value,
                  }))
                }
                rows={4}
                className="w-full resize-none rounded-md border px-3 py-2 text-sm"
                placeholder="Clinical notes..."
              />
              ) : intake.clinicalNote ? (
                <p className="whitespace-pre-wrap rounded-md border bg-muted/30 px-3 py-2 text-sm">
                  {intake.clinicalNote}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">No clinical note recorded.</p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {canWrite && statusCfg?.nextStatus && (
                <Button
                  size="sm"
                  onClick={() => handleStatusChange(intake.id, statusCfg.nextStatus!)}
                  disabled={isPending}
                  type="button"
                >
                  {statusCfg.nextLabel}
                </Button>
              )}

              {canWrite && ["IN_CHAIR", "IN_TRIAGE"].includes(intake.status) && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleMoveToChairside(intake.id)}
                  disabled={isPending}
                  type="button"
                >
                  🪑 Open chairside
                </Button>
              )}

              <Button
                size="sm"
                variant="outline"
                onClick={() => router.push(`/patients/${intake.patientId}`)}
                type="button"
              >
                👤 Patient 360
              </Button>

              {!canWrite ? null : !["COMPLETED", "REFERRED"].includes(intake.status) && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleStatusChange(intake.id, "REFERRED")}
                  disabled={isPending}
                  className="text-muted-foreground"
                  type="button"
                >
                  Refer elsewhere
                </Button>
              )}
            </div>
          </div>
        )}
      </Card>
    );
  }

  if (intakes.length === 0) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        <p className="mb-4 text-5xl">✅</p>
        <p className="text-lg font-medium">No emergency cases today</p>
        <p className="mt-1 text-sm">Queue is clear</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3 text-center">
          <p className="text-2xl font-bold text-yellow-600">{waiting.length}</p>
          <p className="text-xs text-muted-foreground">Waiting</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-2xl font-bold text-blue-600">{inProgress.length}</p>
          <p className="text-xs text-muted-foreground">In progress</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-2xl font-bold text-green-600">{completed.length}</p>
          <p className="text-xs text-muted-foreground">Completed</p>
        </Card>
      </div>

      {waiting.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Waiting ({waiting.length})
          </h3>
          <div className="space-y-3">
            {waiting.map((i) => (
              <IntakeCard key={i.id} intake={i} />
            ))}
          </div>
        </div>
      )}

      {inProgress.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            In progress ({inProgress.length})
          </h3>
          <div className="space-y-3">
            {inProgress.map((i) => (
              <IntakeCard key={i.id} intake={i} />
            ))}
          </div>
        </div>
      )}

      {completed.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Completed today ({completed.length})
          </h3>
          <div className="space-y-3 opacity-75">
            {completed.map((i) => (
              <IntakeCard key={i.id} intake={i} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
