-- Equipes/departamentos + escopo de visibilidade 'team' ("minha equipe").
-- Cargo com scope='team' numa tabela ve os registros criados por qualquer pessoa
-- das suas equipes (e os proprios). Web/API: filtro por createdById. Celular
-- (PowerSync, sem JOIN): cada registro guarda chaves "equipeId:cargoId" (equipes do
-- CRIADOR x cargos com escopo team) e cada usuario tem as suas chaves em
-- "TeamAccessKey" (equipes dele x cargo dele). O bucket casa as duas.

-- ── Tabelas ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Team" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "color" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Team_tenantId_name_key" ON "Team"("tenantId", "name");
CREATE INDEX IF NOT EXISTS "Team_tenantId_idx" ON "Team"("tenantId");
DO $$ BEGIN
  ALTER TABLE "Team" ADD CONSTRAINT "Team_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "TeamMember" (
  "id" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "isLeader" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "TeamMember_teamId_userId_key" ON "TeamMember"("teamId", "userId");
CREATE INDEX IF NOT EXISTS "TeamMember_userId_idx" ON "TeamMember"("userId");
DO $$ BEGIN
  ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "TeamAccessKey" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  CONSTRAINT "TeamAccessKey_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "TeamAccessKey_userId_key_key" ON "TeamAccessKey"("userId", "key");
CREATE INDEX IF NOT EXISTS "TeamAccessKey_userId_tenantId_idx" ON "TeamAccessKey"("userId", "tenantId");

ALTER TABLE "EntityData"
  ADD COLUMN IF NOT EXISTS "_visibleTeamKeysJson" JSONB NOT NULL DEFAULT '[]'::jsonb;

-- ── Escopo do cargo numa tabela: 'all' | 'own' | 'team' ─────────────────
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

  IF perm_item IS NOT NULL AND perm_item->>'scope' IN ('own', 'team') THEN
    RETURN perm_item->>'scope';
  END IF;

  RETURN 'all';
END;
$$ LANGUAGE plpgsql STABLE;

-- ── Visibilidade do registro: + lista de cargos com escopo team ──────────
-- Cargo 'team' entra tambem na lista "own" (sempre ve o que ele mesmo criou).
DROP FUNCTION IF EXISTS calc_record_visibility(TEXT, TEXT, JSONB, TEXT);
CREATE FUNCTION calc_record_visibility(
  p_tenant_id TEXT,
  p_entity_id TEXT,
  p_record_data JSONB,
  p_parent_record_id TEXT DEFAULT NULL,
  OUT all_roles TEXT[],
  OUT own_roles TEXT[],
  OUT team_roles TEXT[]
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
$$ LANGUAGE plpgsql STABLE;

-- Chaves "equipeId:cargoId": equipes do criador x cargos com escopo team.
CREATE OR REPLACE FUNCTION calc_team_keys(
  p_tenant_id TEXT,
  p_creator_id TEXT,
  p_team_roles TEXT[]
) RETURNS JSONB AS $$
  SELECT COALESCE(jsonb_agg(DISTINCT tm."teamId" || ':' || r), '[]'::jsonb)
  FROM "TeamMember" tm
  JOIN "Team" t ON t.id = tm."teamId" AND t."tenantId" = p_tenant_id
  CROSS JOIN unnest(COALESCE(p_team_roles, ARRAY[]::TEXT[])) AS r
  WHERE p_creator_id IS NOT NULL AND tm."userId" = p_creator_id;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION trg_entity_data_calc_visible_roles()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

-- ── Chaves do usuario (parametro do PowerSync) ───────────────────────────
CREATE OR REPLACE FUNCTION refresh_team_access_keys(p_user_id TEXT, p_tenant_id TEXT)
RETURNS VOID AS $$
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
$$ LANGUAGE plpgsql;

-- So vale recalcular registros se a empresa tem algum cargo com escopo team.
CREATE OR REPLACE FUNCTION tenant_uses_team_scope(p_tenant_id TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM "CustomRole"
    WHERE "tenantId" = p_tenant_id AND "deletedAt" IS NULL
      AND jsonb_typeof(permissions::jsonb) = 'array'
      AND jsonb_path_exists(permissions::jsonb, '$[*] ? (@.scope == "team")')
  );
$$ LANGUAGE sql STABLE;

-- Entrou/saiu de equipe: chaves do usuario + chaves dos registros que ELE criou.
CREATE OR REPLACE FUNCTION trg_team_member_changed()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_team_member_changed ON "TeamMember";
CREATE TRIGGER trg_team_member_changed
  AFTER INSERT OR DELETE ON "TeamMember"
  FOR EACH ROW EXECUTE FUNCTION trg_team_member_changed();

-- Trocou de cargo / saiu ou voltou da empresa: refaz as chaves do usuario.
CREATE OR REPLACE FUNCTION trg_membership_team_keys()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM refresh_team_access_keys(OLD."userId", OLD."tenantId");
    RETURN OLD;
  END IF;
  PERFORM refresh_team_access_keys(NEW."userId", NEW."tenantId");
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_membership_team_keys ON "UserTenantAccess";
CREATE TRIGGER trg_membership_team_keys
  AFTER INSERT OR DELETE OR UPDATE OF "customRoleId", status, "deletedAt" ON "UserTenantAccess"
  FOR EACH ROW EXECUTE FUNCTION trg_membership_team_keys();

-- ── PowerSync: replica a tabela de chaves (publicacao por lista de tabelas) ──
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'powersync' AND NOT puballtables)
     AND NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'powersync' AND tablename = 'TeamAccessKey') THEN
    ALTER PUBLICATION powersync ADD TABLE "TeamAccessKey";
  END IF;
END $$;
