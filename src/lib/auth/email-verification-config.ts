/**
 * Email verification gate for credentials sign-in.
 *
 * Off by default (REQUIRE_EMAIL_VERIFICATION unset) — new signups still send the
 * verification email, but can sign in and use the dashboard immediately, matching
 * current testing behavior. Once registration testing is complete, set
 * REQUIRE_EMAIL_VERIFICATION=true in the environment to start blocking credentials
 * sign-in for unverified accounts.
 *
 * Seeded/test accounts (seedDefaultStaffUsers on tenant provisioning, and the bulk
 * run-seed.ts test-data script) stamp `emailVerified` at creation time, so they are
 * never blocked by this gate regardless of the flag.
 */
export function isEmailVerificationRequired(): boolean {
  const flag = process.env.REQUIRE_EMAIL_VERIFICATION?.trim().toLowerCase();
  return flag === "true" || flag === "1" || flag === "on";
}
