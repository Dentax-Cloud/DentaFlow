import { CheckCircle2, Lock, Shield } from "lucide-react";

const badges = [
  { icon: Lock, label: "Secure" },
  { icon: Shield, label: "Data Privacy" },
  { icon: CheckCircle2, label: "14-Day Free Trial" },
] as const;

export function TrustBadges({ className }: { className?: string }) {
  return (
    <div className={className}>
      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-zinc-500 sm:text-sm">
        {badges.map(({ icon: Icon, label }) => (
          <span key={label} className="inline-flex items-center gap-1.5">
            <Icon className="h-3.5 w-3.5 text-sky-400/80" />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
