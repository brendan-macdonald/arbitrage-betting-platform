/*
  Warnings:

  - A unique constraint covering the columns `[marketId,sportsbookId,outcome,line]` on the table `Odds` will be added. If there are existing duplicate values, this will fail.
  - Changed the type of `type` on the `Market` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `outcome` on the `Odds` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "public"."MarketType" AS ENUM ('ML', 'SPREAD', 'TOTAL');

-- CreateEnum
CREATE TYPE "public"."Outcome" AS ENUM ('A', 'B', 'OVER', 'UNDER');

-- DropIndex
DROP INDEX "public"."Odds_marketId_sportsbookId_outcome_key";

-- AlterTable
ALTER TABLE "public"."Market" DROP COLUMN "type",
ADD COLUMN     "type" "public"."MarketType" NOT NULL;

-- AlterTable
ALTER TABLE "public"."Odds" ADD COLUMN     "line" DOUBLE PRECISION,
DROP COLUMN "outcome",
ADD COLUMN     "outcome" "public"."Outcome" NOT NULL;

-- CreateIndex
CREATE INDEX "Market_type_idx" ON "public"."Market"("type");

-- CreateIndex
CREATE INDEX "Odds_outcome_line_idx" ON "public"."Odds"("outcome", "line");

-- CreateIndex
CREATE UNIQUE INDEX "Odds_marketId_sportsbookId_outcome_line_key" ON "public"."Odds"("marketId", "sportsbookId", "outcome", "line");
