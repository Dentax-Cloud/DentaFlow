import { notFound } from "next/navigation";
import type { Tenant } from "@prisma/client";
import { isHrModuleEnabled } from "./feature-flag";

export function assertHrModuleEnabled(tenant: Pick<Tenant, "featureFlags"> | null | undefined) {
  if (!isHrModuleEnabled(tenant)) notFound();
}
