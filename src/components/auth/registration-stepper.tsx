import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export type StepItem = {
  id: number;
  label: string;
};

type Props = {
  steps: StepItem[];
  currentStep: number;
};

export function RegistrationStepper({ steps, currentStep }: Props) {
  return (
    <nav aria-label="Registration progress" className="mb-8">
      <ol className="flex items-center justify-between gap-2">
        {steps.map((step, index) => {
          const done = currentStep > step.id;
          const active = currentStep === step.id;
          return (
            <li key={step.id} className="flex flex-1 items-center">
              <div className="flex w-full flex-col items-center gap-2">
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold transition-colors",
                    done
                      ? "border-sky-500 bg-sky-500 text-white"
                      : active
                        ? "border-sky-400 bg-sky-500/20 text-sky-300"
                        : "border-white/10 bg-zinc-900 text-zinc-500",
                  )}
                >
                  {done ? <Check className="h-4 w-4" /> : step.id}
                </div>
                <span
                  className={cn(
                    "hidden text-center text-[10px] font-medium leading-tight sm:block sm:text-xs",
                    active ? "text-sky-300" : done ? "text-zinc-300" : "text-zinc-600",
                  )}
                >
                  {step.label}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    "mx-1 h-px flex-1 sm:mx-2",
                    done ? "bg-sky-500/60" : "bg-white/10",
                  )}
                  aria-hidden
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
