-- Alinha o banco com o schema.prisma (divergencia antiga, vinda das migrations
-- antigas): computedValues e obrigatorio, como a migration que criou a coluna
-- pretendia. As colunas de data (ArchivedAuditLog e visibility_recompute) foram
-- alinhadas no schema.prisma (@db.Timestamp(6) / @db.Timestamptz(6)), sem reescrever
-- tabelas nem perder o fuso horario.
UPDATE "EntityData" SET "computedValues" = '{}'::jsonb WHERE "computedValues" IS NULL;
UPDATE "ArchivedEntityData" SET "computedValues" = '{}'::jsonb WHERE "computedValues" IS NULL;
ALTER TABLE "EntityData" ALTER COLUMN "computedValues" SET NOT NULL;
ALTER TABLE "ArchivedEntityData" ALTER COLUMN "computedValues" SET NOT NULL;
