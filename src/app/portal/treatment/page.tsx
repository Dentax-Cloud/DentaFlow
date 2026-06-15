import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PortalTreatmentPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Treatment summary</h1>
      <Card>
        <CardHeader>
          <CardTitle>Your treatment plans</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Accepted treatment plans and phase progress appear here once linked to your
            patient record. Contact your clinic for detailed clinical information.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
