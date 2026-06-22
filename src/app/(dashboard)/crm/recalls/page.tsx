import { requireRouteAccess } from "@/lib/rbac/require-route-access";
import { db } from "@/lib/db";
import { RecallsClient } from "./recalls-client";

export default async function RecallsPage() {
  const ctx = await requireRouteAccess("crm", "read");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const in30 = new Date(today);
  in30.setDate(in30.getDate() + 30);

  const [overdue, upcoming] = await Promise.all([
    db.recall.findMany({
      where: {
        tenantId: ctx.tenant.id,
        status: "PENDING",
        completedAt: null,
        dueDate: { lt: today },
      },
      include: { patient: true },
      orderBy: { dueDate: "asc" },
    }),
    db.recall.findMany({
      where: {
        tenantId: ctx.tenant.id,
        status: "PENDING",
        completedAt: null,
        dueDate: { gte: today, lte: in30 },
      },
      include: { patient: true },
      orderBy: { dueDate: "asc" },
    }),
  ]);

  return <RecallsClient overdue={overdue} upcoming={upcoming} />;
}
