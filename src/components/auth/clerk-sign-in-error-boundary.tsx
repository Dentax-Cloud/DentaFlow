"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
};

function isWalletConnectionError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /metamask|web3|wallet|ethereum/i.test(message);
}

/**
 * Catches Clerk/Web3 render failures so a MetaMask probe does not blank the sign-in page.
 */
export class ClerkSignInErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: unknown): State | null {
    return isWalletConnectionError(error) ? { hasError: true } : null;
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (isWalletConnectionError(error)) {
      console.warn("[sign-in] Suppressed wallet connection error:", error.message, info.componentStack);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="space-y-4 rounded-xl border border-white/10 bg-zinc-900/60 p-6 text-center">
          <p className="text-sm text-zinc-300">
            Wallet sign-in is not available. Please use your email and password or continue with
            Google.
          </p>
          <Button
            type="button"
            variant="outline"
            className="border-white/15 bg-zinc-900/80 text-white hover:bg-zinc-800"
            onClick={() => this.setState({ hasError: false })}
          >
            Retry sign in
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
