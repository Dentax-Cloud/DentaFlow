import { db } from "@/lib/db";

const SAFE_ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ";

function randomSuffix(length: number): string {
  return Array.from({ length }, () =>
    SAFE_ALPHA[Math.floor(Math.random() * SAFE_ALPHA.length)],
  ).join("");
}

export async function generateTenantCode(countryCode: string): Promise<string> {
  const cc = countryCode.toUpperCase().substring(0, 2);

  const result = await db.$queryRaw<Array<{ maxseq: number | null }>>`
    SELECT MAX(
      CAST(SPLIT_PART("tenantCode", '-', 2) AS INTEGER)
    ) AS maxseq
    FROM "Tenant"
    WHERE "tenantCode" LIKE ${cc + "-%"}
    AND "tenantCode" ~ '^[A-Z]{2}-[0-9]{4}-[A-Z]{3}$'
  `;

  const nextSeq = (result[0]?.maxseq ?? 0) + 1;
  const seqPadded = String(nextSeq).padStart(4, "0");

  for (let i = 0; i < 20; i++) {
    const suffix = randomSuffix(3);
    const code = `${cc}-${seqPadded}-${suffix}`;
    const existing = await db.tenant.findFirst({
      where: { tenantCode: code },
    });
    if (!existing) return code;
  }

  const ts = Date.now().toString(36).toUpperCase().slice(-3);
  return `${cc}-${seqPadded}-${ts}`;
}

export function generateGlobalTenantId(tenantCode: string, dbId: string): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const shortId = dbId.substring(0, 8);
  return `TEN-${tenantCode}-${date}-${shortId}`;
}

export const CITY_CODES: Record<string, string> = {
  dubai: "DXB",
  "abu dhabi": "AUH",
  sharjah: "SHJ",
  ajman: "AJM",
  "ras al khaimah": "RAK",
  fujairah: "FUJ",
  "umm al quwain": "UAQ",
  "al ain": "AAN",
  riyadh: "RUH",
  jeddah: "JED",
  mecca: "MCC",
  medina: "MED",
  dammam: "DMM",
  khobar: "KHB",
  tabuk: "TBK",
  abha: "AHB",
  doha: "DOH",
  manama: "BAH",
  "kuwait city": "KWI",
  muscat: "MCT",
  salalah: "SLL",
  london: "LON",
  manchester: "MAN",
  birmingham: "BHX",
  "new york": "NYC",
  "los angeles": "LAX",
  chicago: "CHI",
  "dubai marina": "DXB",
  jumeirah: "DXB",
  mumbai: "BOM",
  delhi: "DEL",
  singapore: "SIN",
  sydney: "SYD",
  toronto: "YYZ",
};

export function getCityCode(city: string): string {
  if (!city) return "OTH";
  const normalized = city.toLowerCase().trim();

  if (CITY_CODES[normalized]) return CITY_CODES[normalized];

  for (const [key, code] of Object.entries(CITY_CODES)) {
    if (normalized.includes(key) || key.includes(normalized)) return code;
  }

  const consonants = city.toUpperCase().replace(/[AEIOU\s\-_]/g, "");
  return (consonants.substring(0, 3) || city.substring(0, 3).toUpperCase())
    .padEnd(3, "X")
    .substring(0, 3);
}

export async function generateBranchCode(
  tenantId: string,
  cityCode: string,
): Promise<{ branchCode: string; branchSeq: number }> {
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: { tenantCode: true },
  });
  if (!tenant?.tenantCode) {
    throw new Error(`Tenant ${tenantId} has no tenantCode`);
  }

  const count = await db.branch.count({ where: { tenantId } });
  const branchSeq = count + 1;
  const branchCode = `${tenant.tenantCode}-${cityCode}-${String(branchSeq).padStart(3, "0")}`;

  return { branchCode, branchSeq };
}

export async function generatePatientId(
  branchId: string,
): Promise<{ patientId: string; patientSeq: number; branchCode: string }> {
  const result = await db.$queryRaw<
    Array<{
      patientSeqCounter: number;
      branchCode: string | null;
    }>
  >`
    UPDATE "Branch"
    SET "patientSeqCounter" = "patientSeqCounter" + 1
    WHERE id = ${branchId}
    RETURNING "patientSeqCounter", "branchCode"
  `;

  if (!result[0]) throw new Error(`Branch ${branchId} not found`);
  const { patientSeqCounter, branchCode } = result[0];

  if (!branchCode) {
    throw new Error(`Branch ${branchId} has no branchCode. Run migration first.`);
  }

  const patientId = `PAT-${branchCode}-${String(patientSeqCounter).padStart(6, "0")}`;
  return { patientId, patientSeq: patientSeqCounter, branchCode };
}

