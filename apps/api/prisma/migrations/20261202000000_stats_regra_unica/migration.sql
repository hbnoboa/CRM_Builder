-- Regra unica dos numeros dos paineis (fase 2): o texto de um valor e o mesmo que o
-- navegador usa (toStr do aggregation-engine), para os graficos darem o mesmo resultado
-- calculados no navegador ou no banco.
--   vazio -> ''; objeto -> label (ou name, ou value); lista -> itens separados por ", ".

-- Texto de um item (valor que nao e lista)
CREATE OR REPLACE FUNCTION stats_str_item(v jsonb) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT CASE jsonb_typeof(v)
    WHEN 'string' THEN v #>> '{}'
    WHEN 'number' THEN trim_scale((v #>> '{}')::numeric)::text
    WHEN 'boolean' THEN v #>> '{}'
    WHEN 'object' THEN CASE
      WHEN v ? 'label' THEN coalesce(stats_scalar(v -> 'label'), 'null')
      WHEN v ? 'name' THEN coalesce(stats_scalar(v -> 'name'), 'null')
      WHEN v ? 'value' THEN coalesce(stats_scalar(v -> 'value'), 'null')
      ELSE v::text END
    WHEN 'array' THEN v::text
    ELSE ''
  END
$$;

-- Lista -> "a, b" (itens pelo mesmo criterio)
CREATE OR REPLACE FUNCTION stats_str_list(v jsonb) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT coalesce(string_agg(stats_str_item(e), ', ' ORDER BY o), '')
  FROM jsonb_array_elements(v) WITH ORDINALITY AS t(e, o)
$$;

CREATE OR REPLACE FUNCTION stats_str(v jsonb) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT CASE jsonb_typeof(v)
    WHEN 'string' THEN v #>> '{}'
    WHEN 'number' THEN trim_scale((v #>> '{}')::numeric)::text
    WHEN 'boolean' THEN v #>> '{}'
    WHEN 'array' THEN stats_str_list(v)
    WHEN 'object' THEN stats_str_item(v)
    ELSE ''
  END
$$;
