-- Comandos por chat: anexação N:N canal↔comando.
CREATE TABLE IF NOT EXISTS "ChannelCommand" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "channelId" TEXT NOT NULL,
  "commandTemplateId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChannelCommand_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ChannelCommand_channelId_commandTemplateId_key"
  ON "ChannelCommand" ("channelId", "commandTemplateId");
CREATE INDEX IF NOT EXISTS "ChannelCommand_channelId_idx" ON "ChannelCommand" ("channelId");
CREATE INDEX IF NOT EXISTS "ChannelCommand_tenantId_idx" ON "ChannelCommand" ("tenantId");
