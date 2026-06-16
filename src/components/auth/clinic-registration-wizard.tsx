"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth, useSignUp, useUser } from "@/lib/auth/stubs/client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  ClipboardCheck,
  ImagePlus,
  Loader2,
  Stethoscope,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { RegistrationStepper } from "./registration-stepper";
import { registerClinicAction } from "@/app/(auth)/features/registration/actions";
import { useUploadThing } from "@/lib/uploadthing-client";
import {
  COUNTRY_OPTIONS,
  getCountryByCode,
  MONTHLY_PATIENT_OPTIONS,
  PENDING_REGISTRATION_KEY,
  REFERRAL_SOURCES,
  SPECIALTY_OPTIONS,
  TIMEZONE_OPTIONS,
} from "@/lib/auth/countries";
import {
  formatAdminName,
  registrationStep1OAuthSchema,
  registrationStep1Schema,
  registrationStep2Schema,
  registrationStep3Schema,
  type RegistrationStep1,
  type RegistrationStep2,
  type RegistrationStep3,
} from "@/lib/auth/registration-schema";
import { cn } from "@/lib/utils";

const STEPS = [
  { id: 1, label: "Account" },
  { id: 2, label: "Clinic" },
  { id: 3, label: "Business" },
  { id: 4, label: "Review" },
] as const;

const inputClass =
  "h-11 rounded-xl border-white/10 bg-zinc-900/80 text-white placeholder:text-zinc-500 focus-visible:ring-sky-500/30";
const selectClass =
  "flex h-11 w-full rounded-xl border border-white/10 bg-zinc-900/80 px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/30";

type WizardState = RegistrationStep1 & RegistrationStep2 & RegistrationStep3;

type Props = {
  uploadsEnabled: boolean;
  /** When the user is already signed in (e.g. OAuth return), resume at clinic details. */
  initialStep?: number;
};

function clerkErrorMessage(err: unknown): string {
  if (err && typeof err === "object" && "errors" in err) {
    const errors = (err as { errors: { message: string }[] }).errors;
    if (errors?.[0]?.message) return errors[0].message;
  }
  if (err instanceof Error) return err.message;
  return "Something went wrong. Please try again.";
}

