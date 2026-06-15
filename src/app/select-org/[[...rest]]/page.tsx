import { OrganizationList } from "@clerk/nextjs";
import { AuthShell } from "@/components/auth/auth-shell";
import { clerkAuthAppearance } from "@/lib/auth/clerk-appearance";
import { PendingOrgHint } from "@/components/auth/pending-org-hint";

export default function SelectOrgPage() {
  return (
    <AuthShell
      title="Create your clinic workspace"
      subtitle="Each organization is an isolated dental clinic tenant. Use your clinic name from registration."
      variant="signup"
      backHref="/sign-up"
      backLabel="Back to registration"
    >
      <PendingOrgHint />
      <OrganizationList
        hidePersonal
        afterCreateOrganizationUrl="/sign-up"
        afterSelectOrganizationUrl="/dashboard"
        appearance={{
          ...clerkAuthAppearance,
          elements: {
            ...clerkAuthAppearance.elements,
            organizationListCreateOrganizationActionButton:
              "bg-gradient-to-r from-sky-600 to-cyan-500 hover:from-sky-500 hover:to-cyan-400 text-white font-semibold rounded-xl",
          },
        }}
      />
    </AuthShell>
  );
}
