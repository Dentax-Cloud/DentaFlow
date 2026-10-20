"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  openDaySession,
  closeDaySession,
  assignDoctorToChair,
  removeDoctorChairAssignment,
  createTrayTemplate,
  updateTrayTemplate,
  deleteTrayTemplate,
  setupChairForDay,
  returnChairItems,
  getChairDaySummary,
  updateChair,
  toggleChairPrepItem,
  setChairPrepReady,
  getTraySuggestionForChair,
} from "@/app/(dashboard)/features/clinical/chair-setup-actions";
import type { SetupItem, TrayTemplateItem } from "@/lib/chair-setup/types";
import {
  buildCategorySummaries,
  canManageChairs,
  canManageTemplates,
  getChairStatus,
  isDoctorRole,
  isStoreRole,
} from "@/lib/chair-setup/helpers";
import { DayStatusBar } from "@/components/chair-setup/day-status-bar";
import { ChairCard } from "@/components/chair-setup/chair-card";
import { ScheduleTable } from "@/components/chair-setup/schedule-table";
import {
  AppointmentScheduleTable,
  type AppointmentScheduleRow,
} from "@/components/chair-setup/appointment-schedule-table";
import { TraySetupAccordion } from "@/components/chair-setup/tray-setup-accordion";
import { TemplateCards } from "@/components/chair-setup/template-cards";
import { TraySetupModal } from "@/components/chair-setup/tray-setup-modal";
import { TemplateFormDialog } from "@/components/chair-setup/template-form-dialog";
import {
  ChairManagePanel,
  type ChairFormData,
} from "@/components/chair-setup/chair-manage-panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ClipboardList, Plus, Settings2 } from "lucide-react";

type ChairRow = {
  id: string;
  name: string;
  number: number;
  branchId: string;
  chairType: string;
  roomName: string | null;
  colorCode: string;
  equipment: string[];
  status: string;
};

type DoctorRow = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
};

type InventoryRow = {
  id: string;
  name: string;
  itemRef: string | null;
  quantity: number;
  unit: string;
  cost: number | null;
  category: string | null;
};

type TemplateRow = {
  id: string;
  name: string;
  isDefault: boolean;
  notes: string | null;
  items: TrayTemplateItem[];
  createdAt: string;
};

type ScheduleRow = {
  id: string;
  chairId: string;
  doctorId: string;
  scheduleDate: string;
  startTime: string;
  endTime: string;
  shiftType: string;
  status: string;
  createdAt: string;
  chair: { id: string; name: string; number: number; chairType?: string; roomName?: string | null; colorCode?: string; status?: string };
};

type ChairSetupRow = {
  id: string;
  chairId: string;
  doctorId: string | null;
  templateId: string | null;
  status: string;
  setupCost: number;
  setupItems: SetupItem[];
  consumedItems: SetupItem[];
  returnedItems: Array<{ inventoryItemId: string; qty: number }>;
  createdAt: string;
  updatedAt: string;
  setupByName: string | null;
  checkedItemIds: string[];
  readyAt: string | null;
  readyByName: string | null;
  chair: { id: string; name: string; number: number; chairType?: string; roomName?: string | null; colorCode?: string; status?: string };
  template: { id: string; name: string } | null;
};

type SessionRow = {
  id: string;
  sessionDate: string;
  status: string;
  notes: string | null;
  summary: unknown;
  openedAt: string | null;
  closedAt: string | null;
  openedByName: string | null;
  chairSetups: ChairSetupRow[];
};

type ApptStats = { total: number; completed: number; inChair: boolean };

type Props = {
  session: SessionRow | null;
  templates: TemplateRow[];
  doctorSchedules: ScheduleRow[];
  appointmentSchedule: AppointmentScheduleRow[];
  chairs: ChairRow[];
  doctors: DoctorRow[];
  inventoryItems: InventoryRow[];
  apptStatsByChair: Record<string, ApptStats>;
  today: string;
  userRole: string;
  currency: string;
  countryCode: string;
};

