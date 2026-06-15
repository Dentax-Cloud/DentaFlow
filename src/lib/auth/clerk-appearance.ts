import type { Appearance } from "@clerk/types";
import { CLERK_WEB3_PROVIDERS } from "@/lib/auth/clerk-web3-blocker";

const HIDDEN = "hidden !important";
const COLLAPSED = "!hidden !h-0 !min-h-0 !max-h-0 !overflow-hidden !p-0 !m-0 !border-0";

/** OAuth providers to hide — keep Google only on sign-in. */
const OAUTH_PROVIDERS_TO_HIDE = [
  "facebook",
  "github",
  "gitlab",
  "discord",
  "twitter",
  "twitch",
  "linkedin",
  "linkedin_oidc",
  "dropbox",
  "atlassian",
  "bitbucket",
  "microsoft",
  "notion",
  "apple",
  "line",
  "instagram",
  "coinbase",
  "spotify",
  "xero",
  "box",
  "slack",
  "linear",
  "x",
  "enstall",
  "huggingface",
  "vercel",
  "hubspot",
  "tiktok",
] as const;

function hiddenProviderElements(
  prefix: string,
  providers: readonly string[],
): NonNullable<Appearance["elements"]> {
  const entries: [string, string][] = [];
  for (const provider of providers) {
    entries.push([`${prefix}__${provider}`, HIDDEN]);
  }
  return Object.fromEntries(entries);
}

const web3ButtonHides = {
  ...hiddenProviderElements("socialButtonsBlockButton", CLERK_WEB3_PROVIDERS),
  ...hiddenProviderElements("socialButtonsIconButton", CLERK_WEB3_PROVIDERS),
  ...hiddenProviderElements("alternativeMethodsBlockButton", CLERK_WEB3_PROVIDERS),
  ...hiddenProviderElements("socialButtonsProviderIcon", CLERK_WEB3_PROVIDERS),
  ...hiddenProviderElements("socialButtonsProviderInitialIcon", CLERK_WEB3_PROVIDERS),
  ...hiddenProviderElements("providerIcon", CLERK_WEB3_PROVIDERS),
  ...hiddenProviderElements("providerInitialIcon", CLERK_WEB3_PROVIDERS),
};

const oauthButtonHides = {
  ...hiddenProviderElements("socialButtonsBlockButton", OAUTH_PROVIDERS_TO_HIDE),
  ...hiddenProviderElements("socialButtonsIconButton", OAUTH_PROVIDERS_TO_HIDE),
  ...hiddenProviderElements("alternativeMethodsBlockButton", OAUTH_PROVIDERS_TO_HIDE),
};

/** Hides all Web3 wallet UI surfaces Clerk exposes. */
export const clerkHideWeb3Elements: NonNullable<Appearance["elements"]> = {
  ...web3ButtonHides,
  web3SolanaWalletButtonsRoot: COLLAPSED,
  web3SolanaWalletButtons: COLLAPSED,
  web3SolanaWalletButtonsIconButton: HIDDEN,
  web3SolanaWalletButtonsBlockButton: HIDDEN,
  web3SolanaWalletButtonsBlockButtonText: HIDDEN,
  web3SolanaWalletButtonsWalletIcon: HIDDEN,
  web3SolanaWalletButtonsWalletInitialIcon: HIDDEN,
  walletIcon: HIDDEN,
  walletInitialIcon: HIDDEN,
  alternativeMethods: HIDDEN,
  lastAuthenticationStrategyBadge: HIDDEN,
};

/** Shows only Google among OAuth providers on the sign-in form. */
export const clerkSignInOAuthElements: NonNullable<Appearance["elements"]> = oauthButtonHides;

const authVariables: Appearance["variables"] = {
  colorPrimary: "#0ea5e9",
  colorDanger: "#ef4444",
  colorSuccess: "#10b981",
  colorWarning: "#f59e0b",
  colorNeutral: "#a1a1aa",
  colorText: "#fafafa",
  colorTextSecondary: "#a1a1aa",
  colorBackground: "#09090b",
  colorInputBackground: "#18181b",
  colorInputText: "#fafafa",
  borderRadius: "0.75rem",
  fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
};

const authElements: Appearance["elements"] = {
  rootBox: "w-full mx-auto",
  cardBox: "w-full shadow-none bg-transparent",
  card: "w-full bg-transparent shadow-none p-0 gap-4",
  main: "gap-4 w-full",
  form: "gap-4 w-full",
  formFieldRow: "gap-4",
  socialButtonsBlockButton:
    "border border-white/10 bg-zinc-900/80 text-white hover:bg-zinc-800 h-11 rounded-xl",
  socialButtonsBlockButtonText: "font-medium text-white",
  socialButtonsRoot: "w-full grid gap-2",
  dividerLine: "bg-white/10",
  dividerText: "text-zinc-500",
  formFieldLabel: "text-zinc-300 font-medium",
  formFieldInput:
    "bg-zinc-900/80 border-white/10 text-white placeholder:text-zinc-500 h-11 rounded-xl focus:ring-2 focus:ring-sky-500/30",
  formButtonPrimary:
    "bg-gradient-to-r from-sky-600 to-cyan-500 hover:from-sky-500 hover:to-cyan-400 text-white font-semibold h-11 rounded-xl shadow-lg shadow-sky-500/20",
  footerActionLink: "text-sky-400 hover:text-sky-300",
  footerActionText: "text-zinc-500",
  identityPreviewText: "text-white",
  identityPreviewEditButton: "text-sky-400",
  formFieldInputShowPasswordButton: "text-zinc-400",
  otpCodeFieldInput: "bg-zinc-900 border-white/10 text-white rounded-xl",
  alertText: "text-zinc-300",
  formFieldErrorText: "text-red-400",
  backLink: "text-zinc-400 hover:text-white",
  navbar: "hidden",
  logoBox: "hidden",
};

const sharedAuthElements: Appearance["elements"] = {
  ...authElements,
  ...clerkHideWeb3Elements,
};

/** Global Clerk appearance — suppress Web3 wallet UI application-wide. */
export const clerkProviderAppearance: Appearance = {
  variables: authVariables,
  layout: {
    socialButtonsVariant: "blockButton",
    socialButtonsPlacement: "top",
  },
  elements: sharedAuthElements,
};

/** Shared Clerk styling for auth surfaces (org picker, etc.). */
export const clerkAuthAppearance: Appearance = {
  variables: authVariables,
  elements: {
    ...sharedAuthElements,
    headerTitle: "text-2xl font-semibold tracking-tight text-white",
    headerSubtitle: "text-zinc-400",
  },
};

/** Sign-in page — email/password + Google only; no Web3 wallets. */
export const clerkSignInAppearance: Appearance = {
  variables: authVariables,
  layout: {
    socialButtonsPlacement: "top",
    socialButtonsVariant: "blockButton",
    showOptionalFields: true,
    logoPlacement: "none",
  },
  elements: {
    ...sharedAuthElements,
    ...clerkSignInOAuthElements,
    header: "hidden",
    headerTitle: "hidden",
    headerSubtitle: "hidden",
    footer: "hidden",
    footerAction: "hidden",
    // Force-hide any wallet strategy row Clerk still renders
    socialButtons: "[&_[data-provider=metamask]]:hidden [&_[data-provider=coinbase_wallet]]:hidden [&_[data-provider=okx_wallet]]:hidden [&_[data-provider=base]]:hidden [&_[data-provider=solana]]:hidden",
  },
};
