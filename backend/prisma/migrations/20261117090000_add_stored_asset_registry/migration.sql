-- CreateEnum
CREATE TYPE "StorageBucket" AS ENUM ('CONG_KHAI', 'HOC_VU', 'CA_NHAN', 'TAM');

-- CreateEnum
CREATE TYPE "AssetVisibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateEnum
CREATE TYPE "AssetScanStatus" AS ENUM ('PENDING', 'PASSED', 'REJECTED', 'FAILED');

-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('STAGED', 'ACTIVE', 'REPLACED', 'SOFT_DELETED', 'ORPHANED', 'PURGED');

-- CreateEnum
CREATE TYPE "StoredDocumentType" AS ENUM ('BM01', 'BM02', 'BM02_A', 'BM03', 'CHECKPOINT_EVIDENCE', 'BM04', 'BM05', 'ASSIGNMENT_DECISION', 'ADJUSTMENT_APPENDIX', 'COUNCIL_DOCUMENT', 'REPORT_WORD', 'REPORT_PDF', 'SLIDE_PPTX', 'SOURCE_ZIP', 'CLEARANCE_CERTIFICATE', 'USER_AVATAR', 'PORTAL_IMAGE', 'PORTAL_DOCUMENT', 'PORTAL_TEMPLATE');

-- CreateEnum
CREATE TYPE "AssetUploadTransport" AS ENUM ('MULTIPART', 'TUS');

-- CreateEnum
CREATE TYPE "AssetUploadSessionStatus" AS ENUM ('CREATED', 'UPLOADING', 'UPLOADED', 'FINALIZING', 'COMPLETED', 'ABORTED', 'EXPIRED', 'FAILED');

-- CreateTable
CREATE TABLE "stored_assets" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'supabase',
    "bucket" "StorageBucket" NOT NULL,
    "object_key" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "extension" TEXT NOT NULL,
    "declared_mime" TEXT NOT NULL,
    "detected_mime" TEXT NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "sha256" VARCHAR(64) NOT NULL,
    "owner_user_id" INTEGER,
    "uploaded_by_id" INTEGER NOT NULL,
    "registration_id" INTEGER,
    "semester_id" INTEGER,
    "project_catalog_id" INTEGER,
    "document_type" "StoredDocumentType" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "visibility" "AssetVisibility" NOT NULL DEFAULT 'PRIVATE',
    "access_policy" TEXT,
    "scan_status" "AssetScanStatus" NOT NULL DEFAULT 'PENDING',
    "scan_message" TEXT,
    "scan_diagnostics" JSONB,
    "verified_at" TIMESTAMP(3),
    "status" "AssetStatus" NOT NULL DEFAULT 'STAGED',
    "retention_until" TIMESTAMP(3),
    "replaced_by_id" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stored_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stored_asset_upload_sessions" (
    "id" TEXT NOT NULL,
    "actor_id" INTEGER NOT NULL,
    "document_type" "StoredDocumentType" NOT NULL,
    "resource_context" JSONB NOT NULL,
    "staging_bucket" "StorageBucket" NOT NULL DEFAULT 'TAM',
    "staging_path" TEXT NOT NULL,
    "transport" "AssetUploadTransport" NOT NULL,
    "declared_size_bytes" BIGINT NOT NULL,
    "declared_mime" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "tus_upload_id" TEXT,
    "status" "AssetUploadSessionStatus" NOT NULL DEFAULT 'CREATED',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "finalized_asset_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stored_asset_upload_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stored_asset_cleanup_jobs" (
    "id" TEXT NOT NULL,
    "bucket" "StorageBucket" NOT NULL,
    "object_key" TEXT NOT NULL,
    "asset_id" TEXT,
    "reason" TEXT NOT NULL,
    "scheduled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locked_at" TIMESTAMP(3),
    "locked_by" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "last_error" TEXT,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stored_asset_cleanup_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stored_assets_bucket_object_key_key" ON "stored_assets"("bucket", "object_key");

-- CreateIndex
CREATE INDEX "stored_assets_owner_user_id_idx" ON "stored_assets"("owner_user_id");

-- CreateIndex
CREATE INDEX "stored_assets_registration_id_idx" ON "stored_assets"("registration_id");

-- CreateIndex
CREATE INDEX "stored_assets_semester_id_idx" ON "stored_assets"("semester_id");

-- CreateIndex
CREATE INDEX "stored_assets_document_type_idx" ON "stored_assets"("document_type");

-- CreateIndex
CREATE INDEX "stored_assets_status_idx" ON "stored_assets"("status");

-- CreateIndex
CREATE INDEX "stored_assets_sha256_idx" ON "stored_assets"("sha256");

-- CreateIndex
CREATE INDEX "stored_assets_retention_until_idx" ON "stored_assets"("retention_until");

-- CreateIndex
CREATE INDEX "stored_asset_upload_sessions_actor_id_idx" ON "stored_asset_upload_sessions"("actor_id");

-- CreateIndex
CREATE INDEX "stored_asset_upload_sessions_status_idx" ON "stored_asset_upload_sessions"("status");

-- CreateIndex
CREATE INDEX "stored_asset_upload_sessions_expires_at_idx" ON "stored_asset_upload_sessions"("expires_at");

-- CreateIndex
CREATE INDEX "stored_asset_cleanup_jobs_scheduled_at_completed_at_idx" ON "stored_asset_cleanup_jobs"("scheduled_at", "completed_at");

-- CreateIndex
CREATE INDEX "stored_asset_cleanup_jobs_locked_at_idx" ON "stored_asset_cleanup_jobs"("locked_at");

-- AddForeignKey
ALTER TABLE "stored_assets" ADD CONSTRAINT "stored_assets_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stored_assets" ADD CONSTRAINT "stored_assets_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stored_assets" ADD CONSTRAINT "stored_assets_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "topic_registrations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stored_assets" ADD CONSTRAINT "stored_assets_semester_id_fkey" FOREIGN KEY ("semester_id") REFERENCES "semesters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stored_assets" ADD CONSTRAINT "stored_assets_project_catalog_id_fkey" FOREIGN KEY ("project_catalog_id") REFERENCES "project_catalogs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stored_assets" ADD CONSTRAINT "stored_assets_replaced_by_id_fkey" FOREIGN KEY ("replaced_by_id") REFERENCES "stored_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stored_asset_upload_sessions" ADD CONSTRAINT "stored_asset_upload_sessions_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stored_asset_upload_sessions" ADD CONSTRAINT "stored_asset_upload_sessions_finalized_asset_id_fkey" FOREIGN KEY ("finalized_asset_id") REFERENCES "stored_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stored_asset_cleanup_jobs" ADD CONSTRAINT "stored_asset_cleanup_jobs_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "stored_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
