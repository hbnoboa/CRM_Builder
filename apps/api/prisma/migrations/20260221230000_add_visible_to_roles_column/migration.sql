-- Add _visibleToRoles column to EntityData
-- This column tracks which CustomRole IDs can see this record based on dataFilters.
-- PowerSync sync rules filter on this column to sync only permitted records.
--
-- Logic:
-- - NULL or empty array: all roles can see (no role filters configured)
-- - Array with IDs: only those roles can see
-- - PLATFORM_ADMIN and ADMIN always see everything (checked in sync rules)

-- Step 1: Add column
ALTER TABLE "EntityData" ADD COLUMN "_visibleToRoles" TEXT[];

-- Step 2: Create function to check if a record matches a single role's dataFilters
-- Returns TRUE if record passes all filters for the given entity
CREATE OR REPLACE FUNCTION check_role_data_filters(
  record_data JSONB,
  role_data_filters JSONB,
  p_entity_slug TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  entity_filters JSONB;
  filter_item JSONB;
  field_slug TEXT;
  operator TEXT;
  filter_value TEXT;
  record_value TEXT;
  passes_all BOOLEAN := TRUE;
BEGIN
  -- Find filters for this entity
  SELECT f INTO entity_filters
  FROM jsonb_array_elements(role_data_filters) AS f
  WHERE f->>'entitySlug' = p_entity_slug
  LIMIT 1;

  -- If no filters for this entity, record passes
  IF entity_filters IS NULL THEN
    RETURN TRUE;
  END IF;

  -- Check each filter
  FOR filter_item IN SELECT * FROM jsonb_array_elements(entity_filters->'filters')
  LOOP
    field_slug := filter_item->>'fieldSlug';
    operator := filter_item->>'operator';
    filter_value := filter_item->>'value';

    -- Get record value (handle nested JSON)
    record_value := record_data->>field_slug;

    -- If field doesn't exist, fail the filter (except isEmpty)
    IF record_value IS NULL AND operator != 'isEmpty' THEN
      passes_all := FALSE;
      EXIT;
    END IF;

    -- Evaluate operator
    CASE operator
      WHEN 'equals' THEN
        IF record_value != filter_value THEN
          passes_all := FALSE;
          EXIT;
        END IF;
      WHEN 'contains' THEN
        IF record_value NOT ILIKE '%' || filter_value || '%' THEN
          passes_all := FALSE;
          EXIT;
        END IF;
      WHEN 'startsWith' THEN
        IF record_value NOT ILIKE filter_value || '%' THEN
          passes_all := FALSE;
          EXIT;
        END IF;
      WHEN 'endsWith' THEN
        IF record_value NOT ILIKE '%' || filter_value THEN
          passes_all := FALSE;
          EXIT;
        END IF;
      WHEN 'gt' THEN
        IF (record_value::numeric) <= (filter_value::numeric) THEN
          passes_all := FALSE;
          EXIT;
        END IF;
      WHEN 'gte' THEN
        IF (record_value::numeric) < (filter_value::numeric) THEN
          passes_all := FALSE;
          EXIT;
        END IF;
      WHEN 'lt' THEN
        IF (record_value::numeric) >= (filter_value::numeric) THEN
          passes_all := FALSE;
          EXIT;
        END IF;
      WHEN 'lte' THEN
        IF (record_value::numeric) > (filter_value::numeric) THEN
          passes_all := FALSE;
          EXIT;
        END IF;
      WHEN 'isEmpty' THEN
        IF record_value IS NOT NULL AND record_value != '' THEN
          passes_all := FALSE;
          EXIT;
        END IF;
      WHEN 'isNotEmpty' THEN
        IF record_value IS NULL OR record_value = '' THEN
          passes_all := FALSE;
          EXIT;
        END IF;
      ELSE
        -- Unknown operator, assume pass
        NULL;
    END CASE;
  END LOOP;

  RETURN passes_all;
EXCEPTION
  WHEN OTHERS THEN
    -- On any error (e.g., numeric conversion), fail safely
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql STABLE;

-- Step 3: Create function to calculate _visibleToRoles for a record
-- Returns array of role IDs that can see this record
CREATE OR REPLACE FUNCTION calculate_visible_to_roles(
  p_tenant_id TEXT,
  p_entity_id TEXT,
  p_record_data JSONB
) RETURNS TEXT[] AS $$
DECLARE
  role_record RECORD;
  entity_slug TEXT;
  visible_roles TEXT[] := ARRAY[]::TEXT[];
  has_any_role_filters BOOLEAN := FALSE;
BEGIN
  -- Get entity slug
  SELECT slug INTO entity_slug
  FROM "Entity"
  WHERE id = p_entity_id;

  IF entity_slug IS NULL THEN
    RETURN NULL;
  END IF;

  -- Check each non-admin role in the tenant
  FOR role_record IN
    SELECT id, "roleType", "dataFilters"::jsonb as data_filters
    FROM "CustomRole"
    WHERE "tenantId" = p_tenant_id
      AND "roleType" NOT IN ('PLATFORM_ADMIN', 'ADMIN')
  LOOP
    -- Check if this role has dataFilters for this entity
    IF role_record.data_filters IS NOT NULL
       AND jsonb_typeof(role_record.data_filters) = 'array'
       AND jsonb_array_length(role_record.data_filters) > 0 THEN

      -- Check if there are filters for this specific entity
      IF EXISTS (
        SELECT 1 FROM jsonb_array_elements(role_record.data_filters) AS f
        WHERE f->>'entitySlug' = entity_slug
          AND jsonb_array_length(COALESCE(f->'filters', '[]'::jsonb)) > 0
      ) THEN
        has_any_role_filters := TRUE;

        -- Check if record passes this role's filters
        IF check_role_data_filters(p_record_data, role_record.data_filters, entity_slug) THEN
          visible_roles := array_append(visible_roles, role_record.id);
        END IF;
      ELSE
        -- Role has no filters for this entity, add it
        visible_roles := array_append(visible_roles, role_record.id);
      END IF;
    ELSE
      -- Role has no dataFilters at all, add it
      visible_roles := array_append(visible_roles, role_record.id);
    END IF;
  END LOOP;

  -- If no roles have filters for this entity, return NULL (all can see)
  IF NOT has_any_role_filters THEN
    RETURN NULL;
  END IF;

  RETURN visible_roles;
END;
$$ LANGUAGE plpgsql STABLE;

-- Step 4: Create trigger function for EntityData INSERT/UPDATE
CREATE OR REPLACE FUNCTION trg_entity_data_calc_visible_roles()
RETURNS TRIGGER AS $$
BEGIN
  NEW."_visibleToRoles" := calculate_visible_to_roles(
    NEW."tenantId",
    NEW."entityId",
    NEW.data::jsonb
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Create trigger on EntityData
DROP TRIGGER IF EXISTS trg_entity_data_visible_roles ON "EntityData";
CREATE TRIGGER trg_entity_data_visible_roles
  BEFORE INSERT OR UPDATE OF data, "entityId"
  ON "EntityData"
  FOR EACH ROW
  EXECUTE FUNCTION trg_entity_data_calc_visible_roles();

-- Step 6: Create trigger function for CustomRole dataFilters change
-- Recalculates _visibleToRoles for ALL records of affected entities
CREATE OR REPLACE FUNCTION trg_custom_role_data_filters_update()
RETURNS TRIGGER AS $$
DECLARE
  old_filters JSONB;
  new_filters JSONB;
  affected_entity_slug TEXT;
  entity_id TEXT;
BEGIN
  old_filters := COALESCE(OLD."dataFilters"::jsonb, '[]'::jsonb);
  new_filters := COALESCE(NEW."dataFilters"::jsonb, '[]'::jsonb);

  -- Only recalculate if dataFilters actually changed
  IF old_filters IS DISTINCT FROM new_filters THEN
    -- Get all unique entity slugs from both old and new filters
    FOR affected_entity_slug IN
      SELECT DISTINCT f->>'entitySlug'
      FROM (
        SELECT jsonb_array_elements(old_filters) AS f
        UNION
        SELECT jsonb_array_elements(new_filters) AS f
      ) combined
      WHERE f->>'entitySlug' IS NOT NULL
    LOOP
      -- Get entity ID
      SELECT id INTO entity_id
      FROM "Entity"
      WHERE slug = affected_entity_slug AND "tenantId" = NEW."tenantId";

      IF entity_id IS NOT NULL THEN
        -- Recalculate for all records of this entity
        UPDATE "EntityData"
        SET "_visibleToRoles" = calculate_visible_to_roles(
          "tenantId",
          "entityId",
          data::jsonb
        )
        WHERE "entityId" = entity_id AND "tenantId" = NEW."tenantId";
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 7: Create trigger on CustomRole
DROP TRIGGER IF EXISTS trg_custom_role_data_filters ON "CustomRole";
CREATE TRIGGER trg_custom_role_data_filters
  AFTER UPDATE OF "dataFilters"
  ON "CustomRole"
  FOR EACH ROW
  EXECUTE FUNCTION trg_custom_role_data_filters_update();

-- Step 8: Backfill existing records
-- This may take a while for large datasets
UPDATE "EntityData"
SET "_visibleToRoles" = calculate_visible_to_roles(
  "tenantId",
  "entityId",
  data::jsonb
);

-- Step 9: Create index for PowerSync performance
CREATE INDEX idx_entity_data_visible_roles ON "EntityData" USING GIN ("_visibleToRoles") WHERE "deletedAt" IS NULL;
