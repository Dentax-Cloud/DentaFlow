"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useAuth, useUser } from "@/lib/auth/client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  PartyPopper,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { RegistrationStepper } from "./registration-stepper";
import { registerClinicAction } from "@/app/(auth)/features/registration/actions";
import {
  getCountryByCode,
  SPECIALTY_OPTIONS,
  TIMEZONE_OPTIONS,
} from "@/lib/auth/countries";
import { SUPPORTED_COUNTRIES, getCountryProfile } from "@/lib/countries";
import { SECONDARY_LANGUAGES, normalizeSecondaryLanguage } from "@/lib/i18n/secondary-languages";
import {
  DOCTOR_COUNT_OPTIONS,
  formatAdminName,
  passwordStrengthScore,
  registrationStep1OAuthSchema,
  registrationStep1Schema,
  registrationStep2Schema,
  type RegistrationStep1,
  type RegistrationStep2,
} from "@/lib/auth/registration-schema";
import { cn } from "@/lib/utils";

const STEPS = [
  { id: 1, label: "Your account" },
  { id: 2, label: "Your clinic" },
  { id: 3, label: "You're all set" },
] as const;

const inputClass =
  "h-11 rounded-xl border-white/10 bg-zinc-900/80 text-white placeholder:text-zinc-500 focus-visible:ring-sky-500/30";
const selectClass =
  "flex h-11 w-full rounded-xl border border-white/10 bg-zinc-900/80 px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/30";

type Props = {
  uploadsEnabled?: boolean;
  initialStep?: number;
};

function clerkErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "Something went wrong. Please try again.";
}

