-- Fix calculate_visible_to_roles to also check permissions[].dataFilters
-- Previously only checked CustomRole.dataFilters (top-level), but the UI
-- saves filters in CustomRole.permissions[].dataFilters (inline per entity).
--
-- Now merges both sources (same logic as backend getRoleDataFilters):
--   1. CustomRole.dataFilters[].filters (top-level, by entitySlug)
--   2. CustomRole.permissions[].dataFilters (inline, by entitySlug)

-- Step 1: Update check_role_data_filters to accept both filter sources merged
-- (No change needed - it already works with any filter array)

-- Step 2: New helper to extract merged filters for an entity from a role
-- Returns the combined filters array from both dataFilters[] and permissions[].dataFilters
CREATE OR REPLACE FUNCTION get_role_entity_filters(
  p_role_data_filters JSONB,
  p_role_permissions JSONB,
  p_entity_slug TEXT
) RETURNS JSONB AS $$
DECLARE
  merged_filters JSONB := '[]'::jsonb;
  entity_df JSONB;
  perm_item JSONB;
BEGIN
  -- Source 1: dataFilters[] (top-level)
  IF p_role_data_filters IS NOT NULL
     AND jsonb_typeof(p_role_data_filters) = 'array'
     AND jsonb_array_length(p_role_data_filters) > 0 THEN
    SELECT f->'filters' INTO entity_df
    FROM jsonb_array_elements(p_role_data_filters) AS f
    WHERE f->>'entitySlug' = p_entity_slug
    LIMIT 1;

    IF entity_df IS NOT NULL AND jsonb_array_length(entity_df) > 0 THEN
      merged_filters := merged_filters || entity_df;
    END IF;
  END IF;

  -- Source 2: permissions[].dataFilters (inline per entity)
  IF p_role_permissions IS NOT NULL
     AND jsonb_typeof(p_role_permissions) = 'array'
     AND jsonb_array_length(p_role_permissions) > 0 THEN
    SELECT p INTO perm_item
    FROM jsonb_array_elements(p_role_permissions) AS p
    WHERE p->>'entitySlug' = p_entity_slug
    LIMIT 1;

    IF perm_item IS NOT NULL
       AND perm_item->'dataFilters' IS NOT NULL
       AND jsonb_typeof(perm_item->'dataFilters') = 'array'
       AND jsonb_array_length(perm_item->'dataFilters') > 0 THEN
      merged_filters := merged_filters || (perm_item->'dataFilters');
    END IF;
  END IF;

  RETURN merged_filters;
END;
$$ LANGUAGE plpgsql STABLE;

-- Step 3: New helper to check if a record passes merged filters
CREATE OR REPLACE FUNCTION check_merged_role_filters(
  p_record_data JSONB,
  p_filters JSONB
) RETURNS BOOLEAN AS $$
DECLARE
  filter_item JSONB;
  field_slug TEXT;
  operator TEXT;
  filter_value TEXT;
  record_value TEXT;
