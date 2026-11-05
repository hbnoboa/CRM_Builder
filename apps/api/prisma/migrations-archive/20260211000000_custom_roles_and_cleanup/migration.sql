-- Remove Plan system (enum + column)
DROP INDEX IF EXISTS "Tenant_plan_idx";
ALTER TABLE "Tenant" DROP COLUMN IF EXISTS "plan";
DROP TYPE IF EXISTS "Plan";

-- Create CustomRole table
CREATE TABLE "CustomRole" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT DEFAULT '#6366f1',
    "permissions" JSONB NOT NULL DEFAULT '[]',
    "modulePermissions" JSONB NOT NULL DEFAULT '{}',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomRole_pkey" PRIMARY KEY ("id")
);

-- Add customRoleId to User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "customRoleId" TEXT;

-- Add entitySlug to Notification
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "entitySlug" TEXT;

-- Indexes for CustomRole
CREATE UNIQUE INDEX IF NOT EXISTS "CustomRole_tenantId_name_key" ON "CustomRole"("tenantId", "name");
CREATE INDEX IF NOT EXISTS "CustomRole_tenantId_idx" ON "CustomRole"("tenantId");

-- Index for Notification entitySlug
CREATE INDEX IF NOT EXISTS "Notification_entitySlug_idx" ON "Notification"("entitySlug");

-- Foreign keys
ALTER TABLE "CustomRole" ADD CONSTRAINT "CustomRole_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_customRoleId_fkey" FOREIGN KEY ("customRoleId") REFERENCES "CustomRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;
