import { z } from "zod";

export const duplicateModeSchema = z.enum(["skip", "update"]);

export const patientImportRowSchema = z.object({
  patient_number: z.string().optional(),
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  date_of_birth: z.string().optional(),
  gender: z.string().optional(),
  address: z.string().optional(),
  allergies: z.string().optional(),
  medications: z.string().optional(),
  notes: z.string().optional(),
});

export const inventoryImportRowSchema = z.object({
  sku: z.string().min(1, "SKU is required"),
  name: z.string().min(1, "Name is required"),
  category: z.string().optional(),
  unit: z.string().optional(),
  quantity: z.string().optional(),
  reorder_level: z.string().optional(),
  cost: z.string().optional(),
  batch_number: z.string().optional(),
  expiry_date: z.string().optional(),
});

export const procedureImportRowSchema = z.object({
  code: z.string().min(1, "Code is required"),
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  category: z.string().optional(),
  price: z.string().min(1, "Price is required"),
  duration_minutes: z.string().optional(),
});

export const importPatientsSchema = z.object({
  rows: z.array(patientImportRowSchema),
  duplicateMode: duplicateModeSchema,
});

export const importInventorySchema = z.object({
  rows: z.array(inventoryImportRowSchema),
  duplicateMode: duplicateModeSchema,
});

export const importProceduresSchema = z.object({
  rows: z.array(procedureImportRowSchema),
  duplicateMode: duplicateModeSchema,
});
