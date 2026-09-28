CREATE TABLE "permissions" (
  "id" SERIAL NOT NULL,
  "code" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "module" TEXT NOT NULL,
  CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");
CREATE INDEX "permissions_module_idx" ON "permissions"("module");

CREATE TABLE "permission_groups" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "description" TEXT,
  "is_system" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "permission_groups_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "permission_groups_name_key" ON "permission_groups"("name");
CREATE UNIQUE INDEX "permission_groups_code_key" ON "permission_groups"("code");

CREATE TABLE "permission_group_permissions" (
  "permission_group_id" INTEGER NOT NULL,
  "permission_id" INTEGER NOT NULL,
  CONSTRAINT "permission_group_permissions_pkey" PRIMARY KEY ("permission_group_id", "permission_id"),
  CONSTRAINT "permission_group_permissions_group_fkey" FOREIGN KEY ("permission_group_id") REFERENCES "permission_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "permission_group_permissions_permission_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "permission_group_permissions_permission_id_idx" ON "permission_group_permissions"("permission_id");

CREATE TABLE "user_permission_groups" (
  "user_id" INTEGER NOT NULL,
  "permission_group_id" INTEGER NOT NULL,
  CONSTRAINT "user_permission_groups_pkey" PRIMARY KEY ("user_id", "permission_group_id"),
  CONSTRAINT "user_permission_groups_user_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "user_permission_groups_group_fkey" FOREIGN KEY ("permission_group_id") REFERENCES "permission_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "user_permission_groups_group_id_idx" ON "user_permission_groups"("permission_group_id");
