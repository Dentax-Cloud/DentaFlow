import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/stubs/server";
import { isSuperAdmin } from "@/lib/tenant/config";
import { listPendingApprovalRequests } from "@/lib/tenant/approval";
import { TenantApprovalsClient } from "./tenant-approvals-client";

export default async function TenantApprovalsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  if (!isSuperAdmin(userId)) redirect("/dashboard");

  const pending = await listPendingApprovalRequests();

  return <TenantApprovalsClient pending={pending} />;
}
