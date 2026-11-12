-- BASELINE: schema completo do banco (tabelas, indices, funcoes, triggers, extensoes
-- e publicacao do PowerSync), gerado com pg_dump --schema-only do dev em 05/11/2026,
-- depois da migration 20261118000100_chat_cards_hidden_fields.
--
-- Substitui as 50 migrations antigas (em prisma/migrations-archive/, so para consulta):
-- elas nao subiam num banco vazio (fora de ordem). Num banco que ja tem o schema
-- (dev; prod depois de alcancar o schema atual), esta migration e marcada como
-- aplicada com `prisma migrate resolve --applied 00000000000000_baseline`.
-- Sem dados: os cargos padrao etc. sao criados pela aplicacao.

SET check_function_bodies = false;
SET client_min_messages = warning;
--
-- PostgreSQL database dump
--


-- Dumped from database version 16.11
-- Dumped by pg_dump version 16.11


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS '';


--
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;


--
-- Name: EXTENSION pg_trgm; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_trgm IS 'text similarity measurement and index searching based on trigrams';


--
-- Name: unaccent; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public;


--
-- Name: EXTENSION unaccent; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION unaccent IS 'text search dictionary that removes accents';


--
-- Name: ActionChainTrigger; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ActionChainTrigger" AS ENUM (
    'MANUAL',
    'WEBHOOK',
    'SCHEDULE',
    'EVENT'
);


--
-- Name: AnnouncementSeverity; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."AnnouncementSeverity" AS ENUM (
    'INFO',
    'WARNING',
    'CRITICAL'
);


--
-- Name: AutomationTrigger; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."AutomationTrigger" AS ENUM (
    'ON_CREATE',
    'ON_UPDATE',
    'ON_DELETE',
    'ON_FIELD_CHANGE',
    'ON_STATUS_CHANGE',
    'SCHEDULE',
    'MANUAL'
);


--
-- Name: HttpMethod; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."HttpMethod" AS ENUM (
    'GET',
    'POST',
    'PUT',
    'PATCH',
    'DELETE'
);


--
-- Name: NotificationType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."NotificationType" AS ENUM (
    'INFO',
    'SUCCESS',
    'WARNING',
    'ERROR'
);


--
-- Name: PdfGenerationStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PdfGenerationStatus" AS ENUM (
    'PENDING',
    'PROCESSING',
    'COMPLETED',
    'FAILED'
);


--
-- Name: PdfOrientation; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PdfOrientation" AS ENUM (
    'PORTRAIT',
    'LANDSCAPE'
);


--
-- Name: PdfPageSize; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PdfPageSize" AS ENUM (
    'A4',
    'LETTER',
    'LEGAL'
);


--
-- Name: PlatformStaffRole; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PlatformStaffRole" AS ENUM (
    'OWNER',
    'SUPPORT',
    'FINANCE',
    'READONLY'
);


--
-- Name: Status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."Status" AS ENUM (
    'ACTIVE',
    'INACTIVE',
    'SUSPENDED'
);


--
-- Name: SupportTicketPriority; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."SupportTicketPriority" AS ENUM (
    'LOW',
    'NORMAL',
    'HIGH',
    'URGENT'
);


--
-- Name: SupportTicketStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."SupportTicketStatus" AS ENUM (
    'OPEN',
    'WAITING_CUSTOMER',
    'RESOLVED',
    'CLOSED'
);


--
-- Name: TenantLifecycle; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."TenantLifecycle" AS ENUM (
    'TRIAL',
    'ACTIVE',
    'PAST_DUE',
    'SUSPENDED',
    'CANCELED'
);


--
-- Name: WebhookStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."WebhookStatus" AS ENUM (
    'ACTIVE',
    'INACTIVE',
    'PAUSED'
);


--
-- Name: calc_channel_group_visibility(text, text); Type: FUNCTION; Schema: public; Owner: -
--

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


--
-- Name: calc_record_visibility(text, text, jsonb, text); Type: FUNCTION; Schema: public; Owner: -
--

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