const ROLE_CODES: Record<string, string> = {
  OWNER: "OW",
  ADMIN: "AD",
  DOCTOR: "DR",
  HYGIENIST: "HG",
  RECEPTIONIST: "RC",
  NURSE: "NR",
  STORE: "ST",
  FINANCE: "FN",
  STAFF: "GS",
  DENTIST: "DR",
};

export async function generateStaffRef(tenantId: string, role: string): Promise<string> {
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: { tenantCode: true },
  });
  if (!tenant?.tenantCode) throw new Error("Tenant has no code");

  const roleCode = ROLE_CODES[role.toUpperCase()] ?? "GS";
  const entityKey = `STF-${roleCode}`;
  const date = "LIFETIME";

  const seq = await atomicIncrement(tenantId, date, entityKey);
  return `STF-${tenant.tenantCode}-${roleCode}-${String(seq).padStart(4, "0")}`;
}

export async function atomicIncrement(
  tenantId: string,
  date: string,
  entity: string,
): Promise<number> {
  const result = await db.$queryRaw<Array<{ counter: number }>>`
    INSERT INTO "DailyCounter" ("id", "tenantId", "date", "entity", "counter")
    VALUES (gen_random_uuid()::text, ${tenantId}, ${date}, ${entity}, 1)
    ON CONFLICT ("tenantId", "date", "entity")
    DO UPDATE SET
      "counter" = "DailyCounter"."counter" + 1,
      "updatedAt" = NOW()
    RETURNING "counter"
  `;
  return result[0]?.counter ?? 1;
}

function todayYMD(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, "");
}

function thisMonthYM(): string {
  return new Date().toISOString().slice(0, 7).replace(/-/g, "");
}

export async function generateAppointmentRef(tenantId: string): Promise<string> {
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: { tenantCode: true },
  });
  if (!tenant?.tenantCode) return `APT-${todayYMD()}-0001`;

  const date = todayYMD();
  const seq = await atomicIncrement(tenantId, date, "APT");
  return `APT-${tenant.tenantCode}-${date}-${String(seq).padStart(4, "0")}`;
}

export async function generateInvoiceRef(tenantId: string): Promise<string> {
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: { tenantCode: true },
  });
  if (!tenant?.tenantCode) return `INV-${todayYMD()}-0001`;

  const date = todayYMD();
  const seq = await atomicIncrement(tenantId, date, "INV");
  return `INV-${tenant.tenantCode}-${date}-${String(seq).padStart(4, "0")}`;
}

export async function generatePurchaseOrderRef(tenantId: string): Promise<string> {
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: { tenantCode: true },
  });
  if (!tenant?.tenantCode) return `PO-${thisMonthYM()}-0001`;

  const month = thisMonthYM();
  const seq = await atomicIncrement(tenantId, month, "PO");
  return `PO-${tenant.tenantCode}-${month}-${String(seq).padStart(4, "0")}`;
}

export async function generateStockRef(tenantId: string): Promise<string> {
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: { tenantCode: true },
  });
  if (!tenant?.tenantCode) return `STK-${todayYMD()}-0001`;

  const date = todayYMD();
  const seq = await atomicIncrement(tenantId, date, "STK");
  return `STK-${tenant.tenantCode}-${date}-${String(seq).padStart(4, "0")}`;
}

const ITEM_CATEGORY_CODES: Record<string, string> = {
  CONSUMABLE: "CON",
  MEDICATION: "MED",
  EQUIPMENT: "EQP",
  LABORATORY: "LAB",
  RETAIL: "RET",
  OTHER: "OTH",
};

export async function generateInventoryItemRef(
  tenantId: string,
  category: string,
): Promise<string> {
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: { tenantCode: true },
  });
  if (!tenant?.tenantCode) return "ITM-OTH-0001";

  const catCode = ITEM_CATEGORY_CODES[category.toUpperCase()] ?? "OTH";
  const seq = await atomicIncrement(tenantId, "LIFETIME", `ITM-${catCode}`);
  return `ITM-${tenant.tenantCode}-${catCode}-${String(seq).padStart(4, "0")}`;
}

export async function generateSupplierRef(tenantId: string): Promise<string> {
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: { tenantCode: true },
  });
  if (!tenant?.tenantCode) return "SUP-0001";

  const seq = await atomicIncrement(tenantId, "LIFETIME", "SUP");
  return `SUP-${tenant.tenantCode}-${String(seq).padStart(4, "0")}`;
}

