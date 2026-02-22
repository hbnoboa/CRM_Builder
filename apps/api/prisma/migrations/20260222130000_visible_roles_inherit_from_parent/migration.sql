-- Sub-entity records inherit role visibility from their parent record.
-- If a vehicle is filtered by role, its child non-conformities must also be filtered.
--
-- Logic:
-- 1. Compute own visibility from role filters (existing logic)
-- 2. If record has parentRecordId and parent has _hasRoleFilter=true:
--    - If child has no own filters → inherit parent's _visibleToRoles
--    - If child has own filters → intersect with parent's
-- 3. When parent's _visibleToRoles changes → propagate to children

-- Step 1: Update calculate_visible_to_roles to accept parentRecordId
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

  -- Check parent record visibility (sub-entity inheritance)
  IF p_parent_record_id IS NOT NULL THEN
    SELECT "_hasRoleFilter", "_visibleToRoles"
    INTO parent_has_filter, parent_visible_roles
    FROM "EntityData"
    WHERE id = p_parent_record_id;

    IF parent_has_filter IS TRUE AND parent_visible_roles IS NOT NULL THEN
      IF NOT has_any_role_filters THEN
        -- Child has no own role filters → inherit parent's visibility entirely
        RETURN parent_visible_roles;
      ELSE
        -- Both have filters → intersect (only roles in BOTH arrays)
        visible_roles := ARRAY(
          SELECT unnest(visible_roles)
          INTERSECT
          SELECT unnest(parent_visible_roles)
        );
        -- Keep has_any_role_filters = true, fall through to admin addition
      END IF;
    END IF;
  END IF;

  -- If no roles have filters for this entity AND parent has no filters, return NULL
  IF NOT has_any_role_filters AND (parent_has_filter IS NOT TRUE) THEN
    RETURN NULL;
  END IF;

  -- Always include ADMIN/PLATFORM_ADMIN roles when filters exist
  -- (only add if not already present from parent inheritance)
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

-- Step 2: Update EntityData BEFORE trigger to pass parentRecordId
CREATE OR REPLACE FUNCTION trg_entity_data_calc_visible_roles()
RETURNS TRIGGER AS $$
DECLARE
  roles TEXT[];
BEGIN
  roles := calculate_visible_to_roles(
    NEW."tenantId",
    NEW."entityId",
    NEW.data::jsonb,
    NEW."parentRecordId"
  );

  NEW."_visibleToRoles" := roles;

  -- Derive PowerSync-compatible columns
  IF roles IS NULL THEN
    NEW."_hasRoleFilter" := false;
    NEW."_visibleToRolesJson" := '[]'::jsonb;
  ELSE
    NEW."_hasRoleFilter" := true;
    NEW."_visibleToRolesJson" := to_jsonb(roles);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Add AFTER trigger to propagate _visibleToRoles changes to children
CREATE OR REPLACE FUNCTION trg_entity_data_propagate_visible_roles()
RETURNS TRIGGER AS $$
DECLARE
  old_roles TEXT[];
  new_roles TEXT[];
BEGIN
  old_roles := OLD."_visibleToRoles";
  new_roles := NEW."_visibleToRoles";

  -- Only propagate if visibility changed
  IF old_roles IS DISTINCT FROM new_roles THEN
    -- Recompute all direct children
    UPDATE "EntityData" child
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
      WHERE "parentRecordId" = NEW.id
    ) sub
    WHERE child.id = sub.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_entity_data_propagate_visible_roles ON "EntityData";
CREATE TRIGGER trg_entity_data_propagate_visible_roles
  AFTER UPDATE OF "_visibleToRoles"
  ON "EntityData"
  FOR EACH ROW
  EXECUTE FUNCTION trg_entity_data_propagate_visible_roles();

-- Step 4: Update CustomRole trigger to also recompute child entity records
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

  IF old_filters IS DISTINCT FROM new_filters OR old_perms IS DISTINCT FROM new_perms THEN
    -- Collect entity slugs from dataFilters (old + new)
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

    -- Collect entity slugs from permissions with dataFilters (old + new)
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

    -- Process each affected entity
    FOR slug_item IN
      SELECT DISTINCT unnest(COALESCE(affected_slugs, ARRAY[]::TEXT[]))
    LOOP
      SELECT id INTO entity_id
      FROM "Entity"
      WHERE slug = slug_item AND "tenantId" = NEW."tenantId";

      IF entity_id IS NOT NULL THEN
        -- Recompute parent records first
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

        -- The AFTER trigger trg_entity_data_propagate_visible_roles
        -- will automatically propagate changes to children
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Backfill - recompute all records (parents first, then children inherit)
-- First: records WITHOUT parentRecordId (parents)
UPDATE "EntityData"
SET "_visibleToRoles" = calculate_visible_to_roles(
  "tenantId", "entityId", data::jsonb, "parentRecordId"
)
WHERE "parentRecordId" IS NULL;

-- Then: records WITH parentRecordId (children) - they'll read parent's values
UPDATE "EntityData"
SET "_visibleToRoles" = calculate_visible_to_roles(
  "tenantId", "entityId", data::jsonb, "parentRecordId"
)
WHERE "parentRecordId" IS NOT NULL;

-- Derive PowerSync columns from recomputed _visibleToRoles
UPDATE "EntityData"
SET
  "_hasRoleFilter" = ("_visibleToRoles" IS NOT NULL),
  "_visibleToRolesJson" = CASE
    WHEN "_visibleToRoles" IS NULL THEN '[]'::jsonb
    ELSE to_jsonb("_visibleToRoles")
  END;
