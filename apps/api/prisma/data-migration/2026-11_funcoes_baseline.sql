-- Gerado de 00000000000000_baseline por gerar-funcoes-baseline.py: funcoes e triggers do modelo novo.

-- Reaplicavel. Rodar depois do alinhamento das tabelas (migrate diff) e antes do migrate resolve.

BEGIN;

DROP FUNCTION IF EXISTS public.calc_channel_group_visibility(text, text) CASCADE;
CREATE FUNCTION public.calc_channel_group_visibility(p_tenant_id text, p_entity_id text, OUT all_roles text[], OUT has_filter boolean) RETURNS record
    LANGUAGE plpgsql STABLE
    AS $$
DECLARE role_record RECORD; entity_slug TEXT; total_roles INT := 0;
BEGIN
  all_roles := ARRAY[]::TEXT[];
  SELECT slug INTO entity_slug FROM "Entity" WHERE id = p_entity_id;
  IF entity_slug IS NULL THEN has_filter := false; all_roles := NULL; RETURN; END IF;
  FOR role_record IN
    SELECT id, permissions::jsonb AS perms FROM "CustomRole" WHERE "tenantId" = p_tenant_id
  LOOP
    total_roles := total_roles + 1;
    IF role_can_read_entity(role_record.perms, entity_slug) THEN
      all_roles := array_append(all_roles, role_record.id);
    END IF;
  END LOOP;
  IF total_roles > 0 AND array_length(all_roles, 1) = total_roles THEN
    all_roles := NULL; has_filter := false;   -- todos leem => unrestricted
  ELSE
    has_filter := true;
  END IF;
END; $$;

DROP FUNCTION IF EXISTS public.calc_record_visibility(text, text, jsonb, text) CASCADE;
CREATE FUNCTION public.calc_record_visibility(p_tenant_id text, p_entity_id text, p_record_data jsonb, p_parent_record_id text DEFAULT NULL::text, OUT all_roles text[], OUT own_roles text[], OUT team_roles text[]) RETURNS record
    LANGUAGE plpgsql STABLE
    AS $$
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
  team_roles := ARRAY[]::TEXT[];

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
    ELSIF scope = 'team' THEN
      own_roles := array_append(own_roles, role_record.id);
      team_roles := array_append(team_roles, role_record.id);
    ELSE
      all_roles := array_append(all_roles, role_record.id);
    END IF;
  END LOOP;

  IF p_parent_record_id IS NOT NULL THEN
    SELECT "_visibleToRoles" INTO parent_roles
    FROM "EntityData" WHERE id = p_parent_record_id;

    IF parent_roles IS NOT NULL THEN
      all_roles := ARRAY(
        SELECT unnest(all_roles)
        INTERSECT
        SELECT unnest(parent_roles)
      );
      RETURN;
    END IF;
  END IF;

  IF array_length(all_roles, 1) IS NOT NULL
     AND array_length(all_roles, 1) = total_roles THEN
    all_roles := NULL;
  END IF;
END;
$$;

DROP FUNCTION IF EXISTS public.calc_team_keys(text, text, text[]) CASCADE;
CREATE FUNCTION public.calc_team_keys(p_tenant_id text, p_creator_id text, p_team_roles text[]) RETURNS jsonb
    LANGUAGE sql STABLE
    AS $$
  SELECT COALESCE(jsonb_agg(DISTINCT tm."teamId" || ':' || r), '[]'::jsonb)
  FROM "TeamMember" tm
  JOIN "Team" t ON t.id = tm."teamId" AND t."tenantId" = p_tenant_id
  CROSS JOIN unnest(COALESCE(p_team_roles, ARRAY[]::TEXT[])) AS r
  WHERE p_creator_id IS NOT NULL AND tm."userId" = p_creator_id;
$$;

DROP FUNCTION IF EXISTS public.calculate_visible_to_roles(text, text, jsonb, text) CASCADE;
CREATE FUNCTION public.calculate_visible_to_roles(p_tenant_id text, p_entity_id text, p_record_data jsonb, p_parent_record_id text DEFAULT NULL::text) RETURNS text[]
    LANGUAGE plpgsql STABLE
    AS $$
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
$$;

DROP FUNCTION IF EXISTS public.check_global_filters(jsonb, jsonb) CASCADE;
CREATE FUNCTION public.check_global_filters(entity_data jsonb, global_filters jsonb) RETURNS boolean
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
  filter JSONB;
  field_slug TEXT;
  field_type TEXT;
  op TEXT;
  filter_value TEXT;
  filter_value2 TEXT;
  data_value TEXT;
  data_num NUMERIC;
  filter_num NUMERIC;
  filter_num2 NUMERIC;
