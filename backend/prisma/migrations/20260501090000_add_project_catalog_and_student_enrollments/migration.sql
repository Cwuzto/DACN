-- CreateEnum
CREATE TYPE "StudentProjectEnrollmentStatus" AS ENUM ('ACTIVE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EnrollmentSource" AS ENUM ('SEED', 'MANUAL', 'EXCEL');

-- CreateTable
CREATE TABLE "project_catalogs" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "project_catalogs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_project_enrollments" (
    "id" SERIAL NOT NULL,
    "student_id" INTEGER NOT NULL,
    "semester_id" INTEGER NOT NULL,
    "project_catalog_id" INTEGER NOT NULL,
    "status" "StudentProjectEnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "source" "EnrollmentSource" NOT NULL DEFAULT 'SEED',
    "import_batch_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "student_project_enrollments_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "topics"
ADD COLUMN "project_catalog_id" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "project_catalogs_code_key" ON "project_catalogs"("code");

-- CreateIndex
CREATE UNIQUE INDEX "student_project_enrollments_student_id_semester_id_project_catalog_id_key"
ON "student_project_enrollments"("student_id", "semester_id", "project_catalog_id");

-- CreateIndex
CREATE INDEX "student_project_enrollments_student_id_semester_id_status_idx"
ON "student_project_enrollments"("student_id", "semester_id", "status");

-- AddForeignKey
ALTER TABLE "topics"
ADD CONSTRAINT "topics_project_catalog_id_fkey"
FOREIGN KEY ("project_catalog_id") REFERENCES "project_catalogs"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_project_enrollments"
ADD CONSTRAINT "student_project_enrollments_student_id_fkey"
FOREIGN KEY ("student_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_project_enrollments"
ADD CONSTRAINT "student_project_enrollments_semester_id_fkey"
FOREIGN KEY ("semester_id") REFERENCES "semesters"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_project_enrollments"
ADD CONSTRAINT "student_project_enrollments_project_catalog_id_fkey"
FOREIGN KEY ("project_catalog_id") REFERENCES "project_catalogs"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
