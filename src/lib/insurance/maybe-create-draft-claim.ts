import { ClaimStatus, PolicyRank, type Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { createNotification } from "@/lib/notifications/notification-service";
import type { ClaimProcedureSnapshotLine } from "@/lib/insurance/claim-types";

function buildProcedureSnapshot(
  items: Array<{
    procedureCode: string | null;
    description: string;
    quantity: number;
    unitPrice: unknown;
    total: unknown;
  }>,
): ClaimProcedureSnapshotLine[] {
  return items.map((item) => ({
    procedureCode: item.procedureCode,
    description: item.description,
    quantity: item.quantity,
    unitPrice: Number(item.unitPrice),
    total: Number(item.total),
  }));
}

/**
 * When an invoice has an insurer portion and the patient has an active primary
 * policy, create a DRAFT claim so finance can review/submit (auto-suggest).
 * No-ops safely when policy/claim prerequisites are missing.
 */
export async function maybeCreateDraftClaimForInvoice(params: {
  tenantId: string;
  invoiceId: string;
}): Promise<{ claimId: string } | null> {
  const invoice = await db.invoice.findFirst({
    where: {
      id: params.invoiceId,
      tenantId: params.tenantId,
      deletedAt: null,
    },
    include: {
      items: true,
      claims: {
        select: { id: true, status: true },
      },
      patient: {
        select: { id: true, firstName: true, lastName: true },
      },
    },
  });
  if (!invoice) return null;

  const insuranceAmount = Number(invoice.insuranceAmount ?? 0);
  if (insuranceAmount <= 0) return null;

  const activeClaim = invoice.claims.find(
    (c) =>
      c.status !== ClaimStatus.DENIED &&
      c.status !== ClaimStatus.WRITTEN_OFF &&
      c.status !== ClaimStatus.PAID,
  );
  if (activeClaim) return { claimId: activeClaim.id };

  const policy = await db.patientInsurancePolicy.findFirst({
    where: {
      tenantId: params.tenantId,
      patientId: invoice.patientId,
      rank: PolicyRank.PRIMARY,
      isActive: true,
    },
  });
  if (!policy) return null;

  const claim = await db.claim.create({
    data: {
      tenantId: params.tenantId,
      policyId: policy.id,
      invoiceId: invoice.id,
      amount: insuranceAmount,
      submittedAmount: insuranceAmount,
      status: ClaimStatus.DRAFT,
      procedureSnapshot: buildProcedureSnapshot(
        invoice.items,
      ) as unknown as Prisma.InputJsonValue,
    },
  });

  const patientName = `${invoice.patient.firstName} ${invoice.patient.lastName}`.trim();
  const recipients = await db.staffMember.findMany({
    where: {
      tenantId: params.tenantId,
      role: { in: ["ADMIN", "OWNER", "FINANCE", "ACCOUNTANT", "MANAGER"] },
      deletedAt: null,
    },
    select: { id: true, email: true },
    take: 8,
  });

  await Promise.all(
    recipients.map((staff) =>
      createNotification({
        tenantId: params.tenantId,
        recipientId: staff.id,
        type: "CLAIM_SUGGESTED",
        title: "Insurance claim ready",
        body: `Draft claim created for ${patientName} on invoice ${invoice.invoiceNumber} (${insuranceAmount.toFixed(2)} insurer portion). Review and submit from Claims.`,
        link: `/billing/claims?claimId=${claim.id}`,
        entityType: "Claim",
        entityId: claim.id,
        channel: "IN_APP",
      }).catch(() => null),
    ),
  );

  return { claimId: claim.id };
}