--
-- Name: calc_team_keys(text, text, text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calc_team_keys(p_tenant_id text, p_creator_id text, p_team_roles text[]) RETURNS jsonb
    LANGUAGE sql STABLE
    AS $$
  SELECT COALESCE(jsonb_agg(DISTINCT tm."teamId" || ':' || r), '[]'::jsonb)
  FROM "TeamMember" tm
  JOIN "Team" t ON t.id = tm."teamId" AND t."tenantId" = p_tenant_id
  CROSS JOIN unnest(COALESCE(p_team_roles, ARRAY[]::TEXT[])) AS r
  WHERE p_creator_id IS NOT NULL AND tm."userId" = p_creator_id;
$$;


--
-- Name: calculate_visible_to_roles(text, text, jsonb, text); Type: FUNCTION; Schema: public; Owner: -
--

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


--
-- Name: check_global_filters(jsonb, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

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


--
-- Name: check_merged_role_filters(jsonb, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

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


--
-- Name: check_role_data_filters(jsonb, jsonb, text); Type: FUNCTION; Schema: public; Owner: -
--

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


--
-- Name: f_unaccent(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.f_unaccent(text) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
    AS $_$ SELECT public.unaccent('public.unaccent', $1) $_$;


--
-- Name: get_parent_filter_status(text); Type: FUNCTION; Schema: public; Owner: -
--

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


--
-- Name: get_role_entity_filters(jsonb, text); Type: FUNCTION; Schema: public; Owner: -
--

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


--
-- Name: get_role_entity_scope(jsonb, text); Type: FUNCTION; Schema: public; Owner: -
--

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


--
-- Name: propagate_filter_to_children(); Type: FUNCTION; Schema: public; Owner: -
--

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


--
-- Name: recompute_channel_visibility(text, text); Type: FUNCTION; Schema: public; Owner: -
--

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


--
-- Name: recompute_visibility_batch(text, text, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

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


--
-- Name: refresh_masked_entity_data(text, text); Type: FUNCTION; Schema: public; Owner: -
--

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


--
-- Name: refresh_team_access_keys(text, text); Type: FUNCTION; Schema: public; Owner: -
--

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


--
-- Name: role_can_read_entity(jsonb, text); Type: FUNCTION; Schema: public; Owner: -
--

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


--
-- Name: role_entity_rule(jsonb, text); Type: FUNCTION; Schema: public; Owner: -
--

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


--
-- Name: role_has_hidden_fields(jsonb, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

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


--
-- Name: role_hidden_fields(jsonb, text); Type: FUNCTION; Schema: public; Owner: -
--

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


--
-- Name: tenant_masked_roles(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tenant_masked_roles(p_tenant text) RETURNS TABLE(id text, permissions jsonb)
    LANGUAGE sql STABLE
    AS $$
  SELECT r.id, r.permissions::jsonb
  FROM "CustomRole" r
  WHERE r."tenantId" = p_tenant AND r."deletedAt" IS NULL
    AND role_has_hidden_fields(r.permissions::jsonb, r."modulePermissions"::jsonb);
$$;


--
-- Name: tenant_uses_team_scope(text); Type: FUNCTION; Schema: public; Owner: -
--

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


--
-- Name: trg_channel_calc_visible_roles(); Type: FUNCTION; Schema: public; Owner: -
--

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


--
-- Name: trg_channel_sync_message_team_keys(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_channel_sync_message_team_keys() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE "Message" SET "_visibleTeamKeysJson" = NEW."_visibleTeamKeysJson"
  WHERE "channelId" = NEW.id;
  RETURN NEW;
END; $$;


--
-- Name: trg_command_template_visible_roles(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_command_template_visible_roles() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW."_visibleToRolesJson" := to_jsonb(COALESCE(NEW."visibleToRoleIds", ARRAY[]::text[]));
  RETURN NEW;
END; $$;


--
-- Name: trg_custom_role_data_filters_update(); Type: FUNCTION; Schema: public; Owner: -
--

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


--
-- Name: trg_custom_role_masked(); Type: FUNCTION; Schema: public; Owner: -
--

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


--
-- Name: trg_entity_data_calc_visible_roles(); Type: FUNCTION; Schema: public; Owner: -
--

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


--
-- Name: trg_entity_data_check_global_filter(); Type: FUNCTION; Schema: public; Owner: -
--

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


--
-- Name: trg_entity_data_masked(); Type: FUNCTION; Schema: public; Owner: -
--

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


--
-- Name: trg_entity_data_propagate_visible_roles(); Type: FUNCTION; Schema: public; Owner: -
--

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


--
-- Name: trg_entity_data_sync_record_channel(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_entity_data_sync_record_channel() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE "Channel" c SET "type" = c."type"
  WHERE c."tenantId" = NEW."tenantId" AND c."recordId" = NEW.id AND c."type" = 'record';
  RETURN NEW;
END; $$;


--
-- Name: trg_entity_settings_update_global_filter(); Type: FUNCTION; Schema: public; Owner: -
--

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


--
-- Name: trg_membership_team_keys(); Type: FUNCTION; Schema: public; Owner: -
--

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


--
-- Name: trg_message_team_keys(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_message_team_keys() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  SELECT COALESCE("_visibleTeamKeysJson", '[]'::jsonb) INTO NEW."_visibleTeamKeysJson"
    FROM "Channel" WHERE id = NEW."channelId";
  NEW."_visibleTeamKeysJson" := COALESCE(NEW."_visibleTeamKeysJson", '[]'::jsonb);
  RETURN NEW;
END; $$;


--
-- Name: trg_team_member_changed(); Type: FUNCTION; Schema: public; Owner: -
--

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


--
-- Name: user_can_read_entity(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

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


--
-- Name: user_has_own_scope(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

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




--
-- Name: ActionChain; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ActionChain" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "entityId" text,
    name text NOT NULL,
    description text,
    trigger public."ActionChainTrigger" DEFAULT 'MANUAL'::public."ActionChainTrigger" NOT NULL,
    "triggerConfig" jsonb,
    actions jsonb DEFAULT '[]'::jsonb NOT NULL,
    "errorHandling" text DEFAULT 'stop'::text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "deletedAt" timestamp(3) without time zone
);


--
-- Name: ActionChainExecution; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ActionChainExecution" (
    id text NOT NULL,
    "actionChainId" text NOT NULL,
    "tenantId" text NOT NULL,
    "triggeredBy" text NOT NULL,
    "recordId" text,
    "inputData" jsonb,
    "currentStep" integer DEFAULT 0 NOT NULL,
    "totalSteps" integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'running'::text NOT NULL,
    "stepResults" jsonb DEFAULT '[]'::jsonb NOT NULL,
    "errorMessage" text,
    duration integer,
    "startedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "completedAt" timestamp(3) without time zone
);


--
-- Name: Announcement; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Announcement" (
    id text NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    severity public."AnnouncementSeverity" DEFAULT 'INFO'::public."AnnouncementSeverity" NOT NULL,
    audience jsonb DEFAULT '{"ids": [], "type": "all"}'::jsonb NOT NULL,
    "adminsOnly" boolean DEFAULT false NOT NULL,
    dismissible boolean DEFAULT true NOT NULL,
    "linkUrl" text,
    "linkLabel" text,
    "startsAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "endsAt" timestamp(3) without time zone,
    "publishedAt" timestamp(3) without time zone,
    "createdById" text NOT NULL,
    "createdByName" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: AnnouncementDismissal; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AnnouncementDismissal" (
    id text NOT NULL,
    "announcementId" text NOT NULL,
    "userId" text NOT NULL,
    "tenantId" text NOT NULL,
    "dismissedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: ApiExecutionLog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ApiExecutionLog" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "customApiId" text,
    "webhookId" text,
    "actionChainId" text,
    method text NOT NULL,
    path text NOT NULL,
    "inputPayload" jsonb,
    "userId" text,
    ip text,
    status text NOT NULL,
    "statusCode" integer,
    "outputPayload" jsonb,
    "errorMessage" text,
    duration integer,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: ApiKey; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ApiKey" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    name text NOT NULL,
    prefix text NOT NULL,
    "keyHash" text NOT NULL,
    "customRoleId" text NOT NULL,
    "createdById" text NOT NULL,
    "serviceUserId" text NOT NULL,
    "lastUsedAt" timestamp(3) without time zone,
    "expiresAt" timestamp(3) without time zone,
    "revokedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: ArchivedAuditLog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ArchivedAuditLog" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "userId" text,
    action text NOT NULL,
    resource text NOT NULL,
    "resourceId" text,
    "oldData" jsonb,
    "newData" jsonb,
    metadata jsonb,
    "createdAt" timestamp without time zone NOT NULL,
    "archivedAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: ArchivedEntityData; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ArchivedEntityData" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "entityId" text NOT NULL,
    data jsonb NOT NULL,
    "parentRecordId" text,
    "createdAt" timestamp(3) without time zone NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "createdById" text,
    "updatedById" text,
    "archivedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "computedValues" jsonb DEFAULT '{}'::jsonb
);


--
-- Name: COLUMN "ArchivedEntityData"."computedValues"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."ArchivedEntityData"."computedValues" IS 'Materialized computed field values (formulas, rollups, timers, sla-status). Recomputed when dependencies change.';


--
-- Name: AuditLog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AuditLog" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "userId" text,
    action text NOT NULL,
    resource text NOT NULL,
    "resourceId" text,
    "oldData" jsonb,
    "newData" jsonb,
    metadata jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "impersonatedById" text,
    "impersonatedByName" text
);


--
-- Name: AutomationExecution; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AutomationExecution" (
    id text NOT NULL,
    "automationId" text NOT NULL,
    "tenantId" text NOT NULL,
    "recordId" text,
    "triggeredBy" text NOT NULL,
    "inputData" jsonb,
    "currentStep" integer DEFAULT 0 NOT NULL,
    "totalSteps" integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'running'::text NOT NULL,
    "stepResults" jsonb DEFAULT '[]'::jsonb NOT NULL,
    "errorMessage" text,
    duration integer,
    "startedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "completedAt" timestamp(3) without time zone
);


--
-- Name: BotIdentity; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."BotIdentity" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "userId" text NOT NULL,
    "customRoleId" text NOT NULL,
    name text DEFAULT 'Assistente'::text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Channel; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Channel" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    type text NOT NULL,
    "entityId" text,
    "recordId" text,
    name text,
    "createdById" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "dmKey" text,
    "deletedAt" timestamp(3) without time zone,
    "_visibleToRolesJson" jsonb DEFAULT '[]'::jsonb NOT NULL,
    "_visibleToRolesOwnJson" jsonb DEFAULT '[]'::jsonb NOT NULL,
    "_hasRoleFilter" boolean DEFAULT false NOT NULL,
    "_recordCreatedById" text,
    "_visibleTeamKeysJson" jsonb DEFAULT '[]'::jsonb NOT NULL
);


--
-- Name: ChannelCommand; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ChannelCommand" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "channelId" text NOT NULL,
    "commandTemplateId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: ChannelMember; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ChannelMember" (
    id text NOT NULL,
    "channelId" text NOT NULL,
    "userId" text NOT NULL,
    role text DEFAULT 'member'::text NOT NULL,
    "lastReadAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: CommandTemplate; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CommandTemplate" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    slug text NOT NULL,
    description text,
    icon text,
    "targetEntitySlug" text,
    fields jsonb,
    "actionType" text DEFAULT 'create_record'::text NOT NULL,
    "actionConfig" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "execMode" text DEFAULT 'as_user'::text NOT NULL,
    elevation jsonb,
    llm jsonb,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "visibleToRoleIds" text[] DEFAULT '{}'::text[] NOT NULL,
    "_visibleToRolesJson" jsonb DEFAULT '[]'::jsonb NOT NULL
);


--
-- Name: CustomRole; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CustomRole" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    name text NOT NULL,
    description text,
    color text DEFAULT '#6366f1'::text,
    permissions jsonb DEFAULT '[]'::jsonb NOT NULL,
    "modulePermissions" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "isDefault" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "isSystem" boolean DEFAULT false NOT NULL,
    "tenantPermissions" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "deletedAt" timestamp(3) without time zone,
    rank integer DEFAULT 100 NOT NULL,
    "permsVersion" integer DEFAULT 0 NOT NULL
);


--
-- Name: DashboardTemplate; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."DashboardTemplate" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    name text NOT NULL,
    description text,
    "entitySlug" text,
    layout jsonb DEFAULT '[]'::jsonb NOT NULL,
    widgets jsonb DEFAULT '{}'::jsonb NOT NULL,
    "roleIds" text[],
    priority integer DEFAULT 0 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    tabs jsonb DEFAULT '[]'::jsonb NOT NULL,
    "deletedAt" timestamp(3) without time zone,
    settings jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: DeviceToken; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."DeviceToken" (
    id text NOT NULL,
    "userId" text NOT NULL,
    token text NOT NULL,
    platform text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: EmailTemplate; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."EmailTemplate" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    description text,
    subject text NOT NULL,
    "bodyHtml" text NOT NULL,
    "bodyText" text,
    variables text[],
    "fromName" text,
    "fromEmail" text,
    "replyTo" text,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "deletedAt" timestamp(3) without time zone
);


--
-- Name: Entity; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Entity" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    name text NOT NULL,
    "namePlural" text NOT NULL,
    slug text NOT NULL,
    description text,
    icon text,
    color text,
    fields jsonb NOT NULL,
    settings jsonb DEFAULT '{}'::jsonb NOT NULL,
    "isSystem" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    category text,
    "deletedAt" timestamp(3) without time zone
);


--
-- Name: EntityAutomation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."EntityAutomation" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "entityId" text NOT NULL,
    name text NOT NULL,
    description text,
    "isActive" boolean DEFAULT true NOT NULL,
    trigger public."AutomationTrigger" NOT NULL,
    "triggerConfig" jsonb,
    conditions jsonb,
    actions jsonb DEFAULT '[]'::jsonb NOT NULL,
    "errorHandling" text DEFAULT 'stop'::text NOT NULL,
    "maxExecutionsPerHour" integer DEFAULT 100 NOT NULL,
    "lastRunAt" timestamp(3) without time zone,
    "nextRunAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "deletedAt" timestamp(3) without time zone
);


--
-- Name: EntityData; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."EntityData" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "entityId" text NOT NULL,
    data jsonb NOT NULL,
    "parentRecordId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "createdById" text,
    "updatedById" text,
    "deletedAt" timestamp(3) without time zone,
    "_matchesGlobalFilter" boolean DEFAULT true NOT NULL,
    "_parentMatchesFilter" boolean DEFAULT true NOT NULL,
    "_visibleToRoles" text[],
    "_hasRoleFilter" boolean DEFAULT false NOT NULL,
    "_visibleToRolesJson" jsonb DEFAULT '[]'::jsonb NOT NULL,
    "computedValues" jsonb DEFAULT '{}'::jsonb,
    "_visibleToRolesOwnJson" jsonb DEFAULT '[]'::jsonb NOT NULL,
    "deletedById" text,
    "_visibleTeamKeysJson" jsonb DEFAULT '[]'::jsonb NOT NULL
);


--
-- Name: COLUMN "EntityData"."computedValues"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."EntityData"."computedValues" IS 'Materialized computed field values (formulas, rollups, timers, sla-status). Recomputed when dependencies change.';


--
-- Name: EntityDataMasked; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."EntityDataMasked" (
    id text NOT NULL,
    "recordId" text NOT NULL,
    "roleId" text NOT NULL,
    "tenantId" text NOT NULL,
    "entityId" text NOT NULL,
    data jsonb NOT NULL,
    "parentRecordId" text,
    "createdById" text,
    "updatedById" text,
    "createdAt" timestamp(3) without time zone,
    "updatedAt" timestamp(3) without time zone,
    "_visibleAll" boolean DEFAULT false NOT NULL,
    "_visibleOwn" boolean DEFAULT false NOT NULL,
    "_visibleTeamKeysJson" jsonb DEFAULT '[]'::jsonb NOT NULL
);


--
-- Name: EntityFieldRule; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."EntityFieldRule" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "entityId" text NOT NULL,
    "fieldSlug" text NOT NULL,
    "ruleType" text NOT NULL,
    condition jsonb,
    config jsonb NOT NULL,
    priority integer DEFAULT 0 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "deletedAt" timestamp(3) without time zone
);


--
-- Name: Invitation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Invitation" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    email text NOT NULL,
    name text,
    "customRoleId" text NOT NULL,
    "tokenHash" text NOT NULL,
    "invitedById" text,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "acceptedAt" timestamp(3) without time zone,
    "revokedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Message; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Message" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "channelId" text NOT NULL,
    "senderId" text,
    type text DEFAULT 'text'::text NOT NULL,
    content text,
    meta jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "_visibleTeamKeysJson" jsonb DEFAULT '[]'::jsonb NOT NULL,
    "recipientId" text
);


--
-- Name: Notification; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Notification" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "userId" text NOT NULL,
    type public."NotificationType" DEFAULT 'INFO'::public."NotificationType" NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    data jsonb,
    read boolean DEFAULT false NOT NULL,
    "readAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "entitySlug" text,
    "deletedAt" timestamp(3) without time zone
);


--
-- Name: NotificationPreference; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."NotificationPreference" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "tenantId" text NOT NULL,
    prefs jsonb DEFAULT '{}'::jsonb NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: PdfGeneration; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PdfGeneration" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "templateId" text NOT NULL,
    status public."PdfGenerationStatus" DEFAULT 'PENDING'::public."PdfGenerationStatus" NOT NULL,
    progress integer DEFAULT 0 NOT NULL,
    "recordIds" jsonb DEFAULT '[]'::jsonb NOT NULL,
    "fileUrl" text,
    "fileName" text,
    "fileSize" integer,
    "pageCount" integer,
    "errorMessage" text,
    metadata jsonb,
    "requestedById" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "completedAt" timestamp(3) without time zone
);


