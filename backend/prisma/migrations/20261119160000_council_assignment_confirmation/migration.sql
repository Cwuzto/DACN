-- AlterTable
ALTER TABLE "councils" ADD COLUMN "assignment_confirmed_at" TIMESTAMP(3),
ADD COLUMN "assignment_confirmed_by_id" INTEGER;

-- AddForeignKey
ALTER TABLE "councils" ADD CONSTRAINT "councils_assignment_confirmed_by_id_fkey" FOREIGN KEY ("assignment_confirmed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
