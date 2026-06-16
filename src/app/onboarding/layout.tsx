import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/stubs/server";
import {
  getClinicRegistrationStatus,
  resolvePostAuthDestination,
} from "@/lib/auth/registration-status";

/** Legacy route — new clinics use /sign-up wizard. */
export default async function OnboardingLayout() {
  const { userId, orgId } = await auth();
  if (!userId) redirect("/sign-in");

  if (!orgId) {
    redirect(await resolvePostAuthDestination(userId, orgId));
  }

  const { isComplete } = await getClinicRegistrationStatus(orgId);
  redirect(isComplete ? "/dashboard" : "/sign-up");
}
