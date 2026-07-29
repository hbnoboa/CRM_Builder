CREATE TABLE "CommandTemplate" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "icon" TEXT,
  "targetEntitySlug" TEXT,
  "fields" JSONB,
  "actionType" TEXT NOT NULL DEFAULT 'create_record',
  "actionConfig" JSONB NOT NULL DEFAULT '{}',
  "execMode" TEXT NOT NULL DEFAULT 'as_user',
  "elevation" JSONB,
  "llm" JSONB,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommandTemplate_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CommandTemplate_tenantId_slug_key" ON "CommandTemplate"("tenantId", "slug");
CREATE INDEX "CommandTemplate_tenantId_isActive_idx" ON "CommandTemplate"("tenantId", "isActive");
