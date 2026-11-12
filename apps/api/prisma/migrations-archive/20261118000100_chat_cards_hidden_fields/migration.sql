-- Cartoes antigos do chat ("Registrou/Editou") levavam os valores de TODOS os campos,
-- inclusive os ocultos para algum cargo (o canal inteiro via, no web e no app).
-- O codigo novo ja grava sem esses campos; aqui limpa o historico da tabela do
-- cartao (values, grupos da propria tabela e o texto do resumo).
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
