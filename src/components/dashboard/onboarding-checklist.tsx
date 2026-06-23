"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { CheckCircle2, Circle, PartyPopper } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { OnboardingChecklistItem } from "@/lib/tenant/onboarding";
import { skipOnboardingChecklistAction } from "@/app/(dashboard)/features/onboarding/checklist-actions";

type Props = {
  items: OnboardingChecklistItem[];
  compact?: boolean;
};

export function OnboardingChecklist({ items, compact = false }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const completedCount = items.filter((item) => item.completed).length;

  function handleSkip() {
    startTransition(async () => {
      await skipOnboardingChecklistAction();
      router.refresh();
    });
  }

  return (
    <Card className={compact ? "border-dashed" : ""}>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <PartyPopper className="h-5 w-5 text-dental" />
              Getting started
            </CardTitle>
            <CardDescription>
              {completedCount} of {items.length} steps complete — finish setup to get the most from
              DentaFlow.
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" disabled={pending} onClick={handleSkip}>
            Skip checklist
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className="flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors hover:bg-muted/50"
          >
            {item.completed ? (
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
            ) : (
              <Circle className="h-5 w-5 shrink-0 text-muted-foreground" />
            )}
            <span className={item.completed ? "text-muted-foreground line-through" : "font-medium"}>
              {item.label}
            </span>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
