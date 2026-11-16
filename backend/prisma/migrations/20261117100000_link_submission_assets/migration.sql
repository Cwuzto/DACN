-- AlterTable
ALTER TABLE "submissions" ADD COLUMN "asset_id" TEXT;

-- AlterTable
ALTER TABLE "bm02_submissions" ADD COLUMN "asset_id" TEXT;

-- AlterTable
ALTER TABLE "bm03_meeting_entries" ADD COLUMN "evidence_asset_id" TEXT;

-- CreateIndex
CREATE INDEX "submissions_asset_id_idx" ON "submissions"("asset_id");

-- CreateIndex
CREATE INDEX "bm02_submissions_asset_id_idx" ON "bm02_submissions"("asset_id");

-- CreateIndex
CREATE INDEX "bm03_meeting_entries_evidence_asset_id_idx" ON "bm03_meeting_entries"("evidence_asset_id");

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "stored_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bm02_submissions" ADD CONSTRAINT "bm02_submissions_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "stored_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bm03_meeting_entries" ADD CONSTRAINT "bm03_meeting_entries_evidence_asset_id_fkey" FOREIGN KEY ("evidence_asset_id") REFERENCES "stored_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
