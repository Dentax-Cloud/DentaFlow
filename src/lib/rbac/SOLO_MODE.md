# Solo Mode Integration

## Usage

When rendering navigation, pass the tenant's clinicMode:

```ts
const groups = getNavGroupsForRole(role, {
  clinicMode: tenant.clinicMode,
  spineEnabled: true,
});
```

## Permissions

For permission checks in solo clinics, use `canInSoloMode` from `solo-permissions.ts`
instead of the base `can` when clinicMode is solo.

## Switching modes

Add a control in Admin / Practice settings that updates `Tenant.clinicMode`.
Switching from solo → practice/group restores the full multi-role experience.
