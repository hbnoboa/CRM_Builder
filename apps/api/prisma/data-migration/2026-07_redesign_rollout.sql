-- ============================================================================
-- Rollout do redesenho (develop pre-redesenho -> local): identidade global +
-- rank + soft-delete global + impersonacao + chat. ORDEM SEGURA:
--   A) ADD colunas/tabelas (aditivo)
--   B) BACKFILL de dados (usa roleType/User.tenantId ANTES de dropar)
--   C) DROP colunas antigas + novos unique indexes
-- NENHUM registro e apagado (sem DROP TABLE / DELETE / TRUNCATE). Idempotente
-- (IF NOT EXISTS / IF EXISTS) pra tolerar estado parcial do dev.
-- ============================================================================

-- ================= A) ADITIVO =================
ALTER TABLE "Tenant"            ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "User"              ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "Entity"            ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "Notification"      ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "PdfTemplate"       ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "Webhook"           ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "EmailTemplate"     ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "ActionChain"       ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "ScheduledTask"     ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "EntityAutomation"  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "EntityFieldRule"   ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "PublicLink"        ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "CustomRole"        ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "CustomRole"        ADD COLUMN IF NOT EXISTS "rank" INTEGER NOT NULL DEFAULT 100;
ALTER TABLE "UserTenantAccess"  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "UserTenantAccess"  ADD COLUMN IF NOT EXISTS "isPrimary" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "EntityData"        ADD COLUMN IF NOT EXISTS "_visibleToRolesOwnJson" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "AuditLog"          ADD COLUMN IF NOT EXISTS "impersonatedById" TEXT;
ALTER TABLE "AuditLog"          ADD COLUMN IF NOT EXISTS "impersonatedByName" TEXT;
ALTER TABLE "DashboardTemplate" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "DashboardTemplate" ADD COLUMN IF NOT EXISTS "settings" JSONB NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS "Channel" (
    "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "type" TEXT NOT NULL,
    "entityId" TEXT, "recordId" TEXT, "name" TEXT, "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Channel_pkey" PRIMARY KEY ("id"));
