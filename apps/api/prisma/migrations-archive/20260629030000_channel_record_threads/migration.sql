-- Canais por registro (record-threads): trocar o unique simples por índices parciais.
-- 1 canal de grupo por tabela (recordId nulo) + 1 thread por registro (recordId não-nulo).

DROP INDEX IF EXISTS "Channel_tenantId_entityId_key";

CREATE INDEX IF NOT EXISTS "Channel_tenantId_entityId_idx"
  ON "Channel" ("tenantId", "entityId");

CREATE UNIQUE INDEX IF NOT EXISTS "Channel_group_unique"
  ON "Channel" ("tenantId", "entityId")
  WHERE "recordId" IS NULL AND "type" = 'group';

CREATE UNIQUE INDEX IF NOT EXISTS "Channel_record_unique"
  ON "Channel" ("tenantId", "recordId")
  WHERE "recordId" IS NOT NULL;