BEGIN
  -- If no filters or empty array, return true (show all)
  IF global_filters IS NULL OR jsonb_typeof(global_filters) != 'array' OR jsonb_array_length(global_filters) = 0 THEN
    RETURN TRUE;
  END IF;

  -- If entity_data is null, filters can't match
  IF entity_data IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Check each filter (AND logic - all must pass)
  FOR filter IN SELECT * FROM jsonb_array_elements(global_filters)
  LOOP
    field_slug := filter->>'fieldSlug';
    field_type := LOWER(COALESCE(filter->>'fieldType', 'text'));
    op := LOWER(COALESCE(filter->>'operator', 'equals'));
    filter_value := filter->>'value';
    filter_value2 := filter->>'value2';
    data_value := entity_data->>field_slug;

    -- Handle isEmpty/isNotEmpty operators
    IF op = 'isempty' THEN
      IF data_value IS NOT NULL AND data_value != '' AND data_value != 'null' THEN
        RETURN FALSE;
      END IF;
      CONTINUE;
    END IF;

    IF op = 'isnotempty' THEN
      IF data_value IS NULL OR data_value = '' OR data_value = 'null' THEN
        RETURN FALSE;
      END IF;
      CONTINUE;
    END IF;

    -- For other operators, if data_value is null, filter fails
    IF data_value IS NULL THEN
      RETURN FALSE;
    END IF;

    -- Text-based operators
    IF field_type IN ('text', 'textarea', 'richtext', 'email', 'phone', 'url', 'cpf', 'cnpj', 'cep', 'password', 'select', 'relation', 'api-select') THEN
      CASE op
        WHEN 'equals' THEN
          IF data_value != filter_value THEN
            RETURN FALSE;
          END IF;
        WHEN 'contains' THEN
          IF data_value NOT ILIKE '%' || filter_value || '%' THEN
            RETURN FALSE;
          END IF;
        WHEN 'startswith' THEN
          IF data_value NOT ILIKE filter_value || '%' THEN
            RETURN FALSE;
          END IF;
        WHEN 'endswith' THEN
          IF data_value NOT ILIKE '%' || filter_value THEN
            RETURN FALSE;
          END IF;
        ELSE
          -- Unknown operator, skip
          NULL;
      END CASE;

    -- Numeric operators
    ELSIF field_type IN ('number', 'currency', 'percentage', 'rating', 'slider') THEN
      BEGIN
        data_num := data_value::NUMERIC;
        filter_num := filter_value::NUMERIC;
        IF filter_value2 IS NOT NULL THEN
          filter_num2 := filter_value2::NUMERIC;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        -- Can't convert to number, skip this filter
        CONTINUE;
      END;

      CASE op
        WHEN 'equals' THEN
          IF data_num != filter_num THEN
            RETURN FALSE;
          END IF;
        WHEN 'gt' THEN
          IF data_num <= filter_num THEN
            RETURN FALSE;
          END IF;
        WHEN 'gte' THEN
          IF data_num < filter_num THEN
            RETURN FALSE;
          END IF;
        WHEN 'lt' THEN
          IF data_num >= filter_num THEN
            RETURN FALSE;
          END IF;
        WHEN 'lte' THEN
          IF data_num > filter_num THEN
            RETURN FALSE;
          END IF;
        WHEN 'between' THEN
          IF data_num < filter_num OR data_num > filter_num2 THEN
            RETURN FALSE;
          END IF;
        ELSE
          NULL;
      END CASE;

    -- Date operators
    ELSIF field_type IN ('date', 'datetime', 'time') THEN
      CASE op
        WHEN 'equals' THEN
          IF data_value != filter_value THEN
            RETURN FALSE;
          END IF;
        WHEN 'gt' THEN
          IF data_value <= filter_value THEN
            RETURN FALSE;
          END IF;
        WHEN 'gte' THEN
          IF data_value < filter_value THEN
            RETURN FALSE;
          END IF;
        WHEN 'lt' THEN
          IF data_value >= filter_value THEN
            RETURN FALSE;
          END IF;
        WHEN 'lte' THEN
          IF data_value > filter_value THEN
            RETURN FALSE;
          END IF;
        WHEN 'between' THEN
          IF data_value < filter_value OR data_value > filter_value2 THEN
            RETURN FALSE;
          END IF;
        ELSE
          NULL;
      END CASE;

    -- Boolean operators
    ELSIF field_type = 'boolean' THEN
      IF op = 'equals' THEN
        IF (data_value = 'true' OR data_value = '1') != (filter_value = 'true' OR filter_value = '1') THEN
          RETURN FALSE;
        END IF;
      END IF;

    -- Default: text comparison
    ELSE
      IF op = 'equals' AND data_value != filter_value THEN
        RETURN FALSE;
      ELSIF op = 'contains' AND data_value NOT ILIKE '%' || filter_value || '%' THEN
        RETURN FALSE;
      END IF;
    END IF;

  END LOOP;

  -- All filters passed
  RETURN TRUE;
