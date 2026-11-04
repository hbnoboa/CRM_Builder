-- Lixeira: quem excluiu o registro.
ALTER TABLE "EntityData" ADD COLUMN IF NOT EXISTS "deletedById" TEXT;
