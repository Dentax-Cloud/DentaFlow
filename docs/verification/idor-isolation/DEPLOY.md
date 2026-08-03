# IDOR fix — deploy / spot-check

- PR: https://github.com/Dentax-Cloud/DentaFlow/pull/22
- Merge: `8c6958a` (merge commit)
- Prod web image: `sha256:6d93f1fb4c31…` (healthy on :3100)
- Rollback tags: `dentaflow-web-prod:pre-idor-fix-rollback` ? `4e19804b` (pre-inventory-photos; exact pre-swap digest `a3cccf71` was missing from local image store)
- Migration: none (code-only); `prisma migrate status` up to date
- Disposable re-verify: pass (no Victim/INV-B leak; foreign treatmentItem create ? 500 digest; B stock unchanged)
- Prod spot-check (read-only): `owner.ae.oasis@test.dentaflow.io` forging Bristol tenantId ? no Leo Walker leak; own patients scoped to oasis (`pass: true`)
