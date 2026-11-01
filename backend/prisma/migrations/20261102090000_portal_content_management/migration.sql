-- Portal CMS keeps resource identities separate from append-only content revisions.
CREATE TYPE "AnnouncementType" AS ENUM ('PDF', 'RICH_TEXT');
CREATE TYPE "PortalContentResourceType" AS ENUM ('CONFIGURATION', 'LINK', 'TEMPLATE', 'ANNOUNCEMENT');
CREATE TYPE "PortalRevisionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

ALTER TABLE "public_announcements"
  ADD COLUMN "announcement_type" "AnnouncementType" NOT NULL DEFAULT 'RICH_TEXT',
  ADD COLUMN "current_published_revision_id" INTEGER;

CREATE TABLE "portal_configurations" (
  "id" INTEGER NOT NULL DEFAULT 1,
  "current_published_revision_id" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "portal_configurations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "portal_links" (
  "id" SERIAL NOT NULL,
  "current_published_revision_id" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "portal_links_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "portal_templates" (
  "id" SERIAL NOT NULL,
  "current_published_revision_id" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "portal_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "portal_content_revisions" (
  "id" SERIAL NOT NULL,
  "resource_type" "PortalContentResourceType" NOT NULL,
  "resource_id" INTEGER NOT NULL,
  "version" INTEGER NOT NULL,
  "status" "PortalRevisionStatus" NOT NULL DEFAULT 'DRAFT',
  "payload" JSONB NOT NULL,
  "created_by_id" INTEGER,
  "published_by_id" INTEGER,
  "published_at" TIMESTAMP(3),
  "archived_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "portal_content_revisions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "public_announcements_current_published_revision_id_key" ON "public_announcements"("current_published_revision_id");
CREATE UNIQUE INDEX "portal_configurations_current_published_revision_id_key" ON "portal_configurations"("current_published_revision_id");
CREATE UNIQUE INDEX "portal_links_current_published_revision_id_key" ON "portal_links"("current_published_revision_id");
CREATE UNIQUE INDEX "portal_templates_current_published_revision_id_key" ON "portal_templates"("current_published_revision_id");
CREATE UNIQUE INDEX "portal_content_revisions_resource_type_resource_id_version_key" ON "portal_content_revisions"("resource_type", "resource_id", "version");
CREATE INDEX "portal_content_revisions_resource_type_resource_id_status_idx" ON "portal_content_revisions"("resource_type", "resource_id", "status");

ALTER TABLE "portal_content_revisions"
  ADD CONSTRAINT "portal_content_revisions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "portal_content_revisions_published_by_id_fkey" FOREIGN KEY ("published_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Legacy content is treated as plain text: never reinterpret stored text as HTML.
INSERT INTO "portal_content_revisions" ("resource_type", "resource_id", "version", "status", "payload", "created_by_id", "published_at", "created_at", "updated_at")
SELECT
  'ANNOUNCEMENT',
  pa."id",
  1,
  CASE WHEN pa."is_published" THEN 'PUBLISHED'::"PortalRevisionStatus" ELSE 'DRAFT'::"PortalRevisionStatus" END,
  CASE
    WHEN lower(coalesce(pa."file_name", '')) LIKE '%.pdf' THEN jsonb_build_object('title', pa."title", 'type', 'PDF', 'fileUrl', pa."file_url", 'fileName', pa."file_name", 'category', pa."category", 'isPinned', pa."is_pinned")
    WHEN nullif(trim(coalesce(pa."content", '')), '') IS NOT NULL THEN jsonb_build_object('title', pa."title", 'type', 'RICH_TEXT', 'richContentHtml', '<p>' || replace(replace(replace(pa."content", '&', '&amp;'), '<', '&lt;'), '>', '&gt;') || '</p>', 'category', pa."category", 'isPinned', pa."is_pinned")
    ELSE jsonb_build_object('title', pa."title", 'type', 'RICH_TEXT', 'migrationState', 'REMEDIATION_REQUIRED')
  END,
  pa."author_id",
  CASE WHEN pa."is_published" THEN pa."created_at" ELSE NULL END,
  pa."created_at",
  pa."updated_at"
FROM "public_announcements" pa;

UPDATE "public_announcements" pa
SET "announcement_type" = CASE WHEN lower(coalesce(pa."file_name", '')) LIKE '%.pdf' THEN 'PDF'::"AnnouncementType" ELSE 'RICH_TEXT'::"AnnouncementType" END,
    "current_published_revision_id" = revision."id"
FROM "portal_content_revisions" revision
WHERE revision."resource_type" = 'ANNOUNCEMENT'
  AND revision."resource_id" = pa."id"
  AND revision."status" = 'PUBLISHED';
