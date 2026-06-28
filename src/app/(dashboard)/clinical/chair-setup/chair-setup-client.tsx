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
} from "@/app/(dashboard)/features/clinical/chair-setup-actions";
import type { SetupItem, TrayTemplateItem } from "@/app/(dashboard)/features/clinical/chair-setup-actions";
import { BarcodeScanner } from "@/components/inventory/barcode-scanner";
import { scanSupplierBarcode } from "@/app/(dashboard)/features/inventory/inventory-actions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  LayoutTemplate,
  Plus,
  Trash2,
} from "lucide-react";

type ChairRow = { id: string; name: string; number: number };
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
  chair: { id: string; name: string; number: number };
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
  chair: { id: string; name: string; number: number };
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
  chairSetups: ChairSetupRow[];
};

type Props = {
  session: SessionRow | null;
  templates: TemplateRow[];
  doctorSchedules: ScheduleRow[];
  chairs: ChairRow[];
  doctors: DoctorRow[];
  inventoryItems: InventoryRow[];
  today: string;
};

type CloseSummaryRow = Awaited<ReturnType<typeof getChairDaySummary>>[number];

function doctorName(d: DoctorRow) {
  return [d.firstName, d.lastName].filter(Boolean).join(" ") || "Unknown";
}

function shiftLabel(shiftType: string) {
  if (shiftType === "MORNING") return "Morning";
  if (shiftType === "AFTERNOON") return "Afternoon";
  return "Full day";
}

