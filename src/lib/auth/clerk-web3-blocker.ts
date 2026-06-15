/** Web3 providers Clerk may register as social / wallet strategies. */
export const CLERK_WEB3_PROVIDERS = [
  "metamask",
  "coinbase_wallet",
  "okx_wallet",
  "base",
  "solana",
] as const;

const WEB3_PROVIDER_SELECTOR = CLERK_WEB3_PROVIDERS.map(
  (p) => `[data-provider="${p}"]`,
).join(",");

const WEB3_ERROR_PATTERN =
  /metamask|failed to connect to metamask|web3|wallet_request|eth_request/i;

let web3BlockerInstalled = false;

/** Idempotent — installs provider stub + error suppression before Clerk mounts. */
export function ensureWeb3AuthDisabled(): void {
  if (typeof window === "undefined" || web3BlockerInstalled) return;
  installWeb3ProviderBlocker();
  installWeb3ErrorSuppression();
  web3BlockerInstalled = true;
}

/**
 * Replaces window.ethereum with a no-op provider so Clerk cannot reach the
 * MetaMask extension inpage.js (root cause of "Failed to connect to MetaMask").
 */
export function installWeb3ProviderBlocker(): () => void {
  if (typeof window === "undefined") return () => {};

  const win = window as Window & { ethereum?: unknown };
  const previous = win.ethereum;

  const blockedProvider = {
    isMetaMask: false,
    isDentaFlowWeb3Blocked: true,
    request: async ({ method }: { method: string }) => {
      if (
        method === "eth_requestAccounts" ||
        method === "wallet_requestPermissions" ||
        method === "eth_accounts"
      ) {
        return method === "eth_accounts" ? [] : [];
      }
      throw new Error("Web3 authentication is disabled in DentaFlow");
    },
  };

  try {
    Object.defineProperty(win, "ethereum", {
      configurable: true,
      writable: true,
      value: blockedProvider,
    });
  } catch {
    win.ethereum = blockedProvider;
  }

  return () => {
    try {
      if (previous !== undefined) {
        Object.defineProperty(win, "ethereum", {
          configurable: true,
          writable: true,
          value: previous,
        });
      } else {
        delete win.ethereum;
      }
    } catch {
      win.ethereum = previous;
    }
  };
}

export function installWeb3ErrorSuppression(): () => void {
  if (typeof window === "undefined") return () => {};

  function onUnhandledRejection(event: PromiseRejectionEvent) {
    const message = rejectionMessage(event.reason);
    if (WEB3_ERROR_PATTERN.test(message)) {
      event.preventDefault();
    }
  }

  function onError(event: ErrorEvent) {
    if (WEB3_ERROR_PATTERN.test(event.message ?? "")) {
      event.preventDefault();
    }
  }

  window.addEventListener("unhandledrejection", onUnhandledRejection);
  window.addEventListener("error", onError);

  return () => {
    window.removeEventListener("unhandledrejection", onUnhandledRejection);
    window.removeEventListener("error", onError);
  };
}

function rejectionMessage(reason: unknown): string {
  if (reason instanceof Error) return reason.message;
  if (typeof reason === "string") return reason;
  return "";
}

/** Removes Web3 wallet buttons Clerk injects after mount (belt-and-suspenders). */
export function scrubWeb3Nodes(root: ParentNode) {
  root.querySelectorAll(WEB3_PROVIDER_SELECTOR).forEach((node) => {
    node.remove();
  });

  root.querySelectorAll(".cl-web3SolanaWalletButtonsRoot, .cl-web3SolanaWalletButtons").forEach(
    (node) => {
      node.remove();
    },
  );

  root.querySelectorAll("button, a").forEach((node) => {
    const text = node.textContent?.toLowerCase() ?? "";
    if (
      text.includes("metamask") ||
      text.includes("coinbase wallet") ||
      text.includes("okx wallet") ||
      (text.includes("base") && text.includes("wallet"))
    ) {
      const provider = node.getAttribute("data-provider");
      if (!provider || (CLERK_WEB3_PROVIDERS as readonly string[]).includes(provider)) {
        node.remove();
      }
    }
  });
}

export function observeAndScrubWeb3(root: HTMLElement): () => void {
  scrubWeb3Nodes(root);

  const observer = new MutationObserver(() => {
    scrubWeb3Nodes(root);
  });

  observer.observe(root, { childList: true, subtree: true });
  return () => observer.disconnect();
}
