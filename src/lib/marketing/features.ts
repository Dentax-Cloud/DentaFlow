import type { LucideIcon } from "lucide-react";
import {
  Stethoscope,
  CalendarClock,
  Brain,
  Users,
  Receipt,
  Shield,
} from "lucide-react";

export type FeatureSlug =
  | "odontogram"
  | "scheduling"
  | "ai-assistant"
  | "patient-portal"
  | "billing"
  | "security";

export type FeatureSummary = {
  slug: FeatureSlug;
  href: string;
  title: string;
  shortDescription: string;
  icon: LucideIcon;
  accent: string;
};

export type FeatureDetail = FeatureSummary & {
  metaDescription: string;
  heroSubtitle: string;
  overview: string;
  benefits: string[];
  capabilities: { title: string; description: string }[];
  highlights: string[];
};

export const FEATURE_SUMMARIES: FeatureSummary[] = [
  {
    slug: "odontogram",
    href: "/features/odontogram",
    title: "Interactive Odontogram",
    shortDescription:
      "FDI & Universal charting with surface-level conditions, treatment overlays, and visual case planning.",
    icon: Stethoscope,
    accent: "from-sky-500/20 to-cyan-500/5",
  },
  {
    slug: "scheduling",
    href: "/features/scheduling",
    title: "Smart Scheduling",
    shortDescription:
      "Drag-and-drop calendar, real-time chair board, reminders, and no-show risk signals.",
    icon: CalendarClock,
    accent: "from-blue-500/20 to-indigo-500/5",
  },
  {
    slug: "ai-assistant",
    href: "/features/ai-assistant",
    title: "AI Clinical Assistant",
    shortDescription:
      "SOAP notes, treatment suggestions, churn prediction, and analytics — with clinical guardrails.",
    icon: Brain,
    accent: "from-violet-500/20 to-purple-500/5",
  },
  {
    slug: "patient-portal",
    href: "/features/patient-portal",
    title: "Patient 360°",
    shortDescription:
      "Complete patient view — history, alerts, documents, treatment plans, and self-service portal.",
    icon: Users,
    accent: "from-emerald-500/20 to-teal-500/5",
  },
  {
    slug: "billing",
    href: "/features/billing",
    title: "Billing & Finance",
    shortDescription:
      "Invoicing, Stripe payments, insurance policies, and revenue analytics for your clinic.",
    icon: Receipt,
    accent: "from-amber-500/20 to-orange-500/5",
  },
  {
    slug: "security",
    href: "/features/security",
    title: "Multi-Tenant Security",
    shortDescription:
      "Clerk auth, strict tenant isolation, RBAC, audit logs, and super-admin platform control.",
    icon: Shield,
    accent: "from-rose-500/20 to-pink-500/5",
  },
];

