import { AuditAction } from "@prisma/client";
import { createAuditLog } from "@/lib/actions/safe-action";
import { db } from "@/lib/db";
import { sendMail } from "@/lib/mail/send";
import { tenantWhere } from "@/lib/tenant/scoped";
import type { ClaimProcedureSnapshotLine } from "./claim-types";
import { buildClaimPdfBytes } from "./generate-claim-pdf";
import { buildEstimatePdfBytes } from "./generate-estimate-pdf";
import type { ProcedureCodeSnapshot } from "./estimate-types";
import { resolvePayerConfigForPolicy } from "./resolve-payer-config";
import type { InsurerSubmissionOutcome } from "./submission-types";

type AuditContext = {
  tenantId: string;
  actorUserId?: string;
};

async function logSubmissionAudit(
  ctx: AuditContext,
  entity: "Claim" | "PreAuthorization",
  entityId: string,
  outcome: InsurerSubmissionOutcome,
) {
  await createAuditLog({
    tenantId: ctx.tenantId,
    userId: ctx.actorUserId,
    action: AuditAction.UPDATE,
    entity,
    entityId,
    metadata: {
      insurerSubmission: outcome.kind,
      message: outcome.message,
      providerName: outcome.providerName,
      ...(outcome.kind === "sent" ? { email: outcome.email } : {}),
      ...(outcome.kind === "manual_required" && outcome.portalUrl
        ? { portalUrl: outcome.portalUrl }
        : {}),
    },
  });
}

function manualRequiredOutcome(
  providerName: string,
  portalUrl: string | null,
): InsurerSubmissionOutcome {
  if (portalUrl) {
    return {
      kind: "manual_required",
      providerName,
      portalUrl,
      message: `Reference number saved. This payer requires manual submission via ${portalUrl}`,
    };
  }
  return {
    kind: "manual_required",
    providerName,
    message:
      "Reference number saved. This payer requires manual submission — no portal URL configured.",
  };
}

function noConfigOutcome(providerName: string): InsurerSubmissionOutcome {
  return {
    kind: "no_config",
    providerName,
    message:
      "Reference number saved. No automated submission configured for this payer — submit manually.",
  };
}

async function sendPdfToInsurerEmail(input: {
  to: string;
  cc?: string;
  subject: string;
  body: string;
  filename: string;
  pdfBytes: Uint8Array;
}): Promise<boolean> {
  return sendMail({
    to: input.to,
    cc: input.cc,
    subject: input.subject,
    text: input.body,
    html: `<p>${input.body.replace(/\n/g, "<br/>")}</p>`,
    attachments: [
      {
        filename: input.filename,
        content: Buffer.from(input.pdfBytes),
      },
    ],
  });
}

export async function sendClaimToInsurer(
  claimId: string,
  audit: AuditContext,
): Promise<InsurerSubmissionOutcome> {
  const claim = await db.claim.findFirst({
    where: tenantWhere(audit.tenantId, { id: claimId }),
    include: {
      policy: { include: { provider: true } },
      invoice: {
        include: {
          patient: {
            select: {
              firstName: true,
              lastName: true,
              patientId: true,
            },
          },
        },
      },
    },
  });
  if (!claim) throw new Error("Claim not found");

  const tenant = await db.tenant.findUnique({
    where: { id: audit.tenantId },
    select: {
      name: true,
      address: true,
      email: true,
      phone: true,
      countryCode: true,
    },
  });
  if (!tenant) throw new Error("Tenant not found");

  const payer = await resolvePayerConfigForPolicy(
    audit.tenantId,
    tenant.countryCode ?? "AE",
    claim.policy,
  );

  const reference = claim.claimNumber ?? claim.id;
  const patientName = `${claim.invoice.patient.firstName} ${claim.invoice.patient.lastName}`;

  if (payer.claimSubmissionMethod === "PORTAL") {
    const outcome = manualRequiredOutcome(payer.providerName, payer.claimsPortalUrl);
    await logSubmissionAudit(audit, "Claim", claim.id, outcome);
    return outcome;
  }

  if (
    payer.claimSubmissionMethod === "EMAIL" &&
    payer.claimEmail?.trim()
  ) {
    const procedures = claim.procedureSnapshot as ClaimProcedureSnapshotLine[];
    const pdfBytes = await buildClaimPdfBytes({
      clinicName: tenant.name,
      clinicAddress: tenant.address ?? undefined,
      clinicEmail: tenant.email ?? undefined,
      clinicPhone: tenant.phone ?? undefined,
      patientName,
      patientId: claim.invoice.patient.patientId ?? undefined,
      providerName: payer.providerName,
      networkName: claim.policy.networkTier ?? undefined,
      memberId: claim.policy.memberId,
      policyNumber: claim.policy.groupNumber ?? undefined,
      claimReference: reference,
      procedures,
      submittedAmount: Number(claim.submittedAmount),
      countryCode: tenant.countryCode ?? "AE",
      generatedAt: claim.submittedAt ?? new Date(),
    });

    const sent = await sendPdfToInsurerEmail({
      to: payer.claimEmail.trim(),
      cc: tenant.email ?? undefined,
      subject: `Dental claim ${reference} — ${patientName}`,
      body: [
        `Please find attached a dental claim summary for ${patientName}.`,
        `Claim reference: ${reference}`,
        `Submitted amount: ${Number(claim.submittedAmount).toFixed(2)}`,
        "",
        `Submitted by ${tenant.name}.`,
      ].join("\n"),
      filename: `claim-${reference.replace(/[^\w.-]+/g, "_")}.pdf`,
      pdfBytes,
    });

    const outcome: InsurerSubmissionOutcome = sent
      ? {
          kind: "sent",
          providerName: payer.providerName,
          email: payer.claimEmail.trim(),
          message: `Claim emailed to ${payer.providerName} at ${payer.claimEmail.trim()}`,
        }
      : noConfigOutcome(payer.providerName);

    await logSubmissionAudit(audit, "Claim", claim.id, outcome);
    return outcome;
  }

  const outcome =
    payer.claimSubmissionMethod === "MANUAL" ||
    payer.claimSubmissionMethod === "CLEARINGHOUSE"
      ? noConfigOutcome(payer.providerName)
      : noConfigOutcome(payer.providerName);

  await logSubmissionAudit(audit, "Claim", claim.id, outcome);
  return outcome;
}

