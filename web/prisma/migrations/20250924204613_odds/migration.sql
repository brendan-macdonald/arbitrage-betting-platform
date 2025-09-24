/*
  Warnings:

  - A unique constraint covering the columns `[marketId,sportsbookId,outcome]` on the table `Odds` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Odds_marketId_sportsbookId_outcome_key" ON "public"."Odds"("marketId", "sportsbookId", "outcome");
