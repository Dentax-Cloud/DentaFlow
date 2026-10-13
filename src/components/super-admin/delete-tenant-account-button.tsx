"use client";

import { Button } from "@/components/ui/button";

/**
 * Danger-zone "Delete account" button for the superadmin tenant pages.
 * Submits the given server action (already bound in the server component
 * that renders this) through a plain form, after a confirm() check — the
 * same lightweight confirmation pattern already used elsewhere in the app
 * for destructive actions (e.g. image/presentation deletion).
 */
export function DeleteTenantAccountButton({
  tenantId,
  tenantName,
  action,
  size = "default",
}: {
  tenantId: string;
  tenantName: string;
  action: (tenantId: string, formData?: FormData) => Promise<void>;
  size?: "default" | "sm" | "icon";
}) {
  return (
    <form
      action={action.bind(null, tenantId)}
      onSubmit={(e) => {
        const confirmed = window.confirm(
          `Delete ${tenantName}'s account?\n\n` +
            `This closes the clinic, hides it from reports and billing, and frees its ` +
            `registration email so it can sign up again. All clinical and financial ` +
            `records are kept for audit — this cannot be undone from this screen.`,
        );
        if (!confirmed) {
          e.preventDefault();
        }
      }}
    >
      <Button type="submit" size={size} variant="destructive">
        Delete account
      </Button>
    </form>
  );
}