export async function sendPreAuthToInsurer(
  preAuthId: string,
  audit: AuditContext,
): Promise<InsurerSubmissionOutcome> {
  const preAuth = await db.preAuthorization.findFirst({
    where: tenantWhere(audit.tenantId, { id: preAuthId }),
    include: {
      policy: { include: { provider: true } },
      estimate: {
        include: {
          patient: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });
  if (!preAuth) throw new Error("Pre-authorization not found");
  if (!preAuth.estimate) {
    throw new Error("Pre-authorization has no linked treatment estimate");
  }

  const tenant = await db.tenant.findUnique({
    where: { id: audit.tenantId },
    select: {
      name: true,
      address: true,
      email: true,
      phone: true,
      countryCode: true,
    },
  });
  if (!tenant) throw new Error("Tenant not found");

  const payer = await resolvePayerConfigForPolicy(
    audit.tenantId,
    tenant.countryCode ?? "AE",
    preAuth.policy,
  );

  const reference = preAuth.referenceNumber ?? preAuth.id;
  const estimate = preAuth.estimate;
  const patientName = `${estimate.patient.firstName} ${estimate.patient.lastName}`;

  if (payer.claimSubmissionMethod === "PORTAL") {
    const outcome = manualRequiredOutcome(payer.providerName, payer.claimsPortalUrl);
    await logSubmissionAudit(audit, "PreAuthorization", preAuth.id, outcome);
    return outcome;
  }

  if (
    payer.claimSubmissionMethod === "EMAIL" &&
    payer.claimEmail?.trim()
  ) {
    const procedures = estimate.procedureCodes as ProcedureCodeSnapshot[];
    const pdfBytes = await buildEstimatePdfBytes({
      clinicName: tenant.name,
      clinicAddress: tenant.address ?? undefined,
      patientName,
      providerName: payer.providerName,
      networkName: preAuth.policy.networkTier ?? undefined,
      procedures,
      totalAmount: Number(estimate.totalAmount),
      insurerAmount: Number(estimate.estimatedInsurerAmount),
      patientAmount: Number(estimate.estimatedPatientAmount),
      countryCode: tenant.countryCode ?? "AE",
      generatedAt: estimate.generatedAt,
    });

    const sent = await sendPdfToInsurerEmail({
      to: payer.claimEmail.trim(),
      cc: tenant.email ?? undefined,
      subject: `Pre-authorization ${reference} — ${patientName}`,
      body: [
        `Please find attached a pre-authorization request for ${patientName}.`,
        `Reference: ${reference}`,
        `Estimated insurer portion: ${Number(estimate.estimatedInsurerAmount).toFixed(2)}`,
        "",
        `Submitted by ${tenant.name}.`,
      ].join("\n"),
      filename: `preauth-${reference.replace(/[^\w.-]+/g, "_")}.pdf`,
      pdfBytes,
    });

    const outcome: InsurerSubmissionOutcome = sent
      ? {
          kind: "sent",
          providerName: payer.providerName,
          email: payer.claimEmail.trim(),
          message: `Pre-authorization emailed to ${payer.providerName} at ${payer.claimEmail.trim()}`,
        }
      : noConfigOutcome(payer.providerName);

    await logSubmissionAudit(audit, "PreAuthorization", preAuth.id, outcome);
    return outcome;
  }

  const outcome = noConfigOutcome(payer.providerName);
  await logSubmissionAudit(audit, "PreAuthorization", preAuth.id, outcome);
  return outcome;
}
