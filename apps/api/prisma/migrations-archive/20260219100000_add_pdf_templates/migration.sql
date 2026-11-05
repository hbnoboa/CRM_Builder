-- CreateTable: PdfTemplate (Templates de PDF)
CREATE TABLE "PdfTemplate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "category" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isGlobal" BOOLEAN NOT NULL DEFAULT false,
    "entityId" TEXT,
    "entitySlug" TEXT,
    "basePdf" JSONB NOT NULL DEFAULT '{}',
    "schemas" JSONB NOT NULL DEFAULT '[]',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "clonedFromId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "PdfTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PdfGeneration (Historico de Geracoes)
CREATE TABLE "PdfGeneration" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "recordId" TEXT,
    "inputData" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "fileUrl" TEXT,
    "fileSize" INTEGER,
    "pageCount" INTEGER,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdById" TEXT,

    CONSTRAINT "PdfGeneration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: PdfTemplate
CREATE UNIQUE INDEX "PdfTemplate_tenantId_slug_key" ON "PdfTemplate"("tenantId", "slug");
CREATE INDEX "PdfTemplate_tenantId_idx" ON "PdfTemplate"("tenantId");
CREATE INDEX "PdfTemplate_tenantId_entitySlug_idx" ON "PdfTemplate"("tenantId", "entitySlug");
CREATE INDEX "PdfTemplate_isPublished_idx" ON "PdfTemplate"("isPublished");
CREATE INDEX "PdfTemplate_isSystem_idx" ON "PdfTemplate"("isSystem");
CREATE INDEX "PdfTemplate_isGlobal_idx" ON "PdfTemplate"("isGlobal");
CREATE INDEX "PdfTemplate_category_idx" ON "PdfTemplate"("category");
CREATE INDEX "PdfTemplate_createdById_idx" ON "PdfTemplate"("createdById");

-- CreateIndex: PdfGeneration
CREATE INDEX "PdfGeneration_tenantId_idx" ON "PdfGeneration"("tenantId");
CREATE INDEX "PdfGeneration_templateId_idx" ON "PdfGeneration"("templateId");
CREATE INDEX "PdfGeneration_status_idx" ON "PdfGeneration"("status");
CREATE INDEX "PdfGeneration_createdById_idx" ON "PdfGeneration"("createdById");
CREATE INDEX "PdfGeneration_createdAt_idx" ON "PdfGeneration"("createdAt");
CREATE INDEX "PdfGeneration_expiresAt_idx" ON "PdfGeneration"("expiresAt");
CREATE INDEX "PdfGeneration_tenantId_status_idx" ON "PdfGeneration"("tenantId", "status");
CREATE INDEX "PdfGeneration_tenantId_templateId_idx" ON "PdfGeneration"("tenantId", "templateId");

-- AddForeignKey: PdfTemplate
ALTER TABLE "PdfTemplate" ADD CONSTRAINT "PdfTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PdfTemplate" ADD CONSTRAINT "PdfTemplate_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PdfTemplate" ADD CONSTRAINT "PdfTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PdfTemplate" ADD CONSTRAINT "PdfTemplate_clonedFromId_fkey" FOREIGN KEY ("clonedFromId") REFERENCES "PdfTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: PdfGeneration
ALTER TABLE "PdfGeneration" ADD CONSTRAINT "PdfGeneration_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PdfGeneration" ADD CONSTRAINT "PdfGeneration_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "PdfTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PdfGeneration" ADD CONSTRAINT "PdfGeneration_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
