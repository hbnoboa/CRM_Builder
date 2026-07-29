-- Permission-driven record visibility for PowerSync (no roleType).
--
-- Context: roleType was removed (Fase 3). The previous trigger machinery filtered
-- roles by "roleType NOT IN ('PLATFORM_ADMIN','ADMIN')", which no longer exists.
-- This rebuilds the visibility computation purely from CustomRole.permissions[]:
--
--   A role SEES a record when:
--     1. It can read the entity (permissions[] has an entry for the entitySlug
--        with canRead=true, OR a wildcard entry entitySlug='*' with canRead=true), AND
--     2. The record passes that permission's dataFilters (row-level filters).
--   Sub-entity records additionally INTERSECT with their parent's visibility,
--   so a filter on a parent (e.g. operacoes) cascades to its children
--   (veiculos, nao-conformidades).
--
-- Output columns on EntityData (consumed by powersync.yaml):
--   _visibleToRoles      TEXT[]  - role ids that can see this record (NULL = everyone)
--   _hasRoleFilter       BOOLEAN - true when visibility is role-restricted
--   _visibleToRolesJson  JSONB   - same as _visibleToRoles, for PowerSync IN operator

-- ---------------------------------------------------------------------------
-- Helper: does a role's permissions grant canRead on an entity?
-- Exact entitySlug match wins; falls back to wildcard '*'.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION role_can_read_entity(
  p_perms JSONB,
  p_entity_slug TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  perm_item JSONB;
BEGIN
  IF p_perms IS NULL OR jsonb_typeof(p_perms) <> 'array' THEN
    RETURN FALSE;
  END IF;

  -- Exact match
  SELECT x INTO perm_item
  FROM jsonb_array_elements(p_perms) AS x
  WHERE x->>'entitySlug' = p_entity_slug
  LIMIT 1;

  IF perm_item IS NOT NULL THEN
    RETURN COALESCE((perm_item->>'canRead')::boolean, FALSE);
  END IF;

  -- Wildcard fallback
  SELECT x INTO perm_item
  FROM jsonb_array_elements(p_perms) AS x
  WHERE x->>'entitySlug' = '*'
  LIMIT 1;

  IF perm_item IS NOT NULL THEN
    RETURN COALESCE((perm_item->>'canRead')::boolean, FALSE);
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql STABLE;

-- ---------------------------------------------------------------------------
-- Helper: dataFilters for an entity from a role's permissions.
-- Only the exact-slug permission entry carries per-entity dataFilters
-- (wildcard '*' entries do not). Returns '[]' when none.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_role_entity_filters(
  p_perms JSONB,
  p_entity_slug TEXT
) RETURNS JSONB AS $$
DECLARE
  perm_item JSONB;
BEGIN
  IF p_perms IS NULL OR jsonb_typeof(p_perms) <> 'array' THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT x INTO perm_item
  FROM jsonb_array_elements(p_perms) AS x
  WHERE x->>'entitySlug' = p_entity_slug
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

-- ---------------------------------------------------------------------------
-- Helper: does a record pass an array of row-level filters? (AND semantics)
-- ---------------------------------------------------------------------------
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

    IF record_value IS NULL AND operator NOT IN ('isEmpty', 'notEquals') THEN
      RETURN FALSE;
    END IF;

    CASE operator
      WHEN 'equals' THEN
        IF record_value IS DISTINCT FROM filter_value THEN RETURN FALSE; END IF;
      WHEN 'notEquals' THEN
        IF record_value IS NOT DISTINCT FROM filter_value THEN RETURN FALSE; END IF;
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
        IF record_value IS NOT NULL AND record_value <> '' THEN RETURN FALSE; END IF;
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

-- ---------------------------------------------------------------------------
-- Core: compute the role ids that can see a record.
-- Returns NULL when EVERY role in the tenant can see it (unrestricted).
-- ---------------------------------------------------------------------------
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
  total_roles INT := 0;
  filters JSONB;
  parent_roles TEXT[];
BEGIN
  SELECT slug INTO entity_slug FROM "Entity" WHERE id = p_entity_id;
  IF entity_slug IS NULL THEN
    RETURN NULL;
  END IF;

  -- Own visibility: every role that can read this entity and passes its filters
  FOR role_record IN
    SELECT id, permissions::jsonb AS perms
    FROM "CustomRole"
    WHERE "tenantId" = p_tenant_id
  LOOP
    total_roles := total_roles + 1;

    IF NOT role_can_read_entity(role_record.perms, entity_slug) THEN
      CONTINUE;
    END IF;

    filters := get_role_entity_filters(role_record.perms, entity_slug);
    IF jsonb_array_length(filters) > 0 THEN
      IF check_merged_role_filters(p_record_data, filters) THEN
        visible_roles := array_append(visible_roles, role_record.id);
      END IF;
    ELSE
      visible_roles := array_append(visible_roles, role_record.id);
    END IF;
  END LOOP;

  -- Sub-entity inheritance: intersect with parent visibility when the parent
  -- is itself role-restricted. A parent filter (e.g. operacoes) thus cascades.
  IF p_parent_record_id IS NOT NULL THEN
    SELECT "_visibleToRoles" INTO parent_roles
    FROM "EntityData" WHERE id = p_parent_record_id;

    IF parent_roles IS NOT NULL THEN
      visible_roles := ARRAY(
        SELECT unnest(visible_roles)
        INTERSECT
        SELECT unnest(parent_roles)
      );
      -- Parent is restricted => record is restricted too.
      RETURN visible_roles;
    END IF;
  END IF;

  -- Unrestricted only if literally every role in the tenant can see it.
  IF array_length(visible_roles, 1) IS NOT NULL
     AND array_length(visible_roles, 1) = total_roles THEN
    RETURN NULL;
  END IF;

  RETURN visible_roles;
END;
$$ LANGUAGE plpgsql STABLE;

-- ---------------------------------------------------------------------------
-- Backfill: recompute all records. Multiple passes so child records pick up
-- their (already-recomputed) parent's visibility. Triggers are created AFTER
-- this block to avoid recursive trigger storms during backfill.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  i INT;
BEGIN
  FOR i IN 1..6 LOOP
    UPDATE "EntityData" ed
    SET "_visibleToRoles" = calculate_visible_to_roles(
      ed."tenantId", ed."entityId", ed.data::jsonb, ed."parentRecordId"
    );
  END LOOP;
END $$;

UPDATE "EntityData"
SET
  "_hasRoleFilter" = ("_visibleToRoles" IS NOT NULL),
  "_visibleToRolesJson" = CASE
    WHEN "_visibleToRoles" IS NULL THEN '[]'::jsonb
    ELSE to_jsonb("_visibleToRoles")
  END;

-- ---------------------------------------------------------------------------
-- BEFORE trigger: recompute visibility on every insert/update of a record.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_entity_data_calc_visible_roles()
RETURNS TRIGGER AS $$
DECLARE
  roles TEXT[];
BEGIN
  roles := calculate_visible_to_roles(
    NEW."tenantId", NEW."entityId", NEW.data::jsonb, NEW."parentRecordId"
  );
  NEW."_visibleToRoles" := roles;
  IF roles IS NULL THEN
    NEW."_hasRoleFilter" := FALSE;
    NEW."_visibleToRolesJson" := '[]'::jsonb;
  ELSE
    NEW."_hasRoleFilter" := TRUE;
    NEW."_visibleToRolesJson" := to_jsonb(roles);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_entity_data_calc_visible_roles ON "EntityData";
CREATE TRIGGER trg_entity_data_calc_visible_roles
  BEFORE INSERT OR UPDATE
  ON "EntityData"
  FOR EACH ROW
  EXECUTE FUNCTION trg_entity_data_calc_visible_roles();

-- ---------------------------------------------------------------------------
-- AFTER trigger: when a record's visibility changes, recompute its children
-- (cascade of parent filters down the hierarchy).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_entity_data_propagate_visible_roles()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD."_visibleToRoles" IS DISTINCT FROM NEW."_visibleToRoles" THEN
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
      ) AS roles
      FROM "EntityData"
      WHERE "parentRecordId" = NEW.id
    ) sub
    WHERE child.id = sub.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- NOTE: plain AFTER UPDATE (not "UPDATE OF _visibleToRoles"): the column is set
