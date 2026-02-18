-- Add _matchesGlobalFilter column to EntityData
-- This column is maintained by triggers using the check_global_filters() function.
-- PowerSync sync rules filter on this column to avoid syncing unnecessary records.

-- Step 1: Add column (default true so existing records without filters still sync)
ALTER TABLE "EntityData" ADD COLUMN "_matchesGlobalFilter" BOOLEAN NOT NULL DEFAULT true;

-- Step 2: Create trigger function for EntityData INSERT/UPDATE
-- Recalculates _matchesGlobalFilter by looking up the entity's globalFilters
CREATE OR REPLACE FUNCTION trg_entity_data_check_global_filter()
RETURNS TRIGGER AS $$
DECLARE
  entity_settings JSONB;
  global_filters JSONB;
BEGIN
  -- Get the entity's settings
  SELECT settings::jsonb INTO entity_settings
  FROM "Entity"
  WHERE id = NEW."entityId";

  -- Extract globalFilters array
  global_filters := entity_settings->'globalFilters';

  -- Evaluate filters against the record data
  NEW."_matchesGlobalFilter" := check_global_filters(NEW.data::jsonb, global_filters);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Create trigger on EntityData INSERT/UPDATE
DROP TRIGGER IF EXISTS trg_entity_data_global_filter ON "EntityData";
CREATE TRIGGER trg_entity_data_global_filter
  BEFORE INSERT OR UPDATE OF data, "entityId"
  ON "EntityData"
  FOR EACH ROW
  EXECUTE FUNCTION trg_entity_data_check_global_filter();

-- Step 4: Create trigger function for Entity UPDATE (when globalFilters change)
-- Recalculates _matchesGlobalFilter for ALL records of that entity
CREATE OR REPLACE FUNCTION trg_entity_settings_update_global_filter()
RETURNS TRIGGER AS $$
DECLARE
  old_filters JSONB;
  new_filters JSONB;
BEGIN
  old_filters := (OLD.settings::jsonb)->'globalFilters';
  new_filters := (NEW.settings::jsonb)->'globalFilters';

  -- Only recalculate if globalFilters actually changed
  IF old_filters IS DISTINCT FROM new_filters THEN
    UPDATE "EntityData"
    SET "_matchesGlobalFilter" = check_global_filters(data::jsonb, new_filters)
    WHERE "entityId" = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Create trigger on Entity settings UPDATE
DROP TRIGGER IF EXISTS trg_entity_settings_global_filter ON "Entity";
CREATE TRIGGER trg_entity_settings_global_filter
  AFTER UPDATE OF settings
  ON "Entity"
  FOR EACH ROW
  EXECUTE FUNCTION trg_entity_settings_update_global_filter();

-- Step 6: Backfill existing records
-- Evaluate all EntityData against their entity's current globalFilters
UPDATE "EntityData" ed
SET "_matchesGlobalFilter" = check_global_filters(
  ed.data::jsonb,
  (SELECT (e.settings::jsonb)->'globalFilters' FROM "Entity" e WHERE e.id = ed."entityId")
);

-- Step 7: Index for PowerSync sync performance
CREATE INDEX idx_entity_data_global_filter ON "EntityData" ("tenantId", "_matchesGlobalFilter") WHERE "deletedAt" IS NULL;
