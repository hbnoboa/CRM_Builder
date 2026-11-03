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
-- Superadmins (hbnoboa, viviane, paulo): viram equipe do console (pnpm platform:create-owner),
-- nao cargo de empresa.
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
-- 4. PLATFORM_ADMIN vira acesso total DENTRO da propria empresa (sem platform.*):
-- poder entre empresas agora so existe no console da plataforma (PlatformStaff).
-- A equipe IOS entra nos clientes pelo console ("Entrar como"), nao por cargo.
UPDATE "CustomRole"
SET "modulePermissions" = jsonb_set(COALESCE("modulePermissions", '{}'::jsonb), '{allAccess}', 'true'::jsonb, true)
WHERE "roleType" = 'PLATFORM_ADMIN';

-- ---------------------------------------------------------------------------
-- DRY-RUN: confira ANTES de commitar
-- ---------------------------------------------------------------------------
\echo '--- cargos: rank + allAccess + platform ---'
SELECT t.slug, r.name, r."roleType", r."rank",
       (r."modulePermissions" ->> 'allAccess') AS all_access,
       (r."modulePermissions" -> 'platform') IS NOT NULL AS has_platform  -- deve ser sempre false
FROM "CustomRole" r JOIN "Tenant" t ON t.id = r."tenantId"
WHERE t.slug IN ('ios-risk','jbs','nexus') ORDER BY t.slug, r."rank";

\echo '--- equipe IOS (cargo na propria empresa) ---'
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
