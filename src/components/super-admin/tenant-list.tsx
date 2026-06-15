"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Eye, Pause, Play, Trash2, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { TenantListItem } from "@/lib/super-admin/queries";
import {
  activateTenantAction,
  bulkActivateTenantsAction,
  bulkSuspendTenantsAction,
  softDeleteTenantAction,
  suspendTenantAction,
} from "@/lib/super-admin/actions";
import { ImpersonateButton } from "./impersonate-button";

type Props = { tenants: TenantListItem[] };

const statusVariant: Record<string, "success" | "warning" | "destructive" | "secondary" | "outline"> = {
  ACTIVE: "success",
  PENDING: "warning",
  SUSPENDED: "destructive",
  CLOSED: "secondary",
};

export function TenantList({ tenants }: Props) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return tenants.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.slug.toLowerCase().includes(q) ||
        t.email?.toLowerCase().includes(q) ||
        t.city?.toLowerCase().includes(q),
    );
  }, [tenants, search]);

  const toggleAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((t) => t.id)));
    }
  };

  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  async function runAction(
    key: string,
    fn: () => Promise<{ success: boolean; error?: string }>,
    successMsg: string,
  ) {
    setLoading(key);
    const result = await fn();
    setLoading(null);
    if (result.success) toast.success(successMsg);
    else toast.error(result.error ?? "Action failed");
  }

  return (
    <div id="tenants" className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search tenants…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {selected.size > 0 && (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={!!loading}
              onClick={() =>
                runAction(
                  "bulk-activate",
                  () => bulkActivateTenantsAction({ tenantIds: [...selected] }),
                  `Activated ${selected.size} tenants`,
                )
              }
            >
              <Play className="h-3.5 w-3.5" />
              Activate ({selected.size})
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!!loading}
              onClick={() =>
                runAction(
                  "bulk-suspend",
                  () => bulkSuspendTenantsAction({ tenantIds: [...selected] }),
                  `Suspended ${selected.size} tenants`,
                )
              }
            >
              <Pause className="h-3.5 w-3.5" />
              Suspend ({selected.size})
            </Button>
          </div>
        )}
      </div>

      <div className="rounded-xl border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  aria-label="Select all tenants"
                  checked={filtered.length > 0 && selected.size === filtered.length}
                  onChange={toggleAll}
                  className="rounded border-input"
                />
              </TableHead>
              <TableHead>Clinic</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead className="text-right">Users</TableHead>
              <TableHead className="text-right">Patients</TableHead>
              <TableHead className="text-right">Revenue</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-36">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((tenant) => (
              <TableRow key={tenant.id} data-state={selected.has(tenant.id) ? "selected" : undefined}>
                <TableCell>
                  <input
                    type="checkbox"
                    aria-label={`Select ${tenant.name}`}
                    checked={selected.has(tenant.id)}
                    onChange={() => toggleOne(tenant.id)}
                    className="rounded border-input"
                  />
                </TableCell>
                <TableCell>
                  <div>
                    <p className="font-medium">{tenant.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {tenant.city ?? "—"}
                      {tenant.deletedAt && " · Deleted"}
                    </p>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={statusVariant[tenant.status] ?? "outline"}>{tenant.status}</Badge>
                </TableCell>
                <TableCell>
                  <span className="text-sm">{tenant.subscriptionPlan}</span>
                </TableCell>
                <TableCell className="text-right tabular-nums">{tenant.activeUsers}</TableCell>
                <TableCell className="text-right tabular-nums">{tenant.totalPatients}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {tenant.totalRevenue.toLocaleString("en-AE", {
                    style: "currency",
                    currency: "AED",
                    maximumFractionDigits: 0,
                  })}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {tenant.createdAt.toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" asChild title="View tenant">
                      <Link href={`/super-admin/tenants/${tenant.id}`}>
                        <Eye className="h-4 w-4" />
                      </Link>
                    </Button>
                    <ImpersonateButton tenantId={tenant.id} tenantName={tenant.name} />
                    {tenant.status === "ACTIVE" ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Suspend"
                        disabled={loading === tenant.id}
                        onClick={() =>
                          runAction(
                            tenant.id,
                            () => suspendTenantAction({ tenantId: tenant.id }),
                            `${tenant.name} suspended`,
                          )
                        }
                      >
                        <Pause className="h-4 w-4" />
                      </Button>
                    ) : tenant.status !== "CLOSED" ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Activate"
                        disabled={loading === tenant.id}
                        onClick={() =>
                          runAction(
                            tenant.id,
                            () => activateTenantAction({ tenantId: tenant.id }),
                            `${tenant.name} activated`,
                          )
                        }
                      >
                        <Play className="h-4 w-4" />
                      </Button>
                    ) : null}
                    {!tenant.deletedAt && (
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Soft delete"
                        disabled={loading === tenant.id}
                        onClick={() =>
                          runAction(
                            `del-${tenant.id}`,
                            () => softDeleteTenantAction({ tenantId: tenant.id }),
                            `${tenant.name} archived`,
                          )
                        }
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                  No tenants match your search.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
