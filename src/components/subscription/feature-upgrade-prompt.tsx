import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Props = {
  title: string;
  description: string;
};

export function FeatureUpgradePrompt({ title, description }: Props) {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">{title}</h1>
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-muted-foreground">{description}</p>
          <Button asChild className="mt-6">
            <Link href="/billing/subscription">Upgrade plan</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
