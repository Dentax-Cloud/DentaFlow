"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createDepartment } from "@/app/(dashboard)/features/hr/hr-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function HrDepartmentsClient({
  departments,
}: {
  departments: Array<{ id: string; name: string; description: string | null }>;
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
              await createDepartment({
                name: String(fd.get("name")),
                description: String(fd.get("description") || "") || undefined,
              });
              toast.success("Department created");
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
          <Label htmlFor="description">Description</Label>
          <Input id="description" name="description" />
        </div>
        <Button type="submit" disabled={pending}>
          Add department
        </Button>
      </form>

      <ul className="space-y-2 text-sm">
        {departments.map((d) => (
          <li key={d.id} className="rounded-md border p-3">
            <p className="font-medium">{d.name}</p>
            {d.description && (
              <p className="text-muted-foreground">{d.description}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
