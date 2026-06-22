"use client";

import { useRouter } from "next/navigation";

export function ImpersonateButton({
  tenantId,
  tenantName,
}: {
  tenantId: string;
  tenantName: string;
}) {
  const router = useRouter();

  async function handleImpersonate() {
    const res = await fetch(`/api/user/tenants?switchTo=${tenantId}`, { method: "GET" });
    if (!res.ok) {
      alert("Could not switch to this clinic");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={() => void handleImpersonate()}
      className="text-xs text-sky-400 underline hover:text-sky-300"
    >
      View as {tenantName}
    </button>
  );
}