BEGIN
  IF p_filters IS NULL OR jsonb_array_length(p_filters) = 0 THEN
    RETURN TRUE;
  END IF;

  FOR filter_item IN SELECT * FROM jsonb_array_elements(p_filters)
  LOOP
    field_slug := filter_item->>'fieldSlug';
    operator := filter_item->>'operator';
    filter_value := filter_item->>'value';
    record_value := p_record_data->>field_slug;

    IF record_value IS NULL AND operator != 'isEmpty' THEN
      RETURN FALSE;
    END IF;

    CASE operator
      WHEN 'equals' THEN
        IF record_value != filter_value THEN RETURN FALSE; END IF;
      WHEN 'notEquals' THEN
        IF record_value = filter_value THEN RETURN FALSE; END IF;
      WHEN 'contains' THEN
        IF record_value NOT ILIKE '%' || filter_value || '%' THEN RETURN FALSE; END IF;
      WHEN 'startsWith' THEN
        IF record_value NOT ILIKE filter_value || '%' THEN RETURN FALSE; END IF;
      WHEN 'endsWith' THEN
        IF record_value NOT ILIKE '%' || filter_value THEN RETURN FALSE; END IF;
      WHEN 'gt' THEN
        IF (record_value::numeric) <= (filter_value::numeric) THEN RETURN FALSE; END IF;
      WHEN 'gte' THEN
        IF (record_value::numeric) < (filter_value::numeric) THEN RETURN FALSE; END IF;
      WHEN 'lt' THEN
        IF (record_value::numeric) >= (filter_value::numeric) THEN RETURN FALSE; END IF;
      WHEN 'lte' THEN
        IF (record_value::numeric) > (filter_value::numeric) THEN RETURN FALSE; END IF;
      WHEN 'isEmpty' THEN
        IF record_value IS NOT NULL AND record_value != '' THEN RETURN FALSE; END IF;
      WHEN 'isNotEmpty' THEN
        IF record_value IS NULL OR record_value = '' THEN RETURN FALSE; END IF;
      ELSE
        NULL; -- Unknown operator, pass
    END CASE;
  END LOOP;

  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql STABLE;

-- Step 4: Rewrite calculate_visible_to_roles to use merged filters
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
  merged_filters JSONB;
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
    SELECT id, "roleType",
           "dataFilters"::jsonb as data_filters,
           permissions::jsonb as perms
    FROM "CustomRole"
    WHERE "tenantId" = p_tenant_id
      AND "roleType" NOT IN ('PLATFORM_ADMIN', 'ADMIN')
  LOOP
    -- Get merged filters from both sources
    merged_filters := get_role_entity_filters(
      role_record.data_filters,
      role_record.perms,
      entity_slug
    );

    -- If this role has filters for this entity
    IF jsonb_array_length(merged_filters) > 0 THEN
      has_any_role_filters := TRUE;

      -- Check if record passes all filters
      IF check_merged_role_filters(p_record_data, merged_filters) THEN
        visible_roles := array_append(visible_roles, role_record.id);
      END IF;
    ELSE
      -- No filters for this entity = role can see all records
      visible_roles := array_append(visible_roles, role_record.id);
    END IF;
  END LOOP;

  -- If no role has filters for this entity, return NULL (all can see)
  IF NOT has_any_role_filters THEN
    RETURN NULL;
  END IF;

  -- Always include ADMIN/PLATFORM_ADMIN roles (they see everything)
  FOR role_record IN
    SELECT id FROM "CustomRole"
    WHERE "tenantId" = p_tenant_id
      AND "roleType" IN ('PLATFORM_ADMIN', 'ADMIN')
  LOOP
    visible_roles := array_append(visible_roles, role_record.id);
  END LOOP;

  RETURN visible_roles;
END;
$$ LANGUAGE plpgsql STABLE;

-- Step 5: Update CustomRole trigger to also fire on permissions change
-- (previously only fired on dataFilters change)
CREATE OR REPLACE FUNCTION trg_custom_role_data_filters_update()
RETURNS TRIGGER AS $$
DECLARE
  old_perms JSONB;
  new_perms JSONB;
  old_filters JSONB;
  new_filters JSONB;
  affected_slugs TEXT[] := ARRAY[]::TEXT[];
  slug_item TEXT;
  entity_id TEXT;