export function ClinicRegistrationWizard({ initialStep = 1 }: Props) {
  const searchParams = useSearchParams();
  const { isSignedIn, isLoaded: authLoaded } = useAuth();
  const { user, isLoaded: userLoaded } = useUser();

  const [step, setStep] = useState(initialStep);
  const [submitting, setSubmitting] = useState(false);
  const [oauthConnected, setOauthConnected] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState("");
  const [registeredClinic, setRegisteredClinic] = useState("");

  const step1Form = useForm<RegistrationStep1>({
    resolver: zodResolver(registrationStep1Schema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
    },
  });

  const step2Form = useForm<RegistrationStep2>({
    resolver: zodResolver(registrationStep2Schema),
    defaultValues: {
      clinicName: "",
      country: "AE",
      timezone: "Asia/Dubai",
      currency: "AED",
      phone: "",
      specialty: "",
      doctorCountBand: "1",
      chairCount: 1,
      doctorCount: 1,
      secondaryLanguage: "",
    },
  });

  const watchedCountry = step2Form.watch("country");
  const watchedPassword = step1Form.watch("password");
  const countryMeta = useMemo(() => getCountryByCode(watchedCountry), [watchedCountry]);
  const countryProfile = useMemo(
    () => getCountryProfile(watchedCountry || "AE"),
    [watchedCountry],
  );
  const passwordStrength = useMemo(
    () => passwordStrengthScore(watchedPassword ?? ""),
    [watchedPassword],
  );

  useEffect(() => {
    if (countryMeta) {
      step2Form.setValue("timezone", countryMeta.timezone);
      step2Form.setValue("currency", countryMeta.currency);
    }
  }, [countryMeta, step2Form]);

  useEffect(() => {
    // Suggest the country's typical second language, but only among the
    // curated options we actually have translations for — the clinic can
    // still override it or clear it before submitting.
    const suggested = normalizeSecondaryLanguage(countryProfile.secondaryLanguage) ?? "";
    step2Form.setValue("secondaryLanguage", suggested);
  }, [countryProfile, step2Form]);

  useEffect(() => {
    if (!authLoaded || !userLoaded) return;

    const oauthReturn = searchParams.get("oauth") === "1";
    if (isSignedIn && user) {
      const nameParts = (user.name ?? "").trim().split(/\s+/);
      if (nameParts[0]) step1Form.setValue("firstName", nameParts[0]);
      if (nameParts.slice(1).join(" ")) step1Form.setValue("lastName", nameParts.slice(1).join(" "));
      if (user.email) step1Form.setValue("email", user.email);

      if (oauthReturn) {
        setOauthConnected(true);
        setStep(2);
      }
    }
  }, [authLoaded, userLoaded, isSignedIn, user, searchParams, step1Form]);

  useEffect(() => {
    if (step !== 3 || !registeredEmail) return;
    const timer = window.setTimeout(() => {
      window.location.assign("/dashboard");
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [step, registeredEmail]);

  function onStep1Submit() {
    setStep(2);
  }

  function onStep1OAuthContinue() {
    const parsed = registrationStep1OAuthSchema.safeParse(step1Form.getValues());
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please complete all required fields.");
      return;
    }
    setStep(2);
  }

  async function onStep2Submit(data: RegistrationStep2) {
    setSubmitting(true);
    try {
      const step1 = step1Form.getValues();
      const result = await registerClinicAction({
        firstName: step1.firstName,
        lastName: step1.lastName,
        email: step1.email,
        phone: data.phone || step1.phone || "",
        ...(step1.password ? { password: step1.password } : {}),
        clinicName: data.clinicName,
        country: data.country,
        timezone: data.timezone,
        currency: data.currency,
        specialty: data.specialty,
        doctorCountBand: data.doctorCountBand,
        chairCount: data.chairCount,
        doctorCount: data.doctorCount,
        secondaryLanguage: data.secondaryLanguage || undefined,
        specialties: data.specialty ? [data.specialty] : ["General Dentistry"],
        expectedMonthlyPatients: "1-50",
        referralSource: "Website",
      });

      if (!result.success) {
        toast.error(result.error);
        setSubmitting(false);
        return;
      }

      setRegisteredEmail(step1.email);
      setRegisteredClinic(data.clinicName);

      if (!isSignedIn && step1.password) {
        const signInResult = await signIn("credentials", {
          email: step1.email,
          password: step1.password,
          redirect: false,
        });

        if (signInResult?.error) {
          window.location.assign(`/login?callbackUrl=${encodeURIComponent("/dashboard")}`);
          return;
        }
      }

      setStep(3);
      setSubmitting(false);
    } catch (err) {
      toast.error(clerkErrorMessage(err));
      setSubmitting(false);
    }
  }

  async function handleGoogleSignUp() {
    try {
      await signIn("google", { callbackUrl: "/sign-up?oauth=1" });
    } catch (err) {
      toast.error(clerkErrorMessage(err));
    }
  }

  const progress = (step / STEPS.length) * 100;
  const authReady = authLoaded && userLoaded;

  if (!authReady) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16">
        <Loader2 className="h-8 w-8 animate-spin text-sky-400" />
        <p className="text-sm text-zinc-400">Preparing registration...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">Start your free trial</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Step {step} of {STEPS.length}
          </p>
        </div>
        <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
          14-day trial
        </Badge>
      </div>

      <Progress value={progress} />
      <RegistrationStepper steps={[...STEPS]} currentStep={step} />

      {step === 1 && (
        <div className="space-y-4">
          {oauthConnected && (
            <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 px-4 py-3 text-sm text-sky-200">
              Google account connected. Confirm your details and continue.
            </div>
          )}

          <form onSubmit={step1Form.handleSubmit(onStep1Submit)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="firstName">Full name</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Input id="firstName" placeholder="First" className={inputClass} {...step1Form.register("firstName")} />
                  <Input placeholder="Last" className={inputClass} {...step1Form.register("lastName")} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email address</Label>
                <Input id="email" type="email" className={inputClass} {...step1Form.register("email")} />
              </div>
            </div>

            {!oauthConnected && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input id="password" type="password" className={inputClass} {...step1Form.register("password")} />
                    {watchedPassword && (
                      <div className="space-y-1">
                        <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
                          <div
                            className={cn("h-full rounded-full transition-all", passwordStrength.color)}
                            style={{ width: `${Math.min(100, passwordStrength.score * 20)}%` }}
                          />
                        </div>
                        <p className="text-xs text-zinc-500">Strength: {passwordStrength.label}</p>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm password</Label>
                    <Input id="confirmPassword" type="password" className={inputClass} {...step1Form.register("confirmPassword")} />
                  </div>
                </div>

                <div className="relative py-2">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-white/10" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-zinc-900/50 px-2 text-zinc-500">or</span>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 w-full rounded-xl border-white/15 bg-zinc-900/80 text-white hover:bg-zinc-800"
                  onClick={handleGoogleSignUp}
                >
                  Continue with Google
                </Button>
              </>
            )}

            {oauthConnected ? (
              <Button
                type="button"
                className="h-11 w-full rounded-xl bg-gradient-to-r from-sky-600 to-cyan-500 font-semibold"
                onClick={onStep1OAuthContinue}
              >
                Continue <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button type="submit" className="h-11 w-full rounded-xl bg-gradient-to-r from-sky-600 to-cyan-500 font-semibold">
                Continue <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </form>
        </div>
      )}

      {step === 2 && (
        <form onSubmit={step2Form.handleSubmit(onStep2Submit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="clinicName">Clinic name</Label>
            <Input id="clinicName" className={inputClass} {...step2Form.register("clinicName")} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="country">Country *</Label>
              <select id="country" className={selectClass} {...step2Form.register("country")} required>
                <option value="" className="bg-zinc-900">
                  — Select country —
                </option>
                {SUPPORTED_COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code} className="bg-zinc-900">
                    {c.flag} {c.name} ({c.currency})
                  </option>
                ))}
              </select>
              {watchedCountry && (
                <div className="mt-2 space-y-1 rounded-lg bg-blue-950/40 p-3 text-xs text-sky-100">
                  <p>
                    💱 Currency: <strong>{countryProfile.currency}</strong>
                  </p>
                  <p>
                    🧾 Tax:{" "}
                    <strong>
                      {countryProfile.taxName} {countryProfile.taxRate}%
                    </strong>
                    {!countryProfile.taxOnDental && " (dental exempt)"}
                  </p>
                  <p>
                    🏥 Regulatory: <strong>{countryProfile.regulatoryBody}</strong>
                  </p>
                  <p>
                    🦷 Tooth numbering: <strong>{countryProfile.toothNumbering}</strong>
                  </p>
                  {countryProfile.insuranceMandatory && (
                    <p className="text-orange-300">
                      ⚠ Insurance is mandatory for patients in this country
                    </p>
                  )}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="clinicPhone">Phone number (optional)</Label>
              <Input id="clinicPhone" className={inputClass} {...step2Form.register("phone")} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="secondaryLanguage">Preferred second language (optional)</Label>
            <select
              id="secondaryLanguage"
              className={selectClass}
              {...step2Form.register("secondaryLanguage")}
            >
              <option value="" className="bg-zinc-900">
                None — English only
              </option>
              {SECONDARY_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code} className="bg-zinc-900">
                  {lang.label} ({lang.nativeLabel})
                </option>
              ))}
            </select>
            <p className="text-xs text-zinc-500">
              Patient-facing forms (registration, consent, booking) will show this language
              alongside English for your patients.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="specialty">Specialty (optional)</Label>
              <select id="specialty" className={selectClass} {...step2Form.register("specialty")}>
                <option value="" className="bg-zinc-900">
                  General dentistry
                </option>
                {SPECIALTY_OPTIONS.map((specialty) => (
                  <option key={specialty} value={specialty} className="bg-zinc-900">
                    {specialty}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="doctorCountBand">Number of dentists (optional)</Label>
              <select id="doctorCountBand" className={selectClass} {...step2Form.register("doctorCountBand")}>
                {DOCTOR_COUNT_OPTIONS.map((option) => (
                  <option key={option} value={option} className="bg-zinc-900">
                    {option === "10+" ? "10+" : option}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-3">
            <Button type="button" variant="outline" className="h-11 rounded-xl border-white/15" onClick={() => setStep(1)}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="h-11 flex-1 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-500 font-semibold"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Creating your clinic...
                </>
              ) : (
                <>
                  Create clinic <Sparkles className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </form>
      )}

      {step === 3 && (
        <div className="space-y-6 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/15">
            <PartyPopper className="h-10 w-10 text-emerald-400" />
          </div>
          <div className="space-y-2">
            <h3 className="text-2xl font-bold text-white">Your clinic is ready!</h3>
            <p className="text-zinc-400">
              <strong className="text-white">{registeredClinic}</strong> is live on DentaFlow.
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-zinc-950/50 p-4 text-sm text-zinc-400">
            <CheckCircle2 className="mx-auto mb-2 h-5 w-5 text-emerald-400" />
            We&apos;ve sent a verification email to{" "}
            <span className="font-medium text-white">{registeredEmail}</span>. You can verify in the
            background — no need to wait before using your dashboard.
          </div>
          <p className="text-sm text-zinc-500">Redirecting to your dashboard...</p>
          <Button asChild className="rounded-xl bg-gradient-to-r from-sky-600 to-cyan-500">
            <Link href="/dashboard">Go to dashboard now</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
