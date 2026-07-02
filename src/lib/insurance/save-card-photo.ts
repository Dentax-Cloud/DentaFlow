import { db } from "@/lib/db";
import { tenantWhere } from "@/lib/tenant/scoped";

export async function saveInsuranceCardPhotoFromUpload(
  tenantId: string,
  policyId: string,
  side: "front" | "back",
  fileUrl: string,
) {
  const policy = await db.patientInsurancePolicy.findFirst({
    where: tenantWhere(tenantId, { id: policyId, isActive: true }),
  });
  if (!policy) throw new Error("Insurance policy not found");

  const field = side === "front" ? "cardFrontUrl" : "cardBackUrl";
  await db.patientInsurancePolicy.update({
    where: { id: policyId },
    data: { [field]: fileUrl },
  });

  return fileUrl;
}
