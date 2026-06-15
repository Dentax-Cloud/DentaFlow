import { z } from "zod";
import { AppointmentStatus } from "@prisma/client";

export const createAppointmentSchema = z.object({
  patientId: z.string(),
  title: z.string().min(1),
  startTime: z.string(),
  endTime: z.string(),
  doctorId: z.string().optional(),
  chairId: z.string().optional(),
  type: z.string().optional(),
  notes: z.string().optional(),
});

export const updateAppointmentStatusSchema = z.object({
  id: z.string(),
  status: z.nativeEnum(AppointmentStatus),
});

export const updateAppointmentChairSchema = z.object({
  id: z.string(),
  chairId: z.string().nullable(),
});

export const updateAppointmentTimeSchema = z.object({
  id: z.string(),
  startTime: z.string(),
  endTime: z.string(),
});

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
