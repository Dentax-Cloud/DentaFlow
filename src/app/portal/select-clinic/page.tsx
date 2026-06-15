import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { resolvePortalPatients } from "@/lib/portal/resolve-portal-patient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function PortalSelectClinicPage() {
  const { userId } = await auth();
  if (!userId) redirect("/portal/sign-in");

  const matches = await resolvePortalPatients(userId);
  if (matches.length <= 1) redirect("/portal");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Select your clinic</h1>
        <p className="text-muted-foreground">
          Your portal account is linked to more than one clinic. Pick which one to use.
        </p>
      </div>

      <div className="space-y-3">
        {matches.map((m) => (
          <Card key={m.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{m.tenant.name}</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-4">
              <div className="text-sm">
                <p className="font-medium">
                  {m.firstName} {m.lastName}
                </p>
                <p className="text-xs text-muted-foreground">{m.patientNumber}</p>
              </div>
              <form action="/api/portal/select-clinic" method="post">
                <input type="hidden" name="patientId" value={m.id} />
                <Button type="submit" variant="outline">
                  Use this clinic
                </Button>
              </form>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