BEGIN
  old_filters := COALESCE(OLD."dataFilters"::jsonb, '[]'::jsonb);
  new_filters := COALESCE(NEW."dataFilters"::jsonb, '[]'::jsonb);
  old_perms := COALESCE(OLD.permissions::jsonb, '[]'::jsonb);
  new_perms := COALESCE(NEW.permissions::jsonb, '[]'::jsonb);

  -- Only recalculate if dataFilters or permissions changed
  IF old_filters IS DISTINCT FROM new_filters OR old_perms IS DISTINCT FROM new_perms THEN
    -- Collect all entity slugs from dataFilters (old + new)
    IF jsonb_typeof(old_filters) = 'array' AND jsonb_array_length(old_filters) > 0 THEN
      SELECT array_agg(DISTINCT f->>'entitySlug')
      INTO affected_slugs
      FROM jsonb_array_elements(old_filters) AS f
      WHERE f->>'entitySlug' IS NOT NULL;
    END IF;

    IF jsonb_typeof(new_filters) = 'array' AND jsonb_array_length(new_filters) > 0 THEN
      SELECT array_agg(DISTINCT f->>'entitySlug') || COALESCE(affected_slugs, ARRAY[]::TEXT[])
      INTO affected_slugs
      FROM jsonb_array_elements(new_filters) AS f
      WHERE f->>'entitySlug' IS NOT NULL;
    END IF;

    -- Collect all entity slugs from permissions that have dataFilters (old + new)
    IF jsonb_typeof(old_perms) = 'array' AND jsonb_array_length(old_perms) > 0 THEN
      SELECT COALESCE(affected_slugs, ARRAY[]::TEXT[]) || array_agg(DISTINCT p->>'entitySlug')
      INTO affected_slugs
      FROM jsonb_array_elements(old_perms) AS p
      WHERE p->>'entitySlug' IS NOT NULL
        AND p->'dataFilters' IS NOT NULL
        AND jsonb_typeof(p->'dataFilters') = 'array'
        AND jsonb_array_length(p->'dataFilters') > 0;
    END IF;

    IF jsonb_typeof(new_perms) = 'array' AND jsonb_array_length(new_perms) > 0 THEN
      SELECT COALESCE(affected_slugs, ARRAY[]::TEXT[]) || array_agg(DISTINCT p->>'entitySlug')
      INTO affected_slugs
      FROM jsonb_array_elements(new_perms) AS p
      WHERE p->>'entitySlug' IS NOT NULL
        AND p->'dataFilters' IS NOT NULL
        AND jsonb_typeof(p->'dataFilters') = 'array'
        AND jsonb_array_length(p->'dataFilters') > 0;
    END IF;

    -- Deduplicate and process each affected entity
    FOR slug_item IN
      SELECT DISTINCT unnest(COALESCE(affected_slugs, ARRAY[]::TEXT[]))
    LOOP
      SELECT id INTO entity_id
      FROM "Entity"
      WHERE slug = slug_item AND "tenantId" = NEW."tenantId";

      IF entity_id IS NOT NULL THEN
        UPDATE "EntityData" ed
        SET
          "_visibleToRoles" = sub.roles,
          "_hasRoleFilter" = (sub.roles IS NOT NULL),
          "_visibleToRolesJson" = CASE
            WHEN sub.roles IS NULL THEN '[]'::jsonb
            ELSE to_jsonb(sub.roles)
          END
        FROM (
          SELECT id, calculate_visible_to_roles("tenantId", "entityId", data::jsonb) as roles
          FROM "EntityData"
          WHERE "entityId" = entity_id AND "tenantId" = NEW."tenantId"
        ) sub
        WHERE ed.id = sub.id;
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 6: Update trigger to also fire on permissions column change
DROP TRIGGER IF EXISTS trg_custom_role_data_filters ON "CustomRole";
CREATE TRIGGER trg_custom_role_data_filters
  AFTER UPDATE OF "dataFilters", permissions
  ON "CustomRole"
  FOR EACH ROW
  EXECUTE FUNCTION trg_custom_role_data_filters_update();

-- Step 7: Backfill - recompute all records with updated function
UPDATE "EntityData"
SET "_visibleToRoles" = calculate_visible_to_roles(
  "tenantId",
  "entityId",
  data::jsonb
);

UPDATE "EntityData"
SET
  "_hasRoleFilter" = ("_visibleToRoles" IS NOT NULL),
  "_visibleToRolesJson" = CASE
    WHEN "_visibleToRoles" IS NULL THEN '[]'::jsonb
    ELSE to_jsonb("_visibleToRoles")
  END;