CREATE TABLE IF NOT EXISTS "ChannelMember" (
    "id" TEXT NOT NULL, "channelId" TEXT NOT NULL, "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member', "lastReadAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChannelMember_pkey" PRIMARY KEY ("id"));
CREATE TABLE IF NOT EXISTS "Message" (
    "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "channelId" TEXT NOT NULL, "senderId" TEXT,
    "type" TEXT NOT NULL DEFAULT 'text', "content" TEXT, "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Message_pkey" PRIMARY KEY ("id"));
CREATE TABLE IF NOT EXISTS "CommandTemplate" (
    "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "slug" TEXT NOT NULL, "description" TEXT,
    "icon" TEXT, "targetEntitySlug" TEXT, "fields" JSONB, "actionType" TEXT NOT NULL DEFAULT 'create_record',
    "actionConfig" JSONB NOT NULL DEFAULT '{}', "execMode" TEXT NOT NULL DEFAULT 'as_user',
    "elevation" JSONB, "llm" JSONB, "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CommandTemplate_pkey" PRIMARY KEY ("id"));
CREATE TABLE IF NOT EXISTS "ChannelCommand" (
    "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "channelId" TEXT NOT NULL,
    "commandTemplateId" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChannelCommand_pkey" PRIMARY KEY ("id"));
CREATE TABLE IF NOT EXISTS "BotIdentity" (
    "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "userId" TEXT NOT NULL, "customRoleId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Assistente', "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BotIdentity_pkey" PRIMARY KEY ("id"));

CREATE INDEX IF NOT EXISTS "Channel_tenantId_entityId_idx" ON "Channel"("tenantId", "entityId");
CREATE INDEX IF NOT EXISTS "Channel_tenantId_type_idx" ON "Channel"("tenantId", "type");
CREATE INDEX IF NOT EXISTS "ChannelMember_userId_idx" ON "ChannelMember"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "ChannelMember_channelId_userId_key" ON "ChannelMember"("channelId", "userId");
CREATE INDEX IF NOT EXISTS "Message_channelId_createdAt_idx" ON "Message"("channelId", "createdAt");
CREATE INDEX IF NOT EXISTS "CommandTemplate_tenantId_isActive_idx" ON "CommandTemplate"("tenantId", "isActive");
CREATE UNIQUE INDEX IF NOT EXISTS "CommandTemplate_tenantId_slug_key" ON "CommandTemplate"("tenantId", "slug");
CREATE INDEX IF NOT EXISTS "ChannelCommand_channelId_idx" ON "ChannelCommand"("channelId");
CREATE INDEX IF NOT EXISTS "ChannelCommand_tenantId_idx" ON "ChannelCommand"("tenantId");
CREATE UNIQUE INDEX IF NOT EXISTS "ChannelCommand_channelId_commandTemplateId_key" ON "ChannelCommand"("channelId", "commandTemplateId");
CREATE UNIQUE INDEX IF NOT EXISTS "BotIdentity_tenantId_key" ON "BotIdentity"("tenantId");

DO $$ BEGIN
  ALTER TABLE "ChannelMember" ADD CONSTRAINT "ChannelMember_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "Message" ADD CONSTRAINT "Message_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ================= B) BACKFILL (antes de dropar roleType/tenantId) =================
-- membership a partir do modelo antigo
INSERT INTO "UserTenantAccess" (id, "userId", "tenantId", "customRoleId", status, "isPrimary", "grantedAt", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, u.id, u."tenantId", u."customRoleId", 'ACTIVE', true, now(), now(), now()
FROM "User" u
WHERE u."tenantId" IS NOT NULL AND u."customRoleId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "UserTenantAccess" a WHERE a."userId"=u.id AND a."tenantId"=u."tenantId");
UPDATE "UserTenantAccess" a SET "isPrimary" = (a."tenantId" = u."tenantId")
FROM "User" u WHERE u.id = a."userId" AND u."tenantId" IS NOT NULL;

-- rank por roleType
UPDATE "CustomRole" SET "rank" = CASE "roleType"
  WHEN 'PLATFORM_ADMIN' THEN 1 WHEN 'ADMIN' THEN 10 WHEN 'MANAGER' THEN 30
  WHEN 'USER' THEN 50 WHEN 'VIEWER' THEN 70 WHEN 'CUSTOM' THEN 50 ELSE 90 END;

-- allAccess nos ADMIN de tenant
UPDATE "CustomRole"
SET "modulePermissions" = jsonb_set(COALESCE("modulePermissions", '{}'::jsonb), '{allAccess}', 'true'::jsonb, true)
WHERE "roleType" = 'ADMIN' AND COALESCE("modulePermissions"->>'allAccess','false') <> 'true';

-- platform.* nos PLATFORM_ADMIN
UPDATE "CustomRole"
SET "modulePermissions" = jsonb_set(COALESCE("modulePermissions", '{}'::jsonb), '{platform}',
      '{"crossTenant": true, "impersonateAny": true, "manageTenants": true}'::jsonb, true)
WHERE "roleType" = 'PLATFORM_ADMIN';

-- superadmins ios-risk -> Super Admin (se existirem no ambiente)
WITH sa AS (SELECT r.id FROM "CustomRole" r WHERE r."roleType"='PLATFORM_ADMIN' AND r.name='Super Admin' LIMIT 1),
     t AS (SELECT u.id FROM "User" u WHERE u.email IN ('hbnoboa@iosrisk.com.br','viviane@iosrisk.com.br','noboa@iosrisk.com.br'))
UPDATE "User" u SET "customRoleId"=(SELECT id FROM sa) FROM t WHERE u.id=t.id AND (SELECT id FROM sa) IS NOT NULL;
WITH sa AS (SELECT r.id FROM "CustomRole" r WHERE r."roleType"='PLATFORM_ADMIN' AND r.name='Super Admin' LIMIT 1),
     t AS (SELECT u.id FROM "User" u WHERE u.email IN ('hbnoboa@iosrisk.com.br','viviane@iosrisk.com.br','noboa@iosrisk.com.br'))
UPDATE "UserTenantAccess" a SET "customRoleId"=(SELECT id FROM sa) FROM t WHERE a."userId"=t.id AND (SELECT id FROM sa) IS NOT NULL;

-- ================= C) DROP colunas antigas + novos unique indexes =================
-- objeto ad-hoc do dev/prod que depende de User.tenantId (NAO esta no codigo; obsoleto
-- no modelo novo — user<->tenant agora e via membership). Derivado: nao perde registro.
DROP MATERIALIZED VIEW IF EXISTS mv_user_activity CASCADE;

ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_tenantId_fkey";
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_customRoleId_fkey";
DROP INDEX IF EXISTS "User_tenantId_idx";
DROP INDEX IF EXISTS "User_tenantId_status_idx";
DROP INDEX IF EXISTS "User_customRoleId_idx";
DROP INDEX IF EXISTS "User_tenantId_createdAt_idx";
DROP INDEX IF EXISTS "User_tenantId_email_key";
DROP INDEX IF EXISTS "User_tenantId_cpf_key";
DROP INDEX IF EXISTS "User_tenantId_phone_key";
DROP INDEX IF EXISTS "CustomRole_roleType_idx";
DROP INDEX IF EXISTS "CustomRole_tenantId_roleType_idx";
DROP INDEX IF EXISTS "CustomRole_tenantId_name_key";

ALTER TABLE "User" DROP COLUMN IF EXISTS "customRoleId";
ALTER TABLE "User" DROP COLUMN IF EXISTS "tenantId";
ALTER TABLE "CustomRole" DROP COLUMN IF EXISTS "roleType";

-- novos unique globais (DATA-DEPENDENTE: falha se houver duplicata — o teste no scratch revela)
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "User_cpf_key" ON "User"("cpf");
CREATE UNIQUE INDEX IF NOT EXISTS "User_phone_key" ON "User"("phone");
