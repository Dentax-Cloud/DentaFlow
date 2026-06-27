"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import {
  Activity,
  AlertTriangle,
  Armchair,
  ArrowLeft,
  Calendar,
  CalendarClock,
  FileText,
  Heart,
  Mail,
  MapPin,
  Phone,
  Pill,
  Receipt,
  ScanLine,
  Camera,
  Sparkles,
  Stethoscope,
  User,
  Copy,
  Printer,
  Tag,
  Building2,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { IMAGE_TYPE_CONFIG, PHOTO_CATEGORY_CONFIG, type ImageType, type PhotoCategory } from "@/lib/clinical/image-types";
import { TRIAGE_CONFIG, getComplaintLabel, type TriageLevel } from "@/lib/clinical/emergency-types";
import { PatientIdCard } from "@/components/patients/patient-id-card";
import { PatientLabel } from "@/components/patients/patient-label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { PatientAttachmentUploader } from "@/components/upload/patient-attachment-uploader";

/** Core demographics from the server (matches product spec). */
export interface PatientDetailProfile {
  id: string;
  patientId: string;
  structuredPatientId?: string;
  patientNumber?: string;
  branchCode?: string;
  bloodGroup?: string;
  photoUrl?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  fatherName?: string;
  grandfatherName?: string;
  nationality?: string;
  maritalStatus?: string;
  occupation?: string;
  employer?: string;
  idDocumentType?: string;
  idDocumentNumber?: string;
  idDocumentExpiry?: string;
  insuranceProvider?: string;
  insuranceNetwork?: string;
  insuranceMemberId?: string;
  insurancePolicyNo?: string;
  insuranceExpiry?: string;
  customFieldValues?: Array<{ label: string; value: string; section: string }>;
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  gender?: string;
  phone: string;
  email?: string;
  address?: string;
  medicalHistory?: string;
  allergies?: string[];
  createdAt: string;
  /** Extended 360° data */
  portalUserId?: string | null;
  medications?: string[];
  notes?: string | null;
  emergencyContact?: string | null;
  emergencyPhone?: string | null;
  noShowRisk?: string | null;
  churnRisk?: string | null;
  lastVisitAt?: string | null;
  nextRecallDue?: string | null;
  teethFindings?: number;
  appointments: {
    id: string;
    title: string;
    status: string;
    startTime: string;
    endTime: string;
  }[];
  treatmentPlans: {
    id: string;
    title: string;
    status: string;
    totalCost: number;
    createdAt: string;
    itemCount: number;
    completedCount: number;
  }[];
  invoices: {
    id: string;
    invoiceNumber: string;
    status: string;
    total: number;
    createdAt: string;
  }[];
  clinicalNotes: {
    id: string;
    visitDate: string;
    title: string | null;
    assessment: string | null;
    subjective: string | null;
    aiGenerated: boolean;
    signedByName: string | null;
    signedAt: string | null;
    toothNumbers: string[];
  }[];
  attachments: {
    id: string;
    name: string;
    type: string;
    url: string;
    createdAt: string;
  }[];
}

export interface PatientDetailClientProps {
  patient: PatientDetailProfile;
  clinicName: string;
  tenantCode: string;
  tenantSlug?: string;
  clinicPhone?: string | null;
  uploadsEnabled: boolean;
  latestPerio?: {
    id: string;
    chartDate: string;
    perioStage: string | null;
    perioGrade: string | null;
    bopPercent: number | null;
  } | null;
  clinicalImages?: {
    total: number;
    byType: Record<string, number>;
    recent: {
      id: string;
      url: string;
      type: string;
      fileName: string | null;
      takenAt: string | null;
    }[];
  };
  patientPhotos?: {
    total: number;
    byCategory: Record<string, number>;
    beforeAfterCount: number;
    recent: {
      id: string;
      url: string;
      photoCategory: string | null;
      takenAt: string | null;
    }[];
  };
  emergencyHistory?: {
    id: string;
    chiefComplaint: string;
    painScore: number;
    triageLevel: string;
    status: string;
    createdAt: string;
  }[];
}

type TabId =
  | "overview"
  | "appointments"
  | "clinical"
  | "perio"
  | "radiographs"
  | "photos"
  | "treatment"
  | "billing"
  | "documents";

