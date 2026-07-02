import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { personInitials } from "@/lib/utils/person-display";

type Size = "sm" | "md" | "lg";

const sizeClasses: Record<Size, string> = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-16 w-16 text-lg",
};

type Props = {
  photoUrl?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string;
  size?: Size;
  className?: string;
};

export function PersonAvatar({
  photoUrl,
  firstName,
  lastName,
  email,
  size = "md",
  className,
}: Props) {
  return (
    <Avatar className={cn(sizeClasses[size], className)}>
      {photoUrl ? <AvatarImage src={photoUrl} alt="" /> : null}
      <AvatarFallback className="bg-primary/10 font-semibold text-primary">
        {personInitials(firstName, lastName, email)}
      </AvatarFallback>
    </Avatar>
  );
}