export default function ChairSetupClient({
  session,
  templates,
  doctorSchedules,
  chairs,
  doctors,
  inventoryItems,
  today,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [closeOpen, setCloseOpen] = useState(false);
  const [closeRows, setCloseRows] = useState<CloseSummaryRow[]>([]);
  const [returnDrafts, setReturnDrafts] = useState<
    Record<string, Record<string, number>>
  >({});

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
  const [setupTemplateId, setSetupTemplateId] = useState<string>("");
  const [setupItems, setSetupItems] = useState<SetupItem[]>([]);

  const [templateOpen, setTemplateOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TemplateRow | null>(null);
  const [templateForm, setTemplateForm] = useState({
    name: "",
    isDefault: false,
    notes: "",
    items: [] as TrayTemplateItem[],
  });

  const [viewSetup, setViewSetup] = useState<ChairSetupRow | null>(null);

  const sessionStatus = session?.status ?? "NOT_STARTED";
  const isOpen = sessionStatus === "OPEN";
  const isClosed = sessionStatus === "CLOSED";

  const doctorMap = useMemo(
    () => new Map(doctors.map((d) => [d.id, d])),
    [doctors],
  );

  const inventoryMap = useMemo(
    () => new Map(inventoryItems.map((i) => [i.id, i])),
    [inventoryItems],
  );

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

  function openSetupForChair(chairId: string) {
    const schedules = schedulesByChair.get(chairId) ?? [];
    const doctorId = schedules[0]?.doctorId;
    setSetupChairId(chairId);
    setSetupTemplateId("");
    setSetupItems([]);
    setSetupOpen(true);
    void doctorId;
  }

  function applyTemplate(templateId: string) {
    setSetupTemplateId(templateId);
    const template = templates.find((t) => t.id === templateId);
    if (!template) return;
    setSetupItems(
      template.items.map((item) => ({
        ...item,
        qty: item.qty,
      })),
    );
  }

  function addManualItem(inventoryItemId: string, qty = 1) {
    const item = inventoryMap.get(inventoryItemId);
    if (!item) return;
    setSetupItems((prev) => {
      const existing = prev.find((p) => p.inventoryItemId === inventoryItemId);
      if (existing) {
        return prev.map((p) =>
          p.inventoryItemId === inventoryItemId ? { ...p, qty: p.qty + qty } : p,
        );
      }
      return [
        ...prev,
        {
          inventoryItemId: item.id,
          itemName: item.name,
          qty,
          unit: item.unit,
        },
      ];
    });
  }

  async function handleBarcodeForSetup(code: string) {
    const result = await scanSupplierBarcode(code);
    if (!result.found || !result.item) {
      toast.error("Item not found");
      return;
    }
    const item = result.item as { id: string; name: string; unit?: string };
    addManualItem(item.id, result.packSize ?? 1);
    toast.success(`Added ${item.name}`);
  }

  function handleOpenDay() {
    startTransition(async () => {
      try {
        await openDaySession();
        toast.success("Day opened");
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
        const { summary } = await closeDaySession(session.id);
        toast.success("Day closed");
        setCloseOpen(false);
        console.info("Day summary", summary);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to close day");
      }
    });
  }

  function handleAssign() {
    startTransition(async () => {
      try {
        await assignDoctorToChair({
          ...assignForm,
          scheduleDate: today,
        });
        toast.success("Assignment saved");
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
        toast.success("Chair setup complete");
        setSetupOpen(false);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Setup failed");
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

  function handleDeleteTemplate(id: string) {
    startTransition(async () => {
      try {
        await deleteTrayTemplate(id);
        toast.success("Template deleted");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Delete failed");
      }
    });
  }

  const totalSetupCost = (session?.chairSetups ?? []).reduce((s, c) => s + c.setupCost, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Chair setup</h1>
          <p className="text-muted-foreground">
            Daily session, doctor assignments, tray setup &amp; templates
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/clinical">Back to clinical</Link>
        </Button>
      </div>

      <Tabs defaultValue="day">
        <TabsList className="flex h-auto flex-wrap">
          <TabsTrigger value="day">Day status</TabsTrigger>
          <TabsTrigger value="assignments">Doctor-chair</TabsTrigger>
          <TabsTrigger value="setup" disabled={!isOpen}>
            Tray setup
          </TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>

        {/* Tab 1: Day status */}
        <TabsContent value="day" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5" />
                {new Date(today).toLocaleDateString("en-AE", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">Session status</span>
                <Badge
                  variant={
                    isOpen ? "default" : isClosed ? "secondary" : "outline"
                  }
                >
                  {sessionStatus === "NOT_STARTED" ? "NOT STARTED" : sessionStatus}
                </Badge>
              </div>

              {!session && (
                <Button onClick={handleOpenDay} disabled={isPending}>
                  Open day
                </Button>
              )}

              {isOpen && session && (
                <>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">Chairs set up</p>
                      <p className="text-2xl font-bold">{session.chairSetups.length}</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">Total setup cost</p>
                      <p className="text-2xl font-bold">{formatCurrency(totalSetupCost)}</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">Opened at</p>
                      <p className="text-sm font-medium">
                        {session.openedAt
                          ? new Date(session.openedAt).toLocaleTimeString()
                          : "—"}
                      </p>
                    </div>
                  </div>
                  <Button variant="destructive" onClick={() => void loadCloseSummary()} disabled={isPending}>
                    Close day
                  </Button>
                </>
              )}

              {isClosed && session && (
                <div className="space-y-2 text-sm">
                  <p className="text-muted-foreground">
                    Closed at{" "}
                    {session.closedAt
                      ? new Date(session.closedAt).toLocaleString()
                      : "—"}
                  </p>
                  <p>
                    {session.chairSetups.length} chair setup(s) · Total cost{" "}
                    {formatCurrency(totalSetupCost)}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Doctor-chair assignment */}
        <TabsContent value="assignments" className="space-y-4 pt-4">
          <div className="flex justify-end">
            <Button onClick={() => setAssignOpen(true)}>
              <Plus className="mr-1 h-4 w-4" />
              Add assignment
            </Button>
          </div>

          <div className="space-y-2">
            {chairs.map((chair) => {
              const schedules = schedulesByChair.get(chair.id) ?? [];
              const morning = schedules.find((s) => s.shiftType === "MORNING");
              const afternoon = schedules.find((s) => s.shiftType === "AFTERNOON");
              const fullDay = schedules.find((s) => s.shiftType === "FULL_DAY");

              return (
                <Card key={chair.id}>
                  <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                    <div>
                      <p className="font-medium">{chair.name}</p>
                      <p className="text-xs text-muted-foreground">Chair #{chair.number}</p>
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">Morning</p>
                        <p>
                          {morning
                            ? doctorName(doctorMap.get(morning.doctorId)!)
                            : fullDay
                              ? doctorName(doctorMap.get(fullDay.doctorId)!)
                              : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Afternoon</p>
                        <p>
                          {afternoon
                            ? doctorName(doctorMap.get(afternoon.doctorId)!)
                            : fullDay
                              ? doctorName(doctorMap.get(fullDay.doctorId)!)
                              : "—"}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {schedules.map((s) => (
                        <Button
                          key={s.id}
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            startTransition(async () => {
                              await removeDoctorChairAssignment(s.id);
                              toast.success("Removed");
                              router.refresh();
                            })
                          }
                        >
                          Remove {shiftLabel(s.shiftType)}
                        </Button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Tab 3: Chair tray setup */}
        <TabsContent value="setup" className="space-y-4 pt-4">
          {!isOpen && (
            <p className="text-sm text-muted-foreground">Open the day to set up chairs.</p>
          )}
          {isOpen &&
            chairs.map((chair) => {
              const setup = setupByChair.get(chair.id);
              const schedules = schedulesByChair.get(chair.id) ?? [];
              const assignedDoctor = schedules[0]
                ? doctorMap.get(schedules[0].doctorId)
                : null;

              return (
                <Card key={chair.id}>
                  <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                    <div>
                      <p className="font-medium">{chair.name}</p>
                      {assignedDoctor ? (
                        <p className="text-sm text-muted-foreground">
                          Dr. {doctorName(assignedDoctor)}
                        </p>
                      ) : (
                        <p className="text-sm text-amber-600">No doctor assigned</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {setup ? (
                        <>
                          <Badge className="bg-green-100 text-green-800">
                            <CheckCircle2 className="mr-1 h-3 w-3" />
                            Setup complete
                          </Badge>
                          <Button size="sm" variant="outline" onClick={() => setViewSetup(setup)}>
                            View
                          </Button>
                        </>
                      ) : schedules.length > 0 ? (
                        <Button size="sm" onClick={() => openSetupForChair(chair.id)}>
                          Set up now
                        </Button>
                      ) : (
                        <span className="text-sm text-muted-foreground">No doctor assigned</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
        </TabsContent>

        {/* Tab 4: Templates */}
        <TabsContent value="templates" className="space-y-4 pt-4">
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

          <div className="grid gap-3 md:grid-cols-2">
            {templates.map((t) => (
              <Card key={t.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <LayoutTemplate className="h-4 w-4" />
                    {t.name}
                    {t.isDefault && <Badge variant="secondary">Default</Badge>}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    {t.items.length} item{t.items.length === 1 ? "" : "s"}
                  </p>
                  <ul className="text-sm">
                    {t.items.slice(0, 4).map((item) => (
                      <li key={item.inventoryItemId}>
                        {item.itemName} × {item.qty} {item.unit}
                      </li>
                    ))}
                    {t.items.length > 4 && (
                      <li className="text-muted-foreground">+{t.items.length - 4} more</li>
                    )}
                  </ul>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingTemplate(t);
                        setTemplateForm({
                          name: t.name,
                          isDefault: t.isDefault,
                          notes: t.notes ?? "",
                          items: t.items,
                        });
                        setTemplateOpen(true);
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteTemplate(t.id)}
                      disabled={isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Assignment dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign doctor to chair</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div>
              <Label>Chair</Label>
              <Select
                value={assignForm.chairId}
                onValueChange={(v) => setAssignForm((f) => ({ ...f, chairId: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {chairs.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
                      {doctorName(d)} ({d.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Shift</Label>
              <Select
                value={assignForm.shiftType}
                onValueChange={(v) => {
                  const times =
                    v === "MORNING"
                      ? { startTime: "09:00", endTime: "13:00" }
                      : v === "AFTERNOON"
                        ? { startTime: "14:00", endTime: "18:00" }
                        : { startTime: "09:00", endTime: "17:00" };
                  setAssignForm((f) => ({ ...f, shiftType: v, ...times }));
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MORNING">Morning (09:00–13:00)</SelectItem>
                  <SelectItem value="AFTERNOON">Afternoon (14:00–18:00)</SelectItem>
                  <SelectItem value="FULL_DAY">Full day</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Start</Label>
                <Input
                  value={assignForm.startTime}
                  onChange={(e) =>
                    setAssignForm((f) => ({ ...f, startTime: e.target.value }))
                  }
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

      {/* Setup dialog */}
      <Dialog open={setupOpen} onOpenChange={setSetupOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Set up {chairs.find((c) => c.id === setupChairId)?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Template (optional)</Label>
              <Select
                value={setupTemplateId || "none"}
                onValueChange={(v) => {
                  if (v === "none") {
                    setSetupTemplateId("");
                    setSetupItems([]);
                  } else {
                    applyTemplate(v);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select template" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Manual selection</SelectItem>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} ({t.items.length} items)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Add items</Label>
              <Select onValueChange={(v) => addManualItem(v, 1)}>
                <SelectTrigger>
                  <SelectValue placeholder="Search inventory..." />
                </SelectTrigger>
                <SelectContent>
                  {inventoryItems.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.name} ({i.quantity} {i.unit})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <BarcodeScanner
              onScan={(code) => void handleBarcodeForSetup(code)}
              mode="both"
              placeholder="Scan item barcode..."
            />

            <ul className="space-y-2">
              {setupItems.map((item) => {
                const stock = inventoryMap.get(item.inventoryItemId)?.quantity ?? 0;
                return (
                  <li
                    key={item.inventoryItemId}
                    className="flex items-center justify-between rounded border p-2 text-sm"
                  >
                    <div>
                      <p className="font-medium">{item.itemName}</p>
                      <p className="text-xs text-muted-foreground">
                        Stock: {stock} {item.unit}
                      </p>
                    </div>
                    <Input
                      type="number"
                      min={1}
                      className="w-20"
                      value={item.qty}
                      onChange={(e) => {
                        const qty = parseInt(e.target.value, 10) || 1;
                        setSetupItems((prev) =>
                          prev.map((p) =>
                            p.inventoryItemId === item.inventoryItemId ? { ...p, qty } : p,
                          ),
                        );
                      }}
                    />
                  </li>
                );
              })}
            </ul>
          </div>
          <DialogFooter>
            <Button onClick={handleConfirmSetup} disabled={isPending || setupItems.length === 0}>
              Confirm setup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View setup dialog */}
      <Dialog open={!!viewSetup} onOpenChange={(o) => !o && setViewSetup(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{viewSetup?.chair.name} — setup items</DialogTitle>
          </DialogHeader>
          <ul className="space-y-2 text-sm">
            {viewSetup?.setupItems.map((item) => (
              <li key={item.inventoryItemId} className="flex justify-between border-b pb-1">
                <span>{item.itemName}</span>
                <span>
                  {item.qty} {item.unit}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-sm text-muted-foreground">
            Cost: {formatCurrency(viewSetup?.setupCost ?? 0)}
          </p>
        </DialogContent>
      </Dialog>

      {/* Template dialog */}
      <Dialog open={templateOpen} onOpenChange={setTemplateOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? "Edit template" : "New template"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input
                value={templateForm.name}
                onChange={(e) => setTemplateForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={templateForm.isDefault}
                onChange={(e) =>
                  setTemplateForm((f) => ({ ...f, isDefault: e.target.checked }))
                }
              />
              Default template
            </label>
            <div>
              <Label>Items</Label>
              <Select
                onValueChange={(v) => {
                  const item = inventoryMap.get(v);
                  if (!item) return;
                  setTemplateForm((f) => ({
                    ...f,
                    items: [
                      ...f.items,
                      {
                        inventoryItemId: item.id,
                        itemName: item.name,
                        qty: 1,
                        unit: item.unit,
                      },
                    ],
                  }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Add inventory item..." />
                </SelectTrigger>
                <SelectContent>
                  {inventoryItems.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <ul className="mt-2 space-y-1 text-sm">
                {templateForm.items.map((item, idx) => (
                  <li key={`${item.inventoryItemId}-${idx}`} className="flex justify-between">
                    <span>{item.itemName}</span>
                    <Input
                      type="number"
                      min={1}
                      className="h-8 w-16"
                      value={item.qty}
                      onChange={(e) => {
                        const qty = parseInt(e.target.value, 10) || 1;
                        setTemplateForm((f) => ({
                          ...f,
                          items: f.items.map((it, i) => (i === idx ? { ...it, qty } : it)),
                        }));
                      }}
                    />
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={handleSaveTemplate}
              disabled={isPending || !templateForm.name || templateForm.items.length === 0}
            >
              Save template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close day dialog */}
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
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs text-muted-foreground">
                        <th className="py-1">Item</th>
                        <th>Setup</th>
                        <th>Consumed</th>
                        <th>Return</th>
                        <th>Variance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {row.setupItems.map((item) => {
                        const consumed = row.consumedItems
                          .filter((c) => c.inventoryItemId === item.inventoryItemId)
                          .reduce((s, c) => s + c.qty, 0);
                        const returnQty =
                          returnDrafts[row.chairSetupId]?.[item.inventoryItemId] ?? 0;
                        const variance = item.qty - consumed - returnQty;
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
                                  const qty = parseInt(e.target.value, 10) || 0;
                                  setReturnDrafts((prev) => ({
                                    ...prev,
                                    [row.chairSetupId]: {
                                      ...(prev[row.chairSetupId] ?? {}),
                                      [item.inventoryItemId]: qty,
                                    },
                                  }));
                                }}
                              />
                            </td>
                            <td className={variance !== 0 ? "text-amber-600" : ""}>
                              {variance}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {row.hasVariance && (
                  <p className="flex items-center gap-1 text-xs text-amber-600">
                    <AlertTriangle className="h-3 w-3" />
                    Variance detected — verify returns before closing
                  </p>
                )}
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
