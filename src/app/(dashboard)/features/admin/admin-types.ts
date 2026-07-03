import type { UserRole } from "@prisma/client";

export type PendingInvitation = {
  id: string;
  email: string;
  role: UserRole;
  createdAt: Date;
};
