-- Substitui o trigger sincrono pesado de visibilidade por-cargo por um recompute
-- ASYNC + INCREMENTAL dirigido pela app (tabela outbox + consumidor @nestjs/schedule).
--
-- Motivacao: trg_custom_role_permissions recomputava O(6 x linhas x cargos) DENTRO
-- da request, ao salvar um cargo. Com volume de dados isso passava de 60s -> 504 no
-- proxy, e pior: o Postgres commitava depois (nao-atomico do ponto de vista do cliente).
--
-- Os triggers POR-LINHA do EntityData continuam (baratos): mantem a visibilidade fresca
-- no write de registro e ja cascateiam pros filhos (trg_entity_data_propagate_visible_roles).
-- Removemos apenas o fan-out sincrono na edicao de cargo.

-- 1) Remove o trigger sincrono e sua funcao.
DROP TRIGGER IF EXISTS trg_custom_role_permissions ON "CustomRole";
DROP FUNCTION IF EXISTS trg_custom_role_permissions_update();

-- 2) Outbox duravel. A app insere aqui NA MESMA transacao do update do cargo
--    (enqueue transacional = exactly-once, sem dual-write).
CREATE TABLE IF NOT EXISTS "visibility_recompute" (
  id          BIGSERIAL PRIMARY KEY,
  "tenantId"  TEXT NOT NULL,
  "entitySlug" TEXT NOT NULL,
  cursor      TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3) Recompute em LOTE de uma entidade, keyset por id. Os filhos cascateiam sozinhos
--    via trg_entity_data_propagate_visible_roles (AFTER UPDATE em EntityData).
--    Retorna o ultimo id processado e a contagem do lote.
CREATE OR REPLACE FUNCTION recompute_visibility_batch(
  p_tenant TEXT,
  p_entity_id TEXT,
  p_after TEXT,
  p_limit INT,
  OUT last_id TEXT,
  OUT n INT
) AS $$
BEGIN
  WITH sub AS (
    SELECT b.id, v.all_roles, v.own_roles
    FROM (
      SELECT id, "tenantId", "entityId", data, "parentRecordId"
      FROM "EntityData"
      WHERE "entityId" = p_entity_id
        AND "tenantId" = p_tenant
        AND id > p_after
      ORDER BY id
      LIMIT p_limit
    ) b
    CROSS JOIN LATERAL calc_record_visibility(
      b."tenantId", b."entityId", b.data::jsonb, b."parentRecordId"
    ) v
  ),
  upd AS (
    UPDATE "EntityData" ed
    SET
      "_visibleToRoles"        = sub.all_roles,
      "_hasRoleFilter"         = (sub.all_roles IS NOT NULL),
      "_visibleToRolesJson"    = CASE WHEN sub.all_roles IS NULL
                                      THEN '[]'::jsonb
                                      ELSE to_jsonb(sub.all_roles) END,
      "_visibleToRolesOwnJson" = to_jsonb(sub.own_roles)
    FROM sub
    WHERE ed.id = sub.id
    RETURNING ed.id
  )
  SELECT COALESCE(max(id), p_after), COALESCE(count(*), 0)::int
  INTO last_id, n
  FROM upd;
END;
$$ LANGUAGE plpgsql;
