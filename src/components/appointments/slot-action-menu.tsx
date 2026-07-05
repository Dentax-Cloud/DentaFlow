"use client";

import { format } from "date-fns";
import { CalendarPlus, Clock } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slotStart?: Date;
  slotEnd?: Date;
  onBlockTime: () => void;
};

export function SlotActionMenu({
  open,
  onOpenChange,
  slotStart,
  slotEnd,
  onBlockTime,
}: Props) {
  const router = useRouter();

  if (!slotStart || !slotEnd) return null;

  const date = format(slotStart, "yyyy-MM-dd");
  const time = format(slotStart, "HH:mm");

  function handleBookPatient() {
    onOpenChange(false);
    router.push(
      `/appointments/book?date=${encodeURIComponent(date)}&time=${encodeURIComponent(time)}`,
    );
  }

  function handleBlockTime() {
    onOpenChange(false);
    onBlockTime();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Schedule this slot</DialogTitle>
          <DialogDescription>
            {format(slotStart, "EEE, MMM d · h:mm a")}
            {" – "}
            {format(slotEnd, "h:mm a")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 pt-2">
          <Button type="button" className="justify-start" onClick={handleBookPatient}>
            <CalendarPlus className="mr-2 h-4 w-4" />
            Book patient appointment
          </Button>
          <Button type="button" variant="outline" className="justify-start" onClick={handleBlockTime}>
            <Clock className="mr-2 h-4 w-4" />
            Block time
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
