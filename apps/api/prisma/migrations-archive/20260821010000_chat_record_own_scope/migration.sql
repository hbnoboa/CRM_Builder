-- Fecha o gap de scope='own' nos THREADS DE REGISTRO do chat.
--
-- Antes: o Channel de registro herdava apenas EntityData._visibleToRoles (roles
-- scope='all') no _visibleToRolesJson. Um cargo com scope='own' NAO recebia o
-- thread do proprio registro (o bucket chat_channels_role filtra so por role,
-- sem checar o dono). Resultado: quem criou o registro nao via o thread dele.
--
-- Agora: o Channel de registro tambem herda:
--   _visibleToRolesOwnJson  <- EntityData._visibleToRolesOwnJson (roles scope='own')
--   _recordCreatedById      <- EntityData.createdById (dono do REGISTRO, nao do canal)
-- Espelhando o bucket 4b de EntityData, o bucket chat_channels_record_own libera
-- o canal quando (role_id IN own) AND (_recordCreatedById = user). Sem vazamento:
-- so o criador do registro, com o cargo own, recebe o thread.

-- ── Coluna do dono do REGISTRO no Channel (idempotente) ────────────────────
ALTER TABLE "Channel"
  ADD COLUMN IF NOT EXISTS "_recordCreatedById" TEXT;

CREATE INDEX IF NOT EXISTS "Channel_record_owner_idx"
  ON "Channel" ("_recordCreatedById") WHERE "type" = 'record' AND "deletedAt" IS NULL;

-- ── Trigger BEFORE em Channel: agora tambem popula own + dono do registro ──
CREATE OR REPLACE FUNCTION trg_channel_calc_visible_roles() RETURNS TRIGGER AS $$
DECLARE
  roles TEXT[];
  hf BOOLEAN;
  own_json JSONB := '[]'::jsonb;
  rec_creator TEXT := NULL;
BEGIN
  IF NEW."type" = 'group' AND NEW."entityId" IS NOT NULL THEN
    SELECT all_roles, has_filter INTO roles, hf
      FROM calc_channel_group_visibility(NEW."tenantId", NEW."entityId");
  ELSIF NEW."type" = 'record' AND NEW."recordId" IS NOT NULL THEN
    SELECT "_visibleToRoles",
           COALESCE("_visibleToRolesOwnJson", '[]'::jsonb),
           "createdById"
      INTO roles, own_json, rec_creator
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
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

-- Trigger ja existe (mesmo nome); recriar a funcao basta. Backfill re-dispara.
UPDATE "Channel" SET "type" = "type" WHERE "type" = 'record';
