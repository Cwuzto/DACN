-- AlterTable
ALTER TABLE "bm02a_adjustment_requests" ADD COLUMN "final_pdf_asset_id" TEXT;

-- AlterTable
ALTER TABLE "bm03_progress_records" ADD COLUMN "final_pdf_asset_id" TEXT;

-- AlterTable
ALTER TABLE "bm04_evaluations" ADD COLUMN "final_pdf_asset_id" TEXT;

-- AlterTable
ALTER TABLE "topic_assignment_decisions" ADD COLUMN "asset_id" TEXT;

-- AlterTable
ALTER TABLE "title_adjustment_appendices" ADD COLUMN "asset_id" TEXT;

-- AlterTable
ALTER TABLE "defense_member_scores" ADD COLUMN "pdf_asset_id" TEXT;

-- AlterTable
ALTER TABLE "project_archives" ADD COLUMN "certificate_pdf_asset_id" TEXT;

-- CreateIndex
CREATE INDEX "bm02a_adjustment_requests_final_pdf_asset_id_idx" ON "bm02a_adjustment_requests"("final_pdf_asset_id");

-- CreateIndex
CREATE INDEX "bm03_progress_records_final_pdf_asset_id_idx" ON "bm03_progress_records"("final_pdf_asset_id");

-- CreateIndex
CREATE INDEX "bm04_evaluations_final_pdf_asset_id_idx" ON "bm04_evaluations"("final_pdf_asset_id");

-- CreateIndex
CREATE INDEX "topic_assignment_decisions_asset_id_idx" ON "topic_assignment_decisions"("asset_id");

-- CreateIndex
CREATE INDEX "title_adjustment_appendices_asset_id_idx" ON "title_adjustment_appendices"("asset_id");

-- CreateIndex
CREATE INDEX "defense_member_scores_pdf_asset_id_idx" ON "defense_member_scores"("pdf_asset_id");

-- CreateIndex
CREATE INDEX "project_archives_certificate_pdf_asset_id_idx" ON "project_archives"("certificate_pdf_asset_id");

-- AddForeignKey
ALTER TABLE "bm02a_adjustment_requests" ADD CONSTRAINT "bm02a_adjustment_requests_final_pdf_asset_id_fkey" FOREIGN KEY ("final_pdf_asset_id") REFERENCES "stored_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bm03_progress_records" ADD CONSTRAINT "bm03_progress_records_final_pdf_asset_id_fkey" FOREIGN KEY ("final_pdf_asset_id") REFERENCES "stored_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bm04_evaluations" ADD CONSTRAINT "bm04_evaluations_final_pdf_asset_id_fkey" FOREIGN KEY ("final_pdf_asset_id") REFERENCES "stored_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topic_assignment_decisions" ADD CONSTRAINT "topic_assignment_decisions_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "stored_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "title_adjustment_appendices" ADD CONSTRAINT "title_adjustment_appendices_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "stored_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "defense_member_scores" ADD CONSTRAINT "defense_member_scores_pdf_asset_id_fkey" FOREIGN KEY ("pdf_asset_id") REFERENCES "stored_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_archives" ADD CONSTRAINT "project_archives_certificate_pdf_asset_id_fkey" FOREIGN KEY ("certificate_pdf_asset_id") REFERENCES "stored_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
