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
