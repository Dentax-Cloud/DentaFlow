-- DropForeignKey
ALTER TABLE "Claim" DROP CONSTRAINT IF EXISTS "Claim_policyId_fkey";

-- DropTable
DROP TABLE IF EXISTS "InsurancePolicy";
