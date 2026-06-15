"use client";

import { Check, Sparkles } from "lucide-react";
import { SubscriptionPlan } from "@/lib/subscription/plan-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { PlanDisplay } from "@/lib/subscription/plans-display";

type Props = {
  plan: PlanDisplay;
  currentPlan: SubscriptionPlan;
  loading?: boolean;
  onSelect: (plan: SubscriptionPlan) => void;
};

export function PricingCard({ plan, currentPlan, loading, onSelect }: Props) {
  const isCurrent = plan.id === currentPlan;
  const isEnterprise = plan.id === SubscriptionPlan.ENTERPRISE;

  return (
    <Card
      className={cn(
        "relative flex flex-col transition-all duration-300",
        plan.popular && "border-dental shadow-lg shadow-dental/10 ring-1 ring-dental/20",
        isCurrent && "ring-2 ring-dental",
      )}
    >
      {plan.popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge className="gap-1 bg-dental px-3 shadow">
            <Sparkles className="h-3 w-3" />
            Most popular
          </Badge>
        </div>
      )}
      {isCurrent && (
        <div className="absolute right-4 top-4">
          <Badge variant="success">Current plan</Badge>
        </div>
      )}
      <CardHeader className="pb-4">
        <CardTitle className="text-xl">{plan.name}</CardTitle>
        <CardDescription>{plan.tagline}</CardDescription>
        <div className="pt-4">
          {isEnterprise ? (
            <span className="text-4xl font-bold tracking-tight">Custom</span>
          ) : (
            <>
              <span className="text-4xl font-bold tracking-tight">{plan.priceLabel}</span>
              <span className="text-muted-foreground"> /month</span>
            </>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1">
        <ul className="space-y-2.5">
          {plan.features.map((f) => (
            <li key={f} className="flex items-start gap-2 text-sm">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-dental" />
              <span>{f}</span>
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter>
        <Button
          className="w-full"
          variant={plan.popular ? "default" : "outline"}
          disabled={isCurrent || loading}
          onClick={() => onSelect(plan.id)}
        >
          {isCurrent ? "Current plan" : isEnterprise ? "Contact sales" : plan.cta}
        </Button>
      </CardFooter>
    </Card>
  );
}
