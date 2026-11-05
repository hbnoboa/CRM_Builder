-- Poder de plataforma sai das empresas (agora so a equipe do console /admin tem) e
-- cada empresa ganha um dono. Idempotente: pode rodar de novo sem efeito.

-- 1. Dono da empresa
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "ownerId" TEXT;
DO $$ BEGIN
  ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "Tenant_ownerId_idx" ON "Tenant"("ownerId");

-- 2. Membership com cargo de OUTRA empresa so existia para o Super Admin alcancar
--    todos os clientes. Sai: a equipe entra pelo console ("Entrar como").
DELETE FROM "UserTenantAccess" a
USING "CustomRole" r
WHERE r."id" = a."customRoleId" AND r."tenantId" <> a."tenantId";

-- Cada usuario com membership continua com exatamente uma primaria.
UPDATE "UserTenantAccess" a SET "isPrimary" = true
FROM (
  SELECT DISTINCT ON ("userId") "id" FROM "UserTenantAccess"
  WHERE "deletedAt" IS NULL
    AND "userId" NOT IN (SELECT "userId" FROM "UserTenantAccess" WHERE "isPrimary" AND "deletedAt" IS NULL)
  ORDER BY "userId", "createdAt"
) first
WHERE a."id" = first."id";

-- 3. Cargos: sai platform.* e o modulo "tenants". Quem tinha platform.crossTenant
--    vira acesso total dentro da propria empresa. permsVersion invalida tokens antigos.
UPDATE "CustomRole"
SET "modulePermissions" =
      (("modulePermissions"::jsonb - 'platform') - 'tenants')
      || CASE WHEN ("modulePermissions"::jsonb -> 'platform' ->> 'crossTenant') = 'true'
              THEN '{"allAccess": true}'::jsonb ELSE '{}'::jsonb END,
    "permsVersion" = "permsVersion" + 1
WHERE "modulePermissions"::jsonb ? 'platform' OR "modulePermissions"::jsonb ? 'tenants';

-- 4. Dono inicial: o membro ativo de acesso total mais alto (menor rank) e mais antigo.
UPDATE "Tenant" t SET "ownerId" = x."userId"
FROM (
  SELECT DISTINCT ON (a."tenantId") a."tenantId", a."userId"
  FROM "UserTenantAccess" a
  JOIN "CustomRole" r ON r."id" = a."customRoleId"
  JOIN "User" u ON u."id" = a."userId"
  WHERE a."status" = 'ACTIVE' AND a."deletedAt" IS NULL
    AND u."status" = 'ACTIVE' AND u."deletedAt" IS NULL
    AND r."deletedAt" IS NULL
    AND (r."modulePermissions"::jsonb ->> 'allAccess') = 'true'
  ORDER BY a."tenantId", r."rank", a."createdAt"
) x
WHERE t."id" = x."tenantId" AND t."ownerId" IS NULL;
