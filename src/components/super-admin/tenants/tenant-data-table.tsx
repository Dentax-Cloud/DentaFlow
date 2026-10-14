"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  type ColumnDef,
  type PaginationState,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MoreHorizontal,
  Search,
  X,
} from "lucide-react";
import { TenantStatus, type SubscriptionStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TenantStatusBadge } from "@/components/super-admin/tenant-status-badge";
import { DeleteTenantAccountButton } from "@/components/super-admin/delete-tenant-account-button";
import { TenantPlanQuickSelect } from "@/components/super-admin/tenant-plan-quick-select";
import type { TenantListItem } from "@/lib/super-admin/queries";
import {
  approveTenantAction,
  deleteTenantAccountAction,
  reinstateTenantAction,
  rejectTenantAction,
  suspendTenantAction,
} from "@/app/superadmin/tenants/actions";
import { SUBSCRIPTION_PLAN_VALUES, type SubscriptionPlan } from "@/lib/subscription/plan-types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { STATUS_ORDER } from "@/lib/super-admin/chart-colors";

const SUBSCRIPTION_STATUS_VALUES: SubscriptionStatus[] = [
  "ACTIVE",
  "TRIALING",
  "PAST_DUE",
  "CANCELED",
  "INCOMPLETE",
  "EXPIRED",
  "PAUSED",
];

const STATUS_FILTER_LABELS: Record<TenantStatus, string> = {
  ACTIVE: "Active",
  PENDING: "Pending",
  SUSPENDED: "Suspended",
  CLOSED: "Closed",
};

const menuItemClass = "cursor-pointer focus:bg-white/10 focus:text-white";

