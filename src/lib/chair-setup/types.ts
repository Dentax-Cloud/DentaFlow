export type ChairType =
  | "GENERAL"
  | "SPECIALIST"
  | "PAEDIATRIC"
  | "HYGIENE"
  | "ORAL_SURGERY";

export type TrayItemCategory =
  | "CONSUMABLE"
  | "MEDICATION"
  | "MATERIAL"
  | "EQUIPMENT";

export type ChairOperatoryStatus = "ACTIVE" | "INACTIVE" | "MAINTENANCE";

export type ChairDisplayStatus =
  | "INACTIVE"
  | "NOT_SETUP"
  | "SETTING_UP"
  | "READY"
  | "IN_USE"
  | "CLOSED"
  | "ALERT";

export type TrayTemplateItem = {
  inventoryItemId: string;
  itemName: string;
  qty: number;
  unit: string;
  category: TrayItemCategory;
  costPrice?: number;
};

export type SetupItem = TrayTemplateItem & {
  batchId?: string;
};