END;
$$;

DROP FUNCTION IF EXISTS public.check_merged_role_filters(jsonb, jsonb) CASCADE;
CREATE FUNCTION public.check_merged_role_filters(p_record_data jsonb, p_filters jsonb) RETURNS boolean
    LANGUAGE plpgsql STABLE
    AS $$
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
$$;

DROP FUNCTION IF EXISTS public.check_role_data_filters(jsonb, jsonb, text) CASCADE;
CREATE FUNCTION public.check_role_data_filters(record_data jsonb, role_data_filters jsonb, p_entity_slug text) RETURNS boolean
    LANGUAGE plpgsql STABLE
    AS $$
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
$$;

DROP FUNCTION IF EXISTS public.f_unaccent(text) CASCADE;
CREATE FUNCTION public.f_unaccent(text) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
    AS $_$ SELECT public.unaccent('public.unaccent', $1) $_$;

DROP FUNCTION IF EXISTS public.get_parent_filter_status(text) CASCADE;
CREATE FUNCTION public.get_parent_filter_status(parent_id text) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF parent_id IS NULL THEN
    RETURN true;
  END IF;
  RETURN COALESCE(
    (SELECT "_matchesGlobalFilter" AND "_parentMatchesFilter"
     FROM "EntityData"
     WHERE id = parent_id),
    true
  );
END;
$$;

DROP FUNCTION IF EXISTS public.get_role_entity_filters(jsonb, text) CASCADE;
CREATE FUNCTION public.get_role_entity_filters(p_perms jsonb, p_entity_slug text) RETURNS jsonb
    LANGUAGE plpgsql STABLE
    AS $$
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
$$;

DROP FUNCTION IF EXISTS public.get_role_entity_scope(jsonb, text) CASCADE;
CREATE FUNCTION public.get_role_entity_scope(p_perms jsonb, p_entity_slug text) RETURNS text
    LANGUAGE plpgsql STABLE
    AS $$
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

  IF perm_item IS NOT NULL AND perm_item->>'scope' IN ('own', 'team') THEN
    RETURN perm_item->>'scope';
  END IF;

  RETURN 'all';
END;
$$;

DROP FUNCTION IF EXISTS public.propagate_filter_to_children() CASCADE;
CREATE FUNCTION public.propagate_filter_to_children() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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
$$;

DROP FUNCTION IF EXISTS public.recompute_channel_visibility(text, text) CASCADE;
CREATE FUNCTION public.recompute_channel_visibility(p_tenant text, p_entity_id text) RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE n INT;
BEGIN
  WITH upd AS (
    UPDATE "Channel" c SET "type" = c."type"
    WHERE c."tenantId" = p_tenant AND c."entityId" = p_entity_id AND c."deletedAt" IS NULL
    RETURNING 1
  ) SELECT count(*) INTO n FROM upd;
  RETURN n;
END; $$;

DROP FUNCTION IF EXISTS public.recompute_visibility_batch(text, text, text, integer) CASCADE;
CREATE FUNCTION public.recompute_visibility_batch(p_tenant text, p_entity_id text, p_after text, p_limit integer, OUT last_id text, OUT n integer) RETURNS record
    LANGUAGE plpgsql
    AS $$
BEGIN
  WITH sub AS (
    SELECT b.id, v.all_roles, v.own_roles
    FROM (
      SELECT id, "tenantId", "entityId", data, "parentRecordId"
      FROM "EntityData"
      WHERE "entityId" = p_entity_id
        AND "tenantId" = p_tenant
        AND id > p_after
      ORDER BY id
      LIMIT p_limit
    ) b
    CROSS JOIN LATERAL calc_record_visibility(
      b."tenantId", b."entityId", b.data::jsonb, b."parentRecordId"
    ) v
  ),
  upd AS (
    UPDATE "EntityData" ed
    SET
      "_visibleToRoles"        = sub.all_roles,
      "_hasRoleFilter"         = (sub.all_roles IS NOT NULL),
      "_visibleToRolesJson"    = CASE WHEN sub.all_roles IS NULL
                                      THEN '[]'::jsonb
                                      ELSE to_jsonb(sub.all_roles) END,
      "_visibleToRolesOwnJson" = to_jsonb(sub.own_roles)
    FROM sub
    WHERE ed.id = sub.id
    RETURNING ed.id
  )
  SELECT COALESCE(max(id), p_after), COALESCE(count(*), 0)::int
  INTO last_id, n
  FROM upd;
