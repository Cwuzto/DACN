-- CreateEnum
CREATE TYPE "StudentGender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateTable
CREATE TABLE "student_profiles" (
    "student_id" INTEGER NOT NULL,
    "gender" "StudentGender" NOT NULL,
    "date_of_birth" DATE NOT NULL,
    "class_name" TEXT NOT NULL,
    "major" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_profiles_pkey" PRIMARY KEY ("student_id")
);

-- AddForeignKey
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
