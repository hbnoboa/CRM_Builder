-- REPARO: a migration 20260628010000_visible_roles_own_scope ficou marcada como
-- aplicada em bancos que nao a executaram (baseline). Sem calc_record_visibility /
-- get_role_entity_scope o job de recalculo (VisibilityRecomputeJob) falha sem parar e
-- "_visibleToRolesOwnJson" nunca e preenchido: cargo com escopo 'own' nao sincroniza
-- nada no app. Aqui entram so as funcoes e os triggers de EntityData dessa migration
-- (versao atual; ninguem os redefiniu depois). O trigger de CustomRole dela NAO entra:
-- a 20260820000000 o trocou pela fila (VisibilityRecomputeOutbox). Idempotente.

ALTER TABLE "EntityData"
  ADD COLUMN IF NOT EXISTS "_visibleToRolesOwnJson" JSONB NOT NULL DEFAULT '[]'::jsonb;

-- ---------------------------------------------------------------------------
-- Helper: a role's scope for an entity ('all' | 'own'), default 'all'.
-- Exact entitySlug match wins; falls back to wildcard '*'.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_role_entity_scope(
  p_perms JSONB,
  p_entity_slug TEXT
) RETURNS TEXT AS $$
DECLARE
  perm_item JSONB;
BEGIN
  IF p_perms IS NULL OR jsonb_typeof(p_perms) <> 'array' THEN
    RETURN 'all';
  END IF;

  SELECT x INTO perm_item
  FROM jsonb_array_elements(p_perms) AS x
  WHERE x->>'entitySlug' = p_entity_slug
  LIMIT 1;

  IF perm_item IS NULL THEN
    SELECT x INTO perm_item
    FROM jsonb_array_elements(p_perms) AS x
    WHERE x->>'entitySlug' = '*'
    LIMIT 1;
  END IF;

  IF perm_item IS NOT NULL AND perm_item->>'scope' = 'own' THEN
    RETURN 'own';
  END IF;

  RETURN 'all';
END;
$$ LANGUAGE plpgsql STABLE;

-- ---------------------------------------------------------------------------
-- Core: compute both visibility lists for a record.
--   all_roles: roles that see the record regardless of creator (scope='all'),
--              with parent inheritance (INTERSECT). NULL = every role sees it.
--   own_roles: roles that see the record only if they created it (scope='own'),
--              no inheritance.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION calc_record_visibility(
  p_tenant_id TEXT,
  p_entity_id TEXT,
  p_record_data JSONB,
  p_parent_record_id TEXT DEFAULT NULL,
  OUT all_roles TEXT[],
  OUT own_roles TEXT[]
) AS $$
DECLARE
  role_record RECORD;
  entity_slug TEXT;
  total_roles INT := 0;
  filters JSONB;
  scope TEXT;
  parent_roles TEXT[];
BEGIN
  all_roles := ARRAY[]::TEXT[];
  own_roles := ARRAY[]::TEXT[];

  SELECT slug INTO entity_slug FROM "Entity" WHERE id = p_entity_id;
  IF entity_slug IS NULL THEN
    all_roles := NULL;
    RETURN;
  END IF;

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
    IF jsonb_array_length(filters) > 0
       AND NOT check_merged_role_filters(p_record_data, filters) THEN
      CONTINUE;
    END IF;

    scope := get_role_entity_scope(role_record.perms, entity_slug);
    IF scope = 'own' THEN
      own_roles := array_append(own_roles, role_record.id);
    ELSE
      all_roles := array_append(all_roles, role_record.id);
    END IF;
  END LOOP;

  -- Parent inheritance applies to the ALL list only.
  IF p_parent_record_id IS NOT NULL THEN
    SELECT "_visibleToRoles" INTO parent_roles
    FROM "EntityData" WHERE id = p_parent_record_id;

    IF parent_roles IS NOT NULL THEN
      all_roles := ARRAY(
        SELECT unnest(all_roles)
        INTERSECT
        SELECT unnest(parent_roles)
      );
      RETURN; -- parent restricted => record restricted (do not collapse to NULL)
    END IF;
  END IF;

  -- Unrestricted only if every role in the tenant sees it via scope='all'.
  IF array_length(all_roles, 1) IS NOT NULL
     AND array_length(all_roles, 1) = total_roles THEN
    all_roles := NULL;
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;


