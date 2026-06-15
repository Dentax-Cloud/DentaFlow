export const IMPORT_TEMPLATES = {
  patients: {
    filename: "dentaflow-patients-template.csv",
    headers: [
      "patient_number",
      "first_name",
      "last_name",
      "email",
      "phone",
      "date_of_birth",
      "gender",
      "address",
      "allergies",
      "medications",
      "notes",
    ],
    sample: [
      [
        "P000001",
        "Sarah",
        "Ahmed",
        "sarah@example.com",
        "+971501234567",
        "1985-03-12",
        "female",
        "Dubai Marina",
        "Penicillin; Latex",
        "Ibuprofen",
        "Prefers morning appointments",
      ],
    ],
  },
  inventory: {
    filename: "dentaflow-inventory-template.csv",
    headers: [
      "sku",
      "name",
      "category",
      "unit",
      "quantity",
      "reorder_level",
      "cost",
      "batch_number",
      "expiry_date",
    ],
    sample: [
      ["GLV-SM", "Nitrile gloves (S)", "Consumables", "box", "50", "20", "12.50", "BATCH-001", "2027-06-01"],
    ],
  },
  procedures: {
    filename: "dentaflow-procedures-template.csv",
    headers: ["code", "name", "description", "category", "price", "duration_minutes"],
    sample: [
      ["D1110", "Adult prophylaxis", "Routine cleaning", "Preventive", "150", "45"],
      ["D2391", "Composite filling", "One surface posterior", "Restorative", "220", "60"],
    ],
  },
} as const;

export type ImportKind = keyof typeof IMPORT_TEMPLATES;