const TABS: { id: TabId; label: string; icon: typeof User }[] = [
  { id: "overview", label: "Overview", icon: User },
  { id: "appointments", label: "Appointments", icon: Calendar },
  { id: "clinical", label: "Clinical history", icon: Stethoscope },
  { id: "perio", label: "Perio", icon: Activity },
  { id: "radiographs", label: "Radiographs", icon: ScanLine },
  { id: "photos", label: "Photos", icon: Camera },
  { id: "treatment", label: "Treatment plans", icon: Heart },
  { id: "billing", label: "Invoice history", icon: Receipt },
  { id: "documents", label: "Documents", icon: FileText },
];

function computeAge(dateOfBirth?: string): number | null {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}

function initials(first: string, last: string) {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: typeof Activity;
}) {
  return (
    <Card className="border-border/60 shadow-sm">
      <CardContent className="flex items-center gap-4 p-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="text-2xl font-bold tabular-nums">{value}</p>
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ message, children }: { message: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
      <p>{message}</p>
      {children}
    </div>
  );
}

function riskBadgeVariant(level: string) {
  if (level === "HIGH") return "destructive" as const;
  if (level === "MEDIUM") return "warning" as const;
  return "success" as const;
}

export function PatientDetailClient({
  patient,
  clinicName,
  tenantCode,
  tenantSlug,
  clinicPhone,
  uploadsEnabled,
  latestPerio = null,
  clinicalImages,
  patientPhotos,
  emergencyHistory = [],
}: PatientDetailClientProps) {
  const [idCardOpen, setIdCardOpen] = useState(false);
  const [labelOpen, setLabelOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  const fullName = `${patient.firstName} ${patient.lastName}`;
  const age = computeAge(patient.dateOfBirth);

  const openInvoices = useMemo(
    () =>
      patient.invoices.filter((i) => !["PAID", "VOID", "CANCELED"].includes(i.status)).length,
    [patient.invoices],
  );

  const timeline = useMemo(() => {
    const events: { id: string; date: string; title: string; kind: string; meta?: string }[] = [];
    for (const a of patient.appointments) {
      events.push({
        id: `apt-${a.id}`,
        date: a.startTime,
        title: a.title,
        kind: "appointment",
        meta: a.status,
      });
    }
    for (const n of patient.clinicalNotes) {
      events.push({
        id: `note-${n.id}`,
        date: n.visitDate,
        title: n.assessment?.slice(0, 80) ?? "Clinical note",
        kind: "clinical",
        meta: n.aiGenerated ? "AI" : undefined,
      });
    }
    for (const inv of patient.invoices) {
      events.push({
        id: `inv-${inv.id}`,
        date: inv.createdAt,
        title: inv.invoiceNumber,
        kind: "billing",
        meta: inv.status,
      });
    }
    for (const e of emergencyHistory) {
      events.push({
        id: `emergency-${e.id}`,
        date: e.createdAt,
        title: `Emergency: ${getComplaintLabel(e.chiefComplaint)}`,
        kind: "emergency",
        meta: `${TRIAGE_CONFIG[e.triageLevel as TriageLevel]?.label ?? e.triageLevel} · Pain ${e.painScore}/10`,
      });
    }
    return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 8);
  }, [patient, emergencyHistory]);

  return (
    <div className="space-y-6 pb-10">
      <Breadcrumbs
        items={[
          { label: "Patients", href: "/patients" },
          { label: fullName },
        ]}
      />
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-slate-50 via-white to-cyan-50/80 p-6 shadow-sm dark:from-slate-900 dark:via-slate-900 dark:to-cyan-950/30">
        <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-primary/5 blur-2xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex gap-4">
            <Button variant="ghost" size="icon" className="shrink-0 lg:hidden" asChild>
              <Link href="/patients" aria-label="Back to patients">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <Avatar className="h-16 w-16 border-2 border-background shadow-md">
              <AvatarFallback className="bg-primary/15 text-lg font-semibold text-primary">
                {initials(patient.firstName, patient.lastName)}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{fullName}</h1>
                {patient.bloodGroup && (
                  <Badge variant="destructive">{patient.bloodGroup}</Badge>
                )}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {patient.structuredPatientId ? (
                  <>
                    <span className="font-mono text-base font-semibold tracking-tight sm:text-lg">
                      {patient.structuredPatientId}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => {
                        void navigator.clipboard.writeText(patient.structuredPatientId!);
                        toast.success("Patient ID copied");
                      }}
                      aria-label="Copy patient ID"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    {patient.patientNumber && (
                      <span className="font-mono text-xs text-muted-foreground">
                        Legacy {patient.patientNumber}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="font-mono text-base font-semibold tracking-tight sm:text-lg">
                    {patient.patientNumber ?? patient.patientId}
                  </span>
                )}
              </div>
              {(patient.emergencyContactName || patient.emergencyContact) && (
                <p className="mt-1 text-sm text-muted-foreground">
                  Emergency: {patient.emergencyContactName ?? patient.emergencyContact}
                  {(patient.emergencyContactPhone ?? patient.emergencyPhone) &&
                    ` · ${patient.emergencyContactPhone ?? patient.emergencyPhone}`}
                </p>
              )}
              <p className="mt-1 text-sm text-muted-foreground">
                {age != null && <span>{age} yrs · </span>}
                {patient.gender && <span className="capitalize">{patient.gender} · </span>}
                Patient since {formatDate(patient.createdAt)}
                {patient.lastVisitAt && (
                  <span> · Last visit {formatDate(patient.lastVisitAt)}</span>
                )}
                {patient.nextRecallDue && (
                  <span> · Next recall {formatDate(patient.nextRecallDue)}</span>
                )}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {patient.noShowRisk && (
                  <Badge variant={riskBadgeVariant(patient.noShowRisk)} className="gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    No-show {patient.noShowRisk.toLowerCase()}
                  </Badge>
                )}
                {patient.churnRisk && (
                  <Badge variant={riskBadgeVariant(patient.churnRisk)} className="gap-1">
                    Churn {patient.churnRisk.toLowerCase()}
                  </Badge>
                )}
                {(patient.allergies?.length ?? 0) > 0 && (
                  <Badge variant="destructive">
                    {patient.allergies!.length} allerg
                    {patient.allergies!.length === 1 ? "y" : "ies"}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 lg:justify-end">
            <Button variant="outline" size="sm" onClick={() => setIdCardOpen(true)}>
              <Printer className="mr-2 h-4 w-4" />
              ID card
            </Button>
            <Button variant="outline" size="sm" onClick={() => setLabelOpen(true)}>
              <Tag className="mr-2 h-4 w-4" />
              Label
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/patients">
                <ArrowLeft className="mr-2 h-4 w-4" />
                All patients
              </Link>
            </Button>
            <Button size="sm" asChild>
              <Link href={`/clinical?patientId=${patient.id}`}>
                <Stethoscope className="mr-2 h-4 w-4" />
                Open chart
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/clinical/chairside?patientId=${patient.id}`}>
                <Armchair className="mr-2 h-4 w-4" />
                Chairside
              </Link>
            </Button>
            <Button variant="secondary" size="sm" asChild>
              <Link href={`/appointments?patientId=${patient.id}`}>
                <Calendar className="mr-2 h-4 w-4" />
                Book appointment
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={idCardOpen} onOpenChange={setIdCardOpen}>
        <DialogContent className="max-w-fit">
          <DialogHeader>
            <DialogTitle>Patient ID card</DialogTitle>
          </DialogHeader>
          <PatientIdCard
            patientId={patient.patientId}
            patientName={fullName}
            dateOfBirth={patient.dateOfBirth}
            bloodGroup={patient.bloodGroup}
            criticalAllergy={patient.allergies?.[0]}
            photoUrl={patient.photoUrl}
            clinicName={clinicName}
            tenantCode={tenantCode}
            tenantSlug={tenantSlug}
            branchCode={patient.branchCode}
            clinicPhone={clinicPhone}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={labelOpen} onOpenChange={setLabelOpen}>
        <DialogContent className="max-w-fit">
          <DialogHeader>
            <DialogTitle>Patient label</DialogTitle>
          </DialogHeader>
          <PatientLabel
            patientId={patient.patientId}
            patientName={fullName}
            dateOfBirth={patient.dateOfBirth}
            bloodGroup={patient.bloodGroup}
          />
        </DialogContent>
      </Dialog>

      {/* KPI strip */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Appointments"
          value={patient.appointments.length}
          sub={patient.lastVisitAt ? `Last visit ${formatDate(patient.lastVisitAt)}` : "No visits yet"}
          icon={CalendarClock}
        />
        <StatCard
          label="Chart findings"
          value={patient.teethFindings ?? 0}
          sub="Across odontogram"
          icon={Activity}
        />
        <StatCard
          label="Treatment plans"
          value={patient.treatmentPlans.length}
          icon={Heart}
        />
        <StatCard
          label="Open invoices"
          value={openInvoices}
          sub={`${patient.invoices.length} total`}
          icon={Receipt}
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto rounded-lg border bg-muted/40 p-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors",
              activeTab === id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="space-y-6 min-w-0">
          {activeTab === "overview" && (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Contact & demographics</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <InfoRow icon={Phone} label="Phone" value={patient.phone || "—"} />
                    <InfoRow icon={Mail} label="Email" value={patient.email ?? "—"} />
                    <InfoRow icon={MapPin} label="Address" value={patient.address ?? "—"} />
                    {patient.dateOfBirth && (
                      <InfoRow
                        icon={Calendar}
                        label="Date of birth"
                        value={formatDate(patient.dateOfBirth)}
                      />
                    )}
                    {patient.gender && (
                      <InfoRow icon={User} label="Gender" value={patient.gender} />
                    )}
                  </CardContent>
                </Card>

                {(patient.idDocumentNumber ||
                  patient.insuranceProvider ||
                  patient.nationality ||
                  patient.occupation) && (
                  <Card className="md:col-span-2">
                    <CardHeader>
                      <CardTitle className="text-base">Identity & insurance</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
                      {patient.idDocumentType && (
                        <InfoRow
                          icon={Tag}
                          label={patient.idDocumentType.replace(/_/g, " ")}
                          value={patient.idDocumentNumber ?? "—"}
                        />
                      )}
                      {patient.nationality && (
                        <InfoRow icon={User} label="Nationality" value={patient.nationality} />
                      )}
                      {patient.fatherName && (
                        <InfoRow icon={User} label="Father&apos;s name" value={patient.fatherName} />
                      )}
                      {patient.occupation && (
                        <InfoRow icon={User} label="Occupation" value={patient.occupation} />
                      )}
                      {patient.employer && (
                        <InfoRow icon={Building2} label="Employer" value={patient.employer} />
                      )}
                      {patient.insuranceProvider && (
                        <InfoRow
                          icon={Stethoscope}
                          label="Insurance"
                          value={`${patient.insuranceProvider}${
                            patient.insuranceNetwork ? ` · ${patient.insuranceNetwork}` : ""
                          }`}
                        />
                      )}
                      {patient.insuranceMemberId && (
                        <InfoRow
                          icon={Tag}
                          label="Member ID"
                          value={patient.insuranceMemberId}
                        />
                      )}
                    </CardContent>
                  </Card>
                )}

                {(patient.customFieldValues?.length ?? 0) > 0 && (
                  <Card className="md:col-span-2">
                    <CardHeader>
                      <CardTitle className="text-base">Custom fields</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
                      {patient.customFieldValues!.map((cf) => (
                        <InfoRow key={cf.label} icon={FileText} label={cf.label} value={cf.value} />
                      ))}
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Medical profile</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1.5">Allergies</p>
                      {(patient.allergies?.length ?? 0) > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {patient.allergies!.map((a) => (
                            <Badge key={a} variant="destructive">
                              {a}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">None recorded</p>
                      )}
                    </div>
                    {(patient.medications?.length ?? 0) > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
                          <Pill className="h-3 w-3" /> Medications
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {patient.medications!.map((m) => (
                            <Badge key={m} variant="outline">
                              {m}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {patient.medicalHistory && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">History</p>
                        <pre className="max-h-32 overflow-auto rounded-md bg-muted/50 p-2 text-xs whitespace-pre-wrap font-sans">
                          {patient.medicalHistory}
                        </pre>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Recent activity</CardTitle>
                  <CardDescription>Appointments, notes, and billing</CardDescription>
                </CardHeader>
                <CardContent>
                  {timeline.length === 0 ? (
                    <EmptyState message="No activity yet for this patient." />
                  ) : (
                    <ul className="space-y-0">
                      {timeline.map((ev, idx) => (
                        <li key={ev.id} className="relative flex gap-4 pb-6 last:pb-0">
                          {idx < timeline.length - 1 && (
                            <span className="absolute left-[11px] top-6 h-full w-px bg-border" />
                          )}
                          <span
                            className={cn(
                              "relative z-10 mt-1 h-[22px] w-[22px] shrink-0 rounded-full border-2 border-background",
                              ev.kind === "appointment" && "bg-blue-500",
                              ev.kind === "clinical" && "bg-emerald-500",
                              ev.kind === "billing" && "bg-amber-500",
                              ev.kind === "emergency" && "bg-red-500",
                            )}
                          />
                          <div className="min-w-0 flex-1">
                            {ev.kind === "emergency" ? (
                              <Link
                                href={`/clinical/emergency?intakeId=${ev.id.replace("emergency-", "")}`}
                                className="text-sm font-medium leading-tight hover:underline"
                              >
                                {ev.title}
                              </Link>
                            ) : (
                              <p className="text-sm font-medium leading-tight">{ev.title}</p>
                            )}
                            <p className="text-xs text-muted-foreground">
                              {formatDate(ev.date, { dateStyle: "medium", timeStyle: "short" })}
                              {ev.meta && ` · ${ev.meta}`}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </>
          )}

          {activeTab === "appointments" && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Appointments</CardTitle>
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/appointments?patientId=${patient.id}`}>View calendar</Link>
                </Button>
              </CardHeader>
              <CardContent className="space-y-2">
                {patient.appointments.length === 0 ? (
                  <EmptyState message="No appointments scheduled." />
                ) : (
                  patient.appointments.map((apt) => (
                    <div
                      key={apt.id}
                      className="flex items-center justify-between rounded-lg border px-4 py-3 text-sm"
                    >
                      <div>
                        <p className="font-medium">{apt.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(apt.startTime, { dateStyle: "medium", timeStyle: "short" })}
                        </p>
                      </div>
                      <Badge variant="outline">{apt.status.replace(/_/g, " ")}</Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          )}

          {activeTab === "clinical" && (
            <div className="space-y-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Clinical history</CardTitle>
                    <CardDescription>SOAP notes and odontogram findings</CardDescription>
                  </div>
                  <Button size="sm" asChild>
                    <Link href={`/clinical?patientId=${patient.id}`}>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Open chart
                    </Link>
                  </Button>
                </CardHeader>
                <CardContent className="space-y-2">
                  {patient.clinicalNotes.length === 0 ? (
                    <EmptyState message="No clinical notes yet. Open the odontogram to chart findings." />
                  ) : (
                    patient.clinicalNotes.map((note) => (
                      <div key={note.id} className="rounded-lg border px-4 py-3 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="font-medium">{note.title ?? "Clinical note"}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatDate(note.visitDate)}
                              {note.signedByName ? ` · ${note.signedByName}` : ""}
                            </p>
                          </div>
                          <div className="flex gap-1">
                            {note.aiGenerated && (
                              <Badge variant="secondary" className="text-[10px]">
                                AI-assisted
                              </Badge>
                            )}
                            {note.signedAt && (
                              <Badge variant="outline" className="text-[10px]">
                                Signed
                              </Badge>
                            )}
                          </div>
                        </div>
                        <p className="mt-1 line-clamp-3">
                          {note.assessment ?? note.subjective ?? "—"}
                        </p>
                        {note.toothNumbers.length > 0 && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Teeth: {note.toothNumbers.join(", ")}
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === "perio" && (
            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-base">Periodontal charting</CardTitle>
                  <CardDescription>
                    6-point probing, AAP 2017 staging, and chart history
                  </CardDescription>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/clinical/perio?patientId=${patient.id}`}>
                      View full chart
                    </Link>
                  </Button>
                  <Button size="sm" asChild>
                    <Link href={`/clinical/perio?patientId=${patient.id}`}>
                      New perio chart
                    </Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {latestPerio ? (
                  <div className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="rounded-lg border bg-green-50 p-3 text-green-800">
                        <p className="text-xs font-medium opacity-70">Stage</p>
                        <p className="text-2xl font-bold">{latestPerio.perioStage ?? "—"}</p>
                      </div>
                      <div className="rounded-lg border bg-yellow-50 p-3 text-yellow-800">
                        <p className="text-xs font-medium opacity-70">Grade</p>
                        <p className="text-2xl font-bold">{latestPerio.perioGrade ?? "—"}</p>
                      </div>
                      <div className="rounded-lg border bg-blue-50 p-3 text-blue-800">
                        <p className="text-xs font-medium opacity-70">BOP</p>
                        <p className="text-2xl font-bold">
                          {latestPerio.bopPercent != null ? `${latestPerio.bopPercent}%` : "—"}
                        </p>
                      </div>
                      <div className="rounded-lg border bg-muted/50 p-3">
                        <p className="text-xs font-medium text-muted-foreground">Last charted</p>
                        <p className="text-lg font-semibold">{formatDate(latestPerio.chartDate)}</p>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Open the full periodontal chart to enter measurements, compare visits, or
                      review history.
                    </p>
                  </div>
                ) : (
                  <EmptyState message="No periodontal charts recorded yet.">
                    <Button className="mt-3" asChild>
                      <Link href={`/clinical/perio?patientId=${patient.id}`}>
                        Record first perio chart
                      </Link>
                    </Button>
                  </EmptyState>
                )}
              </CardContent>
            </Card>
          )}

          {activeTab === "radiographs" && (
            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-base">Radiographs</CardTitle>
                  <CardDescription>
                    X-rays, OPG, CBCT and annotated radiographs
                  </CardDescription>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/clinical/radiographs?patientId=${patient.id}`}>
                      View all
                    </Link>
                  </Button>
                  <Button size="sm" asChild>
                    <Link href={`/clinical/radiographs?patientId=${patient.id}&upload=true`}>
                      Upload
                    </Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {clinicalImages && clinicalImages.total > 0 ? (
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(clinicalImages.byType).map(([type, count]) => {
                        const cfg = IMAGE_TYPE_CONFIG[type as ImageType];
                        return (
                          <Badge key={type} variant="secondary" className="text-xs">
                            {cfg?.icon ?? "📷"} {cfg?.label ?? type}: {count}
                          </Badge>
                        );
                      })}
                      <Badge variant="outline" className="text-xs">
                        {clinicalImages.total} total
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {clinicalImages.recent.map((img) => {
                        const cfg = IMAGE_TYPE_CONFIG[img.type as ImageType];
                        return (
                          <Link
                            key={img.id}
                            href={`/clinical/radiographs?patientId=${patient.id}`}
                            className="group relative overflow-hidden rounded-lg border bg-black aspect-square"
                          >
                            <img
                              src={img.url}
                              alt={img.fileName ?? "Clinical image"}
                              className="h-full w-full object-contain"
                            />
                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                              <p className="text-xs font-medium text-white">
                                {cfg?.label ?? img.type}
                              </p>
                              {img.takenAt && (
                                <p className="text-xs text-zinc-400">
                                  {formatDate(img.takenAt)}
                                </p>
                              )}
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <EmptyState message="No radiographs or clinical images yet.">
                    <Button className="mt-3" asChild>
                      <Link href={`/clinical/radiographs?patientId=${patient.id}&upload=true`}>
                        Upload first image
                      </Link>
                    </Button>
                  </EmptyState>
                )}
              </CardContent>
            </Card>
          )}

          {activeTab === "photos" && (
            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-base">Clinical photography</CardTitle>
                  <CardDescription>
                    Intraoral and extraoral photos, before/after comparisons
                  </CardDescription>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/clinical/photos?patientId=${patient.id}`}>
                      View all
                    </Link>
                  </Button>
                  <Button size="sm" asChild>
                    <Link href={`/clinical/photos?patientId=${patient.id}`}>
                      Take photo
                    </Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {patientPhotos && patientPhotos.total > 0 ? (
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(patientPhotos.byCategory).map(([cat, count]) => {
                        const cfg = PHOTO_CATEGORY_CONFIG[cat as PhotoCategory];
                        return (
                          <Badge key={cat} variant="secondary" className="text-xs">
                            {cfg?.icon ?? "📷"} {cfg?.label ?? cat}: {count}
                          </Badge>
                        );
                      })}
                      <Badge variant="outline" className="text-xs">
                        {patientPhotos.total} total
                      </Badge>
                      {patientPhotos.beforeAfterCount > 0 && (
                        <Badge variant="outline" className="text-xs">
                          {patientPhotos.beforeAfterCount} before/after pair
                          {patientPhotos.beforeAfterCount !== 1 ? "s" : ""}
                        </Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {patientPhotos.recent.map((img) => {
                        const cfg = img.photoCategory
                          ? PHOTO_CATEGORY_CONFIG[img.photoCategory as PhotoCategory]
                          : null;
                        return (
                          <Link
                            key={img.id}
                            href={`/clinical/photos?patientId=${patient.id}`}
                            className="relative aspect-square overflow-hidden rounded-lg border bg-black"
                          >
                            <img
                              src={img.url}
                              alt="Clinical photo"
                              className="h-full w-full object-cover"
                            />
                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                              <p className="text-xs font-medium text-white">
                                {cfg?.label ?? "Photo"}
                              </p>
                              {img.takenAt && (
                                <p className="text-xs text-zinc-400">
                                  {formatDate(img.takenAt)}
                                </p>
                              )}
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <EmptyState message="No clinical photos yet.">
                    <Button className="mt-3" asChild>
                      <Link href={`/clinical/photos?patientId=${patient.id}`}>
                        Capture first photo
                      </Link>
                    </Button>
                  </EmptyState>
                )}
              </CardContent>
            </Card>
          )}

          {activeTab === "treatment" && (
            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-base">Treatment plans</CardTitle>
                  <CardDescription>Active and completed treatment plans</CardDescription>
                </div>
                <Button size="sm" asChild>
                  <Link href={`/clinical/treatment-plans/new?patientId=${patient.id}`}>
                    New plan
                  </Link>
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {patient.treatmentPlans.length === 0 ? (
                  <EmptyState message="No treatment plans yet.">
                    <Button className="mt-3" size="sm" asChild>
                      <Link href={`/clinical/treatment-plans/new?patientId=${patient.id}`}>
                        Create first treatment plan
                      </Link>
                    </Button>
                  </EmptyState>
                ) : (
                  patient.treatmentPlans.map((tp) => {
                    const progress =
                      tp.itemCount > 0
                        ? Math.round((tp.completedCount / tp.itemCount) * 100)
                        : 0;
                    return (
                      <div
                        key={tp.id}
                        className="rounded-lg border px-4 py-3 text-sm"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium">{tp.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatDate(tp.createdAt)} · {tp.itemCount} items
                            </p>
                            {tp.itemCount > 0 && (
                              <div className="mt-2 space-y-1">
                                <Progress value={progress} className="h-1.5" />
                                <p className="text-xs text-muted-foreground">
                                  {tp.completedCount} of {tp.itemCount} completed ({progress}%)
                                </p>
                              </div>
                            )}
                          </div>
                          <div className="text-right">
                            <Badge variant="outline">{tp.status}</Badge>
                            <p className="mt-1 text-xs font-medium tabular-nums">
                              {formatCurrency(tp.totalCost)}
                            </p>
                            <Button size="sm" variant="link" className="h-auto p-0 mt-1" asChild>
                              <Link href={`/clinical/treatment-plans/${tp.id}`}>
                                View plan
                              </Link>
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          )}

          {activeTab === "billing" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Invoices</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {patient.invoices.length === 0 ? (
                  <EmptyState message="No invoices for this patient." />
                ) : (
                  patient.invoices.map((inv) => (
                    <div
                      key={inv.id}
                      className="flex items-center justify-between rounded-lg border px-4 py-3 text-sm"
                    >
                      <div>
                        <p className="font-mono font-medium">{inv.invoiceNumber}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(inv.createdAt)}
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge>{inv.status}</Badge>
                        <p className="mt-1 font-semibold tabular-nums">
                          {formatCurrency(inv.total)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          )}

          {activeTab === "documents" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Attachments & imaging</CardTitle>
                <CardDescription>Upload consent forms, X-rays, and referrals</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {patient.attachments.length === 0 ? (
                  <EmptyState message="No documents uploaded yet." />
                ) : (
                  <ul className="divide-y rounded-lg border">
                    {patient.attachments.map((file) => (
                      <li key={file.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                        <a
                          href={file.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-primary hover:underline truncate"
                        >
                          {file.name}
                        </a>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {file.type} · {formatDate(file.createdAt)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <Separator />
                <PatientAttachmentUploader
                  patientId={patient.id}
                  uploadsEnabled={uploadsEnabled}
                />
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <aside className="space-y-4">
          <div className="rounded-lg border p-4">
            <h3 className="mb-1 text-sm font-medium">Patient Portal</h3>
            <p className="text-sm text-muted-foreground">
              Patient portal access coming soon. Patients will receive an invite link via email.
            </p>
          </div>

          {(patient.emergencyContact || patient.emergencyPhone) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Emergency contact</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                {patient.emergencyContact && <p>{patient.emergencyContact}</p>}
                {patient.emergencyPhone && (
                  <p className="text-muted-foreground">{patient.emergencyPhone}</p>
                )}
              </CardContent>
            </Card>
          )}

          {patient.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Internal notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{patient.notes}</p>
              </CardContent>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Phone;
  label: string;
  value: string;
}) {
  return (
    <div className="flex gap-3">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-medium">{value}</p>
      </div>
    </div>
  );
}
