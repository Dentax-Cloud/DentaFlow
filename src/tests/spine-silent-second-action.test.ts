import { createElement, useState, useTransition, type ReactElement } from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useSpineMutation } from "@/app/(dashboard)/clinical/encounter/[appointmentId]/spine/use-spine-mutation";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const workspace = { encounter: { id: "enc-1" }, gates: {} };

const clientSource = readFileSync(
  path.resolve(
    process.cwd(),
    "src/app/(dashboard)/clinical/encounter/[appointmentId]/spine/spine-workspace-client.tsx",
  ),
  "utf8",
);

describe("spine silent second-action (shared run helper)", () => {
  it("routes the four live-failing buttons through one write flag and one run() helper", () => {
    expect(clientSource).toContain("const write = canWrite && !closed && !pending");
    expect(clientSource).toMatch(/useSpineMutation\(/);
    expect(clientSource).not.toMatch(/\buseTransition\b/);
    expect(clientSource).toContain("Grant clinical consent");
    expect(clientSource).toContain("Add line");
    expect(clientSource).toContain("→ {statusLabel(to)}");

    const around = (needle: string) => {
      const at = clientSource.lastIndexOf(needle);
      expect(at).toBeGreaterThan(-1);
      return clientSource.slice(Math.max(0, at - 400), at + 80);
    };

    expect(around("grantSpineConsent({")).toContain("disabled={!write}");
    expect(around("addSpineProcedureLine({")).toContain("disabled={!write");
    expect(around('toStatus: "completed"')).toContain("disabled={!write}");
    expect(around('toStatus: "completed"')).toContain("transitionSpineProcedureLine");
    expect(around("advanceSpinePastGates(")).toContain("disabled={!write}");
    expect(around("advanceSpinePastGates(")).toContain("run(async () =>");
  });
});

function HungTransitionButtons({
  action,
  refresh,
}: {
  action: () => Promise<unknown>;
  refresh: () => Promise<void>;
}): ReactElement {
  const [pending, startTransition] = useTransition();
  const write = !pending;

  function run(next: () => Promise<unknown>) {
    startTransition(async () => {
      await next();
      await refresh();
    });
  }

  return createElement(
    "div",
    null,
    createElement("span", { "data-testid": "pending" }, String(pending)),
    createElement(
      "button",
      {
        type: "button",
        disabled: !write,
        onClick: () => run(action),
      },
      "Grant clinical consent",
    ),
    createElement(
      "button",
      {
        type: "button",
        disabled: !write,
        onClick: () => run(action),
      },
      "Complete",
    ),
  );
}

function SpineMutationButtons({
  action,
  loadWorkspace,
  refreshRouter,
}: {
  action: () => Promise<unknown>;
  loadWorkspace: (appointmentId: string) => Promise<typeof workspace>;
  refreshRouter: () => void;
}): ReactElement {
  const [applied, setApplied] = useState(0);
  const { pending, run } = useSpineMutation({
    appointmentId: "appt-1",
    loadWorkspace,
    applyWorkspace: () => setApplied((n) => n + 1),
    refreshRouter,
  });
  const write = !pending;

  return createElement(
    "div",
    null,
    createElement("span", { "data-testid": "pending" }, String(pending)),
    createElement("span", { "data-testid": "applied" }, String(applied)),
    createElement(
      "button",
      {
        type: "button",
        disabled: !write,
        onClick: () => run(action, "Consent granted"),
      },
      "Grant clinical consent",
    ),
    createElement(
      "button",
      {
        type: "button",
        disabled: !write,
        onClick: () => run(action),
      },
      "Complete",
    ),
  );
}

describe("pre-fix useTransition disable chain", () => {
  it("leaves both buttons disabled after a successful action whose refresh never settles", async () => {
    const action = vi.fn(async () => ({ ok: true }));
    let releaseRefresh: (() => void) | undefined;
    const refresh = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          releaseRefresh = resolve;
        }),
    );

    render(createElement(HungTransitionButtons, { action, refresh }));
    fireEvent.click(screen.getByRole("button", { name: "Grant clinical consent" }));

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.getByTestId("pending").textContent).toBe("true"),
    );

    fireEvent.click(screen.getByRole("button", { name: "Complete" }));
    expect(action).toHaveBeenCalledTimes(1);
    expect(
      (screen.getByRole("button", { name: "Complete" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (
        screen.getByRole("button", {
          name: "Grant clinical consent",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);

    releaseRefresh?.();
    await waitFor(() =>
      expect(screen.getByTestId("pending").textContent).toBe("false"),
    );
  });
});

describe("useSpineMutation sequential actions", () => {
  it("clears pending after the first success even if router.refresh never settles, so the next button can run", async () => {
    const action = vi.fn(async () => ({ ok: true }));
    const loadWorkspace = vi.fn(async () => workspace);
    let releaseRefresh: (() => void) | undefined;
    const refreshRouter = vi.fn((): void => {
      return new Promise<void>((resolve) => {
        releaseRefresh = resolve;
      }) as unknown as void;
    });

    render(
      createElement(SpineMutationButtons, {
        action,
        loadWorkspace,
        refreshRouter,
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Grant clinical consent" }));
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.getByTestId("pending").textContent).toBe("false"),
    );
    expect(screen.getByTestId("applied").textContent).toBe("1");
    expect(refreshRouter).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Complete" }));
    await waitFor(() => expect(action).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(screen.getByTestId("pending").textContent).toBe("false"),
    );
    expect(screen.getByTestId("applied").textContent).toBe("2");
    releaseRefresh?.();
  });

  it("still clears pending when the server returns { ok: false }, so a retry is possible", async () => {
    const action = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, error: "Risk must be clear." })
      .mockResolvedValueOnce({ ok: true });
    const loadWorkspace = vi.fn(async () => workspace);

    render(
      createElement(SpineMutationButtons, {
        action,
        loadWorkspace,
        refreshRouter: () => undefined,
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Grant clinical consent" }));
    await waitFor(() =>
      expect(screen.getByTestId("pending").textContent).toBe("false"),
    );
    expect(loadWorkspace).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Grant clinical consent" }));
    await waitFor(() => expect(action).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(loadWorkspace).toHaveBeenCalledTimes(1));
  });
});
