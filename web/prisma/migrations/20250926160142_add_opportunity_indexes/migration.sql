-- CreateIndex
CREATE INDEX "Odds_marketId_outcome_line_idx" ON "public"."Odds"("marketId", "outcome", "line");
