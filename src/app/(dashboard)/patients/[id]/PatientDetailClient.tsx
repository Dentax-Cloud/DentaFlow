"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Activity,
  AlertTriangle,
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
  Shield,
  Sparkles,
  Stethoscope,
  User,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { linkPatientPortalUser } from "@/app/(dashboard)/features/patients/actions";
import { PatientAttachmentUploader } from "@/components/upload/patient-attachment-uploader";

/** Core demographics from the server (matches product spec). */
export interface PatientDetailProfile {
  id: string;
  patientId: string;
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
    assessment: string | null;
    aiGenerated: boolean;
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
  uploadsEnabled: boolean;
}

type TabId = "overview" | "appointments" | "clinical" | "billing" | "documents";

const TABS: { id: TabId; label: string; icon: typeof User }[] = [
  { id: "overview", label: "Overview", icon: User },
  { id: "appointments", label: "Appointments", icon: Calendar },
  { id: "clinical", label: "Clinical", icon: Stethoscope },
  { id: "billing", label: "Billing", icon: Receipt },
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

function EmptyState({ message }: { message: string }) {
  return (
    <p className="rounded-lg border border-dashed bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
      {message}
    </p>
  );
}

export function PatientDetailClient({ patient, uploadsEnabled }: PatientDetailClientProps) {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [clerkUserId, setClerkUserId] = useState(patient.portalUserId ?? "");
  const [portalSaving, setPortalSaving] = useState(false);

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
    return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 8);
  }, [patient]);

  async function savePortalLink() {
    setPortalSaving(true);
    const result = await linkPatientPortalUser({
      patientId: patient.id,
      clerkUserId: clerkUserId.trim(),
    });
    setPortalSaving(false);
    if (result.success) toast.success("Patient portal linked");
    else toast.error(result.error);
  }

  return (
    <div className="space-y-6 pb-10">
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
                <Badge variant="secondary" className="font-mono text-xs">
                  {patient.patientId}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {age != null && <span>{age} yrs · </span>}
                {patient.gender && <span className="capitalize">{patient.gender} · </span>}
                Patient since {formatDate(patient.createdAt)}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {patient.noShowRisk && (
                  <Badge variant="warning" className="gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    No-show {patient.noShowRisk.toLowerCase()}
                  </Badge>
                )}
                {patient.churnRisk && (
                  <Badge variant="destructive" className="gap-1">
                    Churn {patient.churnRisk.toLowerCase()}
                  </Badge>
                )}
                {(patient.allergies?.length ?? 0) > 0 && (
                  <Badge variant="destructive">
                    {patient.allergies!.length} allerg
                    {patient.allergies!.length === 1 ? "y" : "ies"}
                  </Badge>
                )}
                {patient.portalUserId && (
                  <Badge variant="success" className="gap-1">
                    <Shield className="h-3 w-3" />
                    Portal active
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 lg:justify-end">
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
            <Button variant="secondary" size="sm" asChild>
              <Link href={`/appointments?patientId=${patient.id}`}>
                <Calendar className="mr-2 h-4 w-4" />
                Schedule
              </Link>
            </Button>
          </div>
        </div>
      </div>

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
                  </CardContent>
                </Card>

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
                            )}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm leading-tight">{ev.title}</p>
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
                    <CardTitle className="text-base">Clinical notes</CardTitle>
                    <CardDescription>{patient.clinicalNotes.length} on file</CardDescription>
                  </div>
                  <Button size="sm" asChild>
                    <Link href={`/clinical?patientId=${patient.id}`}>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Chart & SOAP
                    </Link>
                  </Button>
                </CardHeader>
                <CardContent className="space-y-2">
                  {patient.clinicalNotes.length === 0 ? (
                    <EmptyState message="No clinical notes yet. Open the odontogram to chart findings." />
                  ) : (
                    patient.clinicalNotes.map((note) => (
                      <div key={note.id} className="rounded-lg border px-4 py-3 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs text-muted-foreground">
                            {formatDate(note.visitDate)}
                          </p>
                          {note.aiGenerated && (
                            <Badge variant="secondary" className="text-[10px]">
                              AI-assisted
                            </Badge>
                          )}
                        </div>
                        <p className="mt-1 line-clamp-3">
                          {note.assessment ?? "—"}
                        </p>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Treatment plans</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {patient.treatmentPlans.length === 0 ? (
                    <EmptyState message="No treatment plans. Suggest from the clinical chart." />
                  ) : (
                    patient.treatmentPlans.map((tp) => (
                      <div
                        key={tp.id}
                        className="flex items-center justify-between rounded-lg border px-4 py-3 text-sm"
                      >
                        <div>
                          <p className="font-medium">{tp.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(tp.createdAt)}
                          </p>
                        </div>
                        <div className="text-right">
                          <Badge variant="outline">{tp.status}</Badge>
                          <p className="mt-1 text-xs font-medium tabular-nums">
                            {formatCurrency(tp.totalCost)}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
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
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Patient portal</CardTitle>
              <CardDescription>Link Clerk user for /portal access</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs">Clerk user ID</Label>
                <Input
                  className="mt-1 font-mono text-xs"
                  value={clerkUserId}
                  onChange={(e) => setClerkUserId(e.target.value)}
                  placeholder="user_..."
                />
              </div>
              <Button
                className="w-full"
                size="sm"
                onClick={() => void savePortalLink()}
                disabled={portalSaving || !clerkUserId.trim()}
              >
                {portalSaving ? "Saving…" : "Save portal link"}
              </Button>
            </CardContent>
          </Card>

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
