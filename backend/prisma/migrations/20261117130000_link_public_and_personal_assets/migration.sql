-- AlterTable
ALTER TABLE "users" ADD COLUMN "avatar_asset_id" TEXT;

-- AlterTable
ALTER TABLE "semesters" ADD COLUMN "outline_template_asset_id" TEXT;

-- AlterTable
ALTER TABLE "public_announcements" ADD COLUMN "file_asset_id" TEXT;

-- CreateIndex
CREATE INDEX "users_avatar_asset_id_idx" ON "users"("avatar_asset_id");

-- CreateIndex
CREATE INDEX "semesters_outline_template_asset_id_idx" ON "semesters"("outline_template_asset_id");

-- CreateIndex
CREATE INDEX "public_announcements_file_asset_id_idx" ON "public_announcements"("file_asset_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_avatar_asset_id_fkey" FOREIGN KEY ("avatar_asset_id") REFERENCES "stored_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "semesters" ADD CONSTRAINT "semesters_outline_template_asset_id_fkey" FOREIGN KEY ("outline_template_asset_id") REFERENCES "stored_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public_announcements" ADD CONSTRAINT "public_announcements_file_asset_id_fkey" FOREIGN KEY ("file_asset_id") REFERENCES "stored_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "portal_content_revision_assets" (
    "id" SERIAL NOT NULL,
    "revision_id" INTEGER NOT NULL,
    "asset_id" TEXT NOT NULL,
    "slot_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "portal_content_revision_assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "portal_content_revision_assets_revision_id_slot_key_key" ON "portal_content_revision_assets"("revision_id", "slot_key");

-- CreateIndex
CREATE INDEX "portal_content_revision_assets_asset_id_idx" ON "portal_content_revision_assets"("asset_id");

-- AddForeignKey
ALTER TABLE "portal_content_revision_assets" ADD CONSTRAINT "portal_content_revision_assets_revision_id_fkey" FOREIGN KEY ("revision_id") REFERENCES "portal_content_revisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portal_content_revision_assets" ADD CONSTRAINT "portal_content_revision_assets_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "stored_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
