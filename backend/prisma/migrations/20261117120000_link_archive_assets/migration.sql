-- AlterTable
ALTER TABLE "defense_document_versions" ADD COLUMN "asset_id" TEXT;
ALTER TABLE "defense_document_versions" ADD COLUMN "demo_video_external_url" TEXT;

-- CreateIndex
CREATE INDEX "defense_document_versions_asset_id_idx" ON "defense_document_versions"("asset_id");

-- AddForeignKey
ALTER TABLE "defense_document_versions" ADD CONSTRAINT "defense_document_versions_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "stored_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
