import { OrganizationList } from "@/lib/auth/stubs/client";
import { AuthShell } from "@/components/auth/auth-shell";
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
      />
    </AuthShell>
  );
}
