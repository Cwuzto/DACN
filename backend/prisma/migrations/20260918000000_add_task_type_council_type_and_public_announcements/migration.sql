-- CreateEnum
CREATE TYPE "TaskType" AS ENUM ('BM01', 'BM02', 'BM03_CHECKPOINT', 'BM04', 'GENERIC');

-- CreateEnum
CREATE TYPE "CouncilType" AS ENUM ('OUTLINE_REVIEW', 'DEFENSE_COUNCIL');

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN "task_type" "TaskType" NOT NULL DEFAULT 'GENERIC';

-- AlterTable
ALTER TABLE "councils" ADD COLUMN "council_type" "CouncilType" NOT NULL DEFAULT 'DEFENSE_COUNCIL';

-- CreateTable
CREATE TABLE "public_announcements" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "category" TEXT DEFAULT 'ANNOUNCEMENT',
    "file_url" TEXT,
    "file_name" TEXT,
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "is_published" BOOLEAN NOT NULL DEFAULT true,
    "author_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "public_announcements_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public_announcements" ADD CONSTRAINT "public_announcements_author_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