END;
$$;

DROP FUNCTION IF EXISTS public.refresh_masked_entity_data(text, text) CASCADE;
CREATE FUNCTION public.refresh_masked_entity_data(p_tenant text, p_record text) RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE n INT;
BEGIN
  IF p_record IS NULL THEN
    DELETE FROM "EntityDataMasked" WHERE "tenantId" = p_tenant;
  ELSE
    DELETE FROM "EntityDataMasked" WHERE "recordId" = p_record;
  END IF;

  WITH src AS (
    SELECT ed.*, e.slug AS entity_slug
    FROM "EntityData" ed
    JOIN "Entity" e ON e.id = ed."entityId"
    WHERE ed."tenantId" = p_tenant
      AND (p_record IS NULL OR ed.id = p_record)
      AND ed."deletedAt" IS NULL
      AND ed."_matchesGlobalFilter" = true
      AND ed."_parentMatchesFilter" = true
  ), rows AS (
    SELECT
      src.id AS record_id, r.id AS role_id, src."tenantId", src."entityId",
      src.data::jsonb - role_hidden_fields(r.permissions, src.entity_slug) AS data,
      src."parentRecordId", src."createdById", src."updatedById", src."createdAt", src."updatedAt",
      (src."_hasRoleFilter" = false OR r.id = ANY(COALESCE(src."_visibleToRoles", ARRAY[]::TEXT[]))) AS v_all,
      (COALESCE(src."_visibleToRolesOwnJson", '[]'::jsonb) ? r.id) AS v_own,
      (SELECT COALESCE(jsonb_agg(k), '[]'::jsonb)
         FROM jsonb_array_elements_text(COALESCE(src."_visibleTeamKeysJson", '[]'::jsonb)) AS k
        WHERE k LIKE '%:' || r.id) AS v_team
    FROM src
    CROSS JOIN tenant_masked_roles(p_tenant) AS r
  ), ins AS (
    INSERT INTO "EntityDataMasked" (
      "id", "recordId", "roleId", "tenantId", "entityId", "data", "parentRecordId",
      "createdById", "updatedById", "createdAt", "updatedAt",
      "_visibleAll", "_visibleOwn", "_visibleTeamKeysJson"
    )
    SELECT record_id || ':' || role_id, record_id, role_id, "tenantId", "entityId", data, "parentRecordId",
           "createdById", "updatedById", "createdAt", "updatedAt", v_all, v_own, v_team
    FROM rows
    WHERE v_all OR v_own OR v_team <> '[]'::jsonb
    RETURNING 1
  )
  SELECT count(*) INTO n FROM ins;
  RETURN n;
END;
$$;

DROP FUNCTION IF EXISTS public.refresh_team_access_keys(text, text) CASCADE;
CREATE FUNCTION public.refresh_team_access_keys(p_user_id text, p_tenant_id text) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  DELETE FROM "TeamAccessKey" WHERE "userId" = p_user_id AND "tenantId" = p_tenant_id;
  INSERT INTO "TeamAccessKey" ("userId", "tenantId", "key")
  SELECT DISTINCT p_user_id, p_tenant_id, tm."teamId" || ':' || uta."customRoleId"
  FROM "TeamMember" tm
  JOIN "Team" t ON t.id = tm."teamId" AND t."tenantId" = p_tenant_id
  JOIN "UserTenantAccess" uta
    ON uta."userId" = p_user_id AND uta."tenantId" = p_tenant_id
   AND uta."deletedAt" IS NULL AND uta.status = 'ACTIVE'
  WHERE tm."userId" = p_user_id;
END;
$$;

DROP FUNCTION IF EXISTS public.role_can_read_entity(jsonb, text) CASCADE;
CREATE FUNCTION public.role_can_read_entity(p_perms jsonb, p_entity_slug text) RETURNS boolean
    LANGUAGE plpgsql STABLE
    AS $$
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
$$;

DROP FUNCTION IF EXISTS public.role_entity_rule(jsonb, text) CASCADE;
CREATE FUNCTION public.role_entity_rule(p_perms jsonb, p_entity_slug text) RETURNS jsonb
    LANGUAGE sql IMMUTABLE
    AS $$
  WITH perms AS (
    SELECT x FROM jsonb_array_elements(
      CASE WHEN jsonb_typeof(p_perms) = 'array' THEN p_perms ELSE '[]'::jsonb END
    ) AS x
  )
  SELECT COALESCE(
    (SELECT x FROM perms WHERE x->>'entitySlug' = p_entity_slug LIMIT 1),
    (SELECT x FROM perms WHERE x->>'entitySlug' = '*' LIMIT 1)
  );
$$;

