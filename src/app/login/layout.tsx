import { AuthSessionProvider } from "@/components/providers/session-provider";

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <AuthSessionProvider>{children}</AuthSessionProvider>;
}
