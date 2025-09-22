-- CreateTable
CREATE TABLE "public"."OddsFingerprint" (
    "key" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OddsFingerprint_pkey" PRIMARY KEY ("key")
);
