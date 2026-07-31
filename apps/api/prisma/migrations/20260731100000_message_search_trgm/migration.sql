-- Busca de mensagens do chat por SUBSTRING ignorando acento e caixa
-- (f_unaccent(content) ILIKE ...), como Telegram/WhatsApp. Índice GIN trigram
-- (pg_trgm) sobre f_unaccent(content) acelera o ILIKE em qualquer posição, sobre
-- TODO o histórico do canal (não depende do que está carregado na tela).
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- unaccent puro não é IMMUTABLE; o wrapper com a config explícita permite indexar.
CREATE OR REPLACE FUNCTION f_unaccent(text) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT AS
$$ SELECT public.unaccent('public.unaccent', $1) $$;

DROP INDEX IF EXISTS "message_content_fts_idx";
DROP INDEX IF EXISTS "message_content_trgm_idx";
CREATE INDEX IF NOT EXISTS "message_content_trgm_idx"
  ON "Message"
  USING GIN (f_unaccent(content) gin_trgm_ops);
