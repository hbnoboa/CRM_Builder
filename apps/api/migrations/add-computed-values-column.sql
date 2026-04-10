-- Migration: Add computedValues column to EntityData and ArchivedEntityData
-- Data: 2026-04-10
-- Objetivo: Materializar computed fields para queries mais eficientes

-- 1. Adicionar coluna computedValues em EntityData
ALTER TABLE "EntityData"
  ADD COLUMN IF NOT EXISTS "computedValues" JSONB DEFAULT '{}';

-- 2. Adicionar índice GIN para queries em computedValues
CREATE INDEX IF NOT EXISTS "EntityData_computedValues_idx"
  ON "EntityData" USING gin("computedValues");

-- 3. Adicionar coluna computedValues em ArchivedEntityData
ALTER TABLE "ArchivedEntityData"
  ADD COLUMN IF NOT EXISTS "computedValues" JSONB DEFAULT '{}';

-- 4. Adicionar índice GIN para queries em computedValues (archived)
CREATE INDEX IF NOT EXISTS "ArchivedEntityData_computedValues_idx"
  ON "ArchivedEntityData" USING gin("computedValues");

-- 5. Comentários explicativos
COMMENT ON COLUMN "EntityData"."computedValues" IS 'Materialized computed field values (formulas, rollups, timers, sla-status). Recomputed when dependencies change.';
COMMENT ON COLUMN "ArchivedEntityData"."computedValues" IS 'Materialized computed field values (formulas, rollups, timers, sla-status). Recomputed when dependencies change.';
