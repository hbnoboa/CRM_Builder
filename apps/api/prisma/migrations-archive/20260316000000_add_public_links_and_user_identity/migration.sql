-- AlterTable: Add identity fields to User
ALTER TABLE "User" ADD COLUMN "cpf" TEXT;
ALTER TABLE "User" ADD COLUMN "cnpj" TEXT;
ALTER TABLE "User" ADD COLUMN "phone" TEXT;

-- CreateTable: PublicLink
CREATE TABLE "PublicLink" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "entitySlug" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "customRoleId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "maxUsers" INTEGER,
    "registrationCount" INTEGER NOT NULL DEFAULT 0,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublicLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: PublicLink
CREATE UNIQUE INDEX "PublicLink_slug_key" ON "PublicLink"("slug");
CREATE INDEX "PublicLink_tenantId_idx" ON "PublicLink"("tenantId");
CREATE INDEX "PublicLink_tenantId_entitySlug_idx" ON "PublicLink"("tenantId", "entitySlug");

-- CreateIndex: User identity fields
CREATE UNIQUE INDEX "User_tenantId_cpf_key" ON "User"("tenantId", "cpf");
CREATE UNIQUE INDEX "User_tenantId_phone_key" ON "User"("tenantId", "phone");
CREATE INDEX "User_cpf_idx" ON "User"("cpf");
CREATE INDEX "User_phone_idx" ON "User"("phone");

-- AddForeignKey: PublicLink
ALTER TABLE "PublicLink" ADD CONSTRAINT "PublicLink_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PublicLink" ADD CONSTRAINT "PublicLink_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PublicLink" ADD CONSTRAINT "PublicLink_customRoleId_fkey" FOREIGN KEY ("customRoleId") REFERENCES "CustomRole"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
