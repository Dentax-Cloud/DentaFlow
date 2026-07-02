import ExcelJS from "exceljs";
import { getCountryProfile } from "@/lib/countries";
import type { CountryProfile } from "@/lib/countries/types";
import { db } from "@/lib/db";

export type ImportEntity = "PATIENT" | "INVENTORY" | "STAFF" | "PROCEDURE";

type ColumnDef = {
  key: string;
  header: string;
  headerAr?: string;
  mandatory: boolean;
  type: "text" | "date" | "select" | "number" | "phone" | "email";
  options?: string[];
  validation?: string;
  example?: string;
  hint?: string;
  section: "CORE" | "IDENTITY" | "CONTACT" | "INSURANCE" | "MEDICAL" | "CUSTOM";
  countrySpecific?: string[];
};

type CustomFieldRow = {
  fieldKey: string;
  fieldLabel: string;
  fieldType: string;
  isRequired: boolean;
  options?: unknown;
};

function mapCustomFieldType(fieldType: string): ColumnDef["type"] {
  switch (fieldType.toUpperCase()) {
    case "NUMBER":
      return "number";
    case "DATE":
      return "date";
    case "SELECT":
    case "MULTISELECT":
      return "select";
    case "PHONE":
      return "phone";
    case "EMAIL":
      return "email";
    default:
      return "text";
  }
}

function parseCustomFieldOptions(options: unknown): string[] | undefined {
  if (!Array.isArray(options)) return undefined;
  return options.map((o) => {
    if (typeof o === "string") return o;
    if (o && typeof o === "object" && "label" in o) {
      return String((o as { label: string }).label);
    }
    return String(o);
  });
}