-- by the BEFORE trigger, and "UPDATE OF col" only considers columns in the
-- statement's SET list, ignoring BEFORE-trigger changes. The IS DISTINCT guard
-- inside the function keeps it cheap when visibility did not actually change.
DROP TRIGGER IF EXISTS trg_entity_data_propagate_visible_roles ON "EntityData";
CREATE TRIGGER trg_entity_data_propagate_visible_roles
  AFTER UPDATE
  ON "EntityData"
  FOR EACH ROW
  EXECUTE FUNCTION trg_entity_data_propagate_visible_roles();

-- ---------------------------------------------------------------------------
-- CustomRole trigger: when a role's permissions change, recompute the records
-- of the entities affected (those that gained/lost canRead or dataFilters).
-- Children are then propagated by the AFTER trigger above.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_custom_role_permissions_update()
RETURNS TRIGGER AS $$
DECLARE
  old_perms JSONB;
  new_perms JSONB;
  affected_slugs TEXT[] := ARRAY[]::TEXT[];
  slug_item TEXT;
  entity_id TEXT;
  pass INT;
BEGIN
  old_perms := COALESCE(OLD.permissions::jsonb, '[]'::jsonb);
  new_perms := COALESCE(NEW.permissions::jsonb, '[]'::jsonb);

  IF old_perms IS NOT DISTINCT FROM new_perms THEN
    RETURN NEW;
  END IF;

  -- Any entitySlug present in old or new permissions may be affected.
  -- (Wildcard '*' affects every entity of the tenant.)
  SELECT array_agg(DISTINCT s) INTO affected_slugs FROM (
    SELECT x->>'entitySlug' AS s FROM jsonb_array_elements(old_perms) x
    UNION
    SELECT x->>'entitySlug' AS s FROM jsonb_array_elements(new_perms) x
  ) q WHERE s IS NOT NULL;

  IF affected_slugs IS NULL THEN
    RETURN NEW;
  END IF;

  -- Wildcard => recompute every entity in the tenant.
  IF '*' = ANY(affected_slugs) THEN
    SELECT array_agg(slug) INTO affected_slugs
    FROM "Entity" WHERE "tenantId" = NEW."tenantId";
  END IF;

  -- Recompute affected entities, several passes so cascades settle.
  FOR pass IN 1..6 LOOP
    FOREACH slug_item IN ARRAY affected_slugs
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
          ) AS roles
          FROM "EntityData"
          WHERE "entityId" = entity_id AND "tenantId" = NEW."tenantId"
        ) sub
        WHERE ed.id = sub.id;
      END IF;
    END LOOP;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_custom_role_data_filters ON "CustomRole";
DROP TRIGGER IF EXISTS trg_custom_role_permissions ON "CustomRole";
CREATE TRIGGER trg_custom_role_permissions
  AFTER UPDATE OF permissions
  ON "CustomRole"
  FOR EACH ROW
  EXECUTE FUNCTION trg_custom_role_permissions_update();
