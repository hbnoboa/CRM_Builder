-- Historico comercial das empresas (base das metricas do console).
CREATE TABLE IF NOT EXISTS "TenantLifecycleEvent" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "from" "TenantLifecycle",
  "to" "TenantLifecycle" NOT NULL,
  "source" TEXT NOT NULL,
  "staffId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TenantLifecycleEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "TenantLifecycleEvent_createdAt_idx" ON "TenantLifecycleEvent"("createdAt");
CREATE INDEX IF NOT EXISTS "TenantLifecycleEvent_tenantId_idx" ON "TenantLifecycleEvent"("tenantId");
DO $$ BEGIN
  ALTER TABLE "TenantLifecycleEvent" ADD CONSTRAINT "TenantLifecycleEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Reconstroi o passado (so roda se a tabela estiver vazia).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "TenantLifecycleEvent") THEN RETURN; END IF;

  -- 1) Mudancas feitas pelo console (auditoria).
  INSERT INTO "TenantLifecycleEvent" ("id", "tenantId", "from", "to", "source", "staffId", "createdAt")
  SELECT 'bf_' || a."id", a."tenantId",
         (a."metadata"->>'from')::"TenantLifecycle", (a."metadata"->>'to')::"TenantLifecycle",
         'console', a."staffId", a."createdAt"
  FROM "PlatformAuditLog" a
  JOIN "Tenant" t ON t."id" = a."tenantId"
  WHERE a."action" = 'tenant.lifecycle_changed'
    AND a."metadata"->>'to' IS NOT NULL
    AND a."metadata"->>'from' IS DISTINCT FROM a."metadata"->>'to';

  -- 2) Teste vencido (a rotina diaria nao deixava rastro): suspensa, com teste ja
  --    vencido e sem mudanca registrada depois do vencimento.
  INSERT INTO "TenantLifecycleEvent" ("id", "tenantId", "from", "to", "source", "createdAt")
  SELECT 'bft_' || t."id", t."id", 'TRIAL', 'SUSPENDED', 'trial_expired', t."trialEndsAt"
  FROM "Tenant" t
  WHERE t."lifecycle" = 'SUSPENDED' AND t."trialEndsAt" IS NOT NULL AND t."trialEndsAt" < now()
    AND NOT EXISTS (
      SELECT 1 FROM "TenantLifecycleEvent" e WHERE e."tenantId" = t."id" AND e."createdAt" >= t."trialEndsAt"
    );

  -- 3) Criacao: situacao inicial = "from" da primeira mudanca conhecida, senao a atual.
  INSERT INTO "TenantLifecycleEvent" ("id", "tenantId", "from", "to", "source", "createdAt")
  SELECT 'bfc_' || t."id", t."id", NULL,
         COALESCE(
           (SELECT e."from" FROM "TenantLifecycleEvent" e WHERE e."tenantId" = t."id" ORDER BY e."createdAt" LIMIT 1),
           t."lifecycle"
         ),
         CASE WHEN EXISTS (
           SELECT 1 FROM "PlatformAuditLog" a WHERE a."tenantId" = t."id" AND a."action" = 'tenant.created'
         ) THEN 'console' ELSE 'signup' END,
         t."createdAt"
  FROM "Tenant" t;
END $$;