DROP FUNCTION IF EXISTS public.role_has_hidden_fields(jsonb, jsonb) CASCADE;
CREATE FUNCTION public.role_has_hidden_fields(p_perms jsonb, p_modules jsonb) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    AS $$
  SELECT COALESCE(p_modules->>'allAccess', 'false') <> 'true'
     AND jsonb_typeof(p_perms) = 'array'
     AND EXISTS (
       SELECT 1
       FROM jsonb_array_elements(p_perms) AS x,
            jsonb_array_elements(CASE WHEN jsonb_typeof(x->'fieldPermissions') = 'array'
                                      THEN x->'fieldPermissions' ELSE '[]'::jsonb END) AS fp
       WHERE (fp->>'canView') = 'false'
     );
$$;

DROP FUNCTION IF EXISTS public.role_hidden_fields(jsonb, text) CASCADE;
CREATE FUNCTION public.role_hidden_fields(p_perms jsonb, p_entity_slug text) RETURNS text[]
    LANGUAGE sql IMMUTABLE
    AS $$
  SELECT COALESCE(array_agg(fp->>'fieldSlug'), ARRAY[]::TEXT[])
  FROM jsonb_array_elements(
    CASE WHEN jsonb_typeof(role_entity_rule(p_perms, p_entity_slug)->'fieldPermissions') = 'array'
         THEN role_entity_rule(p_perms, p_entity_slug)->'fieldPermissions' ELSE '[]'::jsonb END
  ) AS fp
  WHERE (fp->>'canView') = 'false';
$$;

DROP FUNCTION IF EXISTS public.tenant_masked_roles(text) CASCADE;
CREATE FUNCTION public.tenant_masked_roles(p_tenant text) RETURNS TABLE(id text, permissions jsonb)
    LANGUAGE sql STABLE
    AS $$
  SELECT r.id, r.permissions::jsonb
  FROM "CustomRole" r
  WHERE r."tenantId" = p_tenant AND r."deletedAt" IS NULL
    AND role_has_hidden_fields(r.permissions::jsonb, r."modulePermissions"::jsonb);
$$;

DROP FUNCTION IF EXISTS public.tenant_uses_team_scope(text) CASCADE;
CREATE FUNCTION public.tenant_uses_team_scope(p_tenant_id text) RETURNS boolean
    LANGUAGE sql STABLE
    AS $_$
  SELECT EXISTS (
    SELECT 1 FROM "CustomRole"
    WHERE "tenantId" = p_tenant_id AND "deletedAt" IS NULL
      AND jsonb_typeof(permissions::jsonb) = 'array'
      AND jsonb_path_exists(permissions::jsonb, '$[*] ? (@.scope == "team")')
  );
$_$;

DROP FUNCTION IF EXISTS public.trg_channel_calc_visible_roles() CASCADE;
CREATE FUNCTION public.trg_channel_calc_visible_roles() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  roles TEXT[];
  hf BOOLEAN;
  own_json JSONB := '[]'::jsonb;
  team_json JSONB := '[]'::jsonb;
  rec_creator TEXT := NULL;
BEGIN
  IF NEW."type" = 'group' AND NEW."entityId" IS NOT NULL THEN
    SELECT all_roles, has_filter INTO roles, hf
      FROM calc_channel_group_visibility(NEW."tenantId", NEW."entityId");
  ELSIF NEW."type" = 'record' AND NEW."recordId" IS NOT NULL THEN
    SELECT "_visibleToRoles",
           COALESCE("_visibleToRolesOwnJson", '[]'::jsonb),
           COALESCE("_visibleTeamKeysJson", '[]'::jsonb),
           "createdById"
      INTO roles, own_json, team_json, rec_creator
      FROM "EntityData" WHERE id = NEW."recordId";
    hf := (roles IS NOT NULL);
  ELSE
    roles := NULL; hf := false;   -- dm
  END IF;

  IF roles IS NULL THEN
    NEW."_hasRoleFilter" := false;
    NEW."_visibleToRolesJson" := '[]'::jsonb;
  ELSE
    NEW."_hasRoleFilter" := hf;
    NEW."_visibleToRolesJson" := to_jsonb(roles);
  END IF;
  NEW."_visibleToRolesOwnJson" := COALESCE(own_json, '[]'::jsonb);
  NEW."_recordCreatedById" := rec_creator;
  -- Canal excluido nao entrega mais o historico pela equipe (as mensagens seguem).
  NEW."_visibleTeamKeysJson" := CASE
    WHEN NEW."deletedAt" IS NULL THEN COALESCE(team_json, '[]'::jsonb)
    ELSE '[]'::jsonb
  END;
  RETURN NEW;
END; $$;