export function generateBatchRef(
  itemRef: string,
  expiryDate?: Date | null,
  lotNumber?: string | null,
): string {
  const expiry = expiryDate
    ? expiryDate.toISOString().slice(0, 7).replace(/-/g, "")
    : "NOEXP";
  const lot = (lotNumber ?? randomSuffix(4)).replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(0, 6);
  return `BTH-${itemRef}-${expiry}-${lot}`;
}

export async function generateConsentRef(
  patientDbId: string,
  tenantId: string,
): Promise<string> {
  const patient = await db.patient.findUnique({
    where: { id: patientDbId },
    select: { patientId: true },
  });
  const shortPatient = patient?.patientId?.replace("PAT-", "") ?? patientDbId.slice(0, 8);

  const seq = await atomicIncrement(tenantId, `PAT-${patientDbId}`, "CSN");
  return `CSN-${shortPatient}-${String(seq).padStart(3, "0")}`;
}

export type ParsedPatientId = {
  prefix: string;
  countryCode: string;
  tenantSeq: string;
  tenantSuffix: string;
  tenantCode: string;
  cityCode: string;
  branchSeq: string;
  patientSeq: number;
  branchCode: string;
  isValid: boolean;
};

export function parsePatientId(id: string): ParsedPatientId {
  const parts = id.split("-");
  const empty: ParsedPatientId = {
    prefix: "",
    countryCode: "",
    tenantSeq: "",
    tenantSuffix: "",
    tenantCode: "",
    cityCode: "",
    branchSeq: "",
    patientSeq: 0,
    branchCode: "",
    isValid: false,
  };

  if (parts.length !== 7 || parts[0] !== "PAT") return empty;

  const [prefix, cc, tSeq, tSuf, city, bSeq, pSeq] = parts;

  return {
    prefix,
    countryCode: cc,
    tenantSeq: tSeq,
    tenantSuffix: tSuf,
    tenantCode: `${cc}-${tSeq}-${tSuf}`,
    cityCode: city,
    branchSeq: bSeq,
    patientSeq: parseInt(pSeq),
    branchCode: `${cc}-${tSeq}-${tSuf}-${city}-${bSeq}`,
    isValid:
      cc.length === 2 &&
      tSeq.length === 4 &&
      tSuf.length === 3 &&
      city.length === 3 &&
      bSeq.length === 3 &&
      !isNaN(parseInt(pSeq)),
  };
}

export function toBarcodeValue(id: string): string {
  return id.replace(/-/g, "").toUpperCase();
}

export function formatPatientIdForDisplay(
  patientId: string,
  mode: "FULL" | "SHORT" | "MINIMAL" = "FULL",
): string {
  if (!patientId) return "";
  const parsed = parsePatientId(patientId);
  if (!parsed.isValid) return patientId;

  switch (mode) {
    case "FULL":
      return patientId;
    case "SHORT":
      return `${parsed.cityCode}-${parsed.branchSeq}-${String(parsed.patientSeq).padStart(6, "0")}`;
    case "MINIMAL":
      return String(parsed.patientSeq).padStart(6, "0");
    default:
      return patientId;
  }
}

export async function assignCodestoExistingTenant(tenantId: string) {
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    include: { branches: true },
  });
  if (!tenant) throw new Error("Tenant not found");
  if (tenant.tenantCode) return { alreadyDone: true };

  const tenantCode = await generateTenantCode(tenant.countryCode ?? "AE");
  const globalTenantId = generateGlobalTenantId(tenantCode, tenant.id);

  await db.tenant.update({
    where: { id: tenantId },
    data: { tenantCode, globalTenantId },
  });

  for (const branch of tenant.branches) {
    if (branch.branchCode) continue;
    const city = tenant.city ?? "Dubai";
    const cityCode = getCityCode(city);
    const { branchCode, branchSeq } = await generateBranchCode(tenantId, cityCode);
    await db.branch.update({
      where: { id: branch.id },
      data: {
        branchCode,
        cityCode,
        branchSeq,
        countryCode: tenant.countryCode ?? "AE",
      },
    });
  }

  const branches = await db.branch.findMany({
    where: { tenantId },
    orderBy: { createdAt: "asc" },
  });

  const defaultBranch = branches[0];
  if (!defaultBranch) return { tenantCode, patientsUpdated: 0 };

  const patients = await db.patient.findMany({
    where: { tenantId, patientId: null },
    orderBy: { createdAt: "asc" },
  });

  let patientsUpdated = 0;
  for (const patient of patients) {
    const { patientId, patientSeq, branchCode } = await generatePatientId(defaultBranch.id);
    await db.patient.update({
      where: { id: patient.id },
      data: { patientId, branchSeq: patientSeq, branchCode },
    });
    patientsUpdated++;
  }

  return { tenantCode, globalTenantId, patientsUpdated };
}
