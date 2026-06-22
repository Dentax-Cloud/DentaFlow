export const runtime = "nodejs";

import { getServerAuthSession } from "@/lib/auth";
import { getTenantContext } from "@/lib/tenant/context";
import { chatWithStaffOrPatient } from "@/lib/ai";
import { canUseFeature } from "@/lib/features/plans";
import { db } from "@/lib/db";
import { tenantWhere } from "@/lib/tenant/scoped";

export async function POST(req: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const ctx = await getTenantContext();
  if (!ctx) return new Response("Unauthorized", { status: 401 });

  if (!canUseFeature(ctx.tenant.subscriptionPlan, "aiEnabled")) {
    return new Response("Feature not available", { status: 403 });
  }

  const body = (await req.json()) as {
    messages?: { role: "user" | "assistant"; content: string }[];
    role?: "staff" | "patient";
    patientId?: string;
    chartContext?: string;
  };

  if (!body.messages || !Array.isArray(body.messages)) {
    return new Response("messages array required", { status: 400 });
  }

  let pageContext: string | undefined;
  if (body.patientId) {
    const patient = await db.patient.findFirst({
      where: tenantWhere(ctx.tenant.id, { id: body.patientId, deletedAt: null }),
      select: {
        firstName: true,
        lastName: true,
        dateOfBirth: true,
        allergies: true,
        medications: true,
      },
    });

    if (patient) {
      let chartSummary = body.chartContext;
      if (!chartSummary) {
        const teeth = await db.tooth.findMany({
          where: { tenantId: ctx.tenant.id, patientId: body.patientId },
          include: { conditions: { orderBy: { recordedAt: "desc" }, take: 3 } },
        });
        chartSummary = teeth
          .filter((t) => t.conditions.length > 0)
          .map(
            (t) =>
              `Tooth ${t.number}: ${t.conditions.map((c) => c.type).join(", ")}`,
          )
          .join("; ");
      }

      const recentNotes = await db.clinicalNote.findMany({
        where: { tenantId: ctx.tenant.id, patientId: body.patientId },
        orderBy: { visitDate: "desc" },
        take: 3,
        select: { assessment: true, visitDate: true },
      });

      const age = patient.dateOfBirth
        ? Math.floor(
            (Date.now() - patient.dateOfBirth.getTime()) / (365.25 * 24 * 60 * 60 * 1000),
          )
        : null;

      pageContext = [
        `You are a dental AI assistant. Current patient: ${patient.firstName} ${patient.lastName}.`,
        age !== null ? `Age: ${age}` : null,
        chartSummary ? `Tooth conditions: ${chartSummary}. Provide clinical guidance only.` : null,
        patient.allergies.length ? `Allergies: ${patient.allergies.join(", ")}` : null,
        patient.medications.length ? `Medications: ${patient.medications.join(", ")}` : null,
        recentNotes.length
          ? `Recent notes: ${recentNotes.map((n) => n.assessment?.slice(0, 120)).join(" | ")}`
          : null,
      ]
        .filter(Boolean)
        .join("\n");
    }
  }

  if (!pageContext) {
    pageContext =
      "You are a dental practice AI assistant. Provide general dental practice guidance.";
  }

  const result = chatWithStaffOrPatient(
    {
      role: body.role ?? "staff",
      tenantName: ctx.tenant.name,
      pageContext,
    },
    body.messages,
  );

  return result.toDataStreamResponse();
}
