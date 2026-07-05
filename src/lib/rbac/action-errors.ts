/** User-facing message when a server action is denied by RBAC. */
export const PERMISSION_DENIED_MESSAGE =
  "You don't have permission to make this change. Contact your clinic admin if you believe this is incorrect.";

export function messageFromActionError(err: unknown): string {
  if (err instanceof Error) {
    if (err.message === "FORBIDDEN" || err.message === "ACCOUNT_SETUP_INCOMPLETE") {
      return PERMISSION_DENIED_MESSAGE;
    }
    return err.message;
  }
  return PERMISSION_DENIED_MESSAGE;
}
