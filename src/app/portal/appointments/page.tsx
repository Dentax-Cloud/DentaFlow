import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth/stubs/server";
import { format } from "date-fns";
import { db } from "@/lib/db";
import { resolvePortalPatientOrThrow } from "@/lib/portal/resolve-portal-patient";
import { getPortalPreferredPatientId } from "@/lib/portal/portal-session";
import { redirect } from "next/navigation";

export default async function PortalAppointmentsPage() {
  const { userId } = await auth();
  if (!userId) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Your appointments</h1>
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">
            Please sign in to view appointments.
          </CardContent>
        </Card>
      </div>
    );
  }

  try {
    const preferred = await getPortalPreferredPatientId();
    const patient = await resolvePortalPatientOrThrow(userId, preferred);
    const upcoming = await db.appointment.findMany({
      where: {
        tenantId: patient.tenantId,
        patientId: patient.id,
        deletedAt: null,
        startTime: { gte: new Date() },
      },
      orderBy: { startTime: "asc" },
      take: 25,
    });

    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Your appointments</h1>
        <Card>
          <CardHeader>
            <CardTitle>
              Upcoming <span className="text-muted-foreground">({upcoming.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {upcoming.map((a) => (
              <div key={a.id} className="flex items-center justify-between border-b pb-2 text-sm">
                <div>
                  <p className="font-medium">{a.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(a.startTime), "EEE, MMM d · h:mm a")}
                  </p>
                </div>
                <Badge variant="outline">{a.status}</Badge>
              </div>
            ))}
            {upcoming.length === 0 && (
              <p className="text-sm text-muted-foreground">No upcoming appointments</p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message === "PORTAL_MULTIPLE_CLINICS") redirect("/portal/select-clinic");
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Your appointments</h1>
        <Card>
          <CardHeader>
            <CardTitle>Not linked</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              Your portal account isn’t linked to a clinic yet. Ask your clinic to link your Clerk
              user id to your patient record.
            </p>
            <p className="font-mono text-xs">Clerk user id: {userId}</p>
            <p className="text-xs text-muted-foreground">Error: {message}</p>
          </CardContent>
        </Card>
      </div>
    );
  }
}
