"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useOrganizationList } from "@/lib/auth/stubs/client";
import { UserCog } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { impersonateTenantAction } from "@/lib/super-admin/actions";

type Props = { tenantId: string; tenantName: string };

export function ImpersonateButton({ tenantId, tenantName }: Props) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { setActive, isLoaded } = useOrganizationList({ userMemberships: { infinite: true } });

  async function handleImpersonate() {
    if (!isLoaded || !setActive) {
      toast.error("Organization switcher not ready");
      return;
    }
    setLoading(true);
    const result = await impersonateTenantAction({ tenantId });
    if (!result.success) {
      toast.error(result.error);
      setLoading(false);
      return;
    }
    try {
      await setActive({ organization: result.data.clerkOrgId });
      toast.success(`Switched to ${tenantName}`);
      router.push("/dashboard");
    } catch {
      toast.error("Could not switch organization. Try again from Select Clinic.");
      router.push("/select-org");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      title={`Impersonate ${tenantName}`}
      disabled={loading}
      onClick={handleImpersonate}
    >
      <UserCog className="h-4 w-4" />
    </Button>
  );
}