export const FEATURE_DETAILS: Record<FeatureSlug, FeatureDetail> = {
  odontogram: {
    ...FEATURE_SUMMARIES[0],
    metaDescription:
      "Professional interactive odontogram with FDI and Universal notation, color-coded conditions, and AI-assisted clinical notes.",
    heroSubtitle: "Chart teeth with precision. Plan treatments visually.",
    overview:
      "DentaFlow's interactive odontogram gives dentists a fast, accurate view of every tooth — with support for FDI and Universal notation, surface-level findings, and seamless integration with treatment plans and AI clinical notes.",
    benefits: [
      "Reduce charting time with intuitive tooth-level workflows",
      "Improve case acceptance with visual treatment storytelling",
      "Maintain consistent records across providers and branches",
      "Connect chart findings directly to billing and treatment items",
    ],
    capabilities: [
      {
        title: "FDI & Universal notation",
        description: "Switch between international standards without re-charting.",
      },
      {
        title: "Color-coded conditions",
        description: "Caries, crowns, implants, missing teeth, RCT, perio pockets, and more.",
      },
      {
        title: "Surface-level detail",
        description: "Mesial, occlusal, distal, and other surfaces mapped per finding.",
      },
      {
        title: "AI-assisted notes",
        description: "Generate SOAP summaries from charted findings in one click.",
      },
    ],
    highlights: ["Tooth-level history", "Treatment overlays", "Patient 360 sync"],
  },
  scheduling: {
    ...FEATURE_SUMMARIES[1],
    metaDescription:
      "Smart dental scheduling with drag-and-drop calendar, chair board, and automated patient reminders.",
    heroSubtitle: "Fill chairs. Reduce no-shows. Run a smoother day.",
    overview:
      "Coordinate providers, operatories, and patients from a single scheduling hub. DentaFlow combines a week-view calendar with a live chair board so front desk and clinical teams stay aligned in real time.",
    benefits: [
      "Maximize chair utilization with visual chair management",
      "Reschedule appointments with drag-and-drop speed",
      "Flag high no-show risk patients before they miss visits",
      "Keep teams synced with optional real-time Pusher updates",
    ],
    capabilities: [
      {
        title: "Drag & drop calendar",
        description: "Week, day, and agenda views with quick reschedule actions.",
      },
      {
        title: "Chair board",
        description: "See which chair is active, available, or awaiting turnover.",
      },
      {
        title: "Status workflow",
        description: "Scheduled → Confirmed → Arrived → In Chair → Completed.",
      },
      {
        title: "Smart reminders",
        description: "SMS, email, and WhatsApp reminder hooks for your CRM stack.",
      },
    ],
    highlights: ["Multi-provider views", "Branch-aware scheduling", "Risk signals"],
  },
  "ai-assistant": {
    ...FEATURE_SUMMARIES[2],
    metaDescription:
      "AI clinical assistant for dental practices — treatment suggestions, voice-ready notes, and predictive patient insights.",
    heroSubtitle: "Clinical intelligence that respects your workflow.",
    overview:
      "DentaFlow embeds AI where dentists actually work — inside charting, notes, and analytics. Generate structured clinical documentation, explore treatment options, and surface patients who may churn or no-show.",
    benefits: [
      "Cut documentation time without sacrificing clinical quality",
      "Get evidence-style treatment suggestions tied to chart data",
      "Identify at-risk patients before they disengage",
      "Summarize practice performance in plain language",
    ],
    capabilities: [
      {
        title: "SOAP note generation",
        description: "Structured subjective, objective, assessment, and plan drafts.",
      },
      {
        title: "Treatment suggestions",
        description: "Phase-based proposals with cost estimates from your catalog.",
      },
      {
        title: "Churn & no-show prediction",
        description: "Risk levels surfaced on patient and appointment records.",
      },
      {
        title: "Analytics summaries",
        description: "Natural-language insights for owners and office managers.",
      },
    ],
    highlights: ["Plan-gated on Professional+", "Audit-friendly outputs", "Tenant-scoped AI"],
  },
  "patient-portal": {
    ...FEATURE_SUMMARIES[3],
    metaDescription:
      "Patient 360 view with medical alerts, treatment history, documents, and a secure self-service patient portal.",
    heroSubtitle: "Every patient detail. One trusted view.",
    overview:
      "Patient 360° unifies demographics, medical alerts, allergies, appointments, treatment plans, documents, and portal access into a single profile designed for front desk, clinicians, and patients alike.",
    benefits: [
      "Spot allergies and medical alerts before every procedure",
      "Track treatment plan acceptance and progress over time",
      "Give patients a branded portal for appointments and invoices",
      "Reduce phone calls with self-service clinic selection",
    ],
    capabilities: [
      {
        title: "Unified patient profile",
        description: "Overview, clinical, billing, and documents in one workspace.",
      },
      {
        title: "Medical & dental history",
        description: "Structured JSON history with emergency contacts and medications.",
      },
      {
        title: "Patient portal",
        description: "Secure Clerk-powered access to appointments, invoices, and plans.",
      },
      {
        title: "Recalls & engagement",
        description: "Hygiene recalls with priority and churn risk indicators.",
      },
    ],
    highlights: ["Portal branding per clinic", "Attachment storage", "Recall automation"],
  },
  billing: {
    ...FEATURE_SUMMARIES[4],
    metaDescription:
      "Dental practice billing — invoicing, Stripe payments, insurance policies, and revenue tracking in DentaFlow.",
    heroSubtitle: "Get paid faster. Understand your revenue.",
    overview:
      "Manage the financial side of your clinic with procedure-linked invoices, partial payments, insurance policies, and Stripe checkout — all tenant-scoped and separate from your DentaFlow SaaS subscription.",
    benefits: [
      "Create invoices from completed procedures in seconds",
      "Accept card payments via Stripe payment links",
      "Track partial, paid, and overdue balances at a glance",
      "Prepare for insurance workflows with policy records",
    ],
    capabilities: [
      {
        title: "Procedure catalog",
        description: "Standardized codes and pricing for consistent billing.",
      },
      {
        title: "Invoice lifecycle",
        description: "Draft → Sent → Partial → Paid → Overdue with line items.",
      },
      {
        title: "Stripe integration",
        description: "One-time patient payments with webhook reconciliation.",
      },
      {
        title: "Revenue visibility",
        description: "Payment history and analytics for practice owners.",
      },
    ],
    highlights: ["Multi-currency settings", "AED-ready defaults", "Audit trail"],
  },
  security: {
    ...FEATURE_SUMMARIES[5],
    metaDescription:
      "Enterprise multi-tenant security for dental SaaS — Clerk organizations, tenant isolation, RBAC, and super-admin controls.",
    heroSubtitle: "Enterprise isolation. Platform oversight.",
    overview:
      "Every clinic on DentaFlow runs in a fully isolated tenant backed by Clerk Organizations and row-level PostgreSQL scoping. Platform operators get super-admin tools without compromising clinic data boundaries.",
    benefits: [
      "Guarantee clinic data never leaks across tenants",
      "Control staff access with role-based permissions",
      "Review audit logs for compliance and accountability",
      "Suspend, activate, or impersonate tenants from super-admin",
    ],
    capabilities: [
      {
        title: "Clerk Organizations",
        description: "One org per clinic — the source of truth for tenancy.",
      },
      {
        title: "Row-level isolation",
        description: "Every query scoped by tenantId with server-side enforcement.",
      },
      {
        title: "RBAC & audit logs",
        description: "Owner, dentist, hygienist, receptionist roles with activity history.",
      },
      {
        title: "Super-admin dashboard",
        description: "Cross-tenant analytics, lifecycle controls, and safe impersonation.",
      },
    ],
    highlights: ["HIPAA-ready architecture", "Trial & plan gating", "SOC2-minded design"],
  },
};

export function getFeatureBySlug(slug: FeatureSlug): FeatureDetail {
  return FEATURE_DETAILS[slug];
}