export function ClinicRegistrationWizard({ uploadsEnabled, initialStep = 1 }: Props) {
  const searchParams = useSearchParams();
  const { isSignedIn, isLoaded: authLoaded } = useAuth();
  const { user, isLoaded: userLoaded } = useUser();
  const { isLoaded: signUpLoaded, signUp, setActive } = useSignUp();
  const { startUpload, isUploading } = useUploadThing("registrationLogo");

  const [step, setStep] = useState(initialStep);
  const [submitting, setSubmitting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState("");
  const [wizardData, setWizardData] = useState<Partial<WizardState>>({});
  const [oauthConnected, setOauthConnected] = useState(false);

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
      chairCount: 4,
      doctorCount: 2,
      addressLine1: "",
      addressLine2: "",
      city: "",
      state: "",
      postalCode: "",
    },
  });

  const step3Form = useForm<RegistrationStep3>({
    resolver: zodResolver(registrationStep3Schema),
    defaultValues: {
      taxId: "",
      specialties: [],
      expectedMonthlyPatients: "",
      referralSource: "",
    },
  });

  const watchedCountry = step2Form.watch("country");
  const countryMeta = useMemo(() => getCountryByCode(watchedCountry), [watchedCountry]);
  const selectedSpecialties = step3Form.watch("specialties");

  useEffect(() => {
    if (countryMeta) {
      step2Form.setValue("timezone", countryMeta.timezone);
      step2Form.setValue("currency", countryMeta.currency);
    }
  }, [countryMeta, step2Form]);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(PENDING_REGISTRATION_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as Partial<WizardState> & { logoPreview?: string };
      if (saved.firstName) step1Form.reset({ ...step1Form.getValues(), ...saved });
      if (saved.clinicName) step2Form.reset({ ...step2Form.getValues(), ...saved });
      if (saved.specialties?.length) step3Form.reset({ ...step3Form.getValues(), ...saved });
      setWizardData(saved);
      if (saved.logoPreview) setLogoPreview(saved.logoPreview);
    } catch {
      // ignore corrupt session data
    }
  }, [step1Form, step2Form, step3Form]);

  useEffect(() => {
    if (!authLoaded || !userLoaded) return;

    const oauthReturn = searchParams.get("oauth") === "1";
    if (isSignedIn && user) {
      const firstName = user.firstName ?? "";
      const lastName = user.lastName ?? "";
      const email = user.primaryEmailAddress?.emailAddress ?? "";
      const phone = user.primaryPhoneNumber?.phoneNumber ?? "";
      if (firstName) step1Form.setValue("firstName", firstName);
      if (lastName) step1Form.setValue("lastName", lastName);
      if (email) step1Form.setValue("email", email);
      if (phone) step1Form.setValue("phone", phone);

      const hasGoogleAccount = user.externalAccounts.some(
        (account) => account.provider === "google",
      );
      if (oauthReturn || hasGoogleAccount) {
        setOauthConnected(true);
      }

      if (oauthReturn) {
        setStep(2);
      }
    }
  }, [authLoaded, userLoaded, isSignedIn, user, searchParams, step1Form]);

  const persistWizard = useCallback(
    (data: Partial<WizardState>) => {
      const merged = { ...wizardData, ...data, logoPreview: logoPreview ?? undefined };
      setWizardData(merged);
      const { password: _p, confirmPassword: _c, ...safe } = merged as RegistrationStep1 & object;
      sessionStorage.setItem(PENDING_REGISTRATION_KEY, JSON.stringify({ ...safe, logoPreview }));
    },
    [wizardData, logoPreview],
  );

  function onStep1Submit(data: RegistrationStep1) {
    persistWizard(data);
    setStep(2);
  }

  function onStep1OAuthContinue() {
    const parsed = registrationStep1OAuthSchema.safeParse(step1Form.getValues());
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please complete all required fields.");
      return;
    }
    persistWizard(parsed.data);
    setStep(2);
  }

  function onStep2Submit(data: RegistrationStep2) {
    persistWizard(data);
    setStep(3);
  }

  function onStep3Submit(data: RegistrationStep3) {
    persistWizard(data);
    setStep(4);
  }

  function handleLogoChange(file: File | null) {
    if (!file) {
      setLogoFile(null);
      setLogoPreview(null);
      return;
    }
    if (!file.type.startsWith("image/") || file.size > 2 * 1024 * 1024) {
      toast.error("Please upload a PNG or JPG under 2 MB");
      return;
    }
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : null;
      setLogoPreview(result);
      persistWizard({});
    };
    reader.readAsDataURL(file);
  }

  function toggleSpecialty(specialty: string) {
    const current = step3Form.getValues("specialties");
    const next = current.includes(specialty)
      ? current.filter((s) => s !== specialty)
      : [...current, specialty];
    step3Form.setValue("specialties", next, { shouldValidate: true });
  }

  async function handleGoogleSignUp() {
    if (!signUpLoaded || !signUp) return;
    persistWizard(step1Form.getValues());
    try {
      await signUp.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: "/sign-up/sso-callback",
        redirectUrlComplete: "/sign-up?oauth=1",
      });
    } catch (err) {
      toast.error(clerkErrorMessage(err));
    }
  }

  async function uploadLogoIfNeeded(): Promise<string> {
    if (logoUrl) return logoUrl;
    if (!logoFile || !uploadsEnabled) return "";
    try {
      const result = await startUpload([logoFile]);
      const url = result?.[0]?.url ?? "";
      if (url) setLogoUrl(url);
      return url;
    } catch {
      toast.error("Logo upload failed. Continuing without logo.");
      return "";
    }
  }

  function collectAllStepData() {
    return {
      step1: { ...wizardData, ...step1Form.getValues() } as RegistrationStep1,
      step2: { ...wizardData, ...step2Form.getValues() } as RegistrationStep2,
      step3: { ...wizardData, ...step3Form.getValues() } as RegistrationStep3,
    };
  }

  async function activateOrganization(clerkOrgId: string) {
    if (!setActive) {
      throw new Error("Session handler unavailable. Please refresh and try again.");
    }
    await setActive({ organization: clerkOrgId });
  }

  async function finishRegistration(
    step1: RegistrationStep1,
    step2: RegistrationStep2,
    step3: RegistrationStep3,
  ) {
    setSubmitting(true);
    try {
      const uploadedLogo = await uploadLogoIfNeeded();
      const result = await registerClinicAction({
        firstName: step1.firstName,
        lastName: step1.lastName,
        email: step1.email,
        phone: step1.phone,
        ...(step1.password ? { password: step1.password } : {}),
        ...step2,
        ...step3,
        logoUrl: uploadedLogo,
      });

      if (!result.success) {
        toast.error(result.error);
        setSubmitting(false);
        return;
      }

      await activateOrganization(result.clerkOrgId);
      sessionStorage.removeItem(PENDING_REGISTRATION_KEY);
      toast.success(`Welcome to DentaFlow! ${step2.clinicName} is ready.`);
      // Full navigation so Clerk org session + tenant branding load reliably.
      window.location.assign("/dashboard");
    } catch (err) {
      toast.error(clerkErrorMessage(err));
      setSubmitting(false);
    }
  }

  async function createAccountAndRegister() {
    if (!isSignedIn && (!signUpLoaded || !signUp)) {
      toast.error("Authentication is still loading. Please wait.");
      return;
    }

    const { step1, step2, step3 } = collectAllStepData();

    setSubmitting(true);

    try {
      if (isSignedIn) {
        await finishRegistration(step1, step2, step3);
        return;
      }

      if (!signUp) {
        toast.error("Authentication is still loading. Please wait.");
        setSubmitting(false);
        return;
      }

      await signUp.create({
        emailAddress: step1.email,
        password: step1.password,
        firstName: step1.firstName,
        lastName: step1.lastName,
      });

      if (signUp.status === "complete" && signUp.createdSessionId) {
        if (setActive) {
          await setActive({ session: signUp.createdSessionId });
        }
        await finishRegistration(step1, step2, step3);
        return;
      }

      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setVerifying(true);
      setSubmitting(false);
      toast.message("Check your email for a verification code");
    } catch (err) {
      setSubmitting(false);
      toast.error(clerkErrorMessage(err));
    }
  }

  async function handleVerifyAndRegister() {
    if (!signUpLoaded || !signUp) return;

    setSubmitting(true);
    try {
      const result = await signUp.attemptEmailAddressVerification({ code: verificationCode });
      if (result.status === "complete" && result.createdSessionId) {
        if (setActive) {
          await setActive({ session: result.createdSessionId });
        }
        setVerifying(false);
        const { step1, step2, step3 } = collectAllStepData();
        await finishRegistration(step1, step2, step3);
      } else {
        toast.error("Verification incomplete. Please try again.");
        setSubmitting(false);
      }
    } catch (err) {
      setSubmitting(false);
      toast.error(clerkErrorMessage(err));
    }
  }

  const progress = (step / STEPS.length) * 100;
  const allData = { ...wizardData, ...step1Form.watch(), ...step2Form.watch(), ...step3Form.watch() };

  const clerkReady = authLoaded && userLoaded && (isSignedIn || signUpLoaded);

  if (!clerkReady) {
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
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">Clinic registration</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Step {step} of {STEPS.length}
          </p>
        </div>
        <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
          Free trial
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
                <Label htmlFor="firstName">First name</Label>
                <Input id="firstName" className={inputClass} {...step1Form.register("firstName")} />
                {step1Form.formState.errors.firstName && (
                  <p className="text-xs text-red-400">{step1Form.formState.errors.firstName.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last name</Label>
                <Input id="lastName" className={inputClass} {...step1Form.register("lastName")} />
                {step1Form.formState.errors.lastName && (
                  <p className="text-xs text-red-400">{step1Form.formState.errors.lastName.message}</p>
                )}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" className={inputClass} {...step1Form.register("email")} />
                {step1Form.formState.errors.email && (
                  <p className="text-xs text-red-400">{step1Form.formState.errors.email.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" className={inputClass} {...step1Form.register("phone")} />
                {step1Form.formState.errors.phone && (
                  <p className="text-xs text-red-400">{step1Form.formState.errors.phone.message}</p>
                )}
              </div>
            </div>

            {!oauthConnected && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" className={inputClass} {...step1Form.register("password")} />
                  {step1Form.formState.errors.password && (
                    <p className="text-xs text-red-400">{step1Form.formState.errors.password.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm password</Label>
                  <Input id="confirmPassword" type="password" className={inputClass} {...step1Form.register("confirmPassword")} />
                  {step1Form.formState.errors.confirmPassword && (
                    <p className="text-xs text-red-400">{step1Form.formState.errors.confirmPassword.message}</p>
                  )}
                </div>
              </div>
            )}

            {!oauthConnected && (
              <>
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
                className="h-11 w-full rounded-xl bg-gradient-to-r from-sky-600 to-cyan-500 font-semibold hover:from-sky-500 hover:to-cyan-400"
                onClick={onStep1OAuthContinue}
              >
                Continue
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="submit"
                className="h-11 w-full rounded-xl bg-gradient-to-r from-sky-600 to-cyan-500 font-semibold hover:from-sky-500 hover:to-cyan-400"
              >
                Continue
                <ArrowRight className="h-4 w-4" />
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
            {step2Form.formState.errors.clinicName && (
              <p className="text-xs text-red-400">{step2Form.formState.errors.clinicName.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Clinic logo (optional)</Label>
            <div className="flex items-center gap-4 rounded-xl border border-dashed border-white/15 bg-zinc-950/50 p-4">
              <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-zinc-900">
                {logoPreview ? (
                  <Image src={logoPreview} alt="Logo" width={56} height={56} className="h-full w-full object-cover" unoptimized />
                ) : (
                  <ImagePlus className="h-5 w-5 text-zinc-500" />
                )}
              </div>
              <div>
                <p className="text-sm text-zinc-300">PNG or JPG, max 2 MB</p>
                <p className="text-xs text-zinc-500">
                  {uploadsEnabled ? "Uploaded when you submit" : "Upload disabled — set UPLOADTHING_TOKEN"}
                </p>
                <label className="mt-1 inline-block cursor-pointer text-sm font-medium text-sky-400 hover:text-sky-300">
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handleLogoChange(e.target.files?.[0] ?? null)} />
                  Choose file
                </label>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
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
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Input id="currency" className={inputClass} readOnly {...step2Form.register("currency")} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="chairCount">Operatories / chairs</Label>
              <Input id="chairCount" type="number" min={1} max={50} className={inputClass} {...step2Form.register("chairCount")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="doctorCount">Doctors / specialists</Label>
              <Input id="doctorCount" type="number" min={1} max={100} className={inputClass} {...step2Form.register("doctorCount")} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="addressLine1">Street address</Label>
            <Input id="addressLine1" className={inputClass} {...step2Form.register("addressLine1")} />
            {step2Form.formState.errors.addressLine1 && (
              <p className="text-xs text-red-400">{step2Form.formState.errors.addressLine1.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="addressLine2">Address line 2 (optional)</Label>
            <Input id="addressLine2" className={inputClass} {...step2Form.register("addressLine2")} />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input id="city" className={inputClass} {...step2Form.register("city")} />
              {step2Form.formState.errors.city && (
                <p className="text-xs text-red-400">{step2Form.formState.errors.city.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">State / Emirate</Label>
              <Input id="state" className={inputClass} {...step2Form.register("state")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="postalCode">Postal code</Label>
              <Input id="postalCode" className={inputClass} {...step2Form.register("postalCode")} />
            </div>
          </div>

          <div className="flex gap-3">
            <Button type="button" variant="outline" className="h-11 rounded-xl border-white/15" onClick={() => setStep(1)}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <Button type="submit" className="h-11 flex-1 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-500 font-semibold">
              Continue <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </form>
      )}

      {step === 3 && (
        <form onSubmit={step3Form.handleSubmit(onStep3Submit)} className="space-y-4">
          {countryMeta?.taxLabel && (
            <div className="space-y-2">
              <Label htmlFor="taxId">
                {countryMeta.taxLabel}
                {countryMeta.taxRequired ? " *" : ""}
              </Label>
              <Input id="taxId" className={inputClass} placeholder={countryMeta.taxPlaceholder} {...step3Form.register("taxId")} />
            </div>
          )}

          <div className="space-y-2">
            <Label>Clinic specialties / services</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {SPECIALTY_OPTIONS.map((specialty) => (
                <label
                  key={specialty}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition-colors",
                    selectedSpecialties.includes(specialty)
                      ? "border-sky-500/40 bg-sky-500/10 text-sky-200"
                      : "border-white/10 bg-zinc-950/40 text-zinc-400 hover:border-white/20",
                  )}
                >
                  <input
                    type="checkbox"
                    className="rounded border-white/20 bg-zinc-900 text-sky-500 focus:ring-sky-500/30"
                    checked={selectedSpecialties.includes(specialty)}
                    onChange={() => toggleSpecialty(specialty)}
                  />
                  {specialty}
                </label>
              ))}
            </div>
            {step3Form.formState.errors.specialties && (
              <p className="text-xs text-red-400">{step3Form.formState.errors.specialties.message}</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="expectedMonthlyPatients">Expected monthly patients</Label>
              <select id="expectedMonthlyPatients" className={selectClass} {...step3Form.register("expectedMonthlyPatients")}>
                <option value="" className="bg-zinc-900">Select volume</option>
                {MONTHLY_PATIENT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value} className="bg-zinc-900">{o.label}</option>
                ))}
              </select>
              {step3Form.formState.errors.expectedMonthlyPatients && (
                <p className="text-xs text-red-400">{step3Form.formState.errors.expectedMonthlyPatients.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="referralSource">How did you hear about us?</Label>
              <select id="referralSource" className={selectClass} {...step3Form.register("referralSource")}>
                <option value="" className="bg-zinc-900">Select source</option>
                {REFERRAL_SOURCES.map((s) => (
                  <option key={s} value={s} className="bg-zinc-900">{s}</option>
                ))}
              </select>
              {step3Form.formState.errors.referralSource && (
                <p className="text-xs text-red-400">{step3Form.formState.errors.referralSource.message}</p>
              )}
            </div>
          </div>

          <div className="flex gap-3">
            <Button type="button" variant="outline" className="h-11 rounded-xl border-white/15" onClick={() => setStep(2)}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <Button type="submit" className="h-11 flex-1 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-500 font-semibold">
              Review <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </form>
      )}

      {step === 4 && (
        <div className="space-y-6">
          <div className="space-y-4 rounded-xl border border-white/10 bg-zinc-950/50 p-5">
            <div className="flex items-start gap-3">
              <UserRound className="mt-0.5 h-5 w-5 text-sky-400" />
              <div>
                <p className="font-medium">{formatAdminName(allData.firstName ?? "", allData.lastName ?? "")}</p>
                <p className="text-sm text-zinc-400">{allData.email} · {allData.phone}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Building2 className="mt-0.5 h-5 w-5 text-sky-400" />
              <div>
                <p className="font-medium">{allData.clinicName}</p>
                <p className="text-sm text-zinc-400">
                  {allData.city}, {countryMeta?.name} · {allData.currency}
                </p>
                <p className="text-xs text-zinc-500">
                  {allData.chairCount} operatories · {allData.doctorCount} doctors
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Stethoscope className="mt-0.5 h-5 w-5 text-sky-400" />
              <div>
                <p className="text-sm text-zinc-300">{(allData.specialties ?? []).join(", ")}</p>
                <p className="text-xs text-zinc-500">
                  {MONTHLY_PATIENT_OPTIONS.find((o) => o.value === allData.expectedMonthlyPatients)?.label ?? allData.expectedMonthlyPatients} · via {allData.referralSource}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <ClipboardCheck className="mt-0.5 h-5 w-5 text-sky-400" />
              <p className="text-sm text-zinc-400">
                STARTER plan · 14-day free trial · No credit card required
              </p>
            </div>
          </div>

          {verifying ? (
            <div className="space-y-3">
              <Label htmlFor="code">Email verification code</Label>
              <Input
                id="code"
                className={inputClass}
                placeholder="Enter 6-digit code"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
              />
              <Button
                className="h-11 w-full rounded-xl bg-gradient-to-r from-sky-600 to-cyan-500 font-semibold"
                onClick={handleVerifyAndRegister}
                disabled={submitting || verificationCode.length < 6}
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify & launch clinic"}
              </Button>
            </div>
          ) : (
            <Button
              className="h-12 w-full rounded-xl bg-gradient-to-r from-sky-600 to-cyan-500 text-base font-semibold shadow-lg shadow-sky-500/20 hover:from-sky-500 hover:to-cyan-400"
              onClick={createAccountAndRegister}
              disabled={submitting || isUploading}
            >
              {submitting || isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating your clinic...
                </>
              ) : (
                "Start Free 14-Day Trial"
              )}
            </Button>
          )}

          <Button type="button" variant="outline" className="h-11 w-full rounded-xl border-white/15" onClick={() => setStep(3)}>
            <ArrowLeft className="h-4 w-4" /> Back to edit
          </Button>
        </div>
      )}

      <p className="text-center text-sm text-zinc-500">
        Already have an account?{" "}
        <Link href="/sign-in" className="font-medium text-sky-400 hover:text-sky-300">
          Sign in
        </Link>
      </p>
    </div>
  );
}
