import Link from "next/link";
import { Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function ChairsidePermissionDenied() {
  return (
    <div className="mx-auto max-w-lg space-y-4 p-6">
      <Card>
        <CardContent className="space-y-4 p-8 text-center">
          <Activity className="mx-auto h-10 w-10 text-muted-foreground" />
          <div className="space-y-2">
            <h1 className="text-lg font-semibold">Chairside access restricted</h1>
            <p className="text-sm text-muted-foreground">
              You don&apos;t have permission to start a chairside session. Contact your
              administrator if you believe this is incorrect.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/clinical">Back to Clinical</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
