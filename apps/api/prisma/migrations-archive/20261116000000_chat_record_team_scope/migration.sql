-- Escopo 'minha equipe' nos THREADS DE REGISTRO do chat (celular / PowerSync).
--
-- O EntityData ja guarda as chaves "equipeId:cargoId" (_visibleTeamKeysJson) e o
-- bucket team_entity_data entrega o registro. O thread do registro nao chegava:
-- Channel so herdava cargos (all/own). Sem JOIN no PowerSync, as chaves descem:
--   EntityData._visibleTeamKeysJson -> Channel (record) -> Message
-- e os buckets chat_*_record_team casam com TeamAccessKey do usuario.

ALTER TABLE "Channel"
  ADD COLUMN IF NOT EXISTS "_visibleTeamKeysJson" JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE "Message"
  ADD COLUMN IF NOT EXISTS "_visibleTeamKeysJson" JSONB NOT NULL DEFAULT '[]'::jsonb;

-- ── Channel BEFORE: tambem herda as chaves de equipe do registro ──────────
CREATE OR REPLACE FUNCTION trg_channel_calc_visible_roles() RETURNS TRIGGER AS $$
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
END; $$ LANGUAGE plpgsql;

-- ── EntityData AFTER: visibilidade do registro mudou -> refaz o thread ────
-- Antes o thread so era recalculado pela outbox (troca de cargo). Mudanca de
-- equipe, de dono ou de filtro de dados do registro agora chega na hora.
CREATE OR REPLACE FUNCTION trg_entity_data_sync_record_channel() RETURNS TRIGGER AS $$
BEGIN
  UPDATE "Channel" c SET "type" = c."type"
  WHERE c."tenantId" = NEW."tenantId" AND c."recordId" = NEW.id AND c."type" = 'record';
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_entity_data_sync_record_channel ON "EntityData";
CREATE TRIGGER trg_entity_data_sync_record_channel
  AFTER UPDATE ON "EntityData"
  FOR EACH ROW
  WHEN (
    OLD."_visibleTeamKeysJson" IS DISTINCT FROM NEW."_visibleTeamKeysJson"
    OR OLD."_visibleToRoles" IS DISTINCT FROM NEW."_visibleToRoles"
    OR OLD."_visibleToRolesOwnJson" IS DISTINCT FROM NEW."_visibleToRolesOwnJson"
    OR OLD."createdById" IS DISTINCT FROM NEW."createdById"
  )
  EXECUTE FUNCTION trg_entity_data_sync_record_channel();

-- ── Channel AFTER: chaves mudaram -> copia para as mensagens do thread ────
CREATE OR REPLACE FUNCTION trg_channel_sync_message_team_keys() RETURNS TRIGGER AS $$
BEGIN
  UPDATE "Message" SET "_visibleTeamKeysJson" = NEW."_visibleTeamKeysJson"
  WHERE "channelId" = NEW.id;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_channel_sync_message_team_keys ON "Channel";
CREATE TRIGGER trg_channel_sync_message_team_keys
  AFTER UPDATE ON "Channel"
  FOR EACH ROW
  WHEN (OLD."_visibleTeamKeysJson" IS DISTINCT FROM NEW."_visibleTeamKeysJson")
  EXECUTE FUNCTION trg_channel_sync_message_team_keys();

-- ── Message BEFORE INSERT: nasce com as chaves do canal ───────────────────
CREATE OR REPLACE FUNCTION trg_message_team_keys() RETURNS TRIGGER AS $$
BEGIN
  SELECT COALESCE("_visibleTeamKeysJson", '[]'::jsonb) INTO NEW."_visibleTeamKeysJson"
    FROM "Channel" WHERE id = NEW."channelId";
  NEW."_visibleTeamKeysJson" := COALESCE(NEW."_visibleTeamKeysJson", '[]'::jsonb);
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_message_team_keys ON "Message";
CREATE TRIGGER trg_message_team_keys
  BEFORE INSERT ON "Message"
  FOR EACH ROW EXECUTE FUNCTION trg_message_team_keys();

-- ── Backfill (o AFTER do Channel leva as chaves para as mensagens) ────────
UPDATE "Channel" SET "type" = "type" WHERE "type" = 'record';

-- ── PowerSync: publicacao por lista precisa de todas as tabelas das regras ─
DO $$
DECLARE
  t TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'powersync' AND NOT puballtables) THEN
    FOREACH t IN ARRAY ARRAY[
      'User', 'Notification', 'CustomRole', 'Entity', 'EntityFieldRule', 'EntityData',
      'ArchivedEntityData', 'TeamAccessKey', 'Channel', 'ChannelMember', 'Message',
      'CommandTemplate'
    ] LOOP
      IF to_regclass(format('%I', t)) IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM pg_publication_tables
           WHERE pubname = 'powersync' AND schemaname = 'public' AND tablename = t
         ) THEN
        EXECUTE format('ALTER PUBLICATION powersync ADD TABLE %I', t);
      END IF;
    END LOOP;
  END IF;
END $$;
