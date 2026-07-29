-- ============================================================================
-- Migração de DADOS: roleType  ->  allAccess / rank / membership  (permission-driven)
--
-- Alvo: bancos AINDA no modelo antigo (dev = crm_builder_dev, prod = crm_builder).
-- NÃO rodar no local (local já está no modelo novo).
--
-- Estratégia: ADITIVA e IDEMPOTENTE. Só ADICIONA colunas e PREENCHE dados novos;
-- NÃO dropa roleType nem User.tenantId/customRoleId (ficam como fallback até o
-- deploy do código novo estar validado). Envolvido em transação — revise o
-- bloco de DRY-RUN antes de dar COMMIT.
--
-- Pré-requisito de SCHEMA COMPLETO (tabelas do redesenho/chat, etc.): aplicar as
-- migrations Prisma do branch (prisma migrate deploy) ANTES de subir o código
-- novo. Este script cobre só as colunas/dados que o motor de permissões exige.
--
-- Mapa de rank por tier:
--   PLATFORM_ADMIN=1 · ADMIN=10 · MANAGER=30 · USER=50 · VIEWER=70 · CUSTOM=50
-- Superadmins pedidos: hbnoboa, viviane, paulo (ios-risk) -> PLATFORM_ADMIN.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 0. SCHEMA (aditivo, seguro, idempotente)
-- ---------------------------------------------------------------------------
ALTER TABLE "CustomRole"       ADD COLUMN IF NOT EXISTS "rank"      INTEGER;
ALTER TABLE "CustomRole"       ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP;
ALTER TABLE "UserTenantAccess" ADD COLUMN IF NOT EXISTS "isPrimary" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "UserTenantAccess" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP;

-- ---------------------------------------------------------------------------
-- 1. BACKFILL de membership a partir do modelo antigo (User.tenantId/customRoleId)
--    Cria UserTenantAccess para todo user que ainda não tem no seu tenant "home".
-- ---------------------------------------------------------------------------
INSERT INTO "UserTenantAccess" (id, "userId", "tenantId", "customRoleId", status, "isPrimary", "grantedAt", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, u.id, u."tenantId", u."customRoleId", 'ACTIVE', true, now(), now(), now()
FROM "User" u
WHERE u."tenantId" IS NOT NULL AND u."customRoleId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "UserTenantAccess" a WHERE a."userId" = u.id AND a."tenantId" = u."tenantId"
  );

-- Garante exatamente 1 primary por usuário: prioriza o tenant "home" (User.tenantId).
UPDATE "UserTenantAccess" a
SET "isPrimary" = (a."tenantId" = u."tenantId")
FROM "User" u
WHERE u.id = a."userId" AND u."tenantId" IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. RANK por roleType (menor = mais poder)
-- ---------------------------------------------------------------------------
UPDATE "CustomRole" SET "rank" = CASE "roleType"
  WHEN 'PLATFORM_ADMIN' THEN 1
  WHEN 'ADMIN'          THEN 10
  WHEN 'MANAGER'        THEN 30
  WHEN 'USER'           THEN 50
  WHEN 'VIEWER'         THEN 70
  WHEN 'CUSTOM'         THEN 50
  ELSE 90
END
WHERE "rank" IS NULL;

-- ---------------------------------------------------------------------------
-- 3. allAccess nos ADMINs de TENANT (acesso total dentro do tenant, sem plataforma).
--    Observação: os ADMIN que viram SUPERADMIN (Viviane/Paulo) são tratados no passo 5,
--    então aqui allAccess neles é inofensivo (serão sobrescritos p/ plataforma).
-- ---------------------------------------------------------------------------
UPDATE "CustomRole"
SET "modulePermissions" = jsonb_set(COALESCE("modulePermissions", '{}'::jsonb), '{allAccess}', 'true'::jsonb, true)
WHERE "roleType" = 'ADMIN'
  AND COALESCE("modulePermissions" ->> 'allAccess', 'false') <> 'true';

-- ---------------------------------------------------------------------------
-- 4. PLATFORM nos cargos PLATFORM_ADMIN (tier -> permission-driven).
--    Marca platform.* para o motor novo reconhecer poder de plataforma.
-- ---------------------------------------------------------------------------
UPDATE "CustomRole"
SET "modulePermissions" = jsonb_set(
      COALESCE("modulePermissions", '{}'::jsonb),
      '{platform}',
      '{"crossTenant": true, "impersonateAny": true, "manageTenants": true}'::jsonb,
      true)
WHERE "roleType" = 'PLATFORM_ADMIN';

-- ---------------------------------------------------------------------------
-- 5. SUPERADMINS: hbnoboa, viviane, paulo (ios-risk) -> cargo "Super Admin" (PLATFORM_ADMIN).
--    Aponta User.customRoleId E a membership para o role Super Admin (cmli1g12100014hslvbgvb21h).
--    Henrique já está; Viviane/Paulo sobem de ADMIN.
-- ---------------------------------------------------------------------------
WITH sa AS (
  SELECT r.id AS role_id FROM "CustomRole" r
  WHERE r."roleType" = 'PLATFORM_ADMIN' AND r.name = 'Super Admin'
  LIMIT 1
), targets AS (
  SELECT u.id AS user_id FROM "User" u
  WHERE u.email IN ('hbnoboa@iosrisk.com.br', 'viviane@iosrisk.com.br', 'noboa@iosrisk.com.br')
)
UPDATE "User" u SET "customRoleId" = (SELECT role_id FROM sa)
FROM targets WHERE u.id = targets.user_id;

WITH sa AS (
  SELECT r.id AS role_id FROM "CustomRole" r
  WHERE r."roleType" = 'PLATFORM_ADMIN' AND r.name = 'Super Admin' LIMIT 1
), targets AS (
  SELECT u.id AS user_id FROM "User" u
  WHERE u.email IN ('hbnoboa@iosrisk.com.br', 'viviane@iosrisk.com.br', 'noboa@iosrisk.com.br')
)
UPDATE "UserTenantAccess" a SET "customRoleId" = (SELECT role_id FROM sa)
FROM targets WHERE a."userId" = targets.user_id;

-- ---------------------------------------------------------------------------
-- DRY-RUN: confira ANTES de commitar
-- ---------------------------------------------------------------------------
\echo '--- cargos: rank + allAccess + platform ---'
SELECT t.slug, r.name, r."roleType", r."rank",
       (r."modulePermissions" ->> 'allAccess') AS all_access,
       (r."modulePermissions" -> 'platform') IS NOT NULL AS has_platform
FROM "CustomRole" r JOIN "Tenant" t ON t.id = r."tenantId"
WHERE t.slug IN ('ios-risk','jbs','nexus') ORDER BY t.slug, r."rank";

\echo '--- superadmins pedidos ---'
SELECT u.email, cr.name AS cargo, cr."roleType", cr."rank"
FROM "User" u LEFT JOIN "CustomRole" cr ON cr.id = u."customRoleId"
WHERE u.email IN ('hbnoboa@iosrisk.com.br','viviane@iosrisk.com.br','noboa@iosrisk.com.br');

\echo '--- cobertura de membership (users sem membership no seu tenant home) ---'
SELECT count(*) AS users_sem_membership_home
FROM "User" u
WHERE u."tenantId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "UserTenantAccess" a WHERE a."userId"=u.id AND a."tenantId"=u."tenantId");

-- Revise os resultados acima. Se OK:  COMMIT;   senão:  ROLLBACK;
ROLLBACK;
-- ============================================================================