-- Trigger legado de 20260221230000: chama a mesma funcao que
-- trg_entity_data_calc_visible_roles (cada registro era calculado duas vezes).
DROP TRIGGER IF EXISTS trg_entity_data_visible_roles ON "EntityData";

-- ---------------------------------------------------------------------------
-- Backfill both columns. Multiple passes so children pick up parent's ALL list.
-- Triggers are recreated AFTER this block to avoid recursive storms.
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_entity_data_calc_visible_roles ON "EntityData";
DROP TRIGGER IF EXISTS trg_entity_data_propagate_visible_roles ON "EntityData";

DO $$
DECLARE
  i INT;
BEGIN
  FOR i IN 1..6 LOOP
    UPDATE "EntityData" ed
    SET
      "_visibleToRoles" = c.all_roles,
      "_visibleToRolesOwnJson" = to_jsonb(c.own_roles)
    FROM (
      SELECT e2.id, v.all_roles, v.own_roles
      FROM "EntityData" e2
      CROSS JOIN LATERAL calc_record_visibility(
        e2."tenantId", e2."entityId", e2.data::jsonb, e2."parentRecordId"
      ) v
    ) c
    WHERE ed.id = c.id;
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
-- BEFORE trigger: recompute both lists on insert/update.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_entity_data_calc_visible_roles()
RETURNS TRIGGER AS $$
DECLARE
  v_all TEXT[];
  v_own TEXT[];
BEGIN
  SELECT all_roles, own_roles INTO v_all, v_own
  FROM calc_record_visibility(
    NEW."tenantId", NEW."entityId", NEW.data::jsonb, NEW."parentRecordId"
  );

  NEW."_visibleToRoles" := v_all;
  IF v_all IS NULL THEN
    NEW."_hasRoleFilter" := FALSE;
    NEW."_visibleToRolesJson" := '[]'::jsonb;
  ELSE
    NEW."_hasRoleFilter" := TRUE;
    NEW."_visibleToRolesJson" := to_jsonb(v_all);
  END IF;
  NEW."_visibleToRolesOwnJson" := COALESCE(to_jsonb(v_own), '[]'::jsonb);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_entity_data_calc_visible_roles
  BEFORE INSERT OR UPDATE
  ON "EntityData"
  FOR EACH ROW
  EXECUTE FUNCTION trg_entity_data_calc_visible_roles();

-- ---------------------------------------------------------------------------
-- AFTER trigger: cascade ALL-list changes to children (recompute both columns).
-- Plain AFTER UPDATE (the column is set by the BEFORE trigger; "UPDATE OF col"
-- ignores BEFORE-trigger changes).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_entity_data_propagate_visible_roles()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD."_visibleToRoles" IS DISTINCT FROM NEW."_visibleToRoles" THEN
    UPDATE "EntityData" child
    SET
      "_visibleToRoles" = sub.all_roles,
      "_hasRoleFilter" = (sub.all_roles IS NOT NULL),
      "_visibleToRolesJson" = CASE
        WHEN sub.all_roles IS NULL THEN '[]'::jsonb
        ELSE to_jsonb(sub.all_roles)
      END,
      "_visibleToRolesOwnJson" = to_jsonb(sub.own_roles)
    FROM (
      SELECT e2.id, v.all_roles, v.own_roles
      FROM "EntityData" e2
      CROSS JOIN LATERAL calc_record_visibility(
        e2."tenantId", e2."entityId", e2.data::jsonb, e2."parentRecordId"
      ) v
      WHERE e2."parentRecordId" = NEW.id
    ) sub
    WHERE child.id = sub.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_entity_data_propagate_visible_roles
  AFTER UPDATE
  ON "EntityData"
  FOR EACH ROW
  EXECUTE FUNCTION trg_entity_data_propagate_visible_roles();

