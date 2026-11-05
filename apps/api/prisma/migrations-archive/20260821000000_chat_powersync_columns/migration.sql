-- Expor CHAT (Channel/Message/CommandTemplate) no PowerSync do mobile.
-- Desnormaliza a visibilidade por cargo APENAS no Channel (e converte a allowlist
-- do CommandTemplate p/ JSONB). Mensagens NAO desnormalizam: os buckets de
-- mensagem herdam a visibilidade do canal via parameter query (channelId acessivel),
-- evitando staleness. Manutencao reusa a outbox `visibility_recompute` (ver
-- recompute_channel_visibility + visibility-recompute.job.ts).
--
-- Semantica de visibilidade do Channel:
--   group  -> qualquer cargo que LE a entidade dona (calc_channel_group_visibility)
--   record -> herda EntityData._visibleToRoles do recordId (scope+dataFilters do registro)
--   dm     -> sem filtro de role (acesso por membership em ChannelMember)

-- ── Colunas (idempotentes) ─────────────────────────────────────────────────
ALTER TABLE "Channel"
  ADD COLUMN IF NOT EXISTS "_visibleToRolesJson" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS "_visibleToRolesOwnJson" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS "_hasRoleFilter" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "CommandTemplate"
  ADD COLUMN IF NOT EXISTS "_visibleToRolesJson" JSONB NOT NULL DEFAULT '[]';

CREATE INDEX IF NOT EXISTS "Channel_tenant_type_active_idx"
  ON "Channel" ("tenantId", "type") WHERE "deletedAt" IS NULL;

-- ── Visibilidade de um Channel de GRUPO a partir da Entity dona ─────────────
-- Reusa role_can_read_entity(perms, slug). Retorna all_roles=NULL quando TODOS os
-- cargos do tenant leem a entidade (unrestricted).
CREATE OR REPLACE FUNCTION calc_channel_group_visibility(
  p_tenant_id TEXT, p_entity_id TEXT,
  OUT all_roles TEXT[], OUT has_filter BOOLEAN
) AS $$
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
END; $$ LANGUAGE plpgsql STABLE;

-- ── Trigger BEFORE em Channel: recalcula a visibilidade por-linha ──────────
CREATE OR REPLACE FUNCTION trg_channel_calc_visible_roles() RETURNS TRIGGER AS $$
DECLARE roles TEXT[]; hf BOOLEAN;
BEGIN
  IF NEW."type" = 'group' AND NEW."entityId" IS NOT NULL THEN
    SELECT all_roles, has_filter INTO roles, hf
      FROM calc_channel_group_visibility(NEW."tenantId", NEW."entityId");
  ELSIF NEW."type" = 'record' AND NEW."recordId" IS NOT NULL THEN
    SELECT "_visibleToRoles" INTO roles FROM "EntityData" WHERE id = NEW."recordId";
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
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_channel_calc_visible_roles ON "Channel";
CREATE TRIGGER trg_channel_calc_visible_roles
  BEFORE INSERT OR UPDATE ON "Channel"
  FOR EACH ROW EXECUTE FUNCTION trg_channel_calc_visible_roles();

-- ── Trigger em CommandTemplate: visibleToRoleIds[] -> _visibleToRolesJson ──
CREATE OR REPLACE FUNCTION trg_command_template_visible_roles() RETURNS TRIGGER AS $$
BEGIN
  NEW."_visibleToRolesJson" := to_jsonb(COALESCE(NEW."visibleToRoleIds", ARRAY[]::text[]));
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_command_template_visible_roles ON "CommandTemplate";
CREATE TRIGGER trg_command_template_visible_roles
  BEFORE INSERT OR UPDATE ON "CommandTemplate"
  FOR EACH ROW EXECUTE FUNCTION trg_command_template_visible_roles();

-- ── Recompute em lote dos Channels de uma entidade (para a outbox) ─────────
-- Poucas linhas por entidade (1 grupo + N threads) -> UPDATE simples re-dispara
-- o BEFORE trigger, que rele a Entity/EntityData ja atualizados.
CREATE OR REPLACE FUNCTION recompute_channel_visibility(p_tenant TEXT, p_entity_id TEXT)
RETURNS INT AS $$
DECLARE n INT;
BEGIN
  WITH upd AS (
    UPDATE "Channel" c SET "type" = c."type"
    WHERE c."tenantId" = p_tenant AND c."entityId" = p_entity_id AND c."deletedAt" IS NULL
    RETURNING 1
  ) SELECT count(*) INTO n FROM upd;
  RETURN n;
END; $$ LANGUAGE plpgsql;

-- ── Backfill idempotente (dispara os BEFORE triggers) ─────────────────────
UPDATE "Channel" SET "type" = "type";
UPDATE "CommandTemplate" SET "slug" = "slug";
