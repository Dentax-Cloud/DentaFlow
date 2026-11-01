"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setClinicType } from "@/app/(dashboard)/features/tenant/clinic-type-actions";
import type { ClinicType } from "@/lib/clinic-type";

type Props = {
  current: ClinicType;
};

export function ClinicTypeToggle({ current }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function switchTo(next: ClinicType) {
    if (next === current || pending) return;
    startTransition(async () => {
      const result = await setClinicType(next);
      if (result.success) {
        router.push(next === "solo" ? "/solo" : "/dashboard");
        router.refresh();
      }
    });
  }

  return (
    <div className="inline-flex rounded-lg border bg-white p-1 text-sm">
      <button
        type="button"
        disabled={pending}
        onClick={() => switchTo("solo")}
        className={`rounded-md px-3 py-1.5 ${
          current === "solo" ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-50"
        }`}
      >
        Solo
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => switchTo("practice")}
        className={`rounded-md px-3 py-1.5 ${
          current === "practice" ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-50"
        }`}
      >
        Practice
      </button>
    </div>
  );
}