DROP FUNCTION IF EXISTS public.trg_channel_sync_message_team_keys() CASCADE;
CREATE FUNCTION public.trg_channel_sync_message_team_keys() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE "Message" SET "_visibleTeamKeysJson" = NEW."_visibleTeamKeysJson"
  WHERE "channelId" = NEW.id;
  RETURN NEW;
END; $$;

DROP FUNCTION IF EXISTS public.trg_command_template_visible_roles() CASCADE;
CREATE FUNCTION public.trg_command_template_visible_roles() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW."_visibleToRolesJson" := to_jsonb(COALESCE(NEW."visibleToRoleIds", ARRAY[]::text[]));
  RETURN NEW;
END; $$;

DROP FUNCTION IF EXISTS public.trg_custom_role_data_filters_update() CASCADE;
CREATE FUNCTION public.trg_custom_role_data_filters_update() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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
$$;

DROP FUNCTION IF EXISTS public.trg_custom_role_masked() CASCADE;
CREATE FUNCTION public.trg_custom_role_masked() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  was_masked BOOLEAN := false;
  is_masked BOOLEAN := false;
  v_tenant TEXT;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    was_masked := OLD."deletedAt" IS NULL
      AND role_has_hidden_fields(OLD.permissions::jsonb, OLD."modulePermissions"::jsonb);
    v_tenant := OLD."tenantId";
  END IF;
  IF TG_OP <> 'DELETE' THEN
    is_masked := NEW."deletedAt" IS NULL
      AND role_has_hidden_fields(NEW.permissions::jsonb, NEW."modulePermissions"::jsonb);
    v_tenant := NEW."tenantId";
  END IF;
  IF was_masked OR is_masked THEN
    IF TG_OP = 'UPDATE' AND was_masked = is_masked
       AND OLD.permissions::jsonb = NEW.permissions::jsonb
       AND OLD."modulePermissions"::jsonb = NEW."modulePermissions"::jsonb THEN
      RETURN NEW; -- nome/cor/rank: nada a refazer
    END IF;
    PERFORM refresh_masked_entity_data(v_tenant, NULL);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP FUNCTION IF EXISTS public.trg_entity_data_calc_visible_roles() CASCADE;
CREATE FUNCTION public.trg_entity_data_calc_visible_roles() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_all TEXT[];
  v_own TEXT[];
  v_team TEXT[];
BEGIN
  SELECT all_roles, own_roles, team_roles INTO v_all, v_own, v_team
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
  NEW."_visibleTeamKeysJson" := calc_team_keys(NEW."tenantId", NEW."createdById", v_team);

  RETURN NEW;
END;
$$;

DROP FUNCTION IF EXISTS public.trg_entity_data_check_global_filter() CASCADE;
CREATE FUNCTION public.trg_entity_data_check_global_filter() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  entity_settings JSONB;
  global_filters JSONB;
BEGIN
  SELECT settings::jsonb INTO entity_settings
  FROM "Entity"
  WHERE id = NEW."entityId";

  global_filters := entity_settings->'globalFilters';

  NEW."_matchesGlobalFilter" := check_global_filters(NEW.data::jsonb, global_filters);

  IF NEW."parentRecordId" IS NOT NULL AND NEW."parentRecordId" != '' THEN
    NEW."_parentMatchesFilter" := get_parent_filter_status(NEW."parentRecordId");
  ELSE
    NEW."_parentMatchesFilter" := true;
  END IF;

  RETURN NEW;
END;
$$;

DROP FUNCTION IF EXISTS public.trg_entity_data_masked() CASCADE;
CREATE FUNCTION public.trg_entity_data_masked() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM "EntityDataMasked" WHERE "recordId" = OLD.id;
    RETURN OLD;
  END IF;
  IF EXISTS (SELECT 1 FROM tenant_masked_roles(NEW."tenantId")) THEN
    PERFORM refresh_masked_entity_data(NEW."tenantId", NEW.id);
  ELSIF TG_OP = 'UPDATE' THEN
    DELETE FROM "EntityDataMasked" WHERE "recordId" = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP FUNCTION IF EXISTS public.trg_entity_data_propagate_visible_roles() CASCADE;
CREATE FUNCTION public.trg_entity_data_propagate_visible_roles() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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
$$;

DROP FUNCTION IF EXISTS public.trg_entity_data_sync_record_channel() CASCADE;
CREATE FUNCTION public.trg_entity_data_sync_record_channel() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE "Channel" c SET "type" = c."type"
  WHERE c."tenantId" = NEW."tenantId" AND c."recordId" = NEW.id AND c."type" = 'record';
  RETURN NEW;
END; $$;

DROP FUNCTION IF EXISTS public.trg_entity_settings_update_global_filter() CASCADE;
CREATE FUNCTION public.trg_entity_settings_update_global_filter() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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
$$;

