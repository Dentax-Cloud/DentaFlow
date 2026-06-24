export type TriageLevel = "IMMEDIATE" | "URGENT" | "SEMI_URGENT" | "ROUTINE";
export type EmergencyStatus = "WAITING" | "IN_TRIAGE" | "IN_CHAIR" | "COMPLETED" | "REFERRED";
export type OnsetOption = "TODAY" | "YESTERDAY" | "THIS_WEEK" | "THIS_MONTH" | "LONGER";

export type Vitals = {
  bp?: string;
  pulse?: number;
  temp?: number;
  spo2?: number;
  respRate?: number;
};

export const TRIAGE_CONFIG: Record<
  TriageLevel,
  {
    label: string;
    color: string;
    bgColor: string;
    borderColor: string;
    description: string;
    maxWaitMins: number;
  }
> = {
  IMMEDIATE: {
    label: "Immediate",
    color: "text-red-700",
    bgColor: "bg-red-100",
    borderColor: "border-red-500",
    description: "See immediately — severe pain, trauma, bleeding",
    maxWaitMins: 0,
  },
  URGENT: {
    label: "Urgent",
    color: "text-orange-700",
    bgColor: "bg-orange-100",
    borderColor: "border-orange-400",
    description: "See within 30 minutes — significant pain",
    maxWaitMins: 30,
  },
  SEMI_URGENT: {
    label: "Semi-urgent",
    color: "text-yellow-700",
    bgColor: "bg-yellow-100",
    borderColor: "border-yellow-400",
    description: "See within 2 hours — moderate discomfort",
    maxWaitMins: 120,
  },
  ROUTINE: {
    label: "Routine",
    color: "text-green-700",
    bgColor: "bg-green-100",
    borderColor: "border-green-400",
    description: "Can wait — mild or no pain",
    maxWaitMins: 999,
  },
};

export const STATUS_CONFIG: Record<
  EmergencyStatus,
  {
    label: string;
    color: string;
    nextStatus?: EmergencyStatus;
    nextLabel?: string;
  }
> = {
  WAITING: {
    label: "Waiting",
    color: "bg-yellow-100 text-yellow-800",
    nextStatus: "IN_TRIAGE",
    nextLabel: "Start triage",
  },
  IN_TRIAGE: {
    label: "In triage",
    color: "bg-blue-100 text-blue-800",
    nextStatus: "IN_CHAIR",
    nextLabel: "Move to chair",
  },
  IN_CHAIR: {
    label: "In chair",
    color: "bg-purple-100 text-purple-800",
    nextStatus: "COMPLETED",
    nextLabel: "Complete",
  },
  COMPLETED: {
    label: "Completed",
    color: "bg-green-100 text-green-800",
  },
  REFERRED: {
    label: "Referred",
    color: "bg-gray-100 text-gray-800",
  },
};

export const CHIEF_COMPLAINTS = [
  { value: "TOOTHACHE", label: "Toothache / Pain", icon: "🦷", urgencyScore: 7 },
  { value: "SWELLING", label: "Swelling / Abscess", icon: "😮", urgencyScore: 9 },
  { value: "TRAUMA", label: "Dental trauma / Injury", icon: "🚨", urgencyScore: 10 },
  { value: "BLEEDING", label: "Bleeding / Post-op", icon: "🩸", urgencyScore: 8 },
  { value: "BROKEN_TOOTH", label: "Broken / Chipped tooth", icon: "💔", urgencyScore: 5 },
  { value: "LOST_FILLING", label: "Lost filling / Crown", icon: "⚠️", urgencyScore: 4 },
  { value: "SENSITIVITY", label: "Sensitivity", icon: "🥶", urgencyScore: 3 },
  { value: "ULCER", label: "Mouth ulcer / Sore", icon: "💊", urgencyScore: 3 },
  { value: "ORTHODONTIC", label: "Orthodontic emergency", icon: "🔧", urgencyScore: 4 },
  { value: "DRY_SOCKET", label: "Dry socket", icon: "😣", urgencyScore: 7 },
  { value: "FACIAL_SWELLING", label: "Facial swelling", icon: "😷", urgencyScore: 9 },
  { value: "OTHER", label: "Other", icon: "❓", urgencyScore: 3 },
] as const;

export const ONSET_OPTIONS: Record<OnsetOption, string> = {
  TODAY: "Started today",
  YESTERDAY: "Started yesterday",
  THIS_WEEK: "Started this week",
  THIS_MONTH: "Started this month",
  LONGER: "More than a month ago",
};

export const AGGRAVATING_OPTIONS = [
  "Hot foods/drinks",
  "Cold foods/drinks",
  "Sweet foods",
  "Biting/chewing",
  "Lying down",
  "Pressure on tooth",
  "Spontaneous",
];

export const RELIEVING_OPTIONS = [
  "Painkillers",
  "Cold compress",
  "Warm compress",
  "Nothing helps",
  "Rinsing with water",
];

export const TRIAGE_ORDER: Record<TriageLevel, number> = {
  IMMEDIATE: 0,
  URGENT: 1,
  SEMI_URGENT: 2,
  ROUTINE: 3,
};

export function getComplaintLabel(value: string): string {
  return CHIEF_COMPLAINTS.find((c) => c.value === value)?.label ?? value.replace(/_/g, " ");
}

export function calculateTriageLevel(painScore: number, complaintValue: string): TriageLevel {
  const complaint = CHIEF_COMPLAINTS.find((c) => c.value === complaintValue);
  const urgency = complaint?.urgencyScore ?? 3;
  const score = painScore * 0.6 + urgency * 0.4;

  if (score >= 8.5 || painScore === 10) return "IMMEDIATE";
  if (score >= 6.5) return "URGENT";
  if (score >= 4) return "SEMI_URGENT";
  return "ROUTINE";
}

export function getWaitTimeMinutes(createdAt: Date): number {
  return Math.floor((Date.now() - createdAt.getTime()) / 60000);
}

export function sortByTriagePriority<T extends { triageLevel: string; createdAt: Date | string }>(
  items: T[],
): T[] {
  return [...items].sort((a, b) => {
    const levelDiff =
      (TRIAGE_ORDER[a.triageLevel as TriageLevel] ?? 3) -
      (TRIAGE_ORDER[b.triageLevel as TriageLevel] ?? 3);
    if (levelDiff !== 0) return levelDiff;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}
