import { createUploadthing, type FileRouter } from "uploadthing/next";
import { z } from "zod";
import { getServerAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant/context";
import { tenantWhere } from "@/lib/tenant/scoped";
import { isUploadthingConfigured } from "@/lib/uploadthing-env";

const f = createUploadthing();

function assertUploadthingConfigured() {
  if (!isUploadthingConfigured()) {
    throw new Error("UploadThing is not configured");
  }
}

async function requireAuthenticatedSession() {
  assertUploadthingConfigured();
  const session = await getServerAuthSession();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session;
}

/** Tenant-scoped upload metadata (H4 / B10). */
async function requireTenantUpload() {
  const session = await requireAuthenticatedSession();
  const ctx = await getTenantContext();
  if (!ctx) throw new Error("Unauthorized");

  const staffMemberId = ctx.staffMember?.id ?? null;

  return {
    authUserId: session.user.id,
    tenantId: ctx.tenantId,
    staffMemberId,
    userId: staffMemberId ?? session.user.id,
  };
}

export const ourFileRouter = {
  /** Pre-registration clinic logo — no session required during sign-up wizard. */
  registrationLogo: f({
    image: { maxFileSize: "2MB", maxFileCount: 1 },
  })
    .middleware(async () => {
      assertUploadthingConfigured();
      const session = await getServerAuthSession();
      return { userId: session?.user?.id ?? "registration" };
    })
    .onUploadComplete(async ({ file }) => ({
      url: file.ufsUrl ?? file.url,
    })),

  clinicLogo: f({
    image: { maxFileSize: "2MB", maxFileCount: 1 },
  })
    .middleware(async () => requireTenantUpload())
    .onUploadComplete(async ({ metadata, file }) => {
      const url = file.ufsUrl ?? file.url;
      await db.tenant.update({
        where: { id: metadata.tenantId },
        data: { logoUrl: url },
      });
      return { url, tenantId: metadata.tenantId };
    }),

  patientAttachment: f({
    image: { maxFileSize: "8MB", maxFileCount: 5 },
    pdf: { maxFileSize: "16MB", maxFileCount: 3 },
  })
    .input(z.object({ patientId: z.string().min(1) }))
    .middleware(async ({ input }) => {
      const metadata = await requireTenantUpload();

      const patient = await db.patient.findFirst({
        where: tenantWhere(metadata.tenantId, { id: input.patientId, deletedAt: null }),
      });
      if (!patient) throw new Error("Patient not found");

      return {
        ...metadata,
        patientId: patient.id,
      };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      await db.attachment.create({
        data: {
          tenantId: metadata.tenantId,
          patientId: metadata.patientId,
          name: file.name,
          type: file.type ?? "file",
          url: file.ufsUrl ?? file.url,
          size: file.size,
          mimeType: file.type ?? null,
        },
      });

      return {
        url: file.ufsUrl ?? file.url,
        tenantId: metadata.tenantId,
        patientId: metadata.patientId,
      };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
