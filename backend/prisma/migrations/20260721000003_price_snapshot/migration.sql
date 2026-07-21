-- CreateTable: PriceSnapshot — ежедневный снимок средней цены по городу+типу сделки
CREATE TABLE IF NOT EXISTS "PriceSnapshot" (
    "id"           SERIAL NOT NULL,
    "cityId"       INTEGER NOT NULL,
    "contractType" "ContractType" NOT NULL,
    "avgPrice"     DOUBLE PRECISION NOT NULL,
    "sampleSize"   INTEGER NOT NULL,
    "capturedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PriceSnapshot_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PriceSnapshot"
    ADD CONSTRAINT "PriceSnapshot_cityId_fkey"
    FOREIGN KEY ("cityId") REFERENCES "City"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PriceSnapshot_cityId_contractType_capturedAt_idx" ON "PriceSnapshot"("cityId", "contractType", "capturedAt");