--
-- Name: PdfTemplate; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PdfTemplate" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    description text,
    icon text,
    "pageSize" public."PdfPageSize" DEFAULT 'A4'::public."PdfPageSize" NOT NULL,
    orientation public."PdfOrientation" DEFAULT 'PORTRAIT'::public."PdfOrientation" NOT NULL,
    margins jsonb DEFAULT '{"top": 70, "left": 70, "right": 70, "bottom": 70}'::jsonb NOT NULL,
    content jsonb DEFAULT '{}'::jsonb NOT NULL,
    "sourceEntityId" text,
    "selectedFields" jsonb DEFAULT '[]'::jsonb NOT NULL,
    "logoUrl" text,
    "templateType" text DEFAULT 'single'::text NOT NULL,
    "isPublished" boolean DEFAULT false NOT NULL,
    "publishedAt" timestamp(3) without time zone,
    version integer DEFAULT 1 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "deletedAt" timestamp(3) without time zone
);


--
-- Name: Plan; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Plan" (
    id text NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    description text,
    limits jsonb DEFAULT '{}'::jsonb NOT NULL,
    features jsonb DEFAULT '{}'::jsonb NOT NULL,
    "isDefault" boolean DEFAULT false NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: PlatformAuditLog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PlatformAuditLog" (
    id text NOT NULL,
    "staffId" text NOT NULL,
    "staffName" text NOT NULL,
    action text NOT NULL,
    "targetType" text NOT NULL,
    "targetId" text,
    "tenantId" text,
    metadata jsonb,
    ip text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: PlatformStaff; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PlatformStaff" (
    id text NOT NULL,
    email text NOT NULL,
    password text NOT NULL,
    name text NOT NULL,
    role public."PlatformStaffRole" DEFAULT 'READONLY'::public."PlatformStaffRole" NOT NULL,
    status public."Status" DEFAULT 'ACTIVE'::public."Status" NOT NULL,
    "lastLoginAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "deletedAt" timestamp(3) without time zone
);


--
-- Name: PublicLink; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PublicLink" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    slug text NOT NULL,
    "entitySlug" text NOT NULL,
    "entityId" text NOT NULL,
    "customRoleId" text NOT NULL,
    name text NOT NULL,
    description text,
    "isActive" boolean DEFAULT true NOT NULL,
    "expiresAt" timestamp(3) without time zone,
    "maxUsers" integer,
    "registrationCount" integer DEFAULT 0 NOT NULL,
    settings jsonb DEFAULT '{}'::jsonb NOT NULL,
    "createdById" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "deletedAt" timestamp(3) without time zone
);


--
-- Name: RefreshToken; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."RefreshToken" (
    id text NOT NULL,
    "userId" text NOT NULL,
    token text NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "sessionId" text
);


--
-- Name: ScheduledTask; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ScheduledTask" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "entityId" text,
    name text NOT NULL,
    description text,
    "cronExpression" text NOT NULL,
    timezone text DEFAULT 'America/Sao_Paulo'::text NOT NULL,
    "actionType" text NOT NULL,
    "actionConfig" jsonb,
    "isActive" boolean DEFAULT true NOT NULL,
    "lastRunAt" timestamp(3) without time zone,
    "nextRunAt" timestamp(3) without time zone,
    "runCount" integer DEFAULT 0 NOT NULL,
    "successCount" integer DEFAULT 0 NOT NULL,
    "failureCount" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "deletedAt" timestamp(3) without time zone
);


--
-- Name: ScheduledTaskExecution; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ScheduledTaskExecution" (
    id text NOT NULL,
    "scheduledTaskId" text NOT NULL,
    "tenantId" text NOT NULL,
    status text NOT NULL,
    duration integer,
    "outputData" jsonb,
    "errorMessage" text,
    "startedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "completedAt" timestamp(3) without time zone
);


--
-- Name: SupportMessage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SupportMessage" (
    id text NOT NULL,
    "ticketId" text NOT NULL,
    "authorType" text NOT NULL,
    "authorUserId" text,
    "authorStaffId" text,
    "authorName" text NOT NULL,
    body text NOT NULL,
    internal boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: SupportTicket; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SupportTicket" (
    id text NOT NULL,
    number integer NOT NULL,
    "tenantId" text NOT NULL,
    "createdById" text,
    "createdByName" text NOT NULL,
    "createdByEmail" text NOT NULL,
    subject text NOT NULL,
    category text DEFAULT 'question'::text NOT NULL,
    priority public."SupportTicketPriority" DEFAULT 'NORMAL'::public."SupportTicketPriority" NOT NULL,
    status public."SupportTicketStatus" DEFAULT 'OPEN'::public."SupportTicketStatus" NOT NULL,
    "assignedStaffId" text,
    "lastMessageAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "lastMessageBy" text DEFAULT 'customer'::text NOT NULL,
    "closedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: SupportTicket_number_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."SupportTicket_number_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: SupportTicket_number_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."SupportTicket_number_seq" OWNED BY public."SupportTicket".number;


--
-- Name: Team; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Team" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    name text NOT NULL,
    description text,
    color text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: TeamAccessKey; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."TeamAccessKey" (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    "userId" text NOT NULL,
    "tenantId" text NOT NULL,
    key text NOT NULL
);


--
-- Name: TeamMember; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."TeamMember" (
    id text NOT NULL,
    "teamId" text NOT NULL,
    "userId" text NOT NULL,
    "isLeader" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Tenant; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Tenant" (
    id text NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    domain text,
    logo text,
    settings jsonb DEFAULT '{}'::jsonb NOT NULL,
    status public."Status" DEFAULT 'ACTIVE'::public."Status" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "deletedAt" timestamp(3) without time zone,
    "featureOverrides" jsonb DEFAULT '{}'::jsonb NOT NULL,
    lifecycle public."TenantLifecycle" DEFAULT 'ACTIVE'::public."TenantLifecycle" NOT NULL,
    "planId" text,
    "trialEndsAt" timestamp(3) without time zone,
    "storageUsedKb" integer DEFAULT 0 NOT NULL,
    "ownerId" text
);


--
-- Name: TenantLifecycleEvent; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."TenantLifecycleEvent" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "from" public."TenantLifecycle",
    "to" public."TenantLifecycle" NOT NULL,
    source text NOT NULL,
    "staffId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: User; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."User" (
    id text NOT NULL,
    email text NOT NULL,
    password text NOT NULL,
    name text NOT NULL,
    avatar text,
    status public."Status" DEFAULT 'ACTIVE'::public."Status" NOT NULL,
    "lastLoginAt" timestamp(3) without time zone,
    "resetToken" text,
    "resetTokenExpires" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    cpf text,
    cnpj text,
    phone text,
    "deletedAt" timestamp(3) without time zone,
    "isServiceAccount" boolean DEFAULT false NOT NULL,
    "mfaSecret" text,
    "mfaPendingSecret" text,
    "mfaEnabledAt" timestamp(3) without time zone,
    "mfaRecoveryCodes" text[] DEFAULT ARRAY[]::text[] NOT NULL
);


--
-- Name: UserSession; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."UserSession" (
    id text NOT NULL,
    "userId" text NOT NULL,
    ip text,
    "userAgent" text,
    label text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "lastUsedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "revokedAt" timestamp(3) without time zone
);


--
-- Name: UserTenantAccess; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."UserTenantAccess" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "tenantId" text NOT NULL,
    "customRoleId" text NOT NULL,
    status public."Status" DEFAULT 'ACTIVE'::public."Status" NOT NULL,
    "grantedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "expiresAt" timestamp(3) without time zone,
    "grantedById" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "deletedAt" timestamp(3) without time zone,
    "isPrimary" boolean DEFAULT false NOT NULL
);


--
-- Name: Webhook; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Webhook" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "entityId" text,
    name text NOT NULL,
    description text,
    url text NOT NULL,
    method public."HttpMethod" DEFAULT 'POST'::public."HttpMethod" NOT NULL,
    headers jsonb,
    "bodyTemplate" jsonb,
    events text[],
    "filterConditions" jsonb,
    status public."WebhookStatus" DEFAULT 'ACTIVE'::public."WebhookStatus" NOT NULL,
    "retryCount" integer DEFAULT 3 NOT NULL,
    "retryDelay" integer DEFAULT 1000 NOT NULL,
    timeout integer DEFAULT 30000 NOT NULL,
    secret text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "deletedAt" timestamp(3) without time zone
);


