-- Funcoes das estatisticas calculadas no banco (stats-sql.ts). Reproduzem as regras
-- que o servidor aplicava em JavaScript, para os numeros nao mudarem:
--   stats_scalar: String(x) do JavaScript para um valor JSON (numero sem zeros a direita,
--                 lista vira "a,b", objeto vira "[object Object]").
--   stats_key:    chave de agrupamento (normalizeFieldValue): vazio -> "(vazio)";
--                 objeto {value,label} -> value (ou label).
--   stats_label:  rotulo (normalizeFieldLabel): objeto -> label (ou value).
--   stats_num:    numero como parseFloat: numero ou texto que comeca com numero.
-- O caso comum (texto, numero, booleano, vazio) fica numa expressao simples que o
-- Postgres embute na consulta; objeto e lista (raros) vao para funcoes auxiliares.

-- Lista -> "a,b" (String(array) do JavaScript)
CREATE OR REPLACE FUNCTION stats_array_text(v jsonb) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT coalesce(string_agg(CASE jsonb_typeof(e)
    WHEN 'null' THEN ''
    WHEN 'string' THEN e #>> '{}'
    WHEN 'number' THEN trim_scale((e #>> '{}')::numeric)::text
    WHEN 'boolean' THEN e #>> '{}'
    WHEN 'object' THEN '[object Object]'
    ELSE e #>> '{}' END, ',' ORDER BY o), '')
  FROM jsonb_array_elements(v) WITH ORDINALITY AS t(e, o)
$$;

CREATE OR REPLACE FUNCTION stats_scalar(v jsonb) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT CASE jsonb_typeof(v)
    WHEN 'string' THEN v #>> '{}'
    WHEN 'number' THEN trim_scale((v #>> '{}')::numeric)::text
    WHEN 'boolean' THEN v #>> '{}'
    WHEN 'object' THEN '[object Object]'
    WHEN 'array' THEN stats_array_text(v)
    ELSE NULL
  END
$$;

-- Objeto {value,label}: chave = value (ou label); rotulo = label (ou value)
CREATE OR REPLACE FUNCTION stats_obj_key(v jsonb) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT coalesce(stats_scalar(nullif(v -> 'value', 'null'::jsonb)), stats_scalar(nullif(v -> 'label', 'null'::jsonb)), v::text)
$$;

CREATE OR REPLACE FUNCTION stats_obj_label(v jsonb) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT coalesce(stats_scalar(nullif(v -> 'label', 'null'::jsonb)), stats_scalar(nullif(v -> 'value', 'null'::jsonb)), v::text)
$$;

CREATE OR REPLACE FUNCTION stats_key(v jsonb) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT CASE jsonb_typeof(v)
    WHEN 'string' THEN v #>> '{}'
    WHEN 'number' THEN trim_scale((v #>> '{}')::numeric)::text
    WHEN 'boolean' THEN v #>> '{}'
    WHEN 'object' THEN stats_obj_key(v)
    WHEN 'array' THEN stats_array_text(v)
    ELSE '(vazio)'
  END
$$;

CREATE OR REPLACE FUNCTION stats_label(v jsonb) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT CASE jsonb_typeof(v)
    WHEN 'string' THEN v #>> '{}'
    WHEN 'number' THEN trim_scale((v #>> '{}')::numeric)::text
    WHEN 'boolean' THEN v #>> '{}'
    WHEN 'object' THEN stats_obj_label(v)
    WHEN 'array' THEN stats_array_text(v)
    ELSE '(vazio)'
  END
$$;

CREATE OR REPLACE FUNCTION stats_num(v jsonb) RETURNS numeric
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT CASE jsonb_typeof(v)
    WHEN 'number' THEN (v #>> '{}')::numeric
    WHEN 'string' THEN (substring(v #>> '{}' FROM '^\s*([+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?)'))::numeric
    ELSE NULL
  END
$$;
