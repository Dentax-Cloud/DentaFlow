import Link from "next/link";
import { requireRouteAccess } from "@/lib/rbac/require-route-access";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { SetupItem } from "@/lib/chair-setup/types";

export const runtime = "nodejs";

/**
 * Store-facing chair tray visibility.
 * Sourced from ChairDaySetup / templates — visibility only (no replenishment).
 * Gated by chair_inventory:read (STORE has this; clinical_chart remains none).
 */
export default async function InventoryChairsPage() {
  const ctx = await requireRouteAccess("chair_inventory", "read");
  const today = new Date().toISOString().split("T")[0];

  const [session, chairs] = await Promise.all([
    db.daySession.findFirst({
      where: { tenantId: ctx.tenant.id, sessionDate: today },
      include: {
        chairSetups: {
          include: {
            chair: { select: { id: true, name: true, number: true, status: true } },
            template: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    }),
    db.chair.findMany({
      where: { tenantId: ctx.tenant.id, isActive: true },
      orderBy: { number: "asc" },
      select: { id: true, name: true, number: true, status: true },
    }),
  ]);

  const setupsByChair = new Map(
    (session?.chairSetups ?? []).map((s) => [s.chairId, s] as const),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Chair stock</h1>
          <p className="text-muted-foreground">
            Today&apos;s tray setup state from clinical chair prep (read-only for Store).
            Replenishment remains a Nurse action on chair setup.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/inventory">Back to inventory</Link>
        </Button>
      </div>

      <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
        Session {today}:{" "}
        {session ? (
          <>
            <Badge variant="secondary" className="mr-1">
              {session.status}
            </Badge>
            {session.chairSetups.length} chair setup(s)
          </>
        ) : (
          <span>No day session opened yet — chairs show as not set up.</span>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {chairs.map((chair) => {
          const setup = setupsByChair.get(chair.id);
          const setupItems = (setup?.setupItems as SetupItem[] | undefined) ?? [];
          const consumed = (setup?.consumedItems as SetupItem[] | undefined) ?? [];
          const returned = (setup?.returnedItems as SetupItem[] | undefined) ?? [];
          return (
            <Card key={chair.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base">
                    Chair {chair.number} · {chair.name}
                  </CardTitle>
                  <Badge variant={setup ? "default" : "outline"}>
                    {setup?.status ?? "NOT_SETUP"}
                  </Badge>
                </div>
                {setup?.template?.name && (
                  <p className="text-xs text-muted-foreground">Template: {setup.template.name}</p>
                )}
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {!setup && (
                  <p className="text-muted-foreground">No tray setup for today.</p>
                )}
                {setup && (
                  <>
                    <div>
                      <p className="mb-1 font-medium">On tray ({setupItems.length})</p>
                      {setupItems.length === 0 ? (
                        <p className="text-muted-foreground">Empty</p>
                      ) : (
                        <ul className="space-y-1">
                          {setupItems.slice(0, 8).map((it) => (
                            <li key={`${it.inventoryItemId}-${it.itemName}`} className="flex justify-between gap-2">
                              <span className="truncate">{it.itemName}</span>
                              <span className="shrink-0 tabular-nums text-muted-foreground">
                                ×{it.qty} {it.unit}
                              </span>
                            </li>
                          ))}
                          {setupItems.length > 8 && (
                            <li className="text-muted-foreground">
                              +{setupItems.length - 8} more
                            </li>
                          )}
                        </ul>
                      )}
                    </div>
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      <span>Consumed lines: {consumed.length}</span>
                      <span>Returned lines: {returned.length}</span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
        {chairs.length === 0 && (
          <p className="text-sm text-muted-foreground">No active chairs for this clinic.</p>
        )}
      </div>
    </div>
  );
}
