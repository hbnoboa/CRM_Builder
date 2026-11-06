-- Paginas para clientes (formulario publico e acompanhamento) e links de acompanhamento
CREATE TABLE "SitePage" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "blocks" JSONB NOT NULL DEFAULT '[]',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SitePage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SitePage_tenantId_slug_key" ON "SitePage"("tenantId", "slug");
CREATE INDEX "SitePage_tenantId_idx" ON "SitePage"("tenantId");

CREATE TABLE "RecordTrackingLink" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "createdById" TEXT,
    "lastAccessAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecordTrackingLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RecordTrackingLink_recordId_key" ON "RecordTrackingLink"("recordId");
CREATE UNIQUE INDEX "RecordTrackingLink_token_key" ON "RecordTrackingLink"("token");
CREATE INDEX "RecordTrackingLink_tenantId_idx" ON "RecordTrackingLink"("tenantId");
