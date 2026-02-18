-- CreateEnum
CREATE TYPE "ReportVisibility" AS ENUM ('PRIVATE', 'TEAM', 'ORGANIZATION', 'PUBLIC');

-- CreateEnum
CREATE TYPE "TenantScope" AS ENUM ('CURRENT', 'ALL', 'SELECTED');

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "color" TEXT,
    "components" JSONB NOT NULL DEFAULT '[]',
    "layoutConfig" JSONB,
    "createdById" TEXT NOT NULL,
    "visibility" "ReportVisibility" NOT NULL DEFAULT 'PRIVATE',
    "sharedWith" JSONB,
    "tenantScope" "TenantScope" NOT NULL DEFAULT 'CURRENT',
    "selectedTenants" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "showInDashboard" BOOLEAN NOT NULL DEFAULT false,
    "dashboardOrder" INTEGER NOT NULL DEFAULT 0,
    "schedule" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateIndex para dashboard
CREATE INDEX "Report_showInDashboard_idx" ON "Report"("showInDashboard") WHERE "showInDashboard" = true;

-- CreateIndex
CREATE INDEX "Report_tenantId_idx" ON "Report"("tenantId");

-- CreateIndex
CREATE INDEX "Report_createdById_idx" ON "Report"("createdById");

-- CreateIndex
CREATE INDEX "Report_visibility_idx" ON "Report"("visibility");

-- CreateIndex
CREATE INDEX "Report_tenantId_visibility_idx" ON "Report"("tenantId", "visibility");

-- CreateIndex
CREATE INDEX "Report_tenantId_createdById_idx" ON "Report"("tenantId", "createdById");

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ═══════════════════════════════════════════════════════════════════════════
-- MATERIALIZED VIEWS (Camada Analitica - NAO afeta PowerSync)
-- ═══════════════════════════════════════════════════════════════════════════

-- Materialized View: Estatisticas por Tenant
-- Usado pelo Platform Admin para visao geral de todos tenants
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_tenant_analytics AS
SELECT
  t.id as tenant_id,
  t.name as tenant_name,
  t.slug as tenant_slug,
  t.status as tenant_status,
  t."createdAt" as tenant_created_at,
  COUNT(DISTINCT u.id) as total_users,
  COUNT(DISTINCT u.id) FILTER (WHERE u."lastLoginAt" > NOW() - INTERVAL '30 days') as active_users_30d,
  COUNT(DISTINCT u.id) FILTER (WHERE u."lastLoginAt" > NOW() - INTERVAL '7 days') as active_users_7d,
  COUNT(DISTINCT e.id) as total_entities,
  COUNT(DISTINCT ed.id) FILTER (WHERE ed."deletedAt" IS NULL) as total_records,
  COUNT(DISTINCT ed.id) FILTER (WHERE ed."createdAt" > NOW() - INTERVAL '7 days' AND ed."deletedAt" IS NULL) as new_records_7d,
  COUNT(DISTINCT p.id) as total_pages,
  COUNT(DISTINCT p.id) FILTER (WHERE p."isPublished" = true) as published_pages,
  COUNT(DISTINCT ce.id) as total_custom_endpoints,
  COUNT(DISTINCT ce.id) FILTER (WHERE ce."isActive" = true) as active_endpoints,
  COUNT(DISTINCT cr.id) as total_roles,
  NOW() as refreshed_at
FROM "Tenant" t
LEFT JOIN "User" u ON u."tenantId" = t.id AND u.status = 'ACTIVE'
LEFT JOIN "Entity" e ON e."tenantId" = t.id
LEFT JOIN "EntityData" ed ON ed."tenantId" = t.id
LEFT JOIN "Page" p ON p."tenantId" = t.id
LEFT JOIN "CustomEndpoint" ce ON ce."tenantId" = t.id
LEFT JOIN "CustomRole" cr ON cr."tenantId" = t.id
WHERE t.status = 'ACTIVE'
GROUP BY t.id, t.name, t.slug, t.status, t."createdAt";

-- Index unico para permitir REFRESH CONCURRENTLY
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_tenant_analytics_id
ON mv_tenant_analytics(tenant_id);

-- Materialized View: Registros ao longo do tempo (ultimos 90 dias)
-- Agrega por dia para evitar queries pesadas
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_records_over_time AS
SELECT
  tenant_id,
  entity_id,
  date_trunc('day', "createdAt") as record_date,
  COUNT(*) as records_created,
  COUNT(*) FILTER (WHERE "deletedAt" IS NOT NULL) as records_deleted
