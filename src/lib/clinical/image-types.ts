export type ImageType =
  | "OPG"
  | "CBCT"
  | "BITEWING"
  | "PERIAPICAL"
  | "OCCLUSAL"
  | "CEPHALOMETRIC"
  | "PHOTO"
  | "OTHER";

export type Quadrant = "UL" | "UR" | "LL" | "LR" | "FULL";

export type Annotation = {
  id: string;
  type: "arrow" | "text" | "rect" | "circle" | "measure";
  x: number;
  y: number;
  x2?: number;
  y2?: number;
  text?: string;
  color: string;
  createdAt: string;
};

export const IMAGE_TYPE_CONFIG: Record<
  ImageType,
  {
    label: string;
    icon: string;
    description: string;
    acceptedFormats: string[];
  }
> = {
  OPG: {
    label: "OPG / Panoramic",
    icon: "🦷",
    description: "Full mouth panoramic radiograph",
    acceptedFormats: ["image/jpeg", "image/png", "image/tiff"],
  },
  CBCT: {
    label: "CBCT",
    icon: "🔬",
    description: "Cone beam computed tomography",
    acceptedFormats: ["image/jpeg", "image/png", "application/dicom"],
  },
  BITEWING: {
    label: "Bitewing",
    icon: "📷",
    description: "Interproximal bitewing radiograph",
    acceptedFormats: ["image/jpeg", "image/png"],
  },
  PERIAPICAL: {
    label: "Periapical",
    icon: "🎯",
    description: "Periapical radiograph",
    acceptedFormats: ["image/jpeg", "image/png"],
  },
  OCCLUSAL: {
    label: "Occlusal",
    icon: "⭕",
    description: "Occlusal radiograph",
    acceptedFormats: ["image/jpeg", "image/png"],
  },
  CEPHALOMETRIC: {
    label: "Cephalometric",
    icon: "🧠",
    description: "Lateral cephalometric radiograph",
    acceptedFormats: ["image/jpeg", "image/png"],
  },
  PHOTO: {
    label: "Clinical Photo",
    icon: "📸",
    description: "Intraoral or extraoral photograph",
    acceptedFormats: ["image/jpeg", "image/png", "image/webp"],
  },
  OTHER: {
    label: "Other",
    icon: "📁",
    description: "Other clinical image",
    acceptedFormats: ["image/jpeg", "image/png", "image/tiff"],
  },
};

export const ANNOTATION_COLORS = [
  "#ef4444",
  "#3b82f6",
  "#22c55e",
  "#eab308",
  "#a855f7",
  "#f97316",
  "#ffffff",
];

export function parseAnnotations(value: unknown): Annotation[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is Annotation =>
      typeof item === "object" &&
      item != null &&
      typeof (item as Annotation).id === "string" &&
      typeof (item as Annotation).type === "string",
  );
}

export type PhotoCategory =
  | "FRONTAL_SMILE"
  | "FRONTAL_REST"
  | "RIGHT_LATERAL"
  | "LEFT_LATERAL"
  | "UPPER_OCCLUSAL"
  | "LOWER_OCCLUSAL"
  | "RIGHT_BUCCAL"
  | "LEFT_BUCCAL"
  | "ANTERIOR_RETRACTED"
  | "CLOSEUP"
  | "BEFORE"
  | "AFTER"
  | "CUSTOM";

export const PHOTO_CATEGORY_CONFIG: Record<
  PhotoCategory,
  {
    label: string;
    icon: string;
    description: string;
    isExtraoral: boolean;
  }
> = {
  FRONTAL_SMILE: {
    label: "Frontal (smile)",
    icon: "😊",
    description: "Full face smiling",
    isExtraoral: true,
  },
  FRONTAL_REST: {
    label: "Frontal (rest)",
    icon: "😐",
    description: "Full face at rest",
    isExtraoral: true,
  },
  RIGHT_LATERAL: {
    label: "Right lateral",
    icon: "👤",
    description: "Right profile",
    isExtraoral: true,
  },
  LEFT_LATERAL: {
    label: "Left lateral",
    icon: "👤",
    description: "Left profile",
    isExtraoral: true,
  },
  UPPER_OCCLUSAL: {
    label: "Upper occlusal",
    icon: "⬆️",
    description: "Upper arch from above",
    isExtraoral: false,
  },
  LOWER_OCCLUSAL: {
    label: "Lower occlusal",
    icon: "⬇️",
    description: "Lower arch from below",
    isExtraoral: false,
  },
  RIGHT_BUCCAL: {
    label: "Right buccal",
    icon: "→",
    description: "Right side teeth",
    isExtraoral: false,
  },
  LEFT_BUCCAL: {
    label: "Left buccal",
    icon: "←",
    description: "Left side teeth",
    isExtraoral: false,
  },
  ANTERIOR_RETRACTED: {
    label: "Anterior retracted",
    icon: "🦷",
    description: "Front teeth retracted",
    isExtraoral: false,
  },
  CLOSEUP: {
    label: "Close-up",
    icon: "🔍",
    description: "Specific tooth or area",
    isExtraoral: false,
  },
  BEFORE: {
    label: "Before",
    icon: "1️⃣",
    description: "Before treatment",
    isExtraoral: false,
  },
  AFTER: {
    label: "After",
    icon: "2️⃣",
    description: "After treatment",
    isExtraoral: false,
  },
  CUSTOM: {
    label: "Custom",
    icon: "📷",
    description: "Other clinical photo",
    isExtraoral: false,
  },
};

export const STANDARD_PHOTO_SERIES: PhotoCategory[] = [
  "FRONTAL_SMILE",
  "FRONTAL_REST",
  "RIGHT_LATERAL",
  "LEFT_LATERAL",
  "UPPER_OCCLUSAL",
  "LOWER_OCCLUSAL",
  "RIGHT_BUCCAL",
  "LEFT_BUCCAL",
  "ANTERIOR_RETRACTED",
];

export function parseImageIds(value: string | unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((id): id is string => typeof id === "string");
  }
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}