function getPatientColumns(profile: CountryProfile, customFields: CustomFieldRow[]): ColumnDef[] {
  const cols: ColumnDef[] = [];

  if (profile.nameFormat === "GCC_FOUR_PART") {
    cols.push(
      {
        key: "firstName",
        header: "First Name",
        headerAr: "الاسم الأول",
        mandatory: true,
        type: "text",
        example: "Ahmed",
        section: "CORE",
      },
      {
        key: "fatherName",
        header: "Father's Name",
        headerAr: "اسم الأب",
        mandatory: true,
        type: "text",
        example: "Mohammed",
        section: "CORE",
      },
      {
        key: "grandfatherName",
        header: "Grandfather's Name",
        headerAr: "اسم الجد",
        mandatory: false,
        type: "text",
        example: "Abdullah",
        section: "CORE",
      },
      {
        key: "lastName",
        header: "Family Name",
        headerAr: "اسم العائلة",
        mandatory: true,
        type: "text",
        example: "Al-Rashidi",
        section: "CORE",
      },
    );
  } else if (profile.nameFormat === "INDIAN") {
    cols.push(
      {
        key: "firstName",
        header: "First Name",
        mandatory: true,
        type: "text",
        example: "Rajesh",
        section: "CORE",
      },
      {
        key: "lastName",
        header: "Last Name",
        mandatory: true,
        type: "text",
        example: "Kumar",
        section: "CORE",
      },
      {
        key: "fatherName",
        header: "Father's Name",
        mandatory: false,
        type: "text",
        example: "Suresh",
        section: "CORE",
      },
    );
  } else {
    cols.push(
      {
        key: "firstName",
        header: "First Name",
        mandatory: true,
        type: "text",
        example: "John",
        section: "CORE",
      },
      {
        key: "middleName",
        header: "Middle Name",
        mandatory: false,
        type: "text",
        example: "Michael",
        section: "CORE",
      },
      {
        key: "lastName",
        header: "Last Name",
        mandatory: true,
        type: "text",
        example: "Smith",
        section: "CORE",
      },
    );
  }

  cols.push(
    {
      key: "dateOfBirth",
      header: `Date of Birth (${profile.dateFormat})`,
      mandatory: true,
      type: "date",
      example: profile.dateFormat === "MM/DD/YYYY" ? "03/15/1985" : "15/03/1985",
      hint: `Use format: ${profile.dateFormat}`,
      section: "CORE",
    },
    {
      key: "gender",
      header: "Gender",
      mandatory: true,
      type: "select",
      options: ["Male", "Female", "Other"],
      example: "Male",
      section: "CORE",
    },
  );

  for (const doc of profile.identityDocuments) {
    cols.push({
      key: `idDoc_${doc.key}`,
      header: doc.label,
      headerAr: doc.labelAr,
      mandatory: doc.mandatory,
      type: "text",
      example: doc.example,
      hint: `Format: ${doc.format}`,
      validation: doc.regexStr,
      section: "IDENTITY",
    });
  }

  if (
    profile.mandatoryPatientFields.includes("nationality") ||
    profile.optionalPatientFields.includes("nationality")
  ) {
    cols.push({
      key: "nationality",
      header: "Nationality",
      mandatory: profile.mandatoryPatientFields.includes("nationality"),
      type: "text",
      example: profile.code === "AE" ? "Indian" : "British",
      hint: "Country name or ISO code",
      section: "IDENTITY",
    });
  }

  cols.push(
    {
      key: "phone",
      header: `Phone (${profile.dialCode})`,
      mandatory: true,
      type: "phone",
      example: profile.phoneExample,
      hint: `Include country code: ${profile.dialCode}`,
      section: "CONTACT",
    },
    {
      key: "email",
      header: "Email",
      mandatory: false,
      type: "email",
      example: "patient@email.com",
      section: "CONTACT",
    },
    {
      key: "emergencyContactName",
      header: "Emergency Contact Name",
      mandatory: false,
      type: "text",
      example: "Sara Ahmed",
      section: "CONTACT",
    },
    {
      key: "emergencyContactPhone",
      header: "Emergency Contact Phone",
      mandatory: false,
      type: "phone",
      example: profile.phoneExample,
      section: "CONTACT",
    },
  );

  if (profile.insuranceProviders.length > 0) {
    const providerOptions = profile.insuranceProviders.map((p) => p.name);
    cols.push(
      {
        key: "insuranceProvider",
        header: "Insurance Provider",
        mandatory: profile.insuranceMandatory,
        type: "select",
        options: providerOptions,
        example: providerOptions[0] ?? "Self Pay",
        section: "INSURANCE",
      },
      {
        key: "insuranceNetwork",
        header: "Insurance Network",
        mandatory: false,
        type: "text",
        example: profile.insuranceProviders[0]?.networkTypes[0]?.name ?? "Standard",
        section: "INSURANCE",
      },
      {
        key: "insuranceMemberId",
        header: "Insurance Member ID",
        mandatory: false,
        type: "text",
        example: "MEM123456",
        section: "INSURANCE",
      },
      {
        key: "insurancePolicyNo",
        header: "Policy Number",
        mandatory: false,
        type: "text",
        example: "POL-2024-001",
        section: "INSURANCE",
      },
      {
        key: "insuranceExpiry",
        header: `Insurance Expiry (${profile.dateFormat})`,
        mandatory: false,
        type: "date",
        example: profile.dateFormat === "MM/DD/YYYY" ? "12/31/2025" : "31/12/2025",
        section: "INSURANCE",
      },
    );
  }

  cols.push(
    {
      key: "bloodGroup",
      header: "Blood Group",
      mandatory: false,
      type: "select",
      options: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"],
      example: "O+",
      section: "MEDICAL",
    },
    {
      key: "allergies",
      header: "Allergies",
      mandatory: false,
      type: "text",
      example: "Penicillin, Latex",
      hint: "Separate multiple allergies with commas",
      section: "MEDICAL",
    },
    {
      key: "medicalNotes",
      header: "Medical Notes",
      mandatory: false,
      type: "text",
      example: "Diabetic, on Metformin",
      section: "MEDICAL",
    },
  );

  if (profile.optionalPatientFields.includes("occupation")) {
    cols.push({
      key: "occupation",
      header: "Occupation",
      mandatory: false,
      type: "text",
      example: "Engineer",
      section: "CORE",
    });
  }

  for (const cf of customFields) {
    cols.push({
      key: `custom_${cf.fieldKey}`,
      header: cf.fieldLabel,
      mandatory: cf.isRequired,
      type: mapCustomFieldType(cf.fieldType),
      options: parseCustomFieldOptions(cf.options),
      example: "",
      section: "CUSTOM",
    });
  }

  return cols;
}

