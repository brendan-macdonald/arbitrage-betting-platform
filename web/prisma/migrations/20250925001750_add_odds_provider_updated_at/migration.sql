-- AlterTable
ALTER TABLE "public"."Odds" ADD COLUMN     "providerUpdatedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Odds_marketId_sportsbookId_outcome_providerUpdatedAt_idx" ON "public"."Odds"("marketId", "sportsbookId", "outcome", "providerUpdatedAt");
