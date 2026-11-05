-- Módulo Chat + Bot (fatia 1): Channel, ChannelMember, Message
CREATE TABLE "Channel" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "entityId" TEXT,
  "recordId" TEXT,
  "name" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Channel_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Channel_tenantId_entityId_key" ON "Channel"("tenantId", "entityId");
CREATE INDEX "Channel_tenantId_type_idx" ON "Channel"("tenantId", "type");

CREATE TABLE "ChannelMember" (
  "id" TEXT NOT NULL,
  "channelId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'member',
  "lastReadAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChannelMember_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ChannelMember_channelId_userId_key" ON "ChannelMember"("channelId", "userId");
CREATE INDEX "ChannelMember_userId_idx" ON "ChannelMember"("userId");

CREATE TABLE "Message" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "channelId" TEXT NOT NULL,
  "senderId" TEXT,
  "type" TEXT NOT NULL DEFAULT 'text',
  "content" TEXT,
  "meta" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Message_channelId_createdAt_idx" ON "Message"("channelId", "createdAt");

ALTER TABLE "ChannelMember" ADD CONSTRAINT "ChannelMember_channelId_fkey"
  FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Message" ADD CONSTRAINT "Message_channelId_fkey"
  FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
