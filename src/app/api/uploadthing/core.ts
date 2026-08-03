import { createUploadthing, type FileRouter } from "uploadthing/next";
import { z } from "zod";
import { getServerAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant/context";
import { tenantWhere } from "@/lib/tenant/scoped";
import { isUploadthingConfigured } from "@/lib/uploadthing-env";
import { saveInsuranceCardPhotoFromUpload } from "@/lib/insurance/save-card-photo";
import { requirePermission } from "@/lib/rbac/guard";
import { hasPermission, PERMISSIONS } from "@/lib/rbac/permissions";
import { isHrModuleEnabled } from "@/lib/hr/feature-flag";

const f = createUploadthing();

async function assertUploadthingConfigured() {
  if (!(await isUploadthingConfigured())) {
    throw new Error("UploadThing is not configured");
  }
}

async function requireAuthenticatedSession() {
  await assertUploadthingConfigured();
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
      await assertUploadthingConfigured();
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

  clinicalImageUploader: f({
    image: { maxFileSize: "16MB", maxFileCount: 10 },
    pdf: { maxFileSize: "16MB", maxFileCount: 5 },
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
    .onUploadComplete(async ({ file }) => ({
      url: file.ufsUrl ?? file.url,
      name: file.name,
      size: file.size,
      type: file.type ?? null,
    })),

  profilePhoto: f({
    image: { maxFileSize: "4MB", maxFileCount: 1 },
  })
    .input(
      z.object({
        entityType: z.enum(["patient", "staff"]),
        entityId: z.string().min(1),
      }),
    )
    .middleware(async ({ input }) => {
      const metadata = await requireTenantUpload();

      if (input.entityType === "patient") {
        const patient = await db.patient.findFirst({
          where: tenantWhere(metadata.tenantId, { id: input.entityId, deletedAt: null }),
        });
        if (!patient) throw new Error("Patient not found");
      } else {
        const staff = await db.staffMember.findFirst({
          where: {
            id: input.entityId,
            tenantId: metadata.tenantId,
            deletedAt: null,
          },
        });
        if (!staff) throw new Error("Staff member not found");
      }

      return {
        ...metadata,
        entityType: input.entityType,
        entityId: input.entityId,
      };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      const url = file.ufsUrl ?? file.url;
      console.info("[uploadthing] profilePhoto onUploadComplete", {
        entityType: metadata.entityType,
        entityId: metadata.entityId,
        tenantId: metadata.tenantId,
        fileName: file.name,
        url,
      });

      if (metadata.entityType === "patient") {
        await db.patient.update({
          where: { id: metadata.entityId },
          data: { photoUrl: url },
        });
      } else {
        await db.staffMember.update({
          where: { id: metadata.entityId },
          data: { avatarUrl: url },
        });
      }

      console.info("[uploadthing] profilePhoto DB write OK", {
        entityType: metadata.entityType,
        entityId: metadata.entityId,
      });

      return { url, entityType: metadata.entityType, entityId: metadata.entityId };
    }),

  insuranceCardPhoto: f({
    image: { maxFileSize: "8MB", maxFileCount: 1 },
  })
    .input(
      z.object({
        policyId: z.string().min(1),
        side: z.enum(["front", "back"]),
      }),
    )
    .middleware(async ({ input }) => {
      const metadata = await requireTenantUpload();

      const policy = await db.patientInsurancePolicy.findFirst({
        where: tenantWhere(metadata.tenantId, { id: input.policyId, isActive: true }),
      });
      if (!policy) throw new Error("Insurance policy not found");

      return {
        ...metadata,
        policyId: policy.id,
        side: input.side,
      };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      const url = file.ufsUrl ?? file.url;
      await saveInsuranceCardPhotoFromUpload(
        metadata.tenantId,
        metadata.policyId,
        metadata.side,
        url,
      );
      return { url, policyId: metadata.policyId, side: metadata.side };
    }),

  /**
   * Inventory product photo — JPEG/PNG only (no clinical DICOM/TIFF path).
   * Distinct from patient-scoped clinicalImageUploader / profilePhoto.
   * URL persistence is via setInventoryItemImageUrl (inventory.write).
   */
  inventoryItemImage: f({
    "image/jpeg": { maxFileSize: "4MB", maxFileCount: 1 },
    "image/png": { maxFileSize: "4MB", maxFileCount: 1 },
  })
    .input(z.object({ inventoryItemId: z.string().min(1) }))
    .middleware(async ({ input }) => {
      const metadata = await requireTenantUpload();
      await requirePermission(PERMISSIONS.inventory.write);

      const item = await db.inventoryItem.findFirst({
        where: tenantWhere(metadata.tenantId, {
          id: input.inventoryItemId,
          deletedAt: null,
        }),
        select: { id: true },
      });
      if (!item) throw new Error("Inventory item not found");

      return {
        ...metadata,
        inventoryItemId: item.id,
      };
    })
    .onUploadComplete(async ({ metadata, file }) => ({
      url: file.ufsUrl ?? file.url,
      inventoryItemId: metadata.inventoryItemId,
    })),

  /**
   * HR employee document (contracts, IDs, credentials). Distinct from clinical /
   * inventory uploaders. Persistence via registerEmployeeDocument action.
   */
  employeeDocument: f({
    pdf: { maxFileSize: "16MB", maxFileCount: 1 },
    image: { maxFileSize: "8MB", maxFileCount: 1 },
  })
    .input(z.object({ employeeId: z.string().min(1) }))
    .middleware(async ({ input }) => {
      const metadata = await requireTenantUpload();
      const ctx = await getTenantContext();
      if (!ctx || !isHrModuleEnabled(ctx.tenant)) {
        throw new Error("HR module is not enabled");
      }
      const role = ctx.staffMember?.role;
      if (!role) throw new Error("Unauthorized");

      const employee = await db.employee.findFirst({
        where: tenantWhere(metadata.tenantId, {
          id: input.employeeId,
          deletedAt: null,
        }),
        select: { id: true, staffMemberId: true },
      });
      if (!employee) throw new Error("Employee not found");

      const isHr = hasPermission(role, PERMISSIONS.hr.write);
      const isSelf =
        !!ctx.staffMember?.id && employee.staffMemberId === ctx.staffMember.id;
      if (!isHr && !isSelf) throw new Error("FORBIDDEN");

      return {
        ...metadata,
        employeeId: employee.id,
      };
    })
    .onUploadComplete(async ({ metadata, file }) => ({
      url: file.ufsUrl ?? file.url,
      name: file.name,
      size: file.size,
      type: file.type ?? null,
      employeeId: metadata.employeeId,
    })),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
