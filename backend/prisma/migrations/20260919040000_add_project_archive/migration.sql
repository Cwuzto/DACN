-- CreateEnum
CREATE TYPE "ArchiveStatus" AS ENUM ('SUBMITTED', 'APPROVED', 'REVISION_REQUIRED');

-- CreateTable
CREATE TABLE "project_archives" (
    "id" SERIAL NOT NULL,
    "registration_id" INTEGER NOT NULL,
    "report_file_url" TEXT,
    "report_file_name" TEXT,
    "slide_file_url" TEXT,
    "slide_file_name" TEXT,
    "source_code_url" TEXT,
    "demo_video_url" TEXT,
    "bm03_file_url" TEXT,
    "bm04_file_url" TEXT,
    "summary" TEXT,
    "status" "ArchiveStatus" NOT NULL DEFAULT 'SUBMITTED',
    "reviewed_by" INTEGER,
    "reviewer_notes" TEXT,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_archives_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "project_archives_registration_id_key" ON "project_archives"("registration_id");

-- AddForeignKey
ALTER TABLE "project_archives" ADD CONSTRAINT "project_archives_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "topic_registrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_archives" ADD CONSTRAINT "project_archives_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