--
-- Name: WebhookExecution; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."WebhookExecution" (
    id text NOT NULL,
    "webhookId" text NOT NULL,
    "tenantId" text NOT NULL,
    event text NOT NULL,
    "recordId" text,
    "requestUrl" text NOT NULL,
    "requestMethod" text NOT NULL,
    "requestHeaders" jsonb,
    "requestBody" jsonb,
    "responseStatus" integer,
    "responseBody" jsonb,
    "responseTime" integer,
    status text NOT NULL,
    "errorMessage" text,
    "retryCount" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: visibility_recompute; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.visibility_recompute (
    id bigint NOT NULL,
    "tenantId" text NOT NULL,
    "entitySlug" text NOT NULL,
    cursor text DEFAULT ''::text NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: visibility_recompute_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.visibility_recompute_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: visibility_recompute_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.visibility_recompute_id_seq OWNED BY public.visibility_recompute.id;


--
-- Name: SupportTicket number; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SupportTicket" ALTER COLUMN number SET DEFAULT nextval('public."SupportTicket_number_seq"'::regclass);


--
-- Name: visibility_recompute id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visibility_recompute ALTER COLUMN id SET DEFAULT nextval('public.visibility_recompute_id_seq'::regclass);


--
-- Name: ActionChainExecution ActionChainExecution_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ActionChainExecution"
    ADD CONSTRAINT "ActionChainExecution_pkey" PRIMARY KEY (id);


--
-- Name: ActionChain ActionChain_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ActionChain"
    ADD CONSTRAINT "ActionChain_pkey" PRIMARY KEY (id);


--
-- Name: AnnouncementDismissal AnnouncementDismissal_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnnouncementDismissal"
    ADD CONSTRAINT "AnnouncementDismissal_pkey" PRIMARY KEY (id);


--
-- Name: Announcement Announcement_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Announcement"
    ADD CONSTRAINT "Announcement_pkey" PRIMARY KEY (id);


--
-- Name: ApiExecutionLog ApiExecutionLog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ApiExecutionLog"
    ADD CONSTRAINT "ApiExecutionLog_pkey" PRIMARY KEY (id);


--
-- Name: ApiKey ApiKey_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ApiKey"
    ADD CONSTRAINT "ApiKey_pkey" PRIMARY KEY (id);


--
-- Name: ArchivedAuditLog ArchivedAuditLog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ArchivedAuditLog"
    ADD CONSTRAINT "ArchivedAuditLog_pkey" PRIMARY KEY (id);


--
-- Name: ArchivedEntityData ArchivedEntityData_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ArchivedEntityData"
    ADD CONSTRAINT "ArchivedEntityData_pkey" PRIMARY KEY (id);


--
-- Name: AuditLog AuditLog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AuditLog"
    ADD CONSTRAINT "AuditLog_pkey" PRIMARY KEY (id);


--
-- Name: AutomationExecution AutomationExecution_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AutomationExecution"
    ADD CONSTRAINT "AutomationExecution_pkey" PRIMARY KEY (id);


--
-- Name: BotIdentity BotIdentity_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BotIdentity"
    ADD CONSTRAINT "BotIdentity_pkey" PRIMARY KEY (id);


--
-- Name: ChannelCommand ChannelCommand_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ChannelCommand"
    ADD CONSTRAINT "ChannelCommand_pkey" PRIMARY KEY (id);


--
-- Name: ChannelMember ChannelMember_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ChannelMember"
    ADD CONSTRAINT "ChannelMember_pkey" PRIMARY KEY (id);


--
-- Name: Channel Channel_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Channel"
    ADD CONSTRAINT "Channel_pkey" PRIMARY KEY (id);


--
-- Name: CommandTemplate CommandTemplate_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CommandTemplate"
    ADD CONSTRAINT "CommandTemplate_pkey" PRIMARY KEY (id);


--
-- Name: CustomRole CustomRole_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CustomRole"
    ADD CONSTRAINT "CustomRole_pkey" PRIMARY KEY (id);


--
-- Name: DashboardTemplate DashboardTemplate_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DashboardTemplate"
    ADD CONSTRAINT "DashboardTemplate_pkey" PRIMARY KEY (id);


--
-- Name: DeviceToken DeviceToken_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DeviceToken"
    ADD CONSTRAINT "DeviceToken_pkey" PRIMARY KEY (id);


--
-- Name: EmailTemplate EmailTemplate_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."EmailTemplate"
    ADD CONSTRAINT "EmailTemplate_pkey" PRIMARY KEY (id);


--
-- Name: EntityAutomation EntityAutomation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."EntityAutomation"
    ADD CONSTRAINT "EntityAutomation_pkey" PRIMARY KEY (id);


--
-- Name: EntityDataMasked EntityDataMasked_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."EntityDataMasked"
    ADD CONSTRAINT "EntityDataMasked_pkey" PRIMARY KEY (id);


--
-- Name: EntityData EntityData_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."EntityData"
    ADD CONSTRAINT "EntityData_pkey" PRIMARY KEY (id);


--
-- Name: EntityFieldRule EntityFieldRule_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."EntityFieldRule"
    ADD CONSTRAINT "EntityFieldRule_pkey" PRIMARY KEY (id);


--
-- Name: Entity Entity_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Entity"
    ADD CONSTRAINT "Entity_pkey" PRIMARY KEY (id);


--
-- Name: Invitation Invitation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Invitation"
    ADD CONSTRAINT "Invitation_pkey" PRIMARY KEY (id);


--
-- Name: Message Message_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Message"
    ADD CONSTRAINT "Message_pkey" PRIMARY KEY (id);


--
-- Name: NotificationPreference NotificationPreference_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."NotificationPreference"
    ADD CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY (id);


--
-- Name: Notification Notification_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Notification"
    ADD CONSTRAINT "Notification_pkey" PRIMARY KEY (id);


--
-- Name: PdfGeneration PdfGeneration_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PdfGeneration"
    ADD CONSTRAINT "PdfGeneration_pkey" PRIMARY KEY (id);


--
-- Name: PdfTemplate PdfTemplate_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PdfTemplate"
    ADD CONSTRAINT "PdfTemplate_pkey" PRIMARY KEY (id);


--
-- Name: Plan Plan_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Plan"
    ADD CONSTRAINT "Plan_pkey" PRIMARY KEY (id);


--
-- Name: PlatformAuditLog PlatformAuditLog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PlatformAuditLog"
    ADD CONSTRAINT "PlatformAuditLog_pkey" PRIMARY KEY (id);


--
-- Name: PlatformStaff PlatformStaff_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PlatformStaff"
    ADD CONSTRAINT "PlatformStaff_pkey" PRIMARY KEY (id);


--
-- Name: PublicLink PublicLink_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PublicLink"
    ADD CONSTRAINT "PublicLink_pkey" PRIMARY KEY (id);


--
-- Name: RefreshToken RefreshToken_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RefreshToken"
    ADD CONSTRAINT "RefreshToken_pkey" PRIMARY KEY (id);


--
-- Name: ScheduledTaskExecution ScheduledTaskExecution_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ScheduledTaskExecution"
    ADD CONSTRAINT "ScheduledTaskExecution_pkey" PRIMARY KEY (id);


--
-- Name: ScheduledTask ScheduledTask_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ScheduledTask"
    ADD CONSTRAINT "ScheduledTask_pkey" PRIMARY KEY (id);


--
-- Name: SupportMessage SupportMessage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SupportMessage"
    ADD CONSTRAINT "SupportMessage_pkey" PRIMARY KEY (id);


--
-- Name: SupportTicket SupportTicket_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SupportTicket"
    ADD CONSTRAINT "SupportTicket_pkey" PRIMARY KEY (id);


--
-- Name: TeamAccessKey TeamAccessKey_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TeamAccessKey"
    ADD CONSTRAINT "TeamAccessKey_pkey" PRIMARY KEY (id);


--
-- Name: TeamMember TeamMember_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TeamMember"
    ADD CONSTRAINT "TeamMember_pkey" PRIMARY KEY (id);


--
-- Name: Team Team_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Team"
    ADD CONSTRAINT "Team_pkey" PRIMARY KEY (id);


--
-- Name: TenantLifecycleEvent TenantLifecycleEvent_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TenantLifecycleEvent"
    ADD CONSTRAINT "TenantLifecycleEvent_pkey" PRIMARY KEY (id);


--
-- Name: Tenant Tenant_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Tenant"
    ADD CONSTRAINT "Tenant_pkey" PRIMARY KEY (id);


--
-- Name: UserSession UserSession_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserSession"
    ADD CONSTRAINT "UserSession_pkey" PRIMARY KEY (id);


--
-- Name: UserTenantAccess UserTenantAccess_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserTenantAccess"
    ADD CONSTRAINT "UserTenantAccess_pkey" PRIMARY KEY (id);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: WebhookExecution WebhookExecution_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WebhookExecution"
    ADD CONSTRAINT "WebhookExecution_pkey" PRIMARY KEY (id);


--
-- Name: Webhook Webhook_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Webhook"
    ADD CONSTRAINT "Webhook_pkey" PRIMARY KEY (id);


--
-- Name: visibility_recompute visibility_recompute_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visibility_recompute
    ADD CONSTRAINT visibility_recompute_pkey PRIMARY KEY (id);


--
-- Name: ActionChainExecution_actionChainId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ActionChainExecution_actionChainId_idx" ON public."ActionChainExecution" USING btree ("actionChainId");


--
-- Name: ActionChainExecution_actionChainId_startedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ActionChainExecution_actionChainId_startedAt_idx" ON public."ActionChainExecution" USING btree ("actionChainId", "startedAt" DESC);


--
-- Name: ActionChainExecution_startedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ActionChainExecution_startedAt_idx" ON public."ActionChainExecution" USING btree ("startedAt");


--
-- Name: ActionChainExecution_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ActionChainExecution_status_idx" ON public."ActionChainExecution" USING btree (status);


--
-- Name: ActionChainExecution_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ActionChainExecution_tenantId_idx" ON public."ActionChainExecution" USING btree ("tenantId");


--
-- Name: ActionChainExecution_tenantId_startedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ActionChainExecution_tenantId_startedAt_idx" ON public."ActionChainExecution" USING btree ("tenantId", "startedAt" DESC);


--
-- Name: ActionChain_entityId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ActionChain_entityId_idx" ON public."ActionChain" USING btree ("entityId");


--
-- Name: ActionChain_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ActionChain_isActive_idx" ON public."ActionChain" USING btree ("isActive");


--
-- Name: ActionChain_tenantId_entityId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ActionChain_tenantId_entityId_idx" ON public."ActionChain" USING btree ("tenantId", "entityId");


--
-- Name: ActionChain_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ActionChain_tenantId_idx" ON public."ActionChain" USING btree ("tenantId");


--
-- Name: ActionChain_tenantId_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ActionChain_tenantId_isActive_idx" ON public."ActionChain" USING btree ("tenantId", "isActive");


--
-- Name: ActionChain_trigger_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ActionChain_trigger_idx" ON public."ActionChain" USING btree (trigger);


--
-- Name: AnnouncementDismissal_announcementId_userId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "AnnouncementDismissal_announcementId_userId_key" ON public."AnnouncementDismissal" USING btree ("announcementId", "userId");


--
-- Name: AnnouncementDismissal_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AnnouncementDismissal_userId_idx" ON public."AnnouncementDismissal" USING btree ("userId");


--
-- Name: Announcement_publishedAt_startsAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Announcement_publishedAt_startsAt_idx" ON public."Announcement" USING btree ("publishedAt", "startsAt");


--
-- Name: ApiExecutionLog_actionChainId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ApiExecutionLog_actionChainId_idx" ON public."ApiExecutionLog" USING btree ("actionChainId");


--
-- Name: ApiExecutionLog_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ApiExecutionLog_createdAt_idx" ON public."ApiExecutionLog" USING btree ("createdAt");


--
-- Name: ApiExecutionLog_customApiId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ApiExecutionLog_customApiId_createdAt_idx" ON public."ApiExecutionLog" USING btree ("customApiId", "createdAt" DESC);


--
-- Name: ApiExecutionLog_customApiId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ApiExecutionLog_customApiId_idx" ON public."ApiExecutionLog" USING btree ("customApiId");


--
-- Name: ApiExecutionLog_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ApiExecutionLog_status_idx" ON public."ApiExecutionLog" USING btree (status);


--
-- Name: ApiExecutionLog_tenantId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ApiExecutionLog_tenantId_createdAt_idx" ON public."ApiExecutionLog" USING btree ("tenantId", "createdAt" DESC);


--
-- Name: ApiExecutionLog_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ApiExecutionLog_tenantId_idx" ON public."ApiExecutionLog" USING btree ("tenantId");


--
-- Name: ApiExecutionLog_tenantId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ApiExecutionLog_tenantId_status_idx" ON public."ApiExecutionLog" USING btree ("tenantId", status);


--
-- Name: ApiExecutionLog_webhookId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ApiExecutionLog_webhookId_idx" ON public."ApiExecutionLog" USING btree ("webhookId");


--
-- Name: ApiKey_keyHash_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ApiKey_keyHash_key" ON public."ApiKey" USING btree ("keyHash");


--
-- Name: ApiKey_serviceUserId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ApiKey_serviceUserId_key" ON public."ApiKey" USING btree ("serviceUserId");


--
-- Name: ApiKey_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ApiKey_tenantId_idx" ON public."ApiKey" USING btree ("tenantId");


--
-- Name: ArchivedAuditLog_archivedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ArchivedAuditLog_archivedAt_idx" ON public."ArchivedAuditLog" USING btree ("archivedAt");


--
-- Name: ArchivedAuditLog_tenantId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ArchivedAuditLog_tenantId_createdAt_idx" ON public."ArchivedAuditLog" USING btree ("tenantId", "createdAt" DESC);


--
-- Name: ArchivedAuditLog_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ArchivedAuditLog_tenantId_idx" ON public."ArchivedAuditLog" USING btree ("tenantId");


--
-- Name: ArchivedEntityData_archivedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ArchivedEntityData_archivedAt_idx" ON public."ArchivedEntityData" USING btree ("archivedAt");


--
-- Name: ArchivedEntityData_computedValues_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ArchivedEntityData_computedValues_idx" ON public."ArchivedEntityData" USING gin ("computedValues");


--
-- Name: ArchivedEntityData_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ArchivedEntityData_createdAt_idx" ON public."ArchivedEntityData" USING btree ("createdAt");


--
-- Name: ArchivedEntityData_entityId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ArchivedEntityData_entityId_idx" ON public."ArchivedEntityData" USING btree ("entityId");


--
-- Name: ArchivedEntityData_tenantId_entityId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ArchivedEntityData_tenantId_entityId_createdAt_idx" ON public."ArchivedEntityData" USING btree ("tenantId", "entityId", "createdAt" DESC);


--
-- Name: ArchivedEntityData_tenantId_entityId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ArchivedEntityData_tenantId_entityId_idx" ON public."ArchivedEntityData" USING btree ("tenantId", "entityId");


--
-- Name: ArchivedEntityData_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ArchivedEntityData_tenantId_idx" ON public."ArchivedEntityData" USING btree ("tenantId");


--
-- Name: AuditLog_action_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AuditLog_action_idx" ON public."AuditLog" USING btree (action);


--
-- Name: AuditLog_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AuditLog_createdAt_idx" ON public."AuditLog" USING btree ("createdAt");


--
-- Name: AuditLog_resource_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AuditLog_resource_idx" ON public."AuditLog" USING btree (resource);


--
-- Name: AuditLog_resource_resourceId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AuditLog_resource_resourceId_idx" ON public."AuditLog" USING btree (resource, "resourceId");


--
-- Name: AuditLog_tenantId_action_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AuditLog_tenantId_action_idx" ON public."AuditLog" USING btree ("tenantId", action);


--
-- Name: AuditLog_tenantId_action_resource_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AuditLog_tenantId_action_resource_idx" ON public."AuditLog" USING btree ("tenantId", action, resource);


--
-- Name: AuditLog_tenantId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AuditLog_tenantId_createdAt_idx" ON public."AuditLog" USING btree ("tenantId", "createdAt" DESC);


--
-- Name: AuditLog_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AuditLog_tenantId_idx" ON public."AuditLog" USING btree ("tenantId");


--
-- Name: AuditLog_tenantId_resource_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AuditLog_tenantId_resource_idx" ON public."AuditLog" USING btree ("tenantId", resource);


--
-- Name: AuditLog_tenantId_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AuditLog_tenantId_userId_idx" ON public."AuditLog" USING btree ("tenantId", "userId");


--
-- Name: AuditLog_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AuditLog_userId_idx" ON public."AuditLog" USING btree ("userId");


--
-- Name: AutomationExecution_automationId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AutomationExecution_automationId_idx" ON public."AutomationExecution" USING btree ("automationId");


--
-- Name: AutomationExecution_automationId_startedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AutomationExecution_automationId_startedAt_idx" ON public."AutomationExecution" USING btree ("automationId", "startedAt" DESC);


--
-- Name: AutomationExecution_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AutomationExecution_status_idx" ON public."AutomationExecution" USING btree (status);


--
-- Name: AutomationExecution_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AutomationExecution_tenantId_idx" ON public."AutomationExecution" USING btree ("tenantId");


--
-- Name: AutomationExecution_tenantId_startedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AutomationExecution_tenantId_startedAt_idx" ON public."AutomationExecution" USING btree ("tenantId", "startedAt" DESC);


--
-- Name: BotIdentity_tenantId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "BotIdentity_tenantId_key" ON public."BotIdentity" USING btree ("tenantId");


--
-- Name: ChannelCommand_channelId_commandTemplateId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ChannelCommand_channelId_commandTemplateId_key" ON public."ChannelCommand" USING btree ("channelId", "commandTemplateId");


--
-- Name: ChannelCommand_channelId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ChannelCommand_channelId_idx" ON public."ChannelCommand" USING btree ("channelId");


--
-- Name: ChannelCommand_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ChannelCommand_tenantId_idx" ON public."ChannelCommand" USING btree ("tenantId");


--
-- Name: ChannelMember_channelId_userId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ChannelMember_channelId_userId_key" ON public."ChannelMember" USING btree ("channelId", "userId");


--
-- Name: ChannelMember_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ChannelMember_userId_idx" ON public."ChannelMember" USING btree ("userId");


--
-- Name: Channel_dm_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Channel_dm_unique" ON public."Channel" USING btree ("tenantId", "dmKey") WHERE ((type = 'dm'::text) AND ("dmKey" IS NOT NULL) AND ("deletedAt" IS NULL));


--
-- Name: Channel_group_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Channel_group_unique" ON public."Channel" USING btree ("tenantId", "entityId") WHERE (("recordId" IS NULL) AND (type = 'group'::text) AND ("deletedAt" IS NULL));


--
-- Name: Channel_record_owner_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Channel_record_owner_idx" ON public."Channel" USING btree ("_recordCreatedById") WHERE ((type = 'record'::text) AND ("deletedAt" IS NULL));


--
-- Name: Channel_record_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Channel_record_unique" ON public."Channel" USING btree ("tenantId", "recordId") WHERE (("recordId" IS NOT NULL) AND ("deletedAt" IS NULL));


--
-- Name: Channel_tenantId_entityId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Channel_tenantId_entityId_idx" ON public."Channel" USING btree ("tenantId", "entityId");


--
-- Name: Channel_tenantId_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Channel_tenantId_type_idx" ON public."Channel" USING btree ("tenantId", type);


--
-- Name: Channel_tenant_type_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Channel_tenant_type_active_idx" ON public."Channel" USING btree ("tenantId", type) WHERE ("deletedAt" IS NULL);


--
-- Name: CommandTemplate_tenantId_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CommandTemplate_tenantId_isActive_idx" ON public."CommandTemplate" USING btree ("tenantId", "isActive");


--
-- Name: CommandTemplate_tenantId_slug_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "CommandTemplate_tenantId_slug_key" ON public."CommandTemplate" USING btree ("tenantId", slug);


--
-- Name: CustomRole_isSystem_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CustomRole_isSystem_idx" ON public."CustomRole" USING btree ("isSystem");


--
-- Name: CustomRole_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CustomRole_tenantId_idx" ON public."CustomRole" USING btree ("tenantId");


--
-- Name: CustomRole_tenantId_isDefault_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CustomRole_tenantId_isDefault_idx" ON public."CustomRole" USING btree ("tenantId", "isDefault");


--
-- Name: DashboardTemplate_tenantId_entitySlug_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DashboardTemplate_tenantId_entitySlug_idx" ON public."DashboardTemplate" USING btree ("tenantId", "entitySlug");


--
-- Name: DashboardTemplate_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DashboardTemplate_tenantId_idx" ON public."DashboardTemplate" USING btree ("tenantId");


--
-- Name: DashboardTemplate_tenantId_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "DashboardTemplate_tenantId_name_key" ON public."DashboardTemplate" USING btree ("tenantId", name);


--
-- Name: DeviceToken_token_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "DeviceToken_token_key" ON public."DeviceToken" USING btree (token);


--
-- Name: DeviceToken_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DeviceToken_userId_idx" ON public."DeviceToken" USING btree ("userId");


--
-- Name: EmailTemplate_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "EmailTemplate_isActive_idx" ON public."EmailTemplate" USING btree ("isActive");


--
-- Name: EmailTemplate_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "EmailTemplate_tenantId_idx" ON public."EmailTemplate" USING btree ("tenantId");


--
-- Name: EmailTemplate_tenantId_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "EmailTemplate_tenantId_isActive_idx" ON public."EmailTemplate" USING btree ("tenantId", "isActive");


--
-- Name: EmailTemplate_tenantId_slug_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "EmailTemplate_tenantId_slug_key" ON public."EmailTemplate" USING btree ("tenantId", slug);


--
-- Name: EntityAutomation_entityId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "EntityAutomation_entityId_idx" ON public."EntityAutomation" USING btree ("entityId");


--
-- Name: EntityAutomation_nextRunAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "EntityAutomation_nextRunAt_idx" ON public."EntityAutomation" USING btree ("nextRunAt");


--
-- Name: EntityAutomation_tenantId_entityId_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "EntityAutomation_tenantId_entityId_isActive_idx" ON public."EntityAutomation" USING btree ("tenantId", "entityId", "isActive");


--
-- Name: EntityAutomation_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "EntityAutomation_tenantId_idx" ON public."EntityAutomation" USING btree ("tenantId");


--
-- Name: EntityAutomation_trigger_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "EntityAutomation_trigger_isActive_idx" ON public."EntityAutomation" USING btree (trigger, "isActive");


--
-- Name: EntityDataMasked_recordId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "EntityDataMasked_recordId_idx" ON public."EntityDataMasked" USING btree ("recordId");


--
-- Name: EntityDataMasked_tenantId_roleId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "EntityDataMasked_tenantId_roleId_idx" ON public."EntityDataMasked" USING btree ("tenantId", "roleId");


--
-- Name: EntityData_computedValues_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "EntityData_computedValues_idx" ON public."EntityData" USING gin ("computedValues");


--
-- Name: EntityData_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "EntityData_createdAt_idx" ON public."EntityData" USING btree ("createdAt");


--
-- Name: EntityData_createdById_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "EntityData_createdById_idx" ON public."EntityData" USING btree ("createdById");


--
-- Name: EntityData_deletedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "EntityData_deletedAt_idx" ON public."EntityData" USING btree ("deletedAt");


--
-- Name: EntityData_entityId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "EntityData_entityId_createdAt_idx" ON public."EntityData" USING btree ("entityId", "createdAt" DESC);


--
-- Name: EntityData_entityId_createdById_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "EntityData_entityId_createdById_idx" ON public."EntityData" USING btree ("entityId", "createdById");


--
-- Name: EntityData_entityId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "EntityData_entityId_idx" ON public."EntityData" USING btree ("entityId");


--
-- Name: EntityData_entityId_parentRecordId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "EntityData_entityId_parentRecordId_idx" ON public."EntityData" USING btree ("entityId", "parentRecordId");


--
-- Name: EntityData_parentRecordId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "EntityData_parentRecordId_idx" ON public."EntityData" USING btree ("parentRecordId");


--
-- Name: EntityData_tenantId_entityId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "EntityData_tenantId_entityId_createdAt_idx" ON public."EntityData" USING btree ("tenantId", "entityId", "createdAt" DESC);


--
-- Name: EntityData_tenantId_entityId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "EntityData_tenantId_entityId_idx" ON public."EntityData" USING btree ("tenantId", "entityId");


--
-- Name: EntityData_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "EntityData_tenantId_idx" ON public."EntityData" USING btree ("tenantId");


--
-- Name: EntityData_updatedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "EntityData_updatedAt_idx" ON public."EntityData" USING btree ("updatedAt");


--
-- Name: EntityData_updatedById_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "EntityData_updatedById_idx" ON public."EntityData" USING btree ("updatedById");


--
-- Name: EntityFieldRule_entityId_fieldSlug_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "EntityFieldRule_entityId_fieldSlug_idx" ON public."EntityFieldRule" USING btree ("entityId", "fieldSlug");


--
-- Name: EntityFieldRule_tenantId_entityId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "EntityFieldRule_tenantId_entityId_idx" ON public."EntityFieldRule" USING btree ("tenantId", "entityId");


--
-- Name: Entity_tenantId_category_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Entity_tenantId_category_idx" ON public."Entity" USING btree ("tenantId", category);


--
-- Name: Entity_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Entity_tenantId_idx" ON public."Entity" USING btree ("tenantId");


--
-- Name: Entity_tenantId_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Entity_tenantId_name_idx" ON public."Entity" USING btree ("tenantId", name);


--
-- Name: Entity_tenantId_slug_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Entity_tenantId_slug_key" ON public."Entity" USING btree ("tenantId", slug);


--
-- Name: Invitation_tenantId_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Invitation_tenantId_email_idx" ON public."Invitation" USING btree ("tenantId", email);


--
-- Name: Invitation_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Invitation_tenantId_idx" ON public."Invitation" USING btree ("tenantId");


--
-- Name: Invitation_tokenHash_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Invitation_tokenHash_key" ON public."Invitation" USING btree ("tokenHash");


--
-- Name: Message_channelId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Message_channelId_createdAt_idx" ON public."Message" USING btree ("channelId", "createdAt");


--
-- Name: Message_recipientId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Message_recipientId_idx" ON public."Message" USING btree ("recipientId");


--
-- Name: NotificationPreference_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "NotificationPreference_tenantId_idx" ON public."NotificationPreference" USING btree ("tenantId");


--
-- Name: NotificationPreference_userId_tenantId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "NotificationPreference_userId_tenantId_key" ON public."NotificationPreference" USING btree ("userId", "tenantId");


--
-- Name: Notification_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Notification_createdAt_idx" ON public."Notification" USING btree ("createdAt");


--
-- Name: Notification_entitySlug_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Notification_entitySlug_idx" ON public."Notification" USING btree ("entitySlug");


--
-- Name: Notification_read_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Notification_read_idx" ON public."Notification" USING btree (read);


--
-- Name: Notification_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Notification_tenantId_idx" ON public."Notification" USING btree ("tenantId");


--
-- Name: Notification_tenantId_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Notification_tenantId_userId_idx" ON public."Notification" USING btree ("tenantId", "userId");


--
-- Name: Notification_userId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Notification_userId_createdAt_idx" ON public."Notification" USING btree ("userId", "createdAt" DESC);


--
-- Name: Notification_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Notification_userId_idx" ON public."Notification" USING btree ("userId");


--
-- Name: Notification_userId_read_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Notification_userId_read_idx" ON public."Notification" USING btree ("userId", read);


--
-- Name: PdfGeneration_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PdfGeneration_createdAt_idx" ON public."PdfGeneration" USING btree ("createdAt");


--
-- Name: PdfGeneration_requestedById_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PdfGeneration_requestedById_idx" ON public."PdfGeneration" USING btree ("requestedById");


--
-- Name: PdfGeneration_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PdfGeneration_status_idx" ON public."PdfGeneration" USING btree (status);


--
-- Name: PdfGeneration_templateId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PdfGeneration_templateId_idx" ON public."PdfGeneration" USING btree ("templateId");


--
-- Name: PdfGeneration_tenantId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PdfGeneration_tenantId_createdAt_idx" ON public."PdfGeneration" USING btree ("tenantId", "createdAt" DESC);


--
-- Name: PdfGeneration_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PdfGeneration_tenantId_idx" ON public."PdfGeneration" USING btree ("tenantId");


--
-- Name: PdfGeneration_tenantId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PdfGeneration_tenantId_status_idx" ON public."PdfGeneration" USING btree ("tenantId", status);


--
-- Name: PdfTemplate_isPublished_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PdfTemplate_isPublished_idx" ON public."PdfTemplate" USING btree ("isPublished");


--
-- Name: PdfTemplate_sourceEntityId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PdfTemplate_sourceEntityId_idx" ON public."PdfTemplate" USING btree ("sourceEntityId");


--
-- Name: PdfTemplate_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PdfTemplate_tenantId_idx" ON public."PdfTemplate" USING btree ("tenantId");


--
-- Name: PdfTemplate_tenantId_isPublished_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PdfTemplate_tenantId_isPublished_idx" ON public."PdfTemplate" USING btree ("tenantId", "isPublished");


--
-- Name: PdfTemplate_tenantId_slug_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "PdfTemplate_tenantId_slug_key" ON public."PdfTemplate" USING btree ("tenantId", slug);


--
-- Name: Plan_isDefault_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Plan_isDefault_idx" ON public."Plan" USING btree ("isDefault");


--
-- Name: Plan_slug_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Plan_slug_key" ON public."Plan" USING btree (slug);


--
-- Name: PlatformAuditLog_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PlatformAuditLog_createdAt_idx" ON public."PlatformAuditLog" USING btree ("createdAt" DESC);


--
-- Name: PlatformAuditLog_staffId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PlatformAuditLog_staffId_idx" ON public."PlatformAuditLog" USING btree ("staffId");


--
-- Name: PlatformAuditLog_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PlatformAuditLog_tenantId_idx" ON public."PlatformAuditLog" USING btree ("tenantId");


--
-- Name: PlatformStaff_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "PlatformStaff_email_key" ON public."PlatformStaff" USING btree (email);


--
-- Name: PublicLink_slug_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "PublicLink_slug_key" ON public."PublicLink" USING btree (slug);


--
-- Name: PublicLink_tenantId_entitySlug_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PublicLink_tenantId_entitySlug_idx" ON public."PublicLink" USING btree ("tenantId", "entitySlug");


--
-- Name: PublicLink_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PublicLink_tenantId_idx" ON public."PublicLink" USING btree ("tenantId");


--
-- Name: RefreshToken_sessionId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "RefreshToken_sessionId_idx" ON public."RefreshToken" USING btree ("sessionId");


--
-- Name: RefreshToken_token_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "RefreshToken_token_idx" ON public."RefreshToken" USING btree (token);


--
-- Name: RefreshToken_token_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "RefreshToken_token_key" ON public."RefreshToken" USING btree (token);


--
-- Name: RefreshToken_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "RefreshToken_userId_idx" ON public."RefreshToken" USING btree ("userId");


--
-- Name: ScheduledTaskExecution_scheduledTaskId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ScheduledTaskExecution_scheduledTaskId_idx" ON public."ScheduledTaskExecution" USING btree ("scheduledTaskId");


--
-- Name: ScheduledTaskExecution_scheduledTaskId_startedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ScheduledTaskExecution_scheduledTaskId_startedAt_idx" ON public."ScheduledTaskExecution" USING btree ("scheduledTaskId", "startedAt" DESC);


--
-- Name: ScheduledTaskExecution_startedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ScheduledTaskExecution_startedAt_idx" ON public."ScheduledTaskExecution" USING btree ("startedAt");


--
-- Name: ScheduledTaskExecution_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ScheduledTaskExecution_status_idx" ON public."ScheduledTaskExecution" USING btree (status);


--
-- Name: ScheduledTaskExecution_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ScheduledTaskExecution_tenantId_idx" ON public."ScheduledTaskExecution" USING btree ("tenantId");


--
-- Name: ScheduledTask_entityId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ScheduledTask_entityId_idx" ON public."ScheduledTask" USING btree ("entityId");


--
-- Name: ScheduledTask_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ScheduledTask_isActive_idx" ON public."ScheduledTask" USING btree ("isActive");


--
-- Name: ScheduledTask_nextRunAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ScheduledTask_nextRunAt_idx" ON public."ScheduledTask" USING btree ("nextRunAt");


--
-- Name: ScheduledTask_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ScheduledTask_tenantId_idx" ON public."ScheduledTask" USING btree ("tenantId");


--
-- Name: ScheduledTask_tenantId_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ScheduledTask_tenantId_isActive_idx" ON public."ScheduledTask" USING btree ("tenantId", "isActive");


--
-- Name: SupportMessage_ticketId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SupportMessage_ticketId_createdAt_idx" ON public."SupportMessage" USING btree ("ticketId", "createdAt");


--
-- Name: SupportTicket_assignedStaffId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SupportTicket_assignedStaffId_idx" ON public."SupportTicket" USING btree ("assignedStaffId");


--
-- Name: SupportTicket_number_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "SupportTicket_number_key" ON public."SupportTicket" USING btree (number);


--
-- Name: SupportTicket_status_lastMessageAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SupportTicket_status_lastMessageAt_idx" ON public."SupportTicket" USING btree (status, "lastMessageAt");


--
-- Name: SupportTicket_tenantId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SupportTicket_tenantId_status_idx" ON public."SupportTicket" USING btree ("tenantId", status);


--
-- Name: TeamAccessKey_userId_key_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "TeamAccessKey_userId_key_key" ON public."TeamAccessKey" USING btree ("userId", key);


--
-- Name: TeamAccessKey_userId_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TeamAccessKey_userId_tenantId_idx" ON public."TeamAccessKey" USING btree ("userId", "tenantId");


--
-- Name: TeamMember_teamId_userId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "TeamMember_teamId_userId_key" ON public."TeamMember" USING btree ("teamId", "userId");


--
-- Name: TeamMember_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TeamMember_userId_idx" ON public."TeamMember" USING btree ("userId");


--
-- Name: Team_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Team_tenantId_idx" ON public."Team" USING btree ("tenantId");


--
-- Name: Team_tenantId_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Team_tenantId_name_key" ON public."Team" USING btree ("tenantId", name);


--
-- Name: TenantLifecycleEvent_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TenantLifecycleEvent_createdAt_idx" ON public."TenantLifecycleEvent" USING btree ("createdAt");


--
-- Name: TenantLifecycleEvent_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TenantLifecycleEvent_tenantId_idx" ON public."TenantLifecycleEvent" USING btree ("tenantId");


--
-- Name: Tenant_domain_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Tenant_domain_key" ON public."Tenant" USING btree (domain);


--
-- Name: Tenant_lifecycle_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Tenant_lifecycle_idx" ON public."Tenant" USING btree (lifecycle);


--
-- Name: Tenant_ownerId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Tenant_ownerId_idx" ON public."Tenant" USING btree ("ownerId");


--
-- Name: Tenant_planId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Tenant_planId_idx" ON public."Tenant" USING btree ("planId");


--
-- Name: Tenant_slug_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Tenant_slug_idx" ON public."Tenant" USING btree (slug);


--
-- Name: Tenant_slug_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Tenant_slug_key" ON public."Tenant" USING btree (slug);


--
-- Name: Tenant_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Tenant_status_idx" ON public."Tenant" USING btree (status);


--
-- Name: UserSession_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "UserSession_userId_idx" ON public."UserSession" USING btree ("userId");


--
-- Name: UserTenantAccess_customRoleId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "UserTenantAccess_customRoleId_idx" ON public."UserTenantAccess" USING btree ("customRoleId");


--
-- Name: UserTenantAccess_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "UserTenantAccess_tenantId_idx" ON public."UserTenantAccess" USING btree ("tenantId");


--
-- Name: UserTenantAccess_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "UserTenantAccess_userId_idx" ON public."UserTenantAccess" USING btree ("userId");


--
-- Name: UserTenantAccess_userId_tenantId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "UserTenantAccess_userId_tenantId_key" ON public."UserTenantAccess" USING btree ("userId", "tenantId");


--
-- Name: User_cpf_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "User_cpf_idx" ON public."User" USING btree (cpf);


--
-- Name: User_cpf_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "User_cpf_key" ON public."User" USING btree (cpf);


--
-- Name: User_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "User_email_idx" ON public."User" USING btree (email);


--
-- Name: User_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);


--
-- Name: User_phone_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "User_phone_idx" ON public."User" USING btree (phone);


--
-- Name: User_phone_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "User_phone_key" ON public."User" USING btree (phone);


--
-- Name: User_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "User_status_idx" ON public."User" USING btree (status);


--
-- Name: WebhookExecution_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WebhookExecution_createdAt_idx" ON public."WebhookExecution" USING btree ("createdAt");


--
-- Name: WebhookExecution_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WebhookExecution_status_idx" ON public."WebhookExecution" USING btree (status);


--
-- Name: WebhookExecution_tenantId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WebhookExecution_tenantId_createdAt_idx" ON public."WebhookExecution" USING btree ("tenantId", "createdAt" DESC);


--
-- Name: WebhookExecution_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WebhookExecution_tenantId_idx" ON public."WebhookExecution" USING btree ("tenantId");


--
-- Name: WebhookExecution_webhookId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WebhookExecution_webhookId_createdAt_idx" ON public."WebhookExecution" USING btree ("webhookId", "createdAt" DESC);


--
-- Name: WebhookExecution_webhookId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WebhookExecution_webhookId_idx" ON public."WebhookExecution" USING btree ("webhookId");


--
-- Name: Webhook_entityId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Webhook_entityId_idx" ON public."Webhook" USING btree ("entityId");


--
-- Name: Webhook_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Webhook_status_idx" ON public."Webhook" USING btree (status);


--
-- Name: Webhook_tenantId_entityId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Webhook_tenantId_entityId_idx" ON public."Webhook" USING btree ("tenantId", "entityId");


--
-- Name: Webhook_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Webhook_tenantId_idx" ON public."Webhook" USING btree ("tenantId");


--
-- Name: Webhook_tenantId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Webhook_tenantId_status_idx" ON public."Webhook" USING btree ("tenantId", status);


--
-- Name: idx_entity_data_global_filter; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_entity_data_global_filter ON public."EntityData" USING btree ("tenantId", "_matchesGlobalFilter") WHERE ("deletedAt" IS NULL);


--
-- Name: idx_entity_data_has_role_filter; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_entity_data_has_role_filter ON public."EntityData" USING btree ("tenantId", "_hasRoleFilter") WHERE ("deletedAt" IS NULL);


--
-- Name: idx_entity_data_parent_filter; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_entity_data_parent_filter ON public."EntityData" USING btree ("tenantId", "_matchesGlobalFilter", "_parentMatchesFilter") WHERE ("deletedAt" IS NULL);


--
-- Name: idx_entity_data_visible_roles; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_entity_data_visible_roles ON public."EntityData" USING gin ("_visibleToRoles") WHERE ("deletedAt" IS NULL);


--
-- Name: idx_entity_data_visible_roles_json; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_entity_data_visible_roles_json ON public."EntityData" USING gin ("_visibleToRolesJson") WHERE (("deletedAt" IS NULL) AND ("_hasRoleFilter" = true));


--
-- Name: message_content_trgm_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX message_content_trgm_idx ON public."Message" USING gin (public.f_unaccent(content) public.gin_trgm_ops);


--
-- Name: uq_ed_159fdaa4cbf838697687c6a4; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_ed_159fdaa4cbf838697687c6a4 ON public."EntityData" USING btree (((data ->> 'email'::text))) WHERE (("deletedAt" IS NULL) AND ("entityId" = 'cmw2s4pf607o311j1dtgq4g8q'::text));


--
-- Name: uq_ed_3a1e9153c7d9cf09e9548b7e; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_ed_3a1e9153c7d9cf09e9548b7e ON public."EntityData" USING btree (((data ->> 'email'::text))) WHERE (("deletedAt" IS NULL) AND ("entityId" = 'cmw2qvpj7066811j1o7zufud7'::text));


--
-- Name: uq_ed_530f5d03304acfbcbe22ce44; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_ed_530f5d03304acfbcbe22ce44 ON public."EntityData" USING btree (((data ->> 'email'::text))) WHERE (("deletedAt" IS NULL) AND ("entityId" = 'cmw2udie100cls26gdz2euztq'::text));


--
-- Name: uq_ed_8dca4672265772ce4117f6d9; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_ed_8dca4672265772ce4117f6d9 ON public."EntityData" USING btree (((data ->> 'email'::text))) WHERE (("deletedAt" IS NULL) AND ("entityId" = 'cmw2nutb4011b11j1uar10zcc'::text));


--
-- Name: uq_ed_aaa5b8ab0a555e4b9addfd11; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_ed_aaa5b8ab0a555e4b9addfd11 ON public."EntityData" USING btree (((data ->> 'email'::text))) WHERE (("deletedAt" IS NULL) AND ("entityId" = 'cmw2qp6of05zw11j1s33g8fww'::text));


--
-- Name: uq_ed_e61060a47f3a89edd03e5df3; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_ed_e61060a47f3a89edd03e5df3 ON public."EntityData" USING btree (((data ->> 'email'::text))) WHERE (("deletedAt" IS NULL) AND ("entityId" = 'cmw2qrkh4062s11j14sp02v5k'::text));


--
-- Name: Channel trg_channel_calc_visible_roles; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_channel_calc_visible_roles BEFORE INSERT OR UPDATE ON public."Channel" FOR EACH ROW EXECUTE FUNCTION public.trg_channel_calc_visible_roles();


--
-- Name: Channel trg_channel_sync_message_team_keys; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_channel_sync_message_team_keys AFTER UPDATE ON public."Channel" FOR EACH ROW WHEN ((old."_visibleTeamKeysJson" IS DISTINCT FROM new."_visibleTeamKeysJson")) EXECUTE FUNCTION public.trg_channel_sync_message_team_keys();


--
-- Name: CommandTemplate trg_command_template_visible_roles; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_command_template_visible_roles BEFORE INSERT OR UPDATE ON public."CommandTemplate" FOR EACH ROW EXECUTE FUNCTION public.trg_command_template_visible_roles();


--
-- Name: CustomRole trg_custom_role_masked; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_custom_role_masked AFTER INSERT OR DELETE OR UPDATE ON public."CustomRole" FOR EACH ROW EXECUTE FUNCTION public.trg_custom_role_masked();


--
-- Name: EntityData trg_entity_data_calc_visible_roles; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_entity_data_calc_visible_roles BEFORE INSERT OR UPDATE ON public."EntityData" FOR EACH ROW EXECUTE FUNCTION public.trg_entity_data_calc_visible_roles();


--
-- Name: EntityData trg_entity_data_global_filter; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_entity_data_global_filter BEFORE INSERT OR UPDATE OF data, "entityId" ON public."EntityData" FOR EACH ROW EXECUTE FUNCTION public.trg_entity_data_check_global_filter();


--
-- Name: EntityData trg_entity_data_masked; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_entity_data_masked AFTER INSERT OR DELETE OR UPDATE ON public."EntityData" FOR EACH ROW EXECUTE FUNCTION public.trg_entity_data_masked();


--
-- Name: EntityData trg_entity_data_propagate_visible_roles; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_entity_data_propagate_visible_roles AFTER UPDATE ON public."EntityData" FOR EACH ROW EXECUTE FUNCTION public.trg_entity_data_propagate_visible_roles();


--
-- Name: EntityData trg_entity_data_sync_record_channel; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_entity_data_sync_record_channel AFTER UPDATE ON public."EntityData" FOR EACH ROW WHEN (((old."_visibleTeamKeysJson" IS DISTINCT FROM new."_visibleTeamKeysJson") OR (old."_visibleToRoles" IS DISTINCT FROM new."_visibleToRoles") OR (old."_visibleToRolesOwnJson" IS DISTINCT FROM new."_visibleToRolesOwnJson") OR (old."createdById" IS DISTINCT FROM new."createdById"))) EXECUTE FUNCTION public.trg_entity_data_sync_record_channel();


--
-- Name: Entity trg_entity_settings_global_filter; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_entity_settings_global_filter AFTER UPDATE OF settings ON public."Entity" FOR EACH ROW EXECUTE FUNCTION public.trg_entity_settings_update_global_filter();


--
-- Name: UserTenantAccess trg_membership_team_keys; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_membership_team_keys AFTER INSERT OR DELETE OR UPDATE OF "customRoleId", status, "deletedAt" ON public."UserTenantAccess" FOR EACH ROW EXECUTE FUNCTION public.trg_membership_team_keys();


--
-- Name: Message trg_message_team_keys; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_message_team_keys BEFORE INSERT ON public."Message" FOR EACH ROW EXECUTE FUNCTION public.trg_message_team_keys();


--
-- Name: EntityData trg_propagate_filter_to_children; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_propagate_filter_to_children AFTER UPDATE OF "_matchesGlobalFilter", "_parentMatchesFilter" ON public."EntityData" FOR EACH ROW EXECUTE FUNCTION public.propagate_filter_to_children();


--
-- Name: TeamMember trg_team_member_changed; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_team_member_changed AFTER INSERT OR DELETE ON public."TeamMember" FOR EACH ROW EXECUTE FUNCTION public.trg_team_member_changed();


--
-- Name: ActionChainExecution ActionChainExecution_actionChainId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ActionChainExecution"
    ADD CONSTRAINT "ActionChainExecution_actionChainId_fkey" FOREIGN KEY ("actionChainId") REFERENCES public."ActionChain"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ActionChain ActionChain_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ActionChain"
    ADD CONSTRAINT "ActionChain_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AnnouncementDismissal AnnouncementDismissal_announcementId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnnouncementDismissal"
    ADD CONSTRAINT "AnnouncementDismissal_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES public."Announcement"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AnnouncementDismissal AnnouncementDismissal_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnnouncementDismissal"
    ADD CONSTRAINT "AnnouncementDismissal_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ApiKey ApiKey_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ApiKey"
    ADD CONSTRAINT "ApiKey_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ApiKey ApiKey_customRoleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ApiKey"
    ADD CONSTRAINT "ApiKey_customRoleId_fkey" FOREIGN KEY ("customRoleId") REFERENCES public."CustomRole"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ApiKey ApiKey_serviceUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ApiKey"
    ADD CONSTRAINT "ApiKey_serviceUserId_fkey" FOREIGN KEY ("serviceUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ApiKey ApiKey_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ApiKey"
    ADD CONSTRAINT "ApiKey_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ArchivedEntityData ArchivedEntityData_entityId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ArchivedEntityData"
    ADD CONSTRAINT "ArchivedEntityData_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES public."Entity"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ArchivedEntityData ArchivedEntityData_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ArchivedEntityData"
    ADD CONSTRAINT "ArchivedEntityData_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AutomationExecution AutomationExecution_automationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AutomationExecution"
    ADD CONSTRAINT "AutomationExecution_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES public."EntityAutomation"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AutomationExecution AutomationExecution_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AutomationExecution"
    ADD CONSTRAINT "AutomationExecution_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ChannelMember ChannelMember_channelId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ChannelMember"
    ADD CONSTRAINT "ChannelMember_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES public."Channel"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CustomRole CustomRole_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CustomRole"
    ADD CONSTRAINT "CustomRole_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: DashboardTemplate DashboardTemplate_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DashboardTemplate"
    ADD CONSTRAINT "DashboardTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: DeviceToken DeviceToken_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DeviceToken"
    ADD CONSTRAINT "DeviceToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: EmailTemplate EmailTemplate_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."EmailTemplate"
    ADD CONSTRAINT "EmailTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: EntityAutomation EntityAutomation_entityId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."EntityAutomation"
    ADD CONSTRAINT "EntityAutomation_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES public."Entity"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: EntityAutomation EntityAutomation_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."EntityAutomation"
    ADD CONSTRAINT "EntityAutomation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: EntityData EntityData_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."EntityData"
    ADD CONSTRAINT "EntityData_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: EntityData EntityData_entityId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."EntityData"
    ADD CONSTRAINT "EntityData_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES public."Entity"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: EntityData EntityData_parentRecordId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."EntityData"
    ADD CONSTRAINT "EntityData_parentRecordId_fkey" FOREIGN KEY ("parentRecordId") REFERENCES public."EntityData"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: EntityData EntityData_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."EntityData"
    ADD CONSTRAINT "EntityData_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: EntityData EntityData_updatedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."EntityData"
    ADD CONSTRAINT "EntityData_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: EntityFieldRule EntityFieldRule_entityId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."EntityFieldRule"
    ADD CONSTRAINT "EntityFieldRule_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES public."Entity"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: EntityFieldRule EntityFieldRule_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."EntityFieldRule"
    ADD CONSTRAINT "EntityFieldRule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Entity Entity_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Entity"
    ADD CONSTRAINT "Entity_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Invitation Invitation_customRoleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Invitation"
    ADD CONSTRAINT "Invitation_customRoleId_fkey" FOREIGN KEY ("customRoleId") REFERENCES public."CustomRole"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Invitation Invitation_invitedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Invitation"
    ADD CONSTRAINT "Invitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Invitation Invitation_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Invitation"
    ADD CONSTRAINT "Invitation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Message Message_channelId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Message"
    ADD CONSTRAINT "Message_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES public."Channel"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: NotificationPreference NotificationPreference_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."NotificationPreference"
    ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Notification Notification_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Notification"
    ADD CONSTRAINT "Notification_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Notification Notification_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Notification"
    ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PdfGeneration PdfGeneration_requestedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PdfGeneration"
    ADD CONSTRAINT "PdfGeneration_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: PdfGeneration PdfGeneration_templateId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PdfGeneration"
    ADD CONSTRAINT "PdfGeneration_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES public."PdfTemplate"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PdfGeneration PdfGeneration_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PdfGeneration"
    ADD CONSTRAINT "PdfGeneration_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PdfTemplate PdfTemplate_sourceEntityId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PdfTemplate"
    ADD CONSTRAINT "PdfTemplate_sourceEntityId_fkey" FOREIGN KEY ("sourceEntityId") REFERENCES public."Entity"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: PdfTemplate PdfTemplate_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PdfTemplate"
    ADD CONSTRAINT "PdfTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PlatformAuditLog PlatformAuditLog_staffId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PlatformAuditLog"
    ADD CONSTRAINT "PlatformAuditLog_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES public."PlatformStaff"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: PublicLink PublicLink_customRoleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PublicLink"
    ADD CONSTRAINT "PublicLink_customRoleId_fkey" FOREIGN KEY ("customRoleId") REFERENCES public."CustomRole"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: PublicLink PublicLink_entityId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PublicLink"
    ADD CONSTRAINT "PublicLink_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES public."Entity"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: PublicLink PublicLink_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PublicLink"
    ADD CONSTRAINT "PublicLink_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: RefreshToken RefreshToken_sessionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RefreshToken"
    ADD CONSTRAINT "RefreshToken_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES public."UserSession"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: RefreshToken RefreshToken_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RefreshToken"
    ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ScheduledTaskExecution ScheduledTaskExecution_scheduledTaskId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ScheduledTaskExecution"
    ADD CONSTRAINT "ScheduledTaskExecution_scheduledTaskId_fkey" FOREIGN KEY ("scheduledTaskId") REFERENCES public."ScheduledTask"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ScheduledTask ScheduledTask_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ScheduledTask"
    ADD CONSTRAINT "ScheduledTask_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SupportMessage SupportMessage_ticketId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SupportMessage"
    ADD CONSTRAINT "SupportMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES public."SupportTicket"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SupportTicket SupportTicket_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SupportTicket"
    ADD CONSTRAINT "SupportTicket_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TeamMember TeamMember_teamId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TeamMember"
    ADD CONSTRAINT "TeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES public."Team"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TeamMember TeamMember_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TeamMember"
    ADD CONSTRAINT "TeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Team Team_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Team"
    ADD CONSTRAINT "Team_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TenantLifecycleEvent TenantLifecycleEvent_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TenantLifecycleEvent"
    ADD CONSTRAINT "TenantLifecycleEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Tenant Tenant_ownerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Tenant"
    ADD CONSTRAINT "Tenant_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Tenant Tenant_planId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Tenant"
    ADD CONSTRAINT "Tenant_planId_fkey" FOREIGN KEY ("planId") REFERENCES public."Plan"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: UserSession UserSession_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserSession"
    ADD CONSTRAINT "UserSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: UserTenantAccess UserTenantAccess_customRoleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserTenantAccess"
    ADD CONSTRAINT "UserTenantAccess_customRoleId_fkey" FOREIGN KEY ("customRoleId") REFERENCES public."CustomRole"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: UserTenantAccess UserTenantAccess_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserTenantAccess"
    ADD CONSTRAINT "UserTenantAccess_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: UserTenantAccess UserTenantAccess_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserTenantAccess"
    ADD CONSTRAINT "UserTenantAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: WebhookExecution WebhookExecution_webhookId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WebhookExecution"
    ADD CONSTRAINT "WebhookExecution_webhookId_fkey" FOREIGN KEY ("webhookId") REFERENCES public."Webhook"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Webhook Webhook_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Webhook"
    ADD CONSTRAINT "Webhook_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: powersync; Type: PUBLICATION; Schema: -; Owner: -
--

CREATE PUBLICATION powersync WITH (publish = 'insert, update, delete, truncate');


--
-- Name: powersync ArchivedEntityData; Type: PUBLICATION TABLE; Schema: public; Owner: -
--

ALTER PUBLICATION powersync ADD TABLE ONLY public."ArchivedEntityData";


--
-- Name: powersync Channel; Type: PUBLICATION TABLE; Schema: public; Owner: -
--

ALTER PUBLICATION powersync ADD TABLE ONLY public."Channel";


--
-- Name: powersync ChannelMember; Type: PUBLICATION TABLE; Schema: public; Owner: -
--

ALTER PUBLICATION powersync ADD TABLE ONLY public."ChannelMember";


--
-- Name: powersync CommandTemplate; Type: PUBLICATION TABLE; Schema: public; Owner: -
--

ALTER PUBLICATION powersync ADD TABLE ONLY public."CommandTemplate";


--
-- Name: powersync CustomRole; Type: PUBLICATION TABLE; Schema: public; Owner: -
--

ALTER PUBLICATION powersync ADD TABLE ONLY public."CustomRole";


--
-- Name: powersync Entity; Type: PUBLICATION TABLE; Schema: public; Owner: -
--

ALTER PUBLICATION powersync ADD TABLE ONLY public."Entity";


--
-- Name: powersync EntityData; Type: PUBLICATION TABLE; Schema: public; Owner: -
--

ALTER PUBLICATION powersync ADD TABLE ONLY public."EntityData";


--
-- Name: powersync EntityDataMasked; Type: PUBLICATION TABLE; Schema: public; Owner: -
--

ALTER PUBLICATION powersync ADD TABLE ONLY public."EntityDataMasked";


--
-- Name: powersync EntityFieldRule; Type: PUBLICATION TABLE; Schema: public; Owner: -
--

ALTER PUBLICATION powersync ADD TABLE ONLY public."EntityFieldRule";


--
-- Name: powersync Message; Type: PUBLICATION TABLE; Schema: public; Owner: -
--

ALTER PUBLICATION powersync ADD TABLE ONLY public."Message";


--
-- Name: powersync Notification; Type: PUBLICATION TABLE; Schema: public; Owner: -
--

ALTER PUBLICATION powersync ADD TABLE ONLY public."Notification";


--
-- Name: powersync TeamAccessKey; Type: PUBLICATION TABLE; Schema: public; Owner: -
--

ALTER PUBLICATION powersync ADD TABLE ONLY public."TeamAccessKey";


--
-- Name: powersync User; Type: PUBLICATION TABLE; Schema: public; Owner: -
--

ALTER PUBLICATION powersync ADD TABLE ONLY public."User";


--
-- PostgreSQL database dump complete
--


