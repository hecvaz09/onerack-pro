/*
  Warnings:

  - A unique constraint covering the columns `[sku]` on the table `CatalogDevice` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `sku` to the `CatalogDevice` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "CatalogDevice" ADD COLUMN     "rawData" JSONB,
ADD COLUMN     "sku" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "CatalogDevice_sku_key" ON "CatalogDevice"("sku");
