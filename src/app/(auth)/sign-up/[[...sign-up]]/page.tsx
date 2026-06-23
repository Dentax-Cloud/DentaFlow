export const runtime = "nodejs";

import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getServerAuthSession } from "@/lib/auth";
import { Loader2 } from "lucide-react";
import { SignUpShell } from "@/components/auth/sign-up-shell";
import { ClinicRegistrationWizard } from "@/components/auth/clinic-registration-wizard";
import { RegistrationSessionBanner } from "@/components/auth/registration-session-banner";

type Props = {
  params: Promise<{ "sign-up"?: string[] }>;
};

function WizardFallback() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16">
      <Loader2 className="h-8 w-8 animate-spin text-sky-400" />
      <p className="text-sm text-zinc-400">Loading registration...</p>
    </div>
  );
}

export default async function SignUpPage({ params }: Props) {
  const session = await getServerAuthSession();
  const userId = session?.user?.id ?? null;
  const orgId = session?.user?.activeTenantId ?? null;

  let initialStep = 1;

  if (userId) {
    if (orgId) {
      redirect("/dashboard");
    }
    initialStep = 2;
  }

  const resolvedParams = await params;
  const segments = resolvedParams["sign-up"] ?? [];
  const firstSegment = segments[0];

  if (firstSegment === "sso-callback") {
    redirect("/sign-up?oauth=1");
  }

  return (
    <SignUpShell>
      <RegistrationSessionBanner registrationComplete={false} />
      <Suspense fallback={<WizardFallback />}>
        <ClinicRegistrationWizard initialStep={initialStep} />
      </Suspense>
      <p className="mt-6 text-center text-sm text-zinc-500">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-sky-400 hover:text-sky-300">
          Sign in
        </Link>
      </p>
    </SignUpShell>
  );
}
