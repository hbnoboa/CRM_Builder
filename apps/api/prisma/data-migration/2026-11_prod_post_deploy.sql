-- Depois do schema alinhado ao baseline e da API nova no ar: recalcula a visibilidade
-- do app de celular (PowerSync) de todas as tabelas com as regras novas. O job
-- visibility-recompute da API consome a fila em lotes.
INSERT INTO "visibility_recompute" ("tenantId", "entitySlug")
SELECT e."tenantId", e.slug FROM "Entity" e
WHERE e."deletedAt" IS NULL
  AND NOT EXISTS (SELECT 1 FROM "visibility_recompute" v WHERE v."tenantId" = e."tenantId" AND v."entitySlug" = e.slug);
SELECT count(*) AS tabelas_na_fila FROM "visibility_recompute";
