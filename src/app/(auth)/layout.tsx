import { AuthSessionProvider } from "@/components/providers/session-provider";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthSessionProvider>
      <div className="dark">{children}</div>
    </AuthSessionProvider>
  );
}
