"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { CountryProfile } from "@/lib/countries";
import {
  addCustomInsuranceProvider,
  addPaymentMethod,
  addReferralContact,
  createCorporateAccount,
  createCustomField,
  createMembershipPlan,
  deleteCustomField,
} from "@/app/(dashboard)/features/admin/customization-actions";

type Tab = "insurance" | "fields" | "payments" | "memberships" | "corporate" | "referrals";

type Props = {
  tenant: {
    countryCode: string | null;
    currency: string;
    taxName: string;
    taxRate: unknown;
    regulatoryBody: string | null;
    name: string;
  } | null;
  countryProfile: CountryProfile;
  customFields: Array<{
    id: string;
    fieldKey: string;
    fieldLabel: string;
    fieldType: string;
    isRequired: boolean;
    section: string;
  }>;
  platformProviders: CountryProfile["insuranceProviders"];
  customProviders: Array<{
    id: string;
    code: string;
    name: string;
    shortName: string;
    isActive: boolean;
    networkTypes: Array<{ code: string; name: string; defaultCoPayPercent: number }>;
  }>;
  membershipPlans: Array<{
    id: string;
    name: string;
    price: number;
    discountPercent: number;
    duration: string;
    _count?: { members: number };
  }>;
  corporateAccounts: Array<{
    id: string;
    companyName: string;
    discountPercent: number;
    _count?: { patients: number };
  }>;
  paymentMethods: Array<{ id: string; name: string; type: string; isDefault: boolean }>;
  referralContacts: Array<{
    id: string;
    type: string;
    name: string;
    specialty: string | null;
    phone: string | null;
  }>;
  procedures: Array<{ code: string; name: string }>;
};

const TABS: Array<{ id: Tab; label: string; icon: string }> = [
  { id: "insurance", label: "Insurance", icon: "🏥" },
  { id: "fields", label: "Patient Fields", icon: "👤" },
  { id: "payments", label: "Payment Methods", icon: "💳" },
  { id: "memberships", label: "Membership Plans", icon: "🎫" },
  { id: "corporate", label: "Corporate Accounts", icon: "🏢" },
  { id: "referrals", label: "Referral Network", icon: "🔗" },
];

