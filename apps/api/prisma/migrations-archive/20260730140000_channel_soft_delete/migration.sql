-- Soft-delete de canais de chat.
-- Adiciona Channel.deletedAt e ajusta os índices únicos parciais para IGNORAR
-- canais excluídos — assim dá pra recriar o canal de um registro/tabela/DM
-- depois de excluí-lo (a linha "morta" não bloqueia o unique).

ALTER TABLE "Channel" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

DROP INDEX IF EXISTS "Channel_group_unique";
CREATE UNIQUE INDEX IF NOT EXISTS "Channel_group_unique"
  ON "Channel" ("tenantId", "entityId")
  WHERE "recordId" IS NULL AND "type" = 'group' AND "deletedAt" IS NULL;

DROP INDEX IF EXISTS "Channel_record_unique";
CREATE UNIQUE INDEX IF NOT EXISTS "Channel_record_unique"
  ON "Channel" ("tenantId", "recordId")
  WHERE "recordId" IS NOT NULL AND "deletedAt" IS NULL;

DROP INDEX IF EXISTS "Channel_dm_unique";
CREATE UNIQUE INDEX IF NOT EXISTS "Channel_dm_unique"
  ON "Channel" ("tenantId", "dmKey")
  WHERE "type" = 'dm' AND "dmKey" IS NOT NULL AND "deletedAt" IS NULL;
