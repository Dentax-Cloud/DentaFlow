import { createUploadthing, type FileRouter } from "uploadthing/next";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant/context";
import { tenantWhere } from "@/lib/tenant/scoped";
import { isUploadthingConfigured } from "@/lib/uploadthing-env";

const f = createUploadthing();

export const ourFileRouter = {
  registrationLogo: f({
    image: { maxFileSize: "2MB", maxFileCount: 1 },
  })
    .middleware(async () => {
      if (!isUploadthingConfigured()) {
        throw new Error("UploadThing is not configured");
      }
      const { userId } = await auth();
      if (!userId) throw new Error("Unauthorized");
      return { userId };
    })
    .onUploadComplete(async ({ file }) => ({
      url: file.ufsUrl ?? file.url,
    })),

  clinicLogo: f({
    image: { maxFileSize: "2MB", maxFileCount: 1 },
  })
    .middleware(async () => {
      if (!isUploadthingConfigured()) {
        throw new Error("UploadThing is not configured");
      }

      const { userId } = await auth();
      if (!userId) throw new Error("Unauthorized");

      const ctx = await getTenantContext();
      if (!ctx) throw new Error("Unauthorized");

      return {
        tenantId: ctx.tenant.id,
        userId: ctx.user.id,
      };
    })
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
      if (!isUploadthingConfigured()) {
        throw new Error("UploadThing is not configured");
      }

      const { userId } = await auth();
      if (!userId) throw new Error("Unauthorized");

      const ctx = await getTenantContext();
      if (!ctx) throw new Error("Unauthorized");

      const patient = await db.patient.findFirst({
        where: tenantWhere(ctx.tenant.id, { id: input.patientId, deletedAt: null }),
      });
      if (!patient) throw new Error("Patient not found");

      return {
        tenantId: ctx.tenant.id,
        userId: ctx.user.id,
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
