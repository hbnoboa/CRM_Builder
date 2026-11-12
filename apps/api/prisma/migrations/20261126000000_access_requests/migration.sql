-- Pedidos de acesso pelo dominio proprio da empresa (aprovados por um administrador)
CREATE TABLE "AccessRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "customRoleId" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccessRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AccessRequest_tenantId_status_idx" ON "AccessRequest"("tenantId", "status");
CREATE INDEX "AccessRequest_email_idx" ON "AccessRequest"("email");
