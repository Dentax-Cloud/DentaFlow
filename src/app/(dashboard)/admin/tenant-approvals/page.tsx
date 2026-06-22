import { redirect } from "next/navigation";
import { getServerAuthSession } from "@/lib/auth";
import { listPendingApprovalRequests } from "@/lib/tenant/approval";
import { TenantApprovalsClient } from "./tenant-approvals-client";

export default async function TenantApprovalsPage() {
  const session = await getServerAuthSession();
  if (!session?.user?.id) redirect("/login");
  if (!session.user.isSuperAdmin) redirect("/dashboard");

  const pending = await listPendingApprovalRequests();

  return <TenantApprovalsClient pending={pending} />;
}
