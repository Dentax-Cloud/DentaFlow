"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const isDev = process.env.NODE_ENV === "development";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold">Something went wrong</h2>
        <p className="max-w-md text-muted-foreground">
          An unexpected error occurred. You can try again or return to your dashboard.
        </p>
        {isDev && (
          <p className="max-w-lg rounded-md bg-muted p-3 text-left text-xs font-mono text-destructive">
            {error.message}
            {error.digest && `\nDigest: ${error.digest}`}
          </p>
        )}
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <Button onClick={reset}>Try again</Button>
        <Button variant="outline" asChild>
          <Link href="/dashboard">Go to dashboard</Link>
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        If this keeps happening, contact support with the time the error occurred.
      </p>
    </div>
  );
}
