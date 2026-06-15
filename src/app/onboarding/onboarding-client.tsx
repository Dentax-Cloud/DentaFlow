"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RegistrationStepper } from "@/components/auth/registration-stepper";
import { completeOnboarding } from "@/app/(dashboard)/features/onboarding/actions";
import {
  COUNTRY_OPTIONS,
  getCountryByCode,
  TIMEZONE_OPTIONS,
} from "@/lib/auth/countries";
import { SubscriptionPlan } from "@/lib/subscription/plan-types";
import { cn } from "@/lib/utils";

const STEPS = [
  { id: 1, label: "Clinic" },
  { id: 2, label: "Locale & plan" },
] as const;

const step1Schema = z.object({
  clinicName: z.string().min(2, "Clinic name is required"),
  email: z.string().email("Enter a valid email").optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  chairCount: z.coerce.number().min(1).max(50),
});

const step2Schema = z.object({
  country: z.string().min(2, "Select a country"),
  timezone: z.string().min(1, "Select a timezone"),
  city: z.string().optional(),
});

type Step1Data = z.infer<typeof step1Schema>;
type Step2Data = z.infer<typeof step2Schema>;

export type OnboardingInitialData = {
  clinicName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  timezone: string;
  chairCount: number;
  plan: SubscriptionPlan;
  trialDaysRemaining: number | null;
};

const inputClass =
  "h-11 rounded-xl border-white/10 bg-zinc-900/80 text-white placeholder:text-zinc-500 focus-visible:ring-sky-500/30";
const selectClass =
  "flex h-11 w-full rounded-xl border border-white/10 bg-zinc-900/80 px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/30";

const STARTER_FEATURES = [
  "Up to 500 patients",
  "3 team members",
  "Appointment scheduling",
  "Patient records & billing",
  "14-day free trial",
];

type Props = {
  initial: OnboardingInitialData;
};

export function OnboardingClient({ initial }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [step1Data, setStep1Data] = useState<Step1Data | null>(null);

  const step1Form = useForm<Step1Data>({
    resolver: zodResolver(step1Schema),
    defaultValues: {
      clinicName: initial.clinicName,
      email: initial.email,
      phone: initial.phone,
      address: initial.address,
      chairCount: initial.chairCount,
    },
  });

  const step2Form = useForm<Step2Data>({
    resolver: zodResolver(step2Schema),
    defaultValues: {
      country: initial.country || "AE",
      timezone: initial.timezone || "Asia/Dubai",
      city: initial.city,
    },
  });

  const watchedCountry = step2Form.watch("country");
  const countryMeta = useMemo(() => getCountryByCode(watchedCountry), [watchedCountry]);

  useEffect(() => {
    if (countryMeta) {
      step2Form.setValue("timezone", countryMeta.timezone);
    }
  }, [countryMeta, step2Form]);

  function onStep1Submit(data: Step1Data) {
    setStep1Data(data);
    setStep(2);
  }

  async function onStep2Submit(data: Step2Data) {
    const step1 = step1Data ?? step1Form.getValues();
    setLoading(true);

    const result = await completeOnboarding({
      clinicName: step1.clinicName,
      email: step1.email || undefined,
      phone: step1.phone,
      address: step1.address,
      city: data.city,
      country: data.country,
      timezone: data.timezone,
      chairCount: step1.chairCount,
      plan: SubscriptionPlan.STARTER,
      doctors: [],
    });

    setLoading(false);

    if (result.success) {
      toast.success("Welcome to DentaFlow! Check your email for next steps.");
      router.push("/dashboard");
    } else {
      toast.error(result.error);
    }
  }

  const progress = (step / STEPS.length) * 100;

  return (
    <div className="relative min-h-screen bg-zinc-950 text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -top-40 left-1/2 h-[520px] w-[720px] -translate-x-1/2 rounded-full bg-sky-500/10 blur-[120px]" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-xl flex-col justify-center px-4 py-12">
        <div className="mb-8 text-center">
          <Badge className="mb-4 border-sky-500/30 bg-sky-500/10 text-sky-300">
            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            Clinic onboarding
          </Badge>
          <h1 className="text-3xl font-bold tracking-tight">Set up your practice</h1>
          <p className="mt-3 text-zinc-400">
            A few details to personalize your workspace and activate your free trial.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-zinc-900/50 p-6 shadow-xl sm:p-8">
          <Progress value={progress} className="mb-6" />
          <RegistrationStepper steps={[...STEPS]} currentStep={step} />

          {step === 1 && (
            <form onSubmit={step1Form.handleSubmit(onStep1Submit)} className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="clinicName">Clinic name</Label>
                <Input id="clinicName" className={inputClass} {...step1Form.register("clinicName")} />
                {step1Form.formState.errors.clinicName && (
                  <p className="text-xs text-red-400">{step1Form.formState.errors.clinicName.message}</p>
                )}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="email">Clinic email</Label>
                  <Input id="email" type="email" className={inputClass} {...step1Form.register("email")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" className={inputClass} {...step1Form.register("phone")} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input id="address" className={inputClass} {...step1Form.register("address")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="chairCount">Number of operatories</Label>
                <Input id="chairCount" type="number" min={1} max={50} className={inputClass} {...step1Form.register("chairCount")} />
              </div>
              <Button type="submit" className="h-11 w-full rounded-xl bg-gradient-to-r from-sky-600 to-cyan-500 font-semibold">
                Continue <ArrowRight className="h-4 w-4" />
              </Button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={step2Form.handleSubmit(onStep2Submit)} className="mt-6 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <select id="country" className={selectClass} {...step2Form.register("country")}>
                    {COUNTRY_OPTIONS.map((c) => (
                      <option key={c.code} value={c.code} className="bg-zinc-900">{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <select id="timezone" className={selectClass} {...step2Form.register("timezone")}>
                    {TIMEZONE_OPTIONS.map((tz) => (
                      <option key={tz} value={tz} className="bg-zinc-900">{tz}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input id="city" className={inputClass} {...step2Form.register("city")} />
              </div>

              <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-sky-200">Starter plan</p>
                    <p className="text-sm text-zinc-400">14-day free trial · No credit card</p>
                  </div>
                  {initial.trialDaysRemaining != null && (
                    <Badge variant="outline" className="border-emerald-500/30 text-emerald-300">
                      {initial.trialDaysRemaining} days left
                    </Badge>
                  )}
                </div>
                <ul className="mt-3 space-y-1.5">
                  {STARTER_FEATURES.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm text-zinc-300">
                      <Check className="h-3.5 w-3.5 text-sky-400" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex gap-3">
                <Button type="button" variant="outline" className="h-11 rounded-xl border-white/15" onClick={() => setStep(1)}>
                  <ArrowLeft className="h-4 w-4" /> Back
                </Button>
                <Button
                  type="submit"
                  className={cn("h-11 flex-1 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-500 font-semibold")}
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Launching...
                    </>
                  ) : (
                    "Launch dashboard"
                  )}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