FROM "EntityData"
WHERE "createdAt" > NOW() - INTERVAL '90 days'
GROUP BY tenant_id, entity_id, date_trunc('day', "createdAt");

-- Indexes para queries eficientes
CREATE INDEX IF NOT EXISTS idx_mv_records_over_time_tenant
ON mv_records_over_time(tenant_id, record_date DESC);

CREATE INDEX IF NOT EXISTS idx_mv_records_over_time_entity
ON mv_records_over_time(tenant_id, entity_id, record_date DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_records_over_time_pk
ON mv_records_over_time(tenant_id, entity_id, record_date);

-- Materialized View: Distribuicao por Entidade
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_entity_distribution AS
SELECT
  ed."tenantId" as tenant_id,
  e.id as entity_id,
  e.name as entity_name,
  e.slug as entity_slug,
  e.icon as entity_icon,
  e.color as entity_color,
  COUNT(ed.id) FILTER (WHERE ed."deletedAt" IS NULL) as total_records,
  COUNT(ed.id) FILTER (WHERE ed."createdAt" > NOW() - INTERVAL '7 days' AND ed."deletedAt" IS NULL) as new_records_7d,
  COUNT(ed.id) FILTER (WHERE ed."createdAt" > NOW() - INTERVAL '30 days' AND ed."deletedAt" IS NULL) as new_records_30d,
  MAX(ed."createdAt") as last_record_at,
  NOW() as refreshed_at
FROM "Entity" e
LEFT JOIN "EntityData" ed ON ed."entityId" = e.id
GROUP BY ed."tenantId", e.id, e.name, e.slug, e.icon, e.color;

-- Index unico para REFRESH CONCURRENTLY
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_entity_distribution_pk
ON mv_entity_distribution(tenant_id, entity_id);

CREATE INDEX IF NOT EXISTS idx_mv_entity_distribution_tenant
ON mv_entity_distribution(tenant_id);

-- Materialized View: Atividade de Usuarios
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_user_activity AS
SELECT
  u."tenantId" as tenant_id,
  u.id as user_id,
  u.name as user_name,
  u.email as user_email,
  u.avatar as user_avatar,
  u."lastLoginAt" as last_login_at,
  COUNT(DISTINCT ed.id) FILTER (WHERE ed."createdById" = u.id AND ed."deletedAt" IS NULL) as total_records_created,
  COUNT(DISTINCT ed.id) FILTER (WHERE ed."createdById" = u.id AND ed."createdAt" > NOW() - INTERVAL '7 days' AND ed."deletedAt" IS NULL) as records_created_7d,
  COUNT(DISTINCT ed.id) FILTER (WHERE ed."updatedById" = u.id AND ed."deletedAt" IS NULL) as total_records_updated,
  NOW() as refreshed_at
FROM "User" u
LEFT JOIN "EntityData" ed ON ed."tenantId" = u."tenantId"
  AND (ed."createdById" = u.id OR ed."updatedById" = u.id)
WHERE u.status = 'ACTIVE'
GROUP BY u."tenantId", u.id, u.name, u.email, u.avatar, u."lastLoginAt";

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_user_activity_pk
ON mv_user_activity(tenant_id, user_id);

CREATE INDEX IF NOT EXISTS idx_mv_user_activity_tenant
ON mv_user_activity(tenant_id);

CREATE INDEX IF NOT EXISTS idx_mv_user_activity_last_login
ON mv_user_activity(tenant_id, last_login_at DESC NULLS LAST);

-- ═══════════════════════════════════════════════════════════════════════════
-- FUNCAO: Refresh das Materialized Views
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION refresh_analytics_views()
RETURNS void AS $$
BEGIN
  -- CONCURRENTLY permite leitura durante refresh
  -- Requer indice UNIQUE na view
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_tenant_analytics;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_entity_distribution;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_user_activity;

  -- records_over_time nao precisa de CONCURRENTLY (rapido)
  REFRESH MATERIALIZED VIEW mv_records_over_time;

  RAISE NOTICE 'Analytics views refreshed at %', NOW();
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════════════════
-- NOTA: pg_cron scheduling (executar manualmente se pg_cron estiver instalado)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Para habilitar refresh automatico a cada 5 minutos:
--
-- SELECT cron.schedule('refresh-analytics', '*/5 * * * *', 'SELECT refresh_analytics_views()');
--
-- Para verificar jobs agendados:
-- SELECT * FROM cron.job;
--
-- Para remover job:
-- SELECT cron.unschedule('refresh-analytics');
--
-- ═══════════════════════════════════════════════════════════════════════════
