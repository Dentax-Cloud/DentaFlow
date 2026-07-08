import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type Props = {
  title: string;
  message: string;
  missingPlans?: string[];
};

export function ChairsideSessionBlocked({ title, message, missingPlans }: Props) {
  return (
    <div className="mx-auto max-w-lg space-y-4 p-6">
      <Card>
        <CardContent className="space-y-4 p-8 text-center">
          <AlertTriangle className="mx-auto h-10 w-10 text-amber-600" />
          <div className="space-y-2">
            <h1 className="text-lg font-semibold">{title}</h1>
            <p className="text-sm text-muted-foreground">{message}</p>
            {missingPlans && missingPlans.length > 0 ? (
              <ul className="text-left text-sm text-muted-foreground">
                {missingPlans.map((plan) => (
                  <li key={plan} className="list-inside list-disc">
                    {plan}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <Button asChild variant="outline">
            <Link href="/clinical">Back to Clinical</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
