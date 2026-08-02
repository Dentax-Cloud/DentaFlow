"use client";

import { useState, useTransition } from "react";
import { setChairPrepared } from "@/app/(dashboard)/features/clinical/chair-prep-actions";

type Chair = {
  id: string;
  name: string;
  number: number;
  trayTemplateName: string | null;
  preparedAt: string | null;
  checklist: Array<{
    inventoryItemId: string;
    itemName: string;
    unit: string;
    quantity: number;
  }>;
};

export function ChairPrepClient({
  clinicDate,
  initialChairs,
}: {
  clinicDate: string;
  initialChairs: Chair[];
}) {
  const [chairs, setChairs] = useState(initialChairs);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-4">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Chair prep</h1>
        <p className="text-sm text-slate-600">
          Schedule-driven materials checklist for {clinicDate}
        </p>
      </header>
      {error ? (
        <p className="rounded-md bg-rose-50 p-2 text-sm text-rose-800" role="alert">
          {error}
        </p>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        {chairs.map((chair) => {
          const prepared = Boolean(chair.preparedAt);
          const checkboxId = `prepared-${chair.id}`;
          return (
            <section
              key={chair.id}
              className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
              aria-labelledby={`chair-${chair.id}-title`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2
                    id={`chair-${chair.id}-title`}
                    className="font-medium text-slate-900"
                  >
                    {chair.name} · {chair.number}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {chair.trayTemplateName
                      ? `Tray: ${chair.trayTemplateName}`
                      : "No tray template"}
                  </p>
                </div>
                <label
                  htmlFor={checkboxId}
                  className="flex min-h-10 items-center gap-2 text-sm text-slate-800"
                >
                  <input
                    id={checkboxId}
                    type="checkbox"
                    checked={prepared}
                    disabled={pending}
                    onChange={(e) =>
                      startTransition(async () => {
                        setError(null);
                        try {
                          await setChairPrepared({
                            chairId: chair.id,
                            prepDate: clinicDate,
                            prepared: e.target.checked,
                          });
                          setChairs((prev) =>
                            prev.map((value) =>
                              value.id === chair.id
                                ? {
                                    ...value,
                                    preparedAt: e.target.checked
                                      ? new Date().toISOString()
                                      : null,
                                  }
                                : value,
                            ),
                          );
                        } catch (cause) {
                          setError(
                            cause instanceof Error
                              ? cause.message
                              : "Unable to update chair prep.",
                          );
                        }
                      })
                    }
                  />
                  Prepared
                </label>
              </div>
              {chair.checklist.length ? (
                <ul className="mt-3 space-y-1 text-sm text-slate-800">
                  {chair.checklist.map((item) => (
                    <li
                      key={item.inventoryItemId}
                      className="flex justify-between gap-2"
                    >
                      <span>{item.itemName}</span>
                      <span className="tabular-nums text-slate-600">
                        {item.quantity} {item.unit}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-slate-500">
                  No BOM materials scheduled for this chair.
                </p>
              )}
            </section>
          );
        })}
      </div>
    </main>
  );
}
