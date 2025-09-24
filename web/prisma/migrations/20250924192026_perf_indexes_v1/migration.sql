-- CreateIndex
CREATE INDEX "Event_startsAt_idx" ON "public"."Event"("startsAt");

-- CreateIndex
CREATE INDEX "Market_type_eventId_idx" ON "public"."Market"("type", "eventId");

-- CreateIndex
CREATE INDEX "Odds_marketId_sportsbookId_outcome_line_idx" ON "public"."Odds"("marketId", "sportsbookId", "outcome", "line");
