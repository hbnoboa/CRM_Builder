-- Remove dead CustomRole.dataFilters column.
-- This column was always [] (empty). The actual filter data lives in
-- CustomRole.permissions[].dataFilters (inline per entity).
--
-- Changes:
-- 1. Simplify get_role_entity_filters() to only read permissions[].dataFilters
-- 2. Simplify calculate_visible_to_roles() — no more data_filters parameter
-- 3. Simplify trg_custom_role_data_filters_update() — only watch permissions
-- 4. Drop the column

-- Step 1: Simplify get_role_entity_filters to single source (permissions[].dataFilters)
CREATE OR REPLACE FUNCTION get_role_entity_filters(
  p_role_permissions JSONB,
  p_entity_slug TEXT
) RETURNS JSONB AS $$
DECLARE
  perm_item JSONB;
BEGIN
  IF p_role_permissions IS NULL
     OR jsonb_typeof(p_role_permissions) != 'array'
     OR jsonb_array_length(p_role_permissions) = 0 THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT p INTO perm_item
  FROM jsonb_array_elements(p_role_permissions) AS p
  WHERE p->>'entitySlug' = p_entity_slug
  LIMIT 1;

  IF perm_item IS NOT NULL
     AND perm_item->'dataFilters' IS NOT NULL
     AND jsonb_typeof(perm_item->'dataFilters') = 'array'
     AND jsonb_array_length(perm_item->'dataFilters') > 0 THEN
    RETURN perm_item->'dataFilters';
  END IF;

  RETURN '[]'::jsonb;
END;
$$ LANGUAGE plpgsql STABLE;

-- Step 2: Update calculate_visible_to_roles to use new signature
CREATE OR REPLACE FUNCTION calculate_visible_to_roles(
  p_tenant_id TEXT,
  p_entity_id TEXT,
  p_record_data JSONB,
  p_parent_record_id TEXT DEFAULT NULL
) RETURNS TEXT[] AS $$
DECLARE
  role_record RECORD;
  entity_slug TEXT;
  visible_roles TEXT[] := ARRAY[]::TEXT[];
  has_any_role_filters BOOLEAN := FALSE;
  merged_filters JSONB;
  parent_has_filter BOOLEAN;
  parent_visible_roles TEXT[];
BEGIN
  SELECT slug INTO entity_slug
  FROM "Entity"
  WHERE id = p_entity_id;

  IF entity_slug IS NULL THEN
    RETURN NULL;
  END IF;

  FOR role_record IN
    SELECT id, "roleType", permissions::jsonb as perms
    FROM "CustomRole"
    WHERE "tenantId" = p_tenant_id
      AND "roleType" NOT IN ('PLATFORM_ADMIN', 'ADMIN')
  LOOP
    merged_filters := get_role_entity_filters(role_record.perms, entity_slug);

    IF jsonb_array_length(merged_filters) > 0 THEN
      has_any_role_filters := TRUE;
      IF check_merged_role_filters(p_record_data, merged_filters) THEN
        visible_roles := array_append(visible_roles, role_record.id);
      END IF;
    ELSE
      visible_roles := array_append(visible_roles, role_record.id);
    END IF;
  END LOOP;

  -- Sub-entity inheritance from parent
  IF p_parent_record_id IS NOT NULL THEN
    SELECT "_hasRoleFilter", "_visibleToRoles"
    INTO parent_has_filter, parent_visible_roles
    FROM "EntityData"
    WHERE id = p_parent_record_id;

    IF parent_has_filter IS TRUE AND parent_visible_roles IS NOT NULL THEN
      IF NOT has_any_role_filters THEN
        RETURN parent_visible_roles;
      ELSE
        visible_roles := ARRAY(
          SELECT unnest(visible_roles)
          INTERSECT
          SELECT unnest(parent_visible_roles)
        );
      END IF;
    END IF;
  END IF;

  IF NOT has_any_role_filters AND (parent_has_filter IS NOT TRUE) THEN
    RETURN NULL;
  END IF;

  -- Always include ADMIN/PLATFORM_ADMIN roles
  FOR role_record IN
    SELECT id FROM "CustomRole"
    WHERE "tenantId" = p_tenant_id
      AND "roleType" IN ('PLATFORM_ADMIN', 'ADMIN')
  LOOP
    IF NOT (role_record.id = ANY(visible_roles)) THEN
      visible_roles := array_append(visible_roles, role_record.id);
    END IF;
  END LOOP;

  RETURN visible_roles;
END;
$$ LANGUAGE plpgsql STABLE;

-- Step 3: Simplify CustomRole trigger — only watch permissions column
CREATE OR REPLACE FUNCTION trg_custom_role_data_filters_update()
RETURNS TRIGGER AS $$
DECLARE
  old_perms JSONB;
  new_perms JSONB;
  affected_slugs TEXT[] := ARRAY[]::TEXT[];
  slug_item TEXT;
  entity_id TEXT;
BEGIN
  old_perms := COALESCE(OLD.permissions::jsonb, '[]'::jsonb);
  new_perms := COALESCE(NEW.permissions::jsonb, '[]'::jsonb);

  IF old_perms IS DISTINCT FROM new_perms THEN
    -- Collect entity slugs from old permissions with dataFilters
    IF jsonb_typeof(old_perms) = 'array' AND jsonb_array_length(old_perms) > 0 THEN
      SELECT array_agg(DISTINCT p->>'entitySlug')
      INTO affected_slugs
      FROM jsonb_array_elements(old_perms) AS p
      WHERE p->>'entitySlug' IS NOT NULL
        AND p->'dataFilters' IS NOT NULL
        AND jsonb_typeof(p->'dataFilters') = 'array'
        AND jsonb_array_length(p->'dataFilters') > 0;
    END IF;

    -- Collect entity slugs from new permissions with dataFilters
    IF jsonb_typeof(new_perms) = 'array' AND jsonb_array_length(new_perms) > 0 THEN
      SELECT COALESCE(affected_slugs, ARRAY[]::TEXT[]) || array_agg(DISTINCT p->>'entitySlug')
      INTO affected_slugs
      FROM jsonb_array_elements(new_perms) AS p
      WHERE p->>'entitySlug' IS NOT NULL
        AND p->'dataFilters' IS NOT NULL
        AND jsonb_typeof(p->'dataFilters') = 'array'
        AND jsonb_array_length(p->'dataFilters') > 0;
    END IF;

    -- Recompute each affected entity
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
          SELECT id, calculate_visible_to_roles(
            "tenantId", "entityId", data::jsonb, "parentRecordId"
          ) as roles
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

-- Step 4: Recreate trigger on permissions only (drop old trigger that watched dataFilters + permissions)
DROP TRIGGER IF EXISTS trg_custom_role_data_filters ON "CustomRole";
CREATE TRIGGER trg_custom_role_data_filters
  AFTER UPDATE OF permissions
  ON "CustomRole"
  FOR EACH ROW
  EXECUTE FUNCTION trg_custom_role_data_filters_update();

-- Step 5: Drop the dead column
ALTER TABLE "CustomRole" DROP COLUMN IF EXISTS "dataFilters";
