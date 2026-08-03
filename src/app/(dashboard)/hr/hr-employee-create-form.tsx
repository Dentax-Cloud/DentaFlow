"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createEmployee } from "@/app/(dashboard)/features/hr/hr-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function HrEmployeeCreateForm({
  departments,
}: {
  departments: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      try {
        const row = await createEmployee({
          firstName: String(fd.get("firstName") ?? ""),
          lastName: String(fd.get("lastName") ?? ""),
          email: String(fd.get("email") ?? "") || undefined,
          jobTitle: String(fd.get("jobTitle") ?? "") || undefined,
          departmentId: String(fd.get("departmentId") ?? "") || null,
          employmentType: String(fd.get("employmentType") ?? "salaried"),
          hireDate: String(fd.get("hireDate") ?? ""),
          compensationNote: String(fd.get("compensationNote") ?? "") || undefined,
        });
        toast.success("Employee created");
        setOpen(false);
        router.push(`/hr/employees/${row.id}`);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Create failed");
      }
    });
  }

  if (!open) {
    return (
      <Button type="button" onClick={() => setOpen(true)}>
        Add employee
      </Button>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">New employee</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="firstName">First name</Label>
            <Input id="firstName" name="firstName" required />
          </div>
          <div>
            <Label htmlFor="lastName">Last name</Label>
            <Input id="lastName" name="lastName" required />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" />
          </div>
          <div>
            <Label htmlFor="jobTitle">Job title</Label>
            <Input id="jobTitle" name="jobTitle" />
          </div>
          <div>
            <Label htmlFor="departmentId">Department</Label>
            <select
              id="departmentId"
              name="departmentId"
              className="flex h-9 w-full rounded-md border px-2 text-sm"
            >
              <option value="">—</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="employmentType">Employment type</Label>
            <select
              id="employmentType"
              name="employmentType"
              className="flex h-9 w-full rounded-md border px-2 text-sm"
              defaultValue="salaried"
            >
              <option value="salaried">salaried</option>
              <option value="hourly">hourly</option>
              <option value="production_based">production_based</option>
              <option value="per_diem">per_diem</option>
              <option value="contractor">contractor</option>
            </select>
          </div>
          <div>
            <Label htmlFor="hireDate">Hire date</Label>
            <Input
              id="hireDate"
              name="hireDate"
              type="date"
              required
              defaultValue={new Date().toISOString().slice(0, 10)}
            />
          </div>
          <div>
            <Label htmlFor="compensationNote">Compensation note (optional)</Label>
            <Input id="compensationNote" name="compensationNote" />
          </div>
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" disabled={pending}>
              Create
            </Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
