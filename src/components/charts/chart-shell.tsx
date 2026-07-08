"use client";

import { useState, type ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ChartShellProps = {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  table?: ReactNode;
  defaultShowTable?: boolean;
};

export function ChartShell({
  title,
  description,
  children,
  className,
  table,
  defaultShowTable = false,
}: ChartShellProps) {
  const [showTable, setShowTable] = useState(defaultShowTable);

  return (
    <Card className={cn(className)}>
      <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        {table && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="shrink-0 text-xs"
            onClick={() => setShowTable((v) => !v)}
          >
            {showTable ? "Hide table" : "Show table"}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="w-full min-h-[200px]">{children}</div>
        {table && showTable && <div className="border-t pt-4">{table}</div>}
      </CardContent>
    </Card>
  );
}
