-- Checagem SO DE LEITURA de producao ANTES do deploy de develop (PRs #31-#70).
-- Producao ainda esta no modelo antigo (User.tenantId, User.customRoleId, CustomRole.roleType).
-- Rodar ANTES de qualquer script de migracao de dados. Nada aqui altera dados.
-- Origem: revisao do codigo main..develop (nao testado no schema antigo: se alguma consulta
-- reclamar de coluna inexistente, ela so vale depois da etapa A do rollout).
BEGIN TRANSACTION READ ONLY;

-- A1) Usuarios sem acesso (membership) na propria empresa: no codigo novo nao entram (401)
SELECT u.id, u.email, u."tenantId" FROM "User" u
WHERE u."tenantId" IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM "UserTenantAccess" a WHERE a."userId" = u.id AND a."tenantId" = u."tenantId");

-- A1b) Acesso apontando para cargo de OUTRA empresa
SELECT a.id, a."userId", a."tenantId", r."tenantId" AS empresa_do_cargo
FROM "UserTenantAccess" a JOIN "CustomRole" r ON r.id = a."customRoleId"
WHERE r."tenantId" <> a."tenantId";

-- A2) Cargos MANAGER/USER/VIEWER sem entrada '*': no codigo novo deixam de ver as tabelas
SELECT r.id, r."tenantId", r.name, r."roleType" FROM "CustomRole" r
WHERE r."roleType" IN ('MANAGER', 'USER', 'VIEWER')
  AND NOT (jsonb_typeof(r.permissions::jsonb) = 'array'
           AND jsonb_path_exists(r.permissions::jsonb, '$[*] ? (@.entitySlug == "*" && @.canRead == true)'));

-- A3) Varios cargos/pessoas admin na mesma empresa (regra de nivel: iguais nao se gerenciam)
SELECT "tenantId", "roleType", count(*) FROM "CustomRole"
WHERE "roleType" IN ('ADMIN', 'PLATFORM_ADMIN') GROUP BY 1, 2 HAVING count(*) > 1;

-- A4) Candidato a dono de cada empresa (Tenant.ownerId nao existe no antigo; nada preenche)
SELECT t.id, t.slug,
  (SELECT u.email FROM "User" u JOIN "CustomRole" r ON r.id = u."customRoleId"
   WHERE u."tenantId" = t.id AND r."roleType" IN ('ADMIN', 'PLATFORM_ADMIN')
   ORDER BY u."createdAt" LIMIT 1) AS dono_sugerido
FROM "Tenant" t ORDER BY t.slug;

-- A5) Poderes entre empresas no JSON antigo (somem; equipe vai para o console da plataforma)
SELECT r.id, r."tenantId", r.name, r."roleType" FROM "CustomRole" r
WHERE r."roleType" = 'PLATFORM_ADMIN'
   OR r."tenantPermissions"::jsonb ? 'canAccessAllTenants'
   OR r."tenantPermissions"::jsonb ? 'allowedTenantIds'
   OR r."modulePermissions"::jsonb ?| array['platform', 'tenants'];

-- A6) Escopo de cargo fora de all/own/team/client (editar o cargo passa a dar erro)
SELECT r.id, r."tenantId", r.name, p->>'entitySlug' AS tabela, p->>'scope' AS escopo
FROM "CustomRole" r,
     jsonb_array_elements(CASE WHEN jsonb_typeof(r.permissions::jsonb) = 'array' THEN r.permissions::jsonb ELSE '[]' END) p
WHERE p ? 'scope' AND p->>'scope' NOT IN ('all', 'own', 'team', 'client');

-- A7) Empresa sem cargo padrao (tirar cargo de alguem passa a falhar)
SELECT t.id, t.slug FROM "Tenant" t
WHERE NOT EXISTS (SELECT 1 FROM "CustomRole" r WHERE r."tenantId" = t.id AND r."isDefault");

-- A8) E-mail/CPF/telefone repetidos entre empresas (o rollout cria indice unico global e falha)
SELECT email, count(*), array_agg("tenantId") FROM "User" GROUP BY email HAVING count(*) > 1;
SELECT cpf, count(*) FROM "User" WHERE cpf IS NOT NULL GROUP BY cpf HAVING count(*) > 1;
SELECT phone, count(*) FROM "User" WHERE phone IS NOT NULL GROUP BY phone HAVING count(*) > 1;

-- B1) Automacoes que mudam: send_email passa a enviar de verdade; run_script passa a falhar
SELECT a.id, a."tenantId", a.name, x->>'type' AS acao
FROM "EntityAutomation" a, jsonb_array_elements(a.actions::jsonb) x
WHERE a."isActive" AND x->>'type' IN ('send_email', 'run_script');

-- B2) Automacoes "dormentes" que passam a rodar (operadores equals/greater/less... agora valem)
SELECT id, "tenantId", name FROM "EntityAutomation"
WHERE "isActive" AND jsonb_path_exists(COALESCE(conditions::jsonb, '[]'),
  '$[*] ? (@.operator=="equals"||@.operator=="not_equals"||@.operator=="greater"||@.operator=="greater_than"||@.operator=="less"||@.operator=="less_than")');

-- B3) Webhooks globais (passam a disparar para todas as tabelas) ou para endereco interno (bloqueado)
SELECT id, "tenantId", url, "entityId" FROM "Webhook"
WHERE status = 'ACTIVE' AND ("entityId" IS NULL
  OR url ~* '^https?://(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.|169\.254\.)');

-- B4) Paineis sem cargo definido (passam a aparecer para todos os cargos)
SELECT id, "tenantId", name, "entitySlug" FROM "DashboardTemplate" WHERE cardinality("roleIds") = 0;

-- C1) Campos com valor padrao (passam a ser aplicados pelo servidor ao criar registro)
SELECT e."tenantId", e.slug, f->>'slug' AS campo, f->>'type' AS tipo, f->'default' AS padrao
FROM "Entity" e, jsonb_array_elements(e.fields::jsonb) f
WHERE f ? 'default' AND f->'default' NOT IN ('null'::jsonb, '""'::jsonb);

-- C2) Funcoes do banco que citam roleType (se a coluna cair com elas no lugar, toda gravacao falha)
SELECT proname FROM pg_proc WHERE prosrc ILIKE '%roleType%';

-- C3) Registros ja na lixeira (passam a aparecer na Lixeira e podem ser restaurados)
SELECT "tenantId", count(*) FROM "EntityData" WHERE "deletedAt" IS NOT NULL GROUP BY 1;

ROLLBACK;
