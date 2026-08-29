"use client";

import { useRef, useState } from "react";

function isExpectedFailure(
  result: unknown,
): result is { ok: false; error: unknown } {
  // Spine actions return { ok:false, error } for expected validation failures
  // (gates / billing) so production Next.js does not mask them as RSC digests.
  return (
    !!result &&
    typeof result === "object" &&
    "ok" in result &&
    (result as { ok: unknown }).ok === false &&
    "error" in result
  );
}

export type SpineMutationOptions<TWorkspace> = {
  appointmentId: string;
  loadWorkspace: (appointmentId: string) => Promise<TWorkspace>;
  applyWorkspace: (data: TWorkspace) => void;
  /**
   * Must return immediately. Do not await `router.refresh()` — wrapping a
   * revalidating server action plus `router.refresh()` in `useTransition`
   * leaves React 19 `isPending` stuck true (Next.js #82289 / #86055).
   */
  refreshRouter: () => void;
};

/**
 * Shared submit helper for every spine write button.
 *
 * Do not use `useTransition` here. Spine server actions call `revalidatePath`,
 * and the previous `startTransition(async () => { await action(); await refresh() })`
 * path left `pending` true after the first success, which disabled every
 * `write` button until a full reload remounted the page.
 */
export function useSpineMutation<TWorkspace>(
  options: SpineMutationOptions<TWorkspace>,
) {
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const inFlight = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function run(
    action: () => Promise<unknown>,
    successMsg?: string,
    afterSuccess?: () => void,
  ) {
    if (inFlight.current) return;
    inFlight.current = true;
    setError(null);
    setMessage(null);
    setPending(true);
    void (async () => {
      const { appointmentId, loadWorkspace, applyWorkspace, refreshRouter } =
        optionsRef.current;
      try {
        const result = await action();
        if (isExpectedFailure(result)) {
          setError(String(result.error));
          return;
        }
        const data = await loadWorkspace(appointmentId);
        applyWorkspace(data);
        refreshRouter();
        afterSuccess?.();
        if (successMsg) setMessage(successMsg);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      } finally {
        inFlight.current = false;
        setPending(false);
      }
    })();
  }

  return { pending, error, message, run };
}
