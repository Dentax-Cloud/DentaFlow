"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createLeaveType } from "@/app/(dashboard)/features/hr/hr-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function HrLeaveTypesClient({
  types,
}: {
  types: Array<{
    id: string;
    name: string;
    isPaid: boolean;
    defaultAnnualEntitlement: number;
  }>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <div className="space-y-6">
      <form
        className="grid max-w-lg gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          start(async () => {
            try {
              await createLeaveType({
                name: String(fd.get("name")),
                isPaid: fd.get("isPaid") === "on",
                defaultAnnualEntitlement: Number(fd.get("entitlement") || 0),
              });
              toast.success("Leave type created");
              (e.target as HTMLFormElement).reset();
              router.refresh();
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Failed");
            }
          });
        }}
      >
        <div>
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" required />
        </div>
        <div>
          <Label htmlFor="entitlement">Default annual entitlement (days)</Label>
          <Input id="entitlement" name="entitlement" type="number" defaultValue={20} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isPaid" defaultChecked /> Paid
        </label>
        <Button type="submit" disabled={pending}>
          Add leave type
        </Button>
      </form>

      <ul className="space-y-2 text-sm">
        {types.map((t) => (
          <li key={t.id} className="rounded-md border p-3">
            <p className="font-medium">{t.name}</p>
            <p className="text-muted-foreground">
              {t.isPaid ? "Paid" : "Unpaid"} · {t.defaultAnnualEntitlement} days/year
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
