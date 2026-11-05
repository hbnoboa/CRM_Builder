-- AlterTable
ALTER TABLE "EntityData" ADD COLUMN IF NOT EXISTS "computedValues" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "ArchivedEntityData" ADD COLUMN IF NOT EXISTS "computedValues" JSONB NOT NULL DEFAULT '{}';

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EntityData_computedValues_idx" ON "EntityData" USING GIN ("computedValues");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ArchivedEntityData_computedValues_idx" ON "ArchivedEntityData" USING GIN ("computedValues");
