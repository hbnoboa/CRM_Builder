-- Campos ocultos (cargo com "Ver" desligado) nao podem chegar ao celular.
--
-- O PowerSync manda o registro inteiro (coluna data), sem tirar campos por cargo.
-- Para os cargos com algum campo oculto, guardamos uma copia do registro SEM esses
-- campos (EntityDataMasked: uma linha por registro x cargo), mantida por triggers.
-- O token de sync diz se o cargo e "full" ou "masked" (claim dataView): cargos
-- masked recebem so as copias (buckets masked_*), os demais seguem nos buckets de
-- EntityData. Regra do campo = a da API: regra da tabela, senao o coringa '*';
-- acesso total (allAccess) ve tudo.

CREATE TABLE IF NOT EXISTS "EntityDataMasked" (
  "id" TEXT NOT NULL,                 -- recordId || ':' || roleId
  "recordId" TEXT NOT NULL,
  "roleId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "data" JSONB NOT NULL,
  "parentRecordId" TEXT,
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3),
  "_visibleAll" BOOLEAN NOT NULL DEFAULT false,
  "_visibleOwn" BOOLEAN NOT NULL DEFAULT false,
  "_visibleTeamKeysJson" JSONB NOT NULL DEFAULT '[]'::jsonb,
  CONSTRAINT "EntityDataMasked_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "EntityDataMasked_recordId_idx" ON "EntityDataMasked"("recordId");
CREATE INDEX IF NOT EXISTS "EntityDataMasked_tenantId_roleId_idx" ON "EntityDataMasked"("tenantId", "roleId");

-- ── Regra do cargo para a tabela: a especifica ou o coringa '*' ───────────
CREATE OR REPLACE FUNCTION role_entity_rule(p_perms JSONB, p_entity_slug TEXT)
RETURNS JSONB AS $$
  WITH perms AS (
    SELECT x FROM jsonb_array_elements(
      CASE WHEN jsonb_typeof(p_perms) = 'array' THEN p_perms ELSE '[]'::jsonb END
    ) AS x
  )
  SELECT COALESCE(
    (SELECT x FROM perms WHERE x->>'entitySlug' = p_entity_slug LIMIT 1),
    (SELECT x FROM perms WHERE x->>'entitySlug' = '*' LIMIT 1)
  );
$$ LANGUAGE sql IMMUTABLE;

-- Campos com "Ver" desligado para o cargo nesta tabela.
CREATE OR REPLACE FUNCTION role_hidden_fields(p_perms JSONB, p_entity_slug TEXT)
RETURNS TEXT[] AS $$
  SELECT COALESCE(array_agg(fp->>'fieldSlug'), ARRAY[]::TEXT[])
  FROM jsonb_array_elements(
    CASE WHEN jsonb_typeof(role_entity_rule(p_perms, p_entity_slug)->'fieldPermissions') = 'array'
         THEN role_entity_rule(p_perms, p_entity_slug)->'fieldPermissions' ELSE '[]'::jsonb END
  ) AS fp
  WHERE (fp->>'canView') = 'false';
$$ LANGUAGE sql IMMUTABLE;

-- Cargo com algum campo oculto (em qualquer tabela) e sem acesso total.
CREATE OR REPLACE FUNCTION role_has_hidden_fields(p_perms JSONB, p_modules JSONB)
RETURNS BOOLEAN AS $$
  SELECT COALESCE(p_modules->>'allAccess', 'false') <> 'true'
     AND jsonb_typeof(p_perms) = 'array'
     AND EXISTS (
       SELECT 1
       FROM jsonb_array_elements(p_perms) AS x,
            jsonb_array_elements(CASE WHEN jsonb_typeof(x->'fieldPermissions') = 'array'
                                      THEN x->'fieldPermissions' ELSE '[]'::jsonb END) AS fp
       WHERE (fp->>'canView') = 'false'
     );
$$ LANGUAGE sql IMMUTABLE;

CREATE OR REPLACE FUNCTION tenant_masked_roles(p_tenant TEXT)
RETURNS TABLE(id TEXT, permissions JSONB) AS $$
  SELECT r.id, r.permissions::jsonb
  FROM "CustomRole" r
  WHERE r."tenantId" = p_tenant AND r."deletedAt" IS NULL
    AND role_has_hidden_fields(r.permissions::jsonb, r."modulePermissions"::jsonb);
$$ LANGUAGE sql STABLE;

-- ── (Re)gera as copias: de um registro (p_record) ou da empresa toda ──────
-- Copia so para quem enxerga o registro: escopo "todos" (_visibleAll), "proprios"
-- (_visibleOwn, o bucket confere o criador) ou "equipe" (chaves desse cargo).
CREATE OR REPLACE FUNCTION refresh_masked_entity_data(p_tenant TEXT, p_record TEXT)
RETURNS INT AS $$
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
$$ LANGUAGE plpgsql;

-- ── Registro mudou (dados, visibilidade, exclusao) ────────────────────────
CREATE OR REPLACE FUNCTION trg_entity_data_masked() RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_entity_data_masked ON "EntityData";
CREATE TRIGGER trg_entity_data_masked
  AFTER INSERT OR UPDATE OR DELETE ON "EntityData"
  FOR EACH ROW EXECUTE FUNCTION trg_entity_data_masked();

-- ── Cargo mudou: so refaz se ele tem (ou tinha) campo oculto ──────────────
CREATE OR REPLACE FUNCTION trg_custom_role_masked() RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_custom_role_masked ON "CustomRole";
CREATE TRIGGER trg_custom_role_masked
  AFTER INSERT OR UPDATE OR DELETE ON "CustomRole"
  FOR EACH ROW EXECUTE FUNCTION trg_custom_role_masked();

-- ── Backfill: empresas que ja tem cargo com campo oculto ──────────────────
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN
    SELECT DISTINCT "tenantId" FROM "CustomRole"
    WHERE "deletedAt" IS NULL AND role_has_hidden_fields(permissions::jsonb, "modulePermissions"::jsonb)
  LOOP
    PERFORM refresh_masked_entity_data(t, NULL);
  END LOOP;
END $$;

-- ── PowerSync: replica a tabela nova ──────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'powersync' AND NOT puballtables)
     AND NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'powersync' AND tablename = 'EntityDataMasked') THEN
    ALTER PUBLICATION powersync ADD TABLE "EntityDataMasked";
  END IF;
END $$;
