-- Pedidos de contato comercial da pagina inicial
CREATE TYPE "SalesLeadStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'WON', 'DISCARDED');

CREATE TABLE "SalesLead" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "company" TEXT NOT NULL,
    "teamSize" TEXT,
    "segment" TEXT,
    "interest" TEXT,
    "message" TEXT,
    "source" TEXT,
    "status" "SalesLeadStatus" NOT NULL DEFAULT 'NEW',
    "notes" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesLead_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SalesLead_status_createdAt_idx" ON "SalesLead"("status", "createdAt");
CREATE INDEX "SalesLead_email_idx" ON "SalesLead"("email");
