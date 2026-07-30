-- Chat: anti-duplicado de DM (dmKey + unique parcial) + visibilidade de comando por cargo.

-- 1) Channel.dmKey: chave canonica do par de usuarios do DM (userIds ordenados).
ALTER TABLE "Channel" ADD COLUMN IF NOT EXISTS "dmKey" TEXT;

-- Backfill dos DMs existentes.
UPDATE "Channel" c
SET "dmKey" = sub.k
FROM (
  SELECT cm."channelId", string_agg(cm."userId", ':' ORDER BY cm."userId") AS k
  FROM "ChannelMember" cm
  GROUP BY cm."channelId"
) sub
WHERE c.id = sub."channelId" AND c."type" = 'dm' AND c."dmKey" IS NULL;

-- 1 DM por par de usuarios (indice parcial; Prisma nao expressa WHERE em @@unique).
CREATE UNIQUE INDEX IF NOT EXISTS "Channel_dm_unique"
  ON "Channel"("tenantId", "dmKey")
  WHERE "type" = 'dm' AND "dmKey" IS NOT NULL;

-- 2) CommandTemplate.visibleToRoleIds: allowlist de cargos ([] = visivel a todos).
ALTER TABLE "CommandTemplate" ADD COLUMN IF NOT EXISTS "visibleToRoleIds" TEXT[] NOT NULL DEFAULT '{}';

-- 3) Permissao dedicada chat.manage (criar/renomear/gerir canais e comandos).
--    Auto-concede aos cargos que ja gerenciam estrutura/permissoes (evita lockout;
--    platform/allAccess ja passam por bypass no codigo). Novos cargos concedem via UI.
UPDATE "CustomRole"
SET "modulePermissions" = COALESCE("modulePermissions", '{}'::jsonb) || jsonb_build_object(
  'chat', COALESCE("modulePermissions"->'chat', '{}'::jsonb) || '{"manage": true}'::jsonb)
WHERE (
  "modulePermissions"->'entities'->>'canUpdate' = 'true'
  OR "modulePermissions"->'roles'->>'canManagePermissions' = 'true'
  OR ("modulePermissions"->>'allAccess') = 'true'
);
