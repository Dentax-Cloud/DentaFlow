"use client";

import { useState } from "react";
import type { AppointmentStatus } from "@prisma/client";
import { getChairsideBypassWarning } from "@/app/(dashboard)/features/clinical/chairside-actions";
import { chairsideBypassOutcomeMessage } from "@/lib/clinical/chairside-bypass";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type PendingAction = {
  status: AppointmentStatus;
  entryCount: number;
  onConfirm: () => void;
};

export function useChairsideAppointmentConfirm() {
  const [pending, setPending] = useState<PendingAction | null>(null);

  async function confirmBeforeStatusChange(
    appointmentId: string,
    status: AppointmentStatus,
    onConfirm: () => void,
  ) {
    try {
      const warning = await getChairsideBypassWarning(appointmentId);
      if (!warning.required) {
        onConfirm();
        return;
      }
      setPending({ status, entryCount: warning.entryCount, onConfirm });
    } catch {
      onConfirm();
    }
  }

  const dialog = (
    <AlertDialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Active chairside session</AlertDialogTitle>
          <AlertDialogDescription>
            {pending && (
              <>
                This appointment has an active chairside session with{" "}
                {pending.entryCount} recorded procedure
                {pending.entryCount === 1 ? "" : "s"}. Continuing will{" "}
                {chairsideBypassOutcomeMessage(pending.status)}. Continue?
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              pending?.onConfirm();
              setPending(null);
            }}
          >
            Continue
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { confirmBeforeStatusChange, dialog };
}
