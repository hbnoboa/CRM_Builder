-- Mensagem privada dentro de um canal: resultado de /consulta, relatorio e conversa
-- com o @bot. Rodam com as permissoes de quem pediu, entao so essa pessoa ve
-- (web, API e app). NULL = mensagem do canal.
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "recipientId" TEXT;
CREATE INDEX IF NOT EXISTS "Message_recipientId_idx" ON "Message"("recipientId");

-- Historico: o que ja foi gerado assim passa a ser so de quem pediu.
UPDATE "Message" SET "recipientId" = "senderId"
WHERE "recipientId" IS NULL AND "type" IN ('query_result', 'report') AND "senderId" IS NOT NULL;
UPDATE "Message" SET "recipientId" = "meta"->>'requestedById'
WHERE "recipientId" IS NULL AND "type" = 'bot' AND "meta" ? 'requestedById';
UPDATE "Message" SET "recipientId" = "senderId"
WHERE "recipientId" IS NULL AND "type" = 'command' AND "content" ILIKE '@bot%' AND "senderId" IS NOT NULL;