export default function CustomizationClient(props: Props) {
  const [tab, setTab] = useState<Tab>("insurance");
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Clinic Customization</h1>
        <p className="text-muted-foreground">
          {props.tenant?.name} · {props.countryProfile.flag} {props.countryProfile.name}
        </p>
      </div>

      <div className="flex flex-wrap gap-2 border-b pb-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-3 py-2 text-sm ${
              tab === t.id ? "bg-primary text-primary-foreground" : "bg-muted"
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === "insurance" && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Platform insurance providers</h2>
          <ul className="divide-y rounded-lg border">
            {props.platformProviders.map((p) => (
              <li key={p.code} className="flex items-center justify-between p-3 text-sm">
                <div>
                  <p className="font-medium">{p.name}</p>
                  <p className="text-muted-foreground">
                    {p.networkTypes.length} network types · pre-auth{" "}
                    {p.requiresPreAuth ? "required" : "optional"}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">Platform</span>
              </li>
            ))}
          </ul>

          <h2 className="text-lg font-semibold">Custom providers</h2>
          {props.customProviders.length === 0 ? (
            <p className="text-sm text-muted-foreground">No custom providers yet.</p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {props.customProviders.map((p) => (
                <li key={p.id} className="p-3 text-sm">
                  <p className="font-medium">{p.name}</p>
                  <p className="text-muted-foreground">{p.code}</p>
                </li>
              ))}
            </ul>
          )}

          <button
            type="button"
            disabled={pending}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white"
            onClick={() =>
              startTransition(async () => {
                try {
                  await addCustomInsuranceProvider({
                    code: `CUSTOM_${Date.now()}`,
                    name: "Custom Insurer",
                    shortName: "Custom",
                    requiresPreAuth: true,
                    networkTypes: [
                      { code: "STANDARD", name: "Standard", defaultCoPayPercent: 20 },
                    ],
                  });
                  toast.success("Custom provider added");
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Failed");
                }
              })
            }
          >
            + Add custom provider
          </button>
        </section>
      )}

      {tab === "fields" && (
        <section className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Standard fields are defined by your country ({props.countryProfile.name}).
          </p>
          <ul className="divide-y rounded-lg border">
            {props.customFields.map((f) => (
              <li key={f.id} className="flex items-center justify-between p-3 text-sm">
                <div>
                  <p className="font-medium">{f.fieldLabel}</p>
                  <p className="text-muted-foreground">
                    {f.fieldKey} · {f.fieldType} · {f.section}
                    {f.isRequired ? " · required" : ""}
                  </p>
                </div>
                <button
                  type="button"
                  className="text-xs text-red-600"
                  onClick={() =>
                    startTransition(async () => {
                      await deleteCustomField(f.id);
                      toast.success("Field removed");
                    })
                  }
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white"
            onClick={() =>
              startTransition(async () => {
                await createCustomField({
                  entity: "PATIENT",
                  fieldKey: `field_${Date.now()}`,
                  fieldLabel: "New custom field",
                  fieldType: "TEXT",
                  isRequired: false,
                  isPortalVisible: false,
                  section: "ADDITIONAL",
                });
                toast.success("Custom field added");
              })
            }
          >
            + Add custom field
          </button>
        </section>
      )}

      {tab === "payments" && (
        <section className="space-y-4">
          <ul className="divide-y rounded-lg border">
            {props.paymentMethods.map((m) => (
              <li key={m.id} className="flex items-center justify-between p-3 text-sm">
                <span className="font-medium">{m.name}</span>
                <span className="text-muted-foreground">
                  {m.type}
                  {m.isDefault ? " · default" : ""}
                </span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white"
            onClick={() =>
              startTransition(async () => {
                await addPaymentMethod({ name: "Cheque", type: "OTHER" });
                toast.success("Payment method added");
              })
            }
          >
            + Add payment method
          </button>
        </section>
      )}

      {tab === "memberships" && (
        <section className="space-y-4">
          <ul className="divide-y rounded-lg border">
            {props.membershipPlans.map((p) => (
              <li key={p.id} className="p-3 text-sm">
                <p className="font-medium">{p.name}</p>
                <p className="text-muted-foreground">
                  {props.tenant?.currency} {p.price} · {p.discountPercent}% discount ·{" "}
                  {p._count?.members ?? 0} members
                </p>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white"
            onClick={() =>
              startTransition(async () => {
                await createMembershipPlan({
                  name: "Annual Care Plan",
                  price: 999,
                  duration: "ANNUAL",
                  discountPercent: 10,
                });
                toast.success("Membership plan created");
              })
            }
          >
            + Add membership plan
          </button>
        </section>
      )}

      {tab === "corporate" && (
        <section className="space-y-4">
          <ul className="divide-y rounded-lg border">
            {props.corporateAccounts.map((a) => (
              <li key={a.id} className="p-3 text-sm">
                <p className="font-medium">{a.companyName}</p>
                <p className="text-muted-foreground">
                  {a.discountPercent}% discount · {a._count?.patients ?? 0} patients
                </p>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white"
            onClick={() =>
              startTransition(async () => {
                await createCorporateAccount({
                  companyName: "New Corporate Account",
                  discountPercent: 5,
                  invoicingCycle: "MONTHLY",
                });
                toast.success("Corporate account created");
              })
            }
          >
            + Add corporate account
          </button>
        </section>
      )}

      {tab === "referrals" && (
        <section className="space-y-4">
          <ul className="divide-y rounded-lg border">
            {props.referralContacts.map((r) => (
              <li key={r.id} className="p-3 text-sm">
                <p className="font-medium">{r.name}</p>
                <p className="text-muted-foreground">
                  {r.type}
                  {r.specialty ? ` · ${r.specialty}` : ""}
                  {r.phone ? ` · ${r.phone}` : ""}
                </p>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white"
            onClick={() =>
              startTransition(async () => {
                await addReferralContact({
                  type: "SPECIALIST",
                  name: "New referral contact",
                });
                toast.success("Referral contact added");
              })
            }
          >
            + Add referral contact
          </button>
        </section>
      )}
    </div>
  );
}
