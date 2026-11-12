-- ============================================================================
-- Complemento do rollout de prod (codigo de develop em cima do banco antigo).
-- Cobre o que 2026-07_redesign_rollout.sql NAO faz. Rodar DEPOIS das etapas A e B
-- do rollout e ANTES da etapa C (aqui ainda se usa "roleType" e "User"."tenantId").
-- Idempotente; nao apaga registro. Termina em ROLLBACK: troque por COMMIT so depois
-- de conferir as contagens no ensaio (copia de prod).
-- ============================================================================
BEGIN;

-- 0) Coluna do dono (nao existe no banco antigo; o alinhamento com o baseline depois
--    acrescenta indice e chave estrangeira)
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "ownerId" TEXT;

-- 1) Cargos MANAGER/USER/VIEWER: no codigo antigo viam todas as tabelas pelo tipo do
--    cargo; no novo so vale permissions[]. Ganham a entrada coringa '*' equivalente
--    (mesma regra dos cargos padrao). Entradas por tabela que ja existem continuam e
--    passam a valer: listadas no relatorio 1b para conferencia.
UPDATE "CustomRole" r
SET permissions = jsonb_build_array(
      CASE r."roleType"
        WHEN 'MANAGER' THEN '{"entitySlug":"*","scope":"all","canRead":true,"canCreate":true,"canUpdate":true,"canDelete":true,"canExport":true,"canImport":false}'::jsonb
        WHEN 'USER'    THEN '{"entitySlug":"*","scope":"own","canRead":true,"canCreate":true,"canUpdate":true,"canDelete":false,"canExport":false,"canImport":false}'::jsonb
        ELSE                '{"entitySlug":"*","scope":"all","canRead":true,"canCreate":false,"canUpdate":false,"canDelete":false,"canExport":false,"canImport":false}'::jsonb
      END) || CASE WHEN jsonb_typeof(r.permissions::jsonb) = 'array' THEN r.permissions::jsonb ELSE '[]'::jsonb END
WHERE r."roleType" IN ('MANAGER', 'USER', 'VIEWER')
  AND NOT (jsonb_typeof(r.permissions::jsonb) = 'array'
           AND jsonb_path_exists(r.permissions::jsonb, '$[*] ? (@.entitySlug == "*")'));

-- 1b) Relatorio: cargos com regras por tabela (passam a valer; antes eram ignoradas)
SELECT t.slug AS empresa, r.name AS cargo, r."roleType", jsonb_array_length(r.permissions::jsonb) - 1 AS regras_por_tabela
FROM "CustomRole" r JOIN "Tenant" t ON t.id = r."tenantId"
WHERE r."roleType" IN ('MANAGER', 'USER', 'VIEWER') AND jsonb_array_length(r.permissions::jsonb) > 1;

-- 2) Admins (ADMIN/PLATFORM_ADMIN) tambem com o coringa: o app de celular so le permissions[]
UPDATE "CustomRole" r
SET permissions = '[{"entitySlug":"*","scope":"all","canRead":true,"canCreate":true,"canUpdate":true,"canDelete":true,"canExport":true,"canImport":true,"canConfigureColumns":true}]'::jsonb
    || CASE WHEN jsonb_typeof(r.permissions::jsonb) = 'array' THEN r.permissions::jsonb ELSE '[]'::jsonb END
WHERE r."roleType" IN ('ADMIN', 'PLATFORM_ADMIN')
  AND NOT (jsonb_typeof(r.permissions::jsonb) = 'array'
           AND jsonb_path_exists(r.permissions::jsonb, '$[*] ? (@.entitySlug == "*")'));

-- 3) Escopo fora de all/own/team/client: no codigo antigo valia "todos". Mantem "todos"
--    (a API nova recusaria salvar o cargo com o valor antigo).
UPDATE "CustomRole" r
SET permissions = (
  SELECT jsonb_agg(CASE WHEN p ? 'scope' AND p->>'scope' NOT IN ('all', 'own', 'team', 'client')
                        THEN jsonb_set(p, '{scope}', '"all"') ELSE p END)
  FROM jsonb_array_elements(r.permissions::jsonb) p)
WHERE jsonb_typeof(r.permissions::jsonb) = 'array'
  AND jsonb_path_exists(r.permissions::jsonb, '$[*] ? (@.scope != "all" && @.scope != "own" && @.scope != "team" && @.scope != "client")');

-- 4) Dono da empresa (Tenant.ownerId): o primeiro admin ativo de cada empresa sem dono
UPDATE "Tenant" t
SET "ownerId" = sub."userId"
FROM (
  SELECT DISTINCT ON (a."tenantId") a."tenantId", a."userId"
  FROM "UserTenantAccess" a
  JOIN "CustomRole" r ON r.id = a."customRoleId"
  JOIN "User" u ON u.id = a."userId"
  WHERE r."roleType" IN ('ADMIN', 'PLATFORM_ADMIN') AND a.status = 'ACTIVE' AND u.status = 'ACTIVE'
  ORDER BY a."tenantId", u."createdAt"
) sub
WHERE t.id = sub."tenantId" AND t."ownerId" IS NULL;

-- 4b) Relatorio: empresas que continuam sem dono (definir pelo console)
SELECT id, slug, name FROM "Tenant" WHERE "ownerId" IS NULL;

-- 5) Cargo padrao (quem perde o cargo cai nele): empresa sem nenhum ganha o cargo USER
--    mais antigo; sem USER, o de maior rank (menos poder) que nao seja admin.
UPDATE "CustomRole" r SET "isDefault" = true
FROM (
  SELECT DISTINCT ON (c."tenantId") c.id
  FROM "CustomRole" c
  WHERE NOT EXISTS (SELECT 1 FROM "CustomRole" d WHERE d."tenantId" = c."tenantId" AND d."isDefault")
    AND c."roleType" NOT IN ('ADMIN', 'PLATFORM_ADMIN')
  ORDER BY c."tenantId", (c."roleType" = 'USER') DESC, c."rank" DESC, c."createdAt"
) pick
WHERE r.id = pick.id;

-- 5b) Relatorio: empresas ainda sem cargo padrao
SELECT t.id, t.slug FROM "Tenant" t
WHERE NOT EXISTS (SELECT 1 FROM "CustomRole" r WHERE r."tenantId" = t.id AND r."isDefault");

-- Contagens para conferir antes de trocar ROLLBACK por COMMIT
SELECT 'cargos sem coringa' AS item, count(*) FROM "CustomRole"
WHERE NOT (jsonb_typeof(permissions::jsonb) = 'array' AND jsonb_path_exists(permissions::jsonb, '$[*] ? (@.entitySlug == "*")'))
  AND "roleType" <> 'CUSTOM'
UNION ALL SELECT 'empresas sem dono', count(*) FROM "Tenant" WHERE "ownerId" IS NULL;

ROLLBACK;
