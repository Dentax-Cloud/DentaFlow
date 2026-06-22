export const runtime = "nodejs";

import { getInviteByToken } from "./actions";
import { AcceptInviteClient } from "./accept-invite-client";

type Props = {
  searchParams: Promise<{ token?: string }>;
};

export default async function AcceptInvitePage({ searchParams }: Props) {
  const { token } = await searchParams;
  const invite = token ? await getInviteByToken(token) : null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-4">
      <AcceptInviteClient
        invite={
          invite
            ? {
                tenantName: invite.tenantName,
                email: invite.email,
                role: invite.role,
                inviterName: invite.inviterName,
              }
            : null
        }
      />
    </div>
  );
}
