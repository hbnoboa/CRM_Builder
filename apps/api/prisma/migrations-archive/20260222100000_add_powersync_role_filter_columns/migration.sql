-- Add _hasRoleFilter and _visibleToRolesJson columns to EntityData
-- These columns are derived from _visibleToRoles but in formats PowerSync understands:
--   _hasRoleFilter (Boolean): true if record has role-based filters applied
--   _visibleToRolesJson (JSONB): JSON array of role IDs that can see this record
--
-- PowerSync's IN operator works with JSONB arrays (not TEXT[]),
-- so we need _visibleToRolesJson for the sync rules.
--
-- IMPORTANT: ADMIN/PLATFORM_ADMIN roles are always included in _visibleToRolesJson
-- when _hasRoleFilter=true, so they can see all records via the role_filtered bucket.

-- Step 1: Add columns
ALTER TABLE "EntityData" ADD COLUMN "_hasRoleFilter" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "EntityData" ADD COLUMN "_visibleToRolesJson" JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Step 2: Update calculate_visible_to_roles to include ADMIN/PLATFORM_ADMIN role IDs
-- When role filters exist for an entity, admins must also be in the array
-- so PowerSync syncs those records to admin devices too.
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

  -- When filters exist, always include ADMIN/PLATFORM_ADMIN roles
  -- so they can see everything via the role_filtered PowerSync bucket
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

-- Step 3: Update EntityData trigger to also populate new columns
CREATE OR REPLACE FUNCTION trg_entity_data_calc_visible_roles()
RETURNS TRIGGER AS $$
DECLARE
  roles TEXT[];
BEGIN
  roles := calculate_visible_to_roles(
    NEW."tenantId",
    NEW."entityId",
    NEW.data::jsonb
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

-- Step 4: Update CustomRole trigger to also update new columns
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

  IF old_filters IS DISTINCT FROM new_filters THEN
    FOR affected_entity_slug IN
      SELECT DISTINCT f->>'entitySlug'
      FROM (
        SELECT jsonb_array_elements(old_filters) AS f
        UNION
        SELECT jsonb_array_elements(new_filters) AS f
      ) combined
      WHERE f->>'entitySlug' IS NOT NULL
    LOOP
      SELECT id INTO entity_id
      FROM "Entity"
      WHERE slug = affected_entity_slug AND "tenantId" = NEW."tenantId";

      IF entity_id IS NOT NULL THEN
        -- Recompute all 3 columns for affected records
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

-- Step 5: Backfill existing records (recompute with updated function that includes admins)
UPDATE "EntityData"
SET "_visibleToRoles" = calculate_visible_to_roles(
  "tenantId",
  "entityId",
  data::jsonb
);

-- Step 6: Derive new columns from freshly computed _visibleToRoles
UPDATE "EntityData"
SET
  "_hasRoleFilter" = ("_visibleToRoles" IS NOT NULL),
  "_visibleToRolesJson" = CASE
    WHEN "_visibleToRoles" IS NULL THEN '[]'::jsonb
    ELSE to_jsonb("_visibleToRoles")
  END;

-- Step 7: Create indexes for PowerSync performance
CREATE INDEX idx_entity_data_has_role_filter
  ON "EntityData" ("tenantId", "_hasRoleFilter")
  WHERE "deletedAt" IS NULL;

CREATE INDEX idx_entity_data_visible_roles_json
  ON "EntityData" USING GIN ("_visibleToRolesJson")
  WHERE "deletedAt" IS NULL AND "_hasRoleFilter" = true;