function TenantRowActions({ tenant }: { tenant: TenantListItem }) {
  const [pending, setPending] = useState(false);

  async function run(successMessage: string, fn: () => Promise<void>) {
    setPending(true);
    try {
      await fn();
      toast.success(successMessage);
    } catch {
      toast.error(`Failed: ${successMessage.toLowerCase()}`);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" disabled={pending} className="h-8 w-8 border-white/10 bg-transparent hover:bg-white/10">
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
            ) : (
              <MoreHorizontal className="h-4 w-4 text-zinc-400" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="border-white/10 bg-zinc-900 text-zinc-100">
          <DropdownMenuItem asChild className={menuItemClass}>
            <Link href={`/superadmin/tenants/${tenant.id}`}>View details</Link>
          </DropdownMenuItem>
          {tenant.status === "PENDING" && (
            <>
              <DropdownMenuSeparator className="bg-white/10" />
              <DropdownMenuItem
                className={menuItemClass}
                onSelect={() => void run("Tenant approved", () => approveTenantAction(tenant.id))}
              >
                Approve
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                className="cursor-pointer focus:bg-destructive/15"
                onSelect={() => void run("Tenant rejected", () => rejectTenantAction(tenant.id))}
              >
                Reject
              </DropdownMenuItem>
            </>
          )}
          {tenant.status === "ACTIVE" && (
            <>
              <DropdownMenuSeparator className="bg-white/10" />
              <DropdownMenuItem
                className={menuItemClass}
                onSelect={() => void run("Tenant suspended", () => suspendTenantAction(tenant.id))}
              >
                Suspend
              </DropdownMenuItem>
            </>
          )}
          {tenant.status === "SUSPENDED" && (
            <>
              <DropdownMenuSeparator className="bg-white/10" />
              <DropdownMenuItem
                className={menuItemClass}
                onSelect={() => void run("Tenant reinstated", () => reinstateTenantAction(tenant.id))}
              >
                Reinstate
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <DeleteTenantAccountButton
        tenantId={tenant.id}
        tenantName={tenant.name}
        action={deleteTenantAccountAction}
        size="sm"
      />
    </div>
  );
}

function sortIcon(state: false | "asc" | "desc") {
  if (state === "asc") return <ArrowUp className="h-3.5 w-3.5" />;
  if (state === "desc") return <ArrowDown className="h-3.5 w-3.5" />;
  return <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />;
}

const columns: ColumnDef<TenantListItem>[] = [
  {
    accessorKey: "name",
    header: "Clinic",
    cell: ({ row }) => {
      const t = row.original;
      return (
        <div>
          <Link href={`/superadmin/tenants/${t.id}`} className="font-medium hover:text-sky-400">
            {t.name}
          </Link>
          <div className="text-xs text-zinc-500">
            /{t.slug}
            {!t.tenantCode && <span className="ml-2 text-amber-400">Not migrated</span>}
          </div>
        </div>
      );
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    sortingFn: (a, b) =>
      STATUS_ORDER.indexOf(a.original.status) - STATUS_ORDER.indexOf(b.original.status),
    cell: ({ row }) => <TenantStatusBadge status={row.original.status} />,
  },
  {
    accessorKey: "country",
    header: "Country",
    cell: ({ row }) => (
      <span className="text-zinc-300">{row.original.country || "—"}</span>
    ),
  },
  {
    id: "plan",
    accessorKey: "subscriptionPlan",
    header: "Plan & subscription",
    sortingFn: (a, b) =>
      SUBSCRIPTION_PLAN_VALUES.indexOf(a.original.subscriptionPlan) -
      SUBSCRIPTION_PLAN_VALUES.indexOf(b.original.subscriptionPlan),
    cell: ({ row }) => (
      <TenantPlanQuickSelect
        tenantId={row.original.id}
        currentPlan={row.original.subscriptionPlan}
        currentStatus={row.original.subscriptionStatus}
      />
    ),
  },
  {
    accessorKey: "totalPatients",
    header: "Patients",
    cell: ({ row }) => <span className="tabular-nums">{row.original.totalPatients}</span>,
  },
  {
    accessorKey: "totalAppointments",
    header: "Appointments",
    cell: ({ row }) => <span className="tabular-nums">{row.original.totalAppointments}</span>,
  },
  {
    accessorKey: "activeUsers",
    header: "Staff",
    cell: ({ row }) => <span className="tabular-nums">{row.original.activeUsers}</span>,
  },
  {
    accessorKey: "totalRevenue",
    header: "Revenue",
    cell: ({ row }) => (
      <span className="tabular-nums text-zinc-300">{formatCurrency(row.original.totalRevenue)}</span>
    ),
  },
  {
    accessorKey: "createdAt",
    header: "Created",
    sortingFn: "datetime",
    cell: ({ row }) => (
      <span className="text-xs text-zinc-500">{formatDate(row.original.createdAt)}</span>
    ),
  },
  {
    id: "actions",
    header: "",
    enableSorting: false,
    cell: ({ row }) => <TenantRowActions tenant={row.original} />,
  },
];

export function TenantDataTable({
  tenants,
  initialStatus,
}: {
  tenants: TenantListItem[];
  initialStatus?: string;
}) {
  const initialStatusFilter =
    initialStatus && (STATUS_ORDER as readonly string[]).includes(initialStatus)
      ? (initialStatus as TenantStatus)
      : "ALL";

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TenantStatus | "ALL">(initialStatusFilter);
  const [planFilter, setPlanFilter] = useState<SubscriptionPlan | "ALL">("ALL");
  const [subStatusFilter, setSubStatusFilter] = useState<SubscriptionStatus | "ALL">("ALL");
  const [countryFilter, setCountryFilter] = useState<string>("ALL");
  const [sorting, setSorting] = useState<SortingState>([{ id: "createdAt", desc: true }]);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 25 });

  const countries = useMemo(() => {
    const set = new Set<string>();
    for (const t of tenants) if (t.country) set.add(t.country);
    return Array.from(set).sort();
  }, [tenants]);

  const searched = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tenants;
    return tenants.filter((t) =>
      [t.name, t.slug, t.email, t.tenantCode, t.country, t.city]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(q)),
    );
  }, [tenants, search]);

  const statusCounts = useMemo(() => {
    const counts = new Map<TenantStatus, number>(STATUS_ORDER.map((s) => [s, 0]));
    for (const t of searched) counts.set(t.status, (counts.get(t.status) ?? 0) + 1);
    return counts;
  }, [searched]);

  const filtered = useMemo(() => {
    return searched.filter((t) => {
      if (statusFilter !== "ALL" && t.status !== statusFilter) return false;
      if (planFilter !== "ALL" && t.subscriptionPlan !== planFilter) return false;
      if (subStatusFilter !== "ALL" && t.subscriptionStatus !== subStatusFilter) return false;
      if (countryFilter !== "ALL" && t.country !== countryFilter) return false;
      return true;
    });
  }, [searched, statusFilter, planFilter, subStatusFilter, countryFilter]);

  const hasActiveFilters =
    search.trim() !== "" ||
    statusFilter !== "ALL" ||
    planFilter !== "ALL" ||
    subStatusFilter !== "ALL" ||
    countryFilter !== "ALL";

  function clearFilters() {
    setSearch("");
    setStatusFilter("ALL");
    setPlanFilter("ALL");
    setSubStatusFilter("ALL");
    setCountryFilter("ALL");
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  }

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const selectClass =
    "h-9 rounded-md border border-white/10 bg-zinc-900 px-2 text-sm text-zinc-100";

  return (
    <div className="space-y-4">
      {/* Quick status chips with counts */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setStatusFilter("ALL")}
          className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
            statusFilter === "ALL"
              ? "border-sky-400/40 bg-sky-400/10 text-sky-300"
              : "border-white/10 text-zinc-400 hover:border-white/20 hover:text-zinc-200"
          }`}
        >
          All ({searched.length})
        </button>
        {STATUS_ORDER.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter((prev) => (prev === s ? "ALL" : s))}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              statusFilter === s
                ? "border-sky-400/40 bg-sky-400/10 text-sky-300"
                : "border-white/10 text-zinc-400 hover:border-white/20 hover:text-zinc-200"
            }`}
          >
            {STATUS_FILTER_LABELS[s]} ({statusCounts.get(s) ?? 0})
          </button>
        ))}
      </div>

      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPagination((p) => ({ ...p, pageIndex: 0 }));
            }}
            placeholder="Search name, slug, email, code, city…"
            className="h-9 w-64 rounded-md border border-white/10 bg-zinc-900 pl-8 pr-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-sky-400/50"
          />
        </div>
        <select
          value={planFilter}
          onChange={(e) => setPlanFilter(e.target.value as SubscriptionPlan | "ALL")}
          className={selectClass}
        >
          <option value="ALL">All plans</option>
          {SUBSCRIPTION_PLAN_VALUES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select
          value={subStatusFilter}
          onChange={(e) => setSubStatusFilter(e.target.value as SubscriptionStatus | "ALL")}
          className={selectClass}
        >
          <option value="ALL">All subscription statuses</option>
          {SUBSCRIPTION_STATUS_VALUES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={countryFilter}
          onChange={(e) => setCountryFilter(e.target.value)}
          className={selectClass}
        >
          <option value="ALL">All countries</option>
          {countries.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="text-zinc-400 hover:text-white">
            <X className="h-3.5 w-3.5" />
            Clear filters
          </Button>
        )}
        <span className="ml-auto text-xs text-zinc-500">
          Showing {filtered.length} of {tenants.length} tenants
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full min-w-[1040px] text-sm">
          <thead className="bg-white/5 text-left text-zinc-400">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="px-4 py-3">
                    {header.isPlaceholder ? null : header.column.getCanSort() ? (
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className="flex items-center gap-1 hover:text-zinc-200"
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {sortIcon(header.column.getIsSorted())}
                      </button>
                    ) : (
                      flexRender(header.column.columnDef.header, header.getContext())
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="border-t border-white/10">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
            {table.getRowModel().rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-zinc-500">
                  No tenants match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-zinc-400">
        <div className="flex items-center gap-2">
          <span>Rows per page</span>
          <select
            value={pagination.pageSize}
            onChange={(e) =>
              setPagination({ pageIndex: 0, pageSize: Number(e.target.value) })
            }
            className={selectClass}
          >
            {[10, 25, 50, 100].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-3">
          <span>
            Page {table.getState().pagination.pageIndex + 1} of{" "}
            {Math.max(1, table.getPageCount())}
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 border-white/10 bg-transparent hover:bg-white/10"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 border-white/10 bg-transparent hover:bg-white/10"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