export async function generateImportTemplate(
  entity: ImportEntity,
  tenantId: string,
): Promise<Buffer> {
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: { countryCode: true, name: true, currency: true },
  });

  const countryCode = tenant?.countryCode ?? "AE";
  const profile = getCountryProfile(countryCode);

  let columns: ColumnDef[] = [];

  if (entity === "PATIENT") {
    const customFields = await db.tenantCustomField.findMany({
      where: { tenantId, entity: "PATIENT", isActive: true },
      select: {
        fieldKey: true,
        fieldLabel: true,
        fieldType: true,
        isRequired: true,
        options: true,
      },
      orderBy: { sortOrder: "asc" },
    });
    columns = getPatientColumns(profile, customFields);
  } else if (entity === "INVENTORY") {
    columns = [
      {
        key: "name",
        header: "Item Name",
        mandatory: true,
        type: "text",
        example: "Disposable Gloves (M)",
        section: "CORE",
      },
      {
        key: "itemRef",
        header: "Internal Code",
        mandatory: false,
        type: "text",
        example: "GLV-M-001",
        section: "CORE",
      },
      {
        key: "category",
        header: "Category",
        mandatory: true,
        type: "select",
        options: ["CONSUMABLE", "MEDICATION", "EQUIPMENT", "MATERIAL", "RETAIL"],
        example: "CONSUMABLE",
        section: "CORE",
      },
      {
        key: "unit",
        header: "Unit",
        mandatory: true,
        type: "text",
        example: "BOX",
        section: "CORE",
      },
      {
        key: "currentStock",
        header: "Opening Stock",
        mandatory: false,
        type: "number",
        example: "50",
        section: "CORE",
      },
      {
        key: "minimumStock",
        header: "Minimum Stock",
        mandatory: false,
        type: "number",
        example: "10",
        section: "CORE",
      },
      {
        key: "maximumStock",
        header: "Maximum Stock",
        mandatory: false,
        type: "number",
        example: "100",
        section: "CORE",
      },
      {
        key: "costPrice",
        header: `Cost Price (${tenant?.currency ?? "AED"})`,
        mandatory: false,
        type: "number",
        example: "12.50",
        section: "CORE",
      },
      {
        key: "sellingPrice",
        header: `Selling Price (${tenant?.currency ?? "AED"})`,
        mandatory: false,
        type: "number",
        example: "25.00",
        section: "CORE",
      },
      {
        key: "supplierName",
        header: "Supplier Name",
        mandatory: false,
        type: "text",
        example: "Medical Supplies LLC",
        section: "CORE",
      },
      {
        key: "supplierBarcode",
        header: "Supplier Barcode",
        mandatory: false,
        type: "text",
        example: "5012345678900",
        section: "CORE",
      },
      {
        key: "storageLocation",
        header: "Storage Location",
        mandatory: false,
        type: "text",
        example: "Shelf A3, Bin 2",
        section: "CORE",
      },
      {
        key: "expiryDate",
        header: `Expiry Date (${profile.dateFormat})`,
        mandatory: false,
        type: "date",
        example: "31/12/2026",
        section: "CORE",
      },
    ];
  } else if (entity === "STAFF") {
    columns = [
      {
        key: "firstName",
        header: "First Name",
        mandatory: true,
        type: "text",
        example: "Ahmed",
        section: "CORE",
      },
      {
        key: "lastName",
        header: "Last Name",
        mandatory: true,
        type: "text",
        example: "Al-Rashidi",
        section: "CORE",
      },
      {
        key: "email",
        header: "Email",
        mandatory: true,
        type: "email",
        example: "doctor@clinic.com",
        section: "CONTACT",
      },
      {
        key: "phone",
        header: "Phone",
        mandatory: false,
        type: "phone",
        example: profile.phoneExample,
        section: "CONTACT",
      },
      {
        key: "role",
        header: "Role",
        mandatory: true,
        type: "select",
        options: ["DOCTOR", "HYGIENIST", "RECEPTIONIST", "NURSE", "ADMIN"],
        example: "DOCTOR",
        section: "CORE",
      },
      {
        key: "licenseNumber",
        header: "License Number",
        mandatory: false,
        type: "text",
        example: profile.code === "AE" ? "DHA-D-12345" : "GDC-123456",
        section: "CORE",
      },
      {
        key: "specialization",
        header: "Specialization",
        mandatory: false,
        type: "text",
        example: "Orthodontist",
        section: "CORE",
      },
      {
        key: "joinDate",
        header: `Join Date (${profile.dateFormat})`,
        mandatory: false,
        type: "date",
        example: "01/01/2025",
        section: "CORE",
      },
      {
        key: "branchName",
        header: "Branch",
        mandatory: false,
        type: "text",
        example: "Main Office",
        section: "CORE",
      },
    ];
  } else if (entity === "PROCEDURE") {
    columns = [
      {
        key: "code",
        header: "Procedure Code",
        mandatory: true,
        type: "text",
        example: "D1110",
        section: "CORE",
      },
      {
        key: "name",
        header: "Procedure Name",
        mandatory: true,
        type: "text",
        example: "Adult prophylaxis",
        section: "CORE",
      },
      {
        key: "description",
        header: "Description",
        mandatory: false,
        type: "text",
        example: "Routine cleaning",
        section: "CORE",
      },
      {
        key: "category",
        header: "Category",
        mandatory: false,
        type: "text",
        example: "Preventive",
        section: "CORE",
      },
      {
        key: "price",
        header: `Price (${tenant?.currency ?? "AED"})`,
        mandatory: true,
        type: "number",
        example: "150",
        section: "CORE",
      },
      {
        key: "durationMinutes",
        header: "Duration (minutes)",
        mandatory: false,
        type: "number",
        example: "45",
        section: "CORE",
      },
    ];
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "DentaFlow";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(entity, {
    views: [{ state: "frozen", ySplit: 2 }],
  });

  const sectionColors: Record<string, string> = {
    CORE: "FF2196F3",
    IDENTITY: "FF9C27B0",
    CONTACT: "FF4CAF50",
    INSURANCE: "FFFF9800",
    MEDICAL: "FFF44336",
    CUSTOM: "FF009688",
  };

  sheet.columns = columns.map((col) => ({
    key: col.key,
    width:
      col.type === "date"
        ? 18
        : col.key.includes("Name")
          ? 20
          : col.section === "CUSTOM"
            ? 22
            : 18,
  }));

  let currentSection = "";
  let sectionStart = 1;
  const sectionMerges: Array<{ start: number; end: number; section: string }> = [];

  columns.forEach((col, i) => {
    if (col.section !== currentSection) {
      if (currentSection) {
        sectionMerges.push({
          start: sectionStart,
          end: i,
          section: currentSection,
        });
      }
      currentSection = col.section;
      sectionStart = i + 1;
    }
  });
  sectionMerges.push({
    start: sectionStart,
    end: columns.length,
    section: currentSection,
  });

  const sectionLabels: Record<string, string> = {
    CORE: "Core Information",
    IDENTITY: "Identity Documents",
    CONTACT: "Contact Details",
    INSURANCE: "Insurance Information",
    MEDICAL: "Medical Information",
    CUSTOM: "Custom Fields",
  };

  const row1 = sheet.getRow(1);
  sectionMerges.forEach(({ start, end, section }) => {
    if (start < end) {
      sheet.mergeCells(1, start, 1, end);
    }
    const cell = row1.getCell(start);
    cell.value = sectionLabels[section] ?? section;
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: sectionColors[section] ?? "FF607D8B" },
    };
    cell.font = { color: { argb: "FFFFFFFF" }, bold: true, size: 10 };
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });
  row1.height = 22;

  const row2 = sheet.getRow(2);
  columns.forEach((col, i) => {
    const cell = row2.getCell(i + 1);
    const label = col.mandatory ? `${col.header} *` : col.header;
    cell.value = label;
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: col.mandatory ? "FFEF5350" : "FF90CAF9" },
    };
    cell.font = {
      bold: true,
      size: 9,
      color: { argb: col.mandatory ? "FFFFFFFF" : "FF0D47A1" },
    };
    cell.alignment = { wrapText: true, vertical: "middle" };

    if (col.hint) {
      cell.note = col.hint;
    }
  });
  row2.height = 30;

  const exampleRow = sheet.getRow(3);
  columns.forEach((col, i) => {
    const cell = exampleRow.getCell(i + 1);
    cell.value = col.example ?? "";
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF5F5F5" },
    };
    cell.font = { italic: true, color: { argb: "FF9E9E9E" }, size: 9 };
  });
  exampleRow.height = 18;

  columns.forEach((col, i) => {
    if (col.type === "select" && col.options) {
      const formula = `"${col.options.join(",")}"`;
      for (let row = 4; row <= 1003; row++) {
        sheet.getCell(row, i + 1).dataValidation = {
          type: "list",
          allowBlank: !col.mandatory,
          formulae: [formula],
          showErrorMessage: true,
          errorTitle: "Invalid value",
          error: `Please select from: ${col.options.join(", ")}`,
        };
      }
    }
  });

  const infoSheet = workbook.addWorksheet("Instructions");
  infoSheet.columns = [
    { key: "topic", width: 25 },
    { key: "info", width: 70 },
  ];

  const infoRows: Array<[string, string]> = [
    ["DentaFlow Data Import", `${entity} Import Template`],
    ["Clinic", tenant?.name ?? ""],
    ["Country", `${profile.name} (${profile.code})`],
    ["Currency", profile.currency],
    ["Date Format", profile.dateFormat],
    ["Phone Format", `${profile.dialCode} ${profile.phoneFormat}`],
    ["Generated", new Date().toLocaleDateString()],
    ["", ""],
    ["COLUMN COLORS", ""],
    ["Red header (*)", "Mandatory — must be filled"],
    ["Blue header", "Optional — fill if available"],
    ["Teal header", "Custom fields specific to this clinic"],
    ["", ""],
    ["IMPORT MODES", ""],
    ["Create Only", "Only add new patients, skip existing"],
    ["Update Only", "Only update existing patients, skip new"],
    ["Upsert (default)", "Add new + update existing"],
    ["", ""],
    ["DUPLICATE DETECTION", "System matches by (in priority order):"],
    ["1. Primary ID", `${profile.identityDocuments[0]?.label ?? "ID document"} number`],
    ["2. Email", "Exact match on email address"],
    ["3. Phone + DOB", "Both must match"],
    ["4. Name + DOB", "First + Last + Date of Birth (use with caution)"],
    ["", ""],
    ["TIPS", ""],
    ["Dates", `Use ${profile.dateFormat} format throughout`],
    ["Phone numbers", `Include country code: ${profile.dialCode}`],
    ["Multiple allergies", "Separate with commas"],
    ["Row 3", "Example row — delete before importing"],
    ["Errors", "Download error report after import for details"],
    ["Rollback", "Imports can be rolled back within 24 hours"],
  ];

  infoRows.forEach(([topic, info], i) => {
    const row = infoSheet.getRow(i + 1);
    row.getCell(1).value = topic;
    row.getCell(2).value = info;
    if (i === 0) {
      row.getCell(1).font = { bold: true, size: 14, color: { argb: "FF0EA5E9" } };
    } else if (["COLUMN COLORS", "IMPORT MODES", "DUPLICATE DETECTION", "TIPS"].includes(topic)) {
      row.getCell(1).font = { bold: true, size: 11 };
      row.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF0F9FF" },
      };
    }
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
