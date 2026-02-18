-- Add _parentMatchesFilter column to EntityData
-- Sub-entities only sync if their parent record also passes global filters.
-- This prevents downloading child records whose parent was filtered out.

-- Step 1: Add column (default true for root records, will be calculated for children)
ALTER TABLE "EntityData" ADD COLUMN "_parentMatchesFilter" BOOLEAN NOT NULL DEFAULT true;

-- Step 2: Function to get parent's filter status
CREATE OR REPLACE FUNCTION get_parent_filter_status(parent_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  IF parent_id IS NULL THEN
    RETURN true;  -- Root records always pass
  END IF;

  -- Get parent's combined filter status
  RETURN COALESCE(
    (SELECT "_matchesGlobalFilter" AND "_parentMatchesFilter"
     FROM "EntityData"
     WHERE id = parent_id),
    true
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- Step 3: Update the existing trigger to also set _parentMatchesFilter
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

  -- Get parent's filter status
  NEW."_parentMatchesFilter" := get_parent_filter_status(NEW."parentRecordId");

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Function to propagate filter status to children
-- When a parent's _matchesGlobalFilter changes, update all children
CREATE OR REPLACE FUNCTION propagate_filter_to_children()
RETURNS TRIGGER AS $$
DECLARE
  old_status BOOLEAN;
  new_status BOOLEAN;
BEGIN
  old_status := OLD."_matchesGlobalFilter" AND OLD."_parentMatchesFilter";
  new_status := NEW."_matchesGlobalFilter" AND NEW."_parentMatchesFilter";

  -- Only propagate if the combined status changed
  IF old_status IS DISTINCT FROM new_status THEN
    -- Update direct children
    UPDATE "EntityData"
    SET "_parentMatchesFilter" = new_status
    WHERE "parentRecordId" = NEW.id;

    -- Note: This triggers recursively for grandchildren via the trigger
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Create trigger to propagate changes to children
DROP TRIGGER IF EXISTS trg_propagate_filter_to_children ON "EntityData";
CREATE TRIGGER trg_propagate_filter_to_children
  AFTER UPDATE OF "_matchesGlobalFilter", "_parentMatchesFilter"
  ON "EntityData"
  FOR EACH ROW
  EXECUTE FUNCTION propagate_filter_to_children();

-- Step 6: Backfill existing records
-- First, set root records (no parent)
UPDATE "EntityData"
SET "_parentMatchesFilter" = true
WHERE "parentRecordId" IS NULL;

-- Then, recursively update children based on their parents
-- We do this in a loop to handle nested hierarchies
DO $$
DECLARE
  updated_count INTEGER;
  iteration INTEGER := 0;
  max_iterations INTEGER := 10;  -- Prevent infinite loop
BEGIN
  LOOP
    iteration := iteration + 1;

    -- Update children whose parent has a known status
    WITH parent_status AS (
      SELECT id, ("_matchesGlobalFilter" AND "_parentMatchesFilter") as combined_status
      FROM "EntityData"
    )
    UPDATE "EntityData" ed
    SET "_parentMatchesFilter" = ps.combined_status
    FROM parent_status ps
    WHERE ed."parentRecordId" = ps.id
      AND ed."_parentMatchesFilter" IS DISTINCT FROM ps.combined_status;

    GET DIAGNOSTICS updated_count = ROW_COUNT;

    -- Exit when no more updates or max iterations reached
    EXIT WHEN updated_count = 0 OR iteration >= max_iterations;

    RAISE NOTICE 'Iteration %: updated % records', iteration, updated_count;
  END LOOP;
END $$;

-- Step 7: Create index for sync performance
CREATE INDEX idx_entity_data_parent_filter
ON "EntityData" ("tenantId", "_matchesGlobalFilter", "_parentMatchesFilter")
WHERE "deletedAt" IS NULL;
