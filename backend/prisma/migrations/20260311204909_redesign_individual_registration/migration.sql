/*
  Warnings:

  - The values [INVITATION,EVALUATION] on the enum `NotificationType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `group_id` on the `tasks` table. All the data in the column will be lost.
  - You are about to drop the column `max_groups` on the `topics` table. All the data in the column will be lost.
  - You are about to drop the `evaluations` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `group_members` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `groups` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `registration_id` to the `submissions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `registration_id` to the `tasks` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "AcademicTitle" AS ENUM ('THAC_SI', 'TIEN_SI', 'PHO_GIAO_SU');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'IN_PROGRESS', 'SUBMITTED', 'DEFENDED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "MilestoneStatus" AS ENUM ('PENDING', 'PASSED', 'FAILED');

-- AlterEnum
BEGIN;
CREATE TYPE "NotificationType_new" AS ENUM ('SYSTEM', 'TASK_REMINDER', 'APPROVAL', 'REGISTRATION', 'SUBMISSION', 'DEFENSE');
ALTER TABLE "public"."notifications" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE "notifications" ALTER COLUMN "type" TYPE "NotificationType_new" USING ("type"::text::"NotificationType_new");
ALTER TYPE "NotificationType" RENAME TO "NotificationType_old";
ALTER TYPE "NotificationType_new" RENAME TO "NotificationType";
DROP TYPE "public"."NotificationType_old";
ALTER TABLE "notifications" ALTER COLUMN "type" SET DEFAULT 'SYSTEM';
COMMIT;

-- DropForeignKey
ALTER TABLE "evaluations" DROP CONSTRAINT "evaluations_evaluator_id_fkey";

-- DropForeignKey
ALTER TABLE "evaluations" DROP CONSTRAINT "evaluations_group_id_fkey";

-- DropForeignKey
ALTER TABLE "evaluations" DROP CONSTRAINT "evaluations_student_id_fkey";

-- DropForeignKey
ALTER TABLE "group_members" DROP CONSTRAINT "group_members_group_id_fkey";

-- DropForeignKey
ALTER TABLE "group_members" DROP CONSTRAINT "group_members_student_id_fkey";

-- DropForeignKey
ALTER TABLE "groups" DROP CONSTRAINT "groups_council_id_fkey";

-- DropForeignKey
ALTER TABLE "groups" DROP CONSTRAINT "groups_leader_id_fkey";

-- DropForeignKey
ALTER TABLE "groups" DROP CONSTRAINT "groups_semester_id_fkey";

-- DropForeignKey
ALTER TABLE "groups" DROP CONSTRAINT "groups_topic_id_fkey";

-- DropForeignKey
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_group_id_fkey";

-- AlterTable
ALTER TABLE "submissions" ADD COLUMN     "registration_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "tasks" DROP COLUMN "group_id",
ADD COLUMN     "registration_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "topics" DROP COLUMN "max_groups",
ADD COLUMN     "max_students" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "academic_title" "AcademicTitle";

-- DropTable
DROP TABLE "evaluations";

-- DropTable
DROP TABLE "group_members";

-- DropTable
DROP TABLE "groups";

-- DropEnum
DROP TYPE "EvaluationType";

-- DropEnum
DROP TYPE "GroupMemberStatus";

-- CreateTable
CREATE TABLE "topic_registrations" (
    "id" SERIAL NOT NULL,
    "topic_id" INTEGER NOT NULL,
    "student_id" INTEGER NOT NULL,
    "semester_id" INTEGER NOT NULL,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'PENDING',
    "reject_reason" TEXT,
    "council_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "topic_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "milestones" (
    "id" SERIAL NOT NULL,
    "registration_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "due_date" TIMESTAMP(3),
    "status" "MilestoneStatus" NOT NULL DEFAULT 'PENDING',
    "feedback" TEXT,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "defense_results" (
    "id" SERIAL NOT NULL,
    "registration_id" INTEGER NOT NULL,
    "final_score" DOUBLE PRECISION,
    "comments" TEXT,
    "scoresheet_url" TEXT,
    "evaluator_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "defense_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "topic_registrations_student_id_semester_id_key" ON "topic_registrations"("student_id", "semester_id");

-- CreateIndex
CREATE UNIQUE INDEX "defense_results_registration_id_key" ON "defense_results"("registration_id");

-- AddForeignKey
ALTER TABLE "topic_registrations" ADD CONSTRAINT "topic_registrations_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topic_registrations" ADD CONSTRAINT "topic_registrations_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topic_registrations" ADD CONSTRAINT "topic_registrations_council_id_fkey" FOREIGN KEY ("council_id") REFERENCES "councils"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "topic_registrations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "topic_registrations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "topic_registrations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "defense_results" ADD CONSTRAINT "defense_results_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "topic_registrations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "defense_results" ADD CONSTRAINT "defense_results_evaluator_id_fkey" FOREIGN KEY ("evaluator_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
