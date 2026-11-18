-- CreateTable
CREATE TABLE "topic_expertise_assessments" (
    "id" SERIAL NOT NULL,
    "topic_id" INTEGER NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "candidate_areas" JSONB NOT NULL DEFAULT '[]',
    "accepted_areas" JSONB NOT NULL DEFAULT '[]',
    "evidence_text" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEEDS_REVIEW',
    "reviewed_by_id" INTEGER,
    "reviewed_at" TIMESTAMP(3),
    "model" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "topic_expertise_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "topic_expertise_assessments_topic_id_key" ON "topic_expertise_assessments"("topic_id");

-- AddForeignKey
ALTER TABLE "topic_expertise_assessments" ADD CONSTRAINT "topic_expertise_assessments_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topic_expertise_assessments" ADD CONSTRAINT "topic_expertise_assessments_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
