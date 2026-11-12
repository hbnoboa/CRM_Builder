-- Dominios proprios das empresas (site) e pedidos de compra de dominio
CREATE TABLE "TenantDomain" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "hostname" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'connected',
    "status" TEXT NOT NULL DEFAULT 'pending_dns',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "lastCheckAt" TIMESTAMP(3),
    "lastError" TEXT,
    "orderId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantDomain_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TenantDomain_hostname_key" ON "TenantDomain"("hostname");
CREATE INDEX "TenantDomain_tenantId_idx" ON "TenantDomain"("tenantId");

CREATE TABLE "DomainOrder" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "hostname" TEXT NOT NULL,
    "years" INTEGER NOT NULL DEFAULT 1,
    "priceCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "status" TEXT NOT NULL DEFAULT 'awaiting_payment',
    "registrant" JSONB NOT NULL,
    "provider" TEXT NOT NULL,
    "providerRef" TEXT,
    "expiresAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "paidByStaff" TEXT,
    "lastError" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DomainOrder_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DomainOrder_tenantId_idx" ON "DomainOrder"("tenantId");
CREATE INDEX "DomainOrder_status_idx" ON "DomainOrder"("status");