DROP FUNCTION IF EXISTS public.trg_membership_team_keys() CASCADE;
CREATE FUNCTION public.trg_membership_team_keys() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM refresh_team_access_keys(OLD."userId", OLD."tenantId");
    RETURN OLD;
  END IF;
  PERFORM refresh_team_access_keys(NEW."userId", NEW."tenantId");
  RETURN NEW;
END;
$$;

DROP FUNCTION IF EXISTS public.trg_message_team_keys() CASCADE;
CREATE FUNCTION public.trg_message_team_keys() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  SELECT COALESCE("_visibleTeamKeysJson", '[]'::jsonb) INTO NEW."_visibleTeamKeysJson"
    FROM "Channel" WHERE id = NEW."channelId";
  NEW."_visibleTeamKeysJson" := COALESCE(NEW."_visibleTeamKeysJson", '[]'::jsonb);
  RETURN NEW;
END; $$;

DROP FUNCTION IF EXISTS public.trg_team_member_changed() CASCADE;
CREATE FUNCTION public.trg_team_member_changed() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_tenant TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT "tenantId" INTO v_tenant FROM "Team" WHERE id = NEW."teamId";
    PERFORM refresh_team_access_keys(NEW."userId", v_tenant);
    IF tenant_uses_team_scope(v_tenant) THEN
      -- O BEFORE trigger do EntityData recalcula as chaves.
      UPDATE "EntityData" SET "_visibleTeamKeysJson" = '[]'::jsonb
      WHERE "createdById" = NEW."userId" AND "tenantId" = v_tenant;
    END IF;
    RETURN NEW;
  END IF;

  -- DELETE (tambem em cascata da exclusao da equipe: o Team pode nao existir mais).
  DELETE FROM "TeamAccessKey" WHERE "userId" = OLD."userId" AND "key" LIKE OLD."teamId" || ':%';
  UPDATE "EntityData" SET "_visibleTeamKeysJson" = '[]'::jsonb
  WHERE "createdById" = OLD."userId"
    AND EXISTS (
      SELECT 1 FROM jsonb_array_elements_text("_visibleTeamKeysJson") k
      WHERE k LIKE OLD."teamId" || ':%'
    );
  RETURN OLD;
END;
$$;

DROP FUNCTION IF EXISTS public.user_can_read_entity(uuid, text) CASCADE;
CREATE FUNCTION public.user_can_read_entity(custom_role_id uuid, entity_slug text) RETURNS boolean
    LANGUAGE plpgsql STABLE
    AS $$
DECLARE
  role_permissions JSONB;
  entity_permission JSONB;
  can_read BOOLEAN;
BEGIN
  -- If no role, deny access
  IF custom_role_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Get permissions from CustomRole
  SELECT permissions::jsonb INTO role_permissions
  FROM "CustomRole"
  WHERE id = custom_role_id;

  -- If no permissions found, deny access
  IF role_permissions IS NULL OR jsonb_typeof(role_permissions) != 'array' THEN
    RETURN FALSE;
  END IF;

  -- Find permission for this entity
  SELECT perm INTO entity_permission
  FROM jsonb_array_elements(role_permissions) AS perm
  WHERE perm->>'entitySlug' = entity_slug
  LIMIT 1;

  -- If no permission for this entity, deny access
  IF entity_permission IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Check canRead permission
  can_read := COALESCE((entity_permission->>'canRead')::boolean, false);

  RETURN can_read;
END;
$$;

DROP FUNCTION IF EXISTS public.user_has_own_scope(uuid, text) CASCADE;
CREATE FUNCTION public.user_has_own_scope(custom_role_id uuid, entity_slug text) RETURNS boolean
    LANGUAGE plpgsql STABLE
    AS $$
DECLARE
  role_permissions JSONB;
  entity_permission JSONB;
  scope TEXT;
BEGIN
  IF custom_role_id IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT permissions::jsonb INTO role_permissions
  FROM "CustomRole"
  WHERE id = custom_role_id;

  IF role_permissions IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT perm INTO entity_permission
  FROM jsonb_array_elements(role_permissions) AS perm
  WHERE perm->>'entitySlug' = entity_slug
  LIMIT 1;

  IF entity_permission IS NULL THEN
    RETURN FALSE;
  END IF;

  scope := COALESCE(entity_permission->>'scope', 'all');

  RETURN scope = 'own';
END;
$$;

DROP TRIGGER IF EXISTS Channel ON public.trg_channel_calc_visible_roles;
CREATE TRIGGER trg_channel_calc_visible_roles BEFORE INSERT OR UPDATE ON public."Channel" FOR EACH ROW EXECUTE FUNCTION public.trg_channel_calc_visible_roles();

