-- CreateTable
CREATE TABLE "public"."Sportsbook" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sportsbook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Event" (
    "id" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "league" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "teamA" TEXT NOT NULL,
    "teamB" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Market" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,

    CONSTRAINT "Market_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Odds" (
    "id" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "sportsbookId" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "decimal" DOUBLE PRECISION NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Odds_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Sportsbook_name_key" ON "public"."Sportsbook"("name");

-- CreateIndex
CREATE INDEX "Odds_marketId_sportsbookId_idx" ON "public"."Odds"("marketId", "sportsbookId");

-- CreateIndex
CREATE UNIQUE INDEX "Odds_marketId_sportsbookId_outcome_key" ON "public"."Odds"("marketId", "sportsbookId", "outcome");

-- AddForeignKey
ALTER TABLE "public"."Market" ADD CONSTRAINT "Market_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "public"."Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Odds" ADD CONSTRAINT "Odds_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "public"."Market"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Odds" ADD CONSTRAINT "Odds_sportsbookId_fkey" FOREIGN KEY ("sportsbookId") REFERENCES "public"."Sportsbook"("id") ON DELETE CASCADE ON UPDATE CASCADE;
