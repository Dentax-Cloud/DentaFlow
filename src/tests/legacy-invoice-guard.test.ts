import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    encounter: {
      findFirst: vi.fn(),
    },
  },
}));

import { db } from "@/lib/db";
import {
  assertNoOpenEncounterBlocksLegacyInvoice,
  findOpenUnbilledEncounterForPatient,
  OpenSpineEncounterBlocksLegacyInvoiceError,
} from "@/lib/encounter/legacy-invoice-guard";

const findFirst = db.encounter.findFirst as ReturnType<typeof vi.fn>;

describe("legacy invoice guard vs open spine encounter", () => {
  beforeEach(() => {
    findFirst.mockReset();
  });

  it("findOpenUnbilledEncounterForPatient returns the open row", async () => {
    findFirst.mockResolvedValue({
      id: "enc_1",
      appointmentId: "appt_1",
      status: "procedure_execution",
    });
    await expect(
      findOpenUnbilledEncounterForPatient("ten_1", "pat_1"),
    ).resolves.toEqual({
      id: "enc_1",
      appointmentId: "appt_1",
      status: "procedure_execution",
    });
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: "ten_1",
          patientId: "pat_1",
          closedAt: null,
          deletedAt: null,
        }),
      }),
    );
  });

  it("allows createInvoiceFromItems path when encounterId is set (spine Close & invoice)", async () => {
    findFirst.mockResolvedValue({
      id: "enc_1",
      appointmentId: "appt_1",
      status: "billing",
    });
    await expect(
      assertNoOpenEncounterBlocksLegacyInvoice({
        tenantId: "ten_1",
        patientId: "pat_1",
        encounterId: "enc_1",
      }),
    ).resolves.toBeUndefined();
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("blocks legacy invoice when an open unbilled encounter exists", async () => {
    findFirst.mockResolvedValue({
      id: "enc_1",
      appointmentId: "appt_1",
      status: "procedure_execution",
    });
    await expect(
      assertNoOpenEncounterBlocksLegacyInvoice({
        tenantId: "ten_1",
        patientId: "pat_1",
        encounterId: null,
      }),
    ).rejects.toBeInstanceOf(OpenSpineEncounterBlocksLegacyInvoiceError);

    try {
      await assertNoOpenEncounterBlocksLegacyInvoice({
        tenantId: "ten_1",
        patientId: "pat_1",
      });
    } catch (e) {
      expect(e).toBeInstanceOf(OpenSpineEncounterBlocksLegacyInvoiceError);
      const err = e as OpenSpineEncounterBlocksLegacyInvoiceError;
      expect(err.appointmentId).toBe("appt_1");
      expect(err.encounterId).toBe("enc_1");
      expect(err.message).toMatch(/Close & invoice/i);
    }
  });

  it("allows legacy invoice when no open encounter exists", async () => {
    findFirst.mockResolvedValue(null);
    await expect(
      assertNoOpenEncounterBlocksLegacyInvoice({
        tenantId: "ten_1",
        patientId: "pat_1",
      }),
    ).resolves.toBeUndefined();
  });
});