DROP TRIGGER IF EXISTS Channel ON public.trg_channel_sync_message_team_keys;
CREATE TRIGGER trg_channel_sync_message_team_keys AFTER UPDATE ON public."Channel" FOR EACH ROW WHEN ((old."_visibleTeamKeysJson" IS DISTINCT FROM new."_visibleTeamKeysJson")) EXECUTE FUNCTION public.trg_channel_sync_message_team_keys();

DROP TRIGGER IF EXISTS CommandTemplate ON public.trg_command_template_visible_roles;
CREATE TRIGGER trg_command_template_visible_roles BEFORE INSERT OR UPDATE ON public."CommandTemplate" FOR EACH ROW EXECUTE FUNCTION public.trg_command_template_visible_roles();

DROP TRIGGER IF EXISTS CustomRole ON public.trg_custom_role_masked;
CREATE TRIGGER trg_custom_role_masked AFTER INSERT OR DELETE OR UPDATE ON public."CustomRole" FOR EACH ROW EXECUTE FUNCTION public.trg_custom_role_masked();

DROP TRIGGER IF EXISTS EntityData ON public.trg_entity_data_calc_visible_roles;
CREATE TRIGGER trg_entity_data_calc_visible_roles BEFORE INSERT OR UPDATE ON public."EntityData" FOR EACH ROW EXECUTE FUNCTION public.trg_entity_data_calc_visible_roles();

DROP TRIGGER IF EXISTS EntityData ON public.trg_entity_data_global_filter;
CREATE TRIGGER trg_entity_data_global_filter BEFORE INSERT OR UPDATE OF data, "entityId" ON public."EntityData" FOR EACH ROW EXECUTE FUNCTION public.trg_entity_data_check_global_filter();

DROP TRIGGER IF EXISTS EntityData ON public.trg_entity_data_masked;
CREATE TRIGGER trg_entity_data_masked AFTER INSERT OR DELETE OR UPDATE ON public."EntityData" FOR EACH ROW EXECUTE FUNCTION public.trg_entity_data_masked();

DROP TRIGGER IF EXISTS EntityData ON public.trg_entity_data_propagate_visible_roles;
CREATE TRIGGER trg_entity_data_propagate_visible_roles AFTER UPDATE ON public."EntityData" FOR EACH ROW EXECUTE FUNCTION public.trg_entity_data_propagate_visible_roles();

DROP TRIGGER IF EXISTS EntityData ON public.trg_entity_data_sync_record_channel;
CREATE TRIGGER trg_entity_data_sync_record_channel AFTER UPDATE ON public."EntityData" FOR EACH ROW WHEN (((old."_visibleTeamKeysJson" IS DISTINCT FROM new."_visibleTeamKeysJson") OR (old."_visibleToRoles" IS DISTINCT FROM new."_visibleToRoles") OR (old."_visibleToRolesOwnJson" IS DISTINCT FROM new."_visibleToRolesOwnJson") OR (old."createdById" IS DISTINCT FROM new."createdById"))) EXECUTE FUNCTION public.trg_entity_data_sync_record_channel();

DROP TRIGGER IF EXISTS Entity ON public.trg_entity_settings_global_filter;
CREATE TRIGGER trg_entity_settings_global_filter AFTER UPDATE OF settings ON public."Entity" FOR EACH ROW EXECUTE FUNCTION public.trg_entity_settings_update_global_filter();

DROP TRIGGER IF EXISTS UserTenantAccess ON public.trg_membership_team_keys;
CREATE TRIGGER trg_membership_team_keys AFTER INSERT OR DELETE OR UPDATE OF "customRoleId", status, "deletedAt" ON public."UserTenantAccess" FOR EACH ROW EXECUTE FUNCTION public.trg_membership_team_keys();

DROP TRIGGER IF EXISTS Message ON public.trg_message_team_keys;
CREATE TRIGGER trg_message_team_keys BEFORE INSERT ON public."Message" FOR EACH ROW EXECUTE FUNCTION public.trg_message_team_keys();

DROP TRIGGER IF EXISTS EntityData ON public.trg_propagate_filter_to_children;
CREATE TRIGGER trg_propagate_filter_to_children AFTER UPDATE OF "_matchesGlobalFilter", "_parentMatchesFilter" ON public."EntityData" FOR EACH ROW EXECUTE FUNCTION public.propagate_filter_to_children();

DROP TRIGGER IF EXISTS TeamMember ON public.trg_team_member_changed;
CREATE TRIGGER trg_team_member_changed AFTER INSERT OR DELETE ON public."TeamMember" FOR EACH ROW EXECUTE FUNCTION public.trg_team_member_changed();

COMMIT;
