"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const denied = error.message === "FORBIDDEN";

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold">
          {denied ? "You don’t have access to this page" : "Something went wrong"}
        </h2>
        <p className="max-w-md text-muted-foreground">
          {denied
            ? "Your role cannot open this record. Return to your home page or ask an administrator if you think this is a mistake."
            : "An unexpected error occurred. You can try again or return to your dashboard."}
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        {denied ? null : <Button onClick={reset}>Try again</Button>}
        <Button variant={denied ? "default" : "outline"} asChild>
          <Link href="/dashboard">Go to dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
