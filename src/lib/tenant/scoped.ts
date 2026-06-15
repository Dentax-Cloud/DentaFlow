/** Tenant-scoped Prisma query helpers — always include tenantId */

export function tenantWhere<T extends { tenantId?: string }>(
  tenantId: string,
  where?: Omit<T, "tenantId">,
): T & { tenantId: string } {
  return { ...where, tenantId } as T & { tenantId: string };
}

export function withTenantId<T extends Record<string, unknown>>(
  tenantId: string,
  data: T,
): T & { tenantId: string } {
  return { ...data, tenantId };
}
