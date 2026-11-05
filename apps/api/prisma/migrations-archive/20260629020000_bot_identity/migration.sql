CREATE TABLE "BotIdentity" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "customRoleId" TEXT NOT NULL,
  "name" TEXT NOT NULL DEFAULT 'Assistente',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BotIdentity_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BotIdentity_tenantId_key" ON "BotIdentity"("tenantId");
