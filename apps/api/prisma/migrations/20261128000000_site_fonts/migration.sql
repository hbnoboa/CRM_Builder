CREATE TABLE "SiteFont" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SiteFont_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SiteFont_tenantId_idx" ON "SiteFont"("tenantId");