type CloseSummaryRow = Awaited<ReturnType<typeof getChairDaySummary>>[number];

function doctorName(d: DoctorRow) {
  return [d.firstName, d.lastName].filter(Boolean).join(" ") || "Unknown";
}

export default function ChairSetupClient({
  session,
  templates,
  doctorSchedules,
  appointmentSchedule,
  chairs,
  doctors,
  inventoryItems,
  apptStatsByChair,
  today,
  userRole,
  currency,
  countryCode,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [closeOpen, setCloseOpen] = useState(false);
  const [closeRows, setCloseRows] = useState<CloseSummaryRow[]>([]);
  const [returnDrafts, setReturnDrafts] = useState<Record<string, Record<string, number>>>({});

  const [assignOpen, setAssignOpen] = useState(false);
  const [assignForm, setAssignForm] = useState({
    chairId: chairs[0]?.id ?? "",
    doctorId: doctors[0]?.id ?? "",
    startTime: "09:00",
    endTime: "13:00",
    shiftType: "MORNING",
  });

  const [setupOpen, setSetupOpen] = useState(false);
  const [setupChairId, setSetupChairId] = useState("");
  const [setupTemplateId, setSetupTemplateId] = useState("");
  const [setupItems, setSetupItems] = useState<SetupItem[]>([]);
  const [setupSuggestion, setSetupSuggestion] = useState<{
    items: SetupItem[];
    procedureNames: string[];
  } | null>(null);

  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [returnSetupId, setReturnSetupId] = useState("");
  const [returnChairId, setReturnChairId] = useState("");

  const [templateOpen, setTemplateOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TemplateRow | null>(null);
  const [templateForm, setTemplateForm] = useState({
    name: "",
    isDefault: false,
    notes: "",
    items: [] as TrayTemplateItem[],
  });

  const [viewSetup, setViewSetup] = useState<ChairSetupRow | null>(null);
  const [manageChairsOpen, setManageChairsOpen] = useState(false);

  const sessionStatus = session?.status ?? "PENDING";
  const isOpen = sessionStatus === "OPEN";
  const isViewOnly = isDoctorRole(userRole);
  const storeOnly = isStoreRole(userRole);

  const doctorMap = useMemo(() => new Map(doctors.map((d) => [d.id, d])), [doctors]);

  const schedulesByChair = useMemo(() => {
    const map = new Map<string, ScheduleRow[]>();
    for (const s of doctorSchedules) {
      const list = map.get(s.chairId) ?? [];
      list.push(s);
      map.set(s.chairId, list);
    }
    return map;
  }, [doctorSchedules]);

  const setupByChair = useMemo(() => {
    const map = new Map<string, ChairSetupRow>();
    for (const s of session?.chairSetups ?? []) {
      map.set(s.chairId, s);
    }
    return map;
  }, [session]);

  const chairStatuses = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getChairStatus>>();
    for (const chair of chairs) {
      const setup = setupByChair.get(chair.id) ?? null;
      const appt = apptStatsByChair[chair.id];
      const summaries = setup
        ? buildCategorySummaries(setup.setupItems, setup.consumedItems, setup.returnedItems)
        : [];
      map.set(
        chair.id,
        getChairStatus({
          chairStatus: chair.status,
          sessionStatus: session?.status ?? null,
          setup,
          hasActivePatient: appt?.inChair ?? false,
          hasLowStock: summaries.some((s) => s.hasLowStock),
        }),
      );
    }
    return map;
  }, [chairs, setupByChair, apptStatsByChair, session?.status]);

  const statusCounts = useMemo(() => {
    let ready = 0;
    let inUse = 0;
    let notSetup = 0;
    for (const chair of chairs) {
      const status = chairStatuses.get(chair.id);
      if (status === "READY") ready += 1;
      else if (status === "IN_USE") inUse += 1;
      else if (status === "NOT_SETUP") notSetup += 1;
    }
    return { ready, inUse, notSetup };
  }, [chairs, chairStatuses]);

  const assignedDoctors = useMemo(() => {
    const map = new Map<string, string>();
    for (const chair of chairs) {
      const schedules = schedulesByChair.get(chair.id) ?? [];
      if (schedules[0]) map.set(chair.id, schedules[0].doctorId);
    }
    return map;
  }, [chairs, schedulesByChair]);

  const doctorNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of doctors) map.set(d.id, doctorName(d));
    return map;
  }, [doctors]);

  function openSetupForChair(chairId: string) {
    setSetupChairId(chairId);
    setSetupTemplateId("");
    setSetupItems([]);
    setSetupSuggestion(null);
    setSetupOpen(true);
    startTransition(async () => {
      try {
        const suggestion = await getTraySuggestionForChair(chairId);
        setSetupSuggestion(suggestion.items.length > 0 ? suggestion : null);
      } catch {
        setSetupSuggestion(null);
      }
    });
  }

  function openReturnForChair(chairId: string, setupId: string) {
    const setup = setupByChair.get(chairId);
    if (!setup) return;
    const draft: Record<string, number> = {};
    for (const item of setup.setupItems) {
      if (item.category === "EQUIPMENT") continue;
      const consumed = setup.consumedItems
        .filter((c) => c.inventoryItemId === item.inventoryItemId)
        .reduce((s, c) => s + c.qty, 0);
      const returned = setup.returnedItems
        .filter((r) => r.inventoryItemId === item.inventoryItemId)
        .reduce((s, r) => s + r.qty, 0);
      draft[item.inventoryItemId] = Math.max(0, item.qty - consumed - returned);
    }
    setReturnDrafts({ [setupId]: draft });
    setReturnSetupId(setupId);
    setReturnChairId(chairId);
    setReturnModalOpen(true);
  }

  function openAssignModal(chairId: string, shift: string) {
    const times =
      shift === "MORNING"
        ? { startTime: "09:00", endTime: "13:00" }
        : shift === "AFTERNOON"
          ? { startTime: "14:00", endTime: "18:00" }
          : { startTime: "09:00", endTime: "17:00" };
    setAssignForm({
      chairId,
      doctorId: doctors[0]?.id ?? "",
      shiftType: shift,
      ...times,
    });
    setAssignOpen(true);
  }

  function handleOpenDay() {
    startTransition(async () => {
      try {
        await openDaySession();
        toast.success("Day session opened");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to open day");
      }
    });
  }

  async function loadCloseSummary() {
    if (!session) return;
    try {
      const rows = await getChairDaySummary(session.id);
      setCloseRows(rows);
      const drafts: Record<string, Record<string, number>> = {};
      for (const row of rows) {
        drafts[row.chairSetupId] = {};
        for (const item of row.setupItems) {
          if (item.category === "EQUIPMENT") continue;
          const consumed = row.consumedItems
            .filter((c) => c.inventoryItemId === item.inventoryItemId)
            .reduce((s, c) => s + c.qty, 0);
          const returned = row.returnedItems
            .filter((r) => r.inventoryItemId === item.inventoryItemId)
            .reduce((s, r) => s + r.qty, 0);
          drafts[row.chairSetupId][item.inventoryItemId] = Math.max(
            0,
            item.qty - consumed - returned,
          );
        }
      }
      setReturnDrafts(drafts);
      setCloseOpen(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load summary");
    }
  }

  function handleConfirmClose() {
    if (!session) return;
    startTransition(async () => {
      try {
        for (const row of closeRows) {
          if (row.status === "CLOSED") continue;
          const draft = returnDrafts[row.chairSetupId] ?? {};
          const returnedItems = Object.entries(draft)
            .filter(([, qty]) => qty > 0)
            .map(([inventoryItemId, qty]) => ({ inventoryItemId, qty }));
          if (returnedItems.length > 0) {
            await returnChairItems({ chairSetupId: row.chairSetupId, returnedItems });
          }
        }
        await closeDaySession(session.id);
        toast.success("Day closed");
        setCloseOpen(false);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to close day");
      }
    });
  }

  function handleAssign() {
    startTransition(async () => {
      try {
        await assignDoctorToChair({ ...assignForm, scheduleDate: today });
        toast.success("Doctor assigned");
        setAssignOpen(false);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Assignment failed");
      }
    });
  }

  function handleConfirmSetup() {
    if (!session || setupItems.length === 0) return;
    const schedules = schedulesByChair.get(setupChairId) ?? [];
    startTransition(async () => {
      try {
        await setupChairForDay({
          sessionId: session.id,
          chairId: setupChairId,
          doctorId: schedules[0]?.doctorId,
          templateId: setupTemplateId || undefined,
          items: setupItems,
        });
        toast.success("Tray setup complete");
        setSetupOpen(false);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Setup failed");
      }
    });
  }

  function handleConfirmReturn() {
    const draft = returnDrafts[returnSetupId] ?? {};
    const returnedItems = Object.entries(draft)
      .filter(([, qty]) => qty > 0)
      .map(([inventoryItemId, qty]) => ({ inventoryItemId, qty }));
    startTransition(async () => {
      try {
        await returnChairItems({ chairSetupId: returnSetupId, returnedItems });
        toast.success("Items returned to store");
        setReturnModalOpen(false);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Return failed");
      }
    });
  }

  function handleToggleItem(chairSetupId: string, inventoryItemId: string, checked: boolean) {
    startTransition(async () => {
      try {
        await toggleChairPrepItem({ chairSetupId, inventoryItemId, checked });
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to update checklist");
      }
    });
  }

  function handleToggleReady(chairSetupId: string, ready: boolean) {
    startTransition(async () => {
      try {
        await setChairPrepReady({ chairSetupId, ready });
        toast.success(ready ? "Chair marked ready" : "Chair marked not ready");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to update chair status");
      }
    });
  }

  function handleSaveTemplate() {
    startTransition(async () => {
      try {
        if (editingTemplate) {
          await updateTrayTemplate(editingTemplate.id, {
            name: templateForm.name,
            isDefault: templateForm.isDefault,
            items: templateForm.items,
            notes: templateForm.notes || undefined,
          });
          toast.success("Template updated");
        } else {
          await createTrayTemplate({
            name: templateForm.name,
            isDefault: templateForm.isDefault,
            items: templateForm.items,
            notes: templateForm.notes || undefined,
          });
          toast.success("Template created");
        }
        setTemplateOpen(false);
        setEditingTemplate(null);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Save failed");
      }
    });
  }

  function handleSaveChair(data: ChairFormData) {
    if (!data.id) return;
    const chairId = data.id;
    startTransition(async () => {
      try {
        await updateChair(chairId, {
          name: data.name,
          number: data.number,
          roomName: data.roomName || null,
          chairType: data.chairType,
          colorCode: data.colorCode,
          equipment: data.equipment,
          status: data.status,
        });
        toast.success("Chair updated");
        setManageChairsOpen(false);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Update failed");
      }
    });
  }

  const defaultTab = storeOnly ? "setup" : "overview";

  return (
    <div className="-mx-4 -mt-4 flex flex-col sm:-mx-6 lg:-mx-8">
      <div className="border-b bg-white px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Chair Management</h1>
            <p className="text-sm text-muted-foreground">
              Chair setup, doctor schedules, tray inventory &amp; day sessions
            </p>
          </div>
          <div className="flex gap-2">
            {canManageChairs(userRole) && (
              <Button variant="outline" size="sm" onClick={() => setManageChairsOpen(true)}>
                <Settings2 className="mr-1 h-4 w-4" />
                Manage chairs
              </Button>
            )}
            <Button variant="outline" size="sm" asChild>
              <Link href="/clinical">Back to clinical</Link>
            </Button>
          </div>
        </div>
      </div>

      <DayStatusBar
        session={
          session
            ? {
                status: session.status,
                openedAt: session.openedAt,
                openedByName: session.openedByName,
                closedAt: session.closedAt,
              }
            : null
        }
        readyCount={statusCounts.ready}
        inUseCount={statusCounts.inUse}
        notSetupCount={statusCounts.notSetup}
        userRole={userRole}
        onOpenDay={handleOpenDay}
        onCloseDay={() => void loadCloseSummary()}
        isPending={isPending}
      />

      <div className="px-6 py-6">
        <Tabs defaultValue={defaultTab}>
          <TabsList className="mb-4 flex h-auto flex-wrap">
            {!storeOnly && <TabsTrigger value="overview">Overview</TabsTrigger>}
            {!storeOnly && !isViewOnly && (
              <TabsTrigger value="schedule">Doctor-Chair Schedule</TabsTrigger>
            )}
            <TabsTrigger value="setup">Tray Setup</TabsTrigger>
            {canManageTemplates(userRole) && (
              <TabsTrigger value="templates">Templates</TabsTrigger>
            )}
            {!storeOnly && <TabsTrigger value="help">Help</TabsTrigger>}
          </TabsList>

          {!storeOnly && (
            <TabsContent value="overview" className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {chairs.map((chair) => {
                  const setup = setupByChair.get(chair.id) ?? null;
                  const schedules = schedulesByChair.get(chair.id) ?? [];
                  const primarySchedule = schedules.find((s) => s.shiftType === "FULL_DAY") ?? schedules[0];
                  const assignedDoctor = primarySchedule
                    ? doctorMap.get(primarySchedule.doctorId) ?? null
                    : null;
                  const appt = apptStatsByChair[chair.id] ?? {
                    total: 0,
                    completed: 0,
                    inChair: false,
                  };

                  return (
                    <ChairCard
                      key={chair.id}
                      chair={chair}
                      chairStatus={chairStatuses.get(chair.id) ?? "NOT_SETUP"}
                      assignedDoctor={assignedDoctor}
                      schedule={
                        primarySchedule
                          ? {
                              startTime: primarySchedule.startTime,
                              endTime: primarySchedule.endTime,
                            }
                          : null
                      }
                      apptCount={appt.total}
                      completedCount={appt.completed}
                      setup={
                        setup
                          ? {
                              setupItems: setup.setupItems,
                              consumedItems: setup.consumedItems,
                              returnedItems: setup.returnedItems,
                              setupCost: setup.setupCost,
                              template: setup.template,
                              setupByName: setup.setupByName,
                              createdAt: setup.createdAt,
                              checkedItemIds: setup.checkedItemIds,
                              readyAt: setup.readyAt,
                              readyByName: setup.readyByName,
                            }
                          : null
                      }
                      sessionOpen={isOpen}
                      currency={currency}
                      userRole={userRole}
                      onSetup={() => openSetupForChair(chair.id)}
                      onViewDetails={() => setViewSetup(setup)}
                      onReturnItems={() =>
                        setup && openReturnForChair(chair.id, setup.id)
                      }
                    />
                  );
                })}
              </div>
            </TabsContent>
          )}

          {!storeOnly && !isViewOnly && (
            <TabsContent value="schedule" className="space-y-6">
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Today&apos;s schedule (from appointments)</h3>
                <p className="text-xs text-muted-foreground">
                  Who&apos;s actually booked where today, derived automatically from the
                  appointment book — nothing to enter here.
                </p>
                <AppointmentScheduleTable chairs={chairs} appointments={appointmentSchedule} />
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Manual shift assignment</h3>
                <p className="text-xs text-muted-foreground">
                  Use this for walk-ins or shifts that aren&apos;t tied to a specific
                  appointment yet.
                </p>
              </div>
              <ScheduleTable
                chairs={chairs}
                schedules={doctorSchedules}
                doctors={doctors}
                userRole={userRole}
                onAssign={openAssignModal}
                onRemove={(id) =>
                  startTransition(async () => {
                    await removeDoctorChairAssignment(id);
                    toast.success("Assignment removed");
                    router.refresh();
                  })
                }
                onEditChair={() => setManageChairsOpen(true)}
              />
            </TabsContent>
          )}

          <TabsContent value="setup">
            {!isOpen && !isViewOnly && (
              <p className="mb-4 text-sm text-muted-foreground">
                Open the day session to set up chair trays.
              </p>
            )}
            <TraySetupAccordion
              chairs={chairs}
              setups={setupByChair}
              chairStatuses={chairStatuses}
              assignedDoctors={assignedDoctors}
              doctorNames={doctorNames}
              sessionOpen={isOpen}
              currency={currency}
              userRole={userRole}
              onSetup={openSetupForChair}
              onReturn={openReturnForChair}
              onToggleItem={handleToggleItem}
              onToggleReady={handleToggleReady}
            />
          </TabsContent>

          {canManageTemplates(userRole) && (
            <TabsContent value="templates" className="space-y-4">
              <div className="flex justify-end">
                <Button
                  onClick={() => {
                    setEditingTemplate(null);
                    setTemplateForm({ name: "", isDefault: false, notes: "", items: [] });
                    setTemplateOpen(true);
                  }}
                >
                  <Plus className="mr-1 h-4 w-4" />
                  New template
                </Button>
              </div>
              <TemplateCards
                templates={templates}
                currency={currency}
                canEdit={canManageTemplates(userRole)}
                onEdit={(t) => {
                  const full = templates.find((x) => x.id === t.id);
                  if (!full) return;
                  setEditingTemplate(full);
                  setTemplateForm({
                    name: full.name,
                    isDefault: full.isDefault,
                    notes: full.notes ?? "",
                    items: full.items,
                  });
                  setTemplateOpen(true);
                }}
                onDelete={(id) =>
                  startTransition(async () => {
                    await deleteTrayTemplate(id);
                    toast.success("Template deleted");
                    router.refresh();
                  })
                }
              />
            </TabsContent>
          )}

          {!storeOnly && (
            <TabsContent value="help" className="prose prose-sm max-w-none">
              <h3>Chair setup guidance</h3>
              {countryCode === "AE" ? (
                <ul>
                  <li>Assign doctors to chairs before opening the day session.</li>
                  <li>Set up trays with consumables, medications, materials, and equipment.</li>
                  <li>Equipment items are verified present — not deducted from stock.</li>
                  <li>Return unused items when closing the day or per chair.</li>
                </ul>
              ) : (
                <ul>
                  <li>Open the day session before setting up chair trays.</li>
                  <li>Use templates for consistent tray preparation across operatories.</li>
                  <li>Monitor low-stock alerts on the overview cards.</li>
                </ul>
              )}
              <p className="text-sm text-muted-foreground">
                Download tray templates from the Templates tab. For inventory issues, visit{" "}
                <Link href="/inventory" className="text-blue-600 underline">
                  Inventory
                </Link>
                .
              </p>
            </TabsContent>
          )}
        </Tabs>
      </div>

      <TraySetupModal
        open={setupOpen}
        onOpenChange={setSetupOpen}
        chairName={chairs.find((c) => c.id === setupChairId)?.name ?? "Chair"}
        templates={templates}
        suggestion={setupSuggestion}
        inventoryItems={inventoryItems}
        currency={currency}
        items={setupItems}
        onItemsChange={setSetupItems}
        onConfirm={handleConfirmSetup}
        isPending={isPending}
      />

      <TemplateFormDialog
        open={templateOpen}
        onOpenChange={setTemplateOpen}
        editing={!!editingTemplate}
        form={templateForm}
        inventoryItems={inventoryItems}
        onFormChange={setTemplateForm}
        onSave={handleSaveTemplate}
        isPending={isPending}
      />

      <ChairManagePanel
        open={manageChairsOpen}
        onOpenChange={setManageChairsOpen}
        chairs={chairs}
        onSave={handleSaveChair}
        isPending={isPending}
      />

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign doctor to chair</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div>
              <Label>Doctor</Label>
              <Select
                value={assignForm.doctorId}
                onValueChange={(v) => setAssignForm((f) => ({ ...f, doctorId: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {doctors.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {doctorName(d)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Start</Label>
                <Input
                  value={assignForm.startTime}
                  onChange={(e) => setAssignForm((f) => ({ ...f, startTime: e.target.value }))}
                />
              </div>
              <div>
                <Label>End</Label>
                <Input
                  value={assignForm.endTime}
                  onChange={(e) => setAssignForm((f) => ({ ...f, endTime: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleAssign} disabled={isPending}>
              Save assignment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewSetup} onOpenChange={(o) => !o && setViewSetup(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewSetup?.chair.name} — tray details</DialogTitle>
          </DialogHeader>
          {viewSetup && (
            <TraySetupAccordion
              chairs={[chairs.find((c) => c.id === viewSetup.chairId)!].filter(Boolean)}
              setups={new Map([[viewSetup.chairId, viewSetup]])}
              chairStatuses={new Map([[viewSetup.chairId, chairStatuses.get(viewSetup.chairId) ?? "READY"]])}
              assignedDoctors={assignedDoctors}
              doctorNames={doctorNames}
              sessionOpen={isOpen}
              currency={currency}
              userRole={userRole}
              onSetup={() => {}}
              onReturn={openReturnForChair}
              onToggleItem={handleToggleItem}
              onToggleReady={handleToggleReady}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={returnModalOpen} onOpenChange={setReturnModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Return unused items</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {Object.entries(returnDrafts[returnSetupId] ?? {}).map(([itemId, qty]) => {
              const setup = setupByChair.get(returnChairId);
              const item = setup?.setupItems.find((i) => i.inventoryItemId === itemId);
              if (!item) return null;
              return (
                <div key={itemId} className="flex items-center justify-between text-sm">
                  <span>{item.itemName}</span>
                  <Input
                    type="number"
                    min={0}
                    className="h-8 w-20"
                    value={qty}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10) || 0;
                      setReturnDrafts((prev) => ({
                        ...prev,
                        [returnSetupId]: { ...(prev[returnSetupId] ?? {}), [itemId]: v },
                      }));
                    }}
                  />
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button onClick={handleConfirmReturn} disabled={isPending}>
              Confirm return
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={closeOpen} onOpenChange={setCloseOpen}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              Close day — reconciliation
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            {closeRows.map((row) => (
              <div key={row.chairSetupId} className="space-y-2">
                <p className="font-medium">{row.chairName}</p>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="py-1">Item</th>
                      <th>Setup</th>
                      <th>Consumed</th>
                      <th>Return</th>
                    </tr>
                  </thead>
                  <tbody>
                    {row.setupItems
                      .filter((item) => item.category !== "EQUIPMENT")
                      .map((item) => {
                        const consumed = row.consumedItems
                          .filter((c) => c.inventoryItemId === item.inventoryItemId)
                          .reduce((s, c) => s + c.qty, 0);
                        const returnQty =
                          returnDrafts[row.chairSetupId]?.[item.inventoryItemId] ?? 0;
                        return (
                          <tr key={item.inventoryItemId} className="border-b">
                            <td className="py-1">{item.itemName}</td>
                            <td>{item.qty}</td>
                            <td>{consumed}</td>
                            <td>
                              <Input
                                type="number"
                                min={0}
                                className="h-8 w-16"
                                value={returnQty}
                                onChange={(e) => {
                                  const v = parseInt(e.target.value, 10) || 0;
                                  setReturnDrafts((prev) => ({
                                    ...prev,
                                    [row.chairSetupId]: {
                                      ...(prev[row.chairSetupId] ?? {}),
                                      [item.inventoryItemId]: v,
                                    },
                                  }));
                                }}
                              />
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmClose} disabled={isPending}>
              Confirm &amp; close day
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
