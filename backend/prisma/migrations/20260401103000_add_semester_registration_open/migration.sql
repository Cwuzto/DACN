-- Add registration_open toggle per semester
ALTER TABLE "semesters"
ADD COLUMN "registration_open" BOOLEAN NOT NULL DEFAULT true;
