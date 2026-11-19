-- Dados das 3 migrations que entraram depois da ultima aplicada em prod e foram
-- absorvidas pelo baseline (message_recipient, masked_entity_data, chat_cards_hidden_fields).
-- O `migrate diff` cria as tabelas/colunas e o 2026-11_funcoes_baseline.sql as funcoes e
-- triggers, mas nenhum dos dois preenche dados nem mexe na publicacao do PowerSync.
-- Rodar depois do passo 8 do ROLLOUT-PROD.md. Reaplicavel.

-- ── message_recipient: historico do chat passa a ser so de quem pediu ─────
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "recipientId" TEXT;
CREATE INDEX IF NOT EXISTS "Message_recipientId_idx" ON "Message"("recipientId");

-- Historico: o que ja foi gerado assim passa a ser so de quem pediu.
UPDATE "Message" SET "recipientId" = "senderId"
WHERE "recipientId" IS NULL AND "type" IN ('query_result', 'report') AND "senderId" IS NOT NULL;
UPDATE "Message" SET "recipientId" = "meta"->>'requestedById'
WHERE "recipientId" IS NULL AND "type" = 'bot' AND "meta" ? 'requestedById';
UPDATE "Message" SET "recipientId" = "senderId"
WHERE "recipientId" IS NULL AND "type" = 'command' AND "content" ILIKE '@bot%' AND "senderId" IS NOT NULL;

-- ── masked_entity_data: copia sem campos ocultos para o app ──────────────
-- ── Backfill: empresas que ja tem cargo com campo oculto ──────────────────
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN
    SELECT DISTINCT "tenantId" FROM "CustomRole"
    WHERE "deletedAt" IS NULL AND role_has_hidden_fields(permissions::jsonb, "modulePermissions"::jsonb)
  LOOP
    PERFORM refresh_masked_entity_data(t, NULL);
  END LOOP;
END $$;

-- ── PowerSync: replica a tabela nova ──────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'powersync' AND NOT puballtables)
     AND NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'powersync' AND tablename = 'EntityDataMasked') THEN
    ALTER PUBLICATION powersync ADD TABLE "EntityDataMasked";
  END IF;
END $$;

-- ── chat_cards_hidden_fields: cartoes antigos sem os campos ocultos ──────
WITH hid AS (
  SELECT m.id,
    ARRAY(
      SELECT DISTINCT f
      FROM "CustomRole" r, unnest(role_hidden_fields(r.permissions::jsonb, m.meta->>'entitySlug')) AS f
      WHERE r."tenantId" = m."tenantId" AND r."deletedAt" IS NULL
        AND COALESCE(r."modulePermissions"::jsonb->>'allAccess', 'false') <> 'true'
    ) AS h
  FROM "Message" m
  WHERE m.type = 'form_submission' AND jsonb_typeof(m.meta) = 'object' AND m.meta ? 'entitySlug'
)
UPDATE "Message" m SET
  content = CASE
    WHEN jsonb_typeof(m.meta->'values') = 'object' AND (m.meta->'values') ?| hid.h
      THEN split_part(m.content, ' — ', 1) || ' — (campos ocultos removidos)'
    ELSE m.content END,
  meta = (
    WITH v AS (
      SELECT CASE WHEN jsonb_typeof(m.meta->'values') = 'object'
                  THEN jsonb_set(m.meta, '{values}', (m.meta->'values') - hid.h) ELSE m.meta END AS meta
    )
    SELECT CASE
      WHEN jsonb_typeof(m.meta->'groups') = 'array' THEN jsonb_set(v.meta, '{groups}', COALESCE((
        SELECT jsonb_agg(CASE
          WHEN g->>'level' = 'parent' OR jsonb_typeof(g->'values') <> 'object' THEN g
          ELSE jsonb_set(g, '{values}', (g->'values') - hid.h) END)
        FROM jsonb_array_elements(m.meta->'groups') AS g
      ), '[]'::jsonb))
      ELSE v.meta END
    FROM v
  )
FROM hid
WHERE hid.id = m.id AND cardinality(hid.h) > 0;
