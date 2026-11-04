-- Comunicados da plataforma para os clientes.
-- CreateEnum
CREATE TYPE "AnnouncementSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "severity" "AnnouncementSeverity" NOT NULL DEFAULT 'INFO',
    "audience" JSONB NOT NULL DEFAULT '{"type":"all","ids":[]}',
    "adminsOnly" BOOLEAN NOT NULL DEFAULT false,
    "dismissible" BOOLEAN NOT NULL DEFAULT true,
    "linkUrl" TEXT,
    "linkLabel" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnnouncementDismissal" (
    "id" TEXT NOT NULL,
    "announcementId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "dismissedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnnouncementDismissal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Announcement_publishedAt_startsAt_idx" ON "Announcement"("publishedAt", "startsAt");

-- CreateIndex
CREATE INDEX "AnnouncementDismissal_userId_idx" ON "AnnouncementDismissal"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AnnouncementDismissal_announcementId_userId_key" ON "AnnouncementDismissal"("announcementId", "userId");

-- AddForeignKey
ALTER TABLE "AnnouncementDismissal" ADD CONSTRAINT "AnnouncementDismissal_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnouncementDismissal" ADD CONSTRAINT "AnnouncementDismissal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

