-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "Status" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('PLATFORM_ADMIN', 'ADMIN', 'MANAGER', 'USER', 'VIEWER');

-- CreateEnum
CREATE TYPE "HttpMethod" AS ENUM ('GET', 'POST', 'PUT', 'PATCH', 'DELETE');

-- CreateEnum
CREATE TYPE "AuthType" AS ENUM ('NONE', 'JWT', 'API_KEY');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('INFO', 'SUCCESS', 'WARNING', 'ERROR');

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "domain" TEXT,
    "logo" TEXT,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "plan" "Plan" NOT NULL DEFAULT 'FREE',
    "status" "Status" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatar" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "status" "Status" NOT NULL DEFAULT 'ACTIVE',
    "lastLoginAt" TIMESTAMP(3),
    "resetToken" TEXT,
    "resetTokenExpires" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "permissions" JSONB NOT NULL DEFAULT '[]',
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entity_permissions" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "canCreate" BOOLEAN NOT NULL DEFAULT false,
    "canRead" BOOLEAN NOT NULL DEFAULT true,
    "canUpdate" BOOLEAN NOT NULL DEFAULT false,
    "canDelete" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "entity_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Entity" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "namePlural" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "color" TEXT,
    "fields" JSONB NOT NULL,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Entity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntityData" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "parentRecordId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,

    CONSTRAINT "EntityData_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Page" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "content" JSONB NOT NULL DEFAULT '{}',
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "permissions" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Page_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomEndpoint" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "path" TEXT NOT NULL,
    "method" "HttpMethod" NOT NULL DEFAULT 'POST',
    "mode" TEXT NOT NULL DEFAULT 'visual',
    "requestSchema" JSONB,
    "responseSchema" JSONB,
    "sourceEntityId" TEXT,
    "selectedFields" JSONB NOT NULL DEFAULT '[]',
    "filters" JSONB NOT NULL DEFAULT '[]',
    "queryParams" JSONB NOT NULL DEFAULT '[]',
    "orderBy" JSONB,
    "limitRecords" INTEGER,
    "logic" JSONB NOT NULL DEFAULT '[]',
    "auth" "AuthType" NOT NULL DEFAULT 'JWT',
    "permissions" JSONB NOT NULL DEFAULT '[]',
    "rateLimit" INTEGER NOT NULL DEFAULT 100,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomEndpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resourceId" TEXT,
    "oldData" JSONB,
    "newData" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL DEFAULT 'INFO',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "data" JSONB,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_domain_key" ON "Tenant"("domain");

-- CreateIndex
CREATE INDEX "Tenant_slug_idx" ON "Tenant"("slug");

-- CreateIndex
CREATE INDEX "Tenant_status_idx" ON "Tenant"("status");

-- CreateIndex
CREATE INDEX "Tenant_plan_idx" ON "Tenant"("plan");

-- CreateIndex
CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE INDEX "User_tenantId_status_idx" ON "User"("tenantId", "status");

-- CreateIndex
CREATE INDEX "User_tenantId_role_idx" ON "User"("tenantId", "role");

-- CreateIndex
CREATE INDEX "User_tenantId_createdAt_idx" ON "User"("tenantId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "User_tenantId_email_key" ON "User"("tenantId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_token_key" ON "RefreshToken"("token");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "RefreshToken_token_idx" ON "RefreshToken"("token");

-- CreateIndex
CREATE INDEX "Role_tenantId_idx" ON "Role"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Role_tenantId_slug_key" ON "Role"("tenantId", "slug");

-- CreateIndex
CREATE INDEX "user_roles_userId_idx" ON "user_roles"("userId");

-- CreateIndex
CREATE INDEX "user_roles_roleId_idx" ON "user_roles"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_userId_roleId_key" ON "user_roles"("userId", "roleId");

-- CreateIndex
CREATE INDEX "entity_permissions_roleId_idx" ON "entity_permissions"("roleId");

-- CreateIndex
CREATE INDEX "entity_permissions_entityId_idx" ON "entity_permissions"("entityId");

-- CreateIndex
CREATE INDEX "entity_permissions_tenantId_idx" ON "entity_permissions"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "entity_permissions_roleId_entityId_key" ON "entity_permissions"("roleId", "entityId");

-- CreateIndex
CREATE INDEX "Entity_tenantId_idx" ON "Entity"("tenantId");

-- CreateIndex
CREATE INDEX "Entity_tenantId_name_idx" ON "Entity"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Entity_tenantId_slug_key" ON "Entity"("tenantId", "slug");

-- CreateIndex
CREATE INDEX "EntityData_tenantId_idx" ON "EntityData"("tenantId");

-- CreateIndex
CREATE INDEX "EntityData_entityId_idx" ON "EntityData"("entityId");

-- CreateIndex
CREATE INDEX "EntityData_createdAt_idx" ON "EntityData"("createdAt");

-- CreateIndex
CREATE INDEX "EntityData_createdById_idx" ON "EntityData"("createdById");

-- CreateIndex
CREATE INDEX "EntityData_tenantId_entityId_idx" ON "EntityData"("tenantId", "entityId");

-- CreateIndex
CREATE INDEX "EntityData_tenantId_entityId_createdAt_idx" ON "EntityData"("tenantId", "entityId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "EntityData_entityId_createdAt_idx" ON "EntityData"("entityId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "EntityData_entityId_createdById_idx" ON "EntityData"("entityId", "createdById");

-- CreateIndex
CREATE INDEX "EntityData_parentRecordId_idx" ON "EntityData"("parentRecordId");

-- CreateIndex
CREATE INDEX "EntityData_entityId_parentRecordId_idx" ON "EntityData"("entityId", "parentRecordId");

-- CreateIndex
CREATE INDEX "Page_tenantId_idx" ON "Page"("tenantId");

-- CreateIndex
CREATE INDEX "Page_isPublished_idx" ON "Page"("isPublished");

-- CreateIndex
CREATE INDEX "Page_tenantId_isPublished_idx" ON "Page"("tenantId", "isPublished");

-- CreateIndex
CREATE UNIQUE INDEX "Page_tenantId_slug_key" ON "Page"("tenantId", "slug");

-- CreateIndex
CREATE INDEX "CustomEndpoint_tenantId_idx" ON "CustomEndpoint"("tenantId");

-- CreateIndex
CREATE INDEX "CustomEndpoint_isActive_idx" ON "CustomEndpoint"("isActive");

-- CreateIndex
CREATE INDEX "CustomEndpoint_sourceEntityId_idx" ON "CustomEndpoint"("sourceEntityId");

-- CreateIndex
CREATE INDEX "CustomEndpoint_tenantId_isActive_idx" ON "CustomEndpoint"("tenantId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "CustomEndpoint_tenantId_path_method_key" ON "CustomEndpoint"("tenantId", "path", "method");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_idx" ON "AuditLog"("tenantId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_resource_idx" ON "AuditLog"("resource");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_createdAt_idx" ON "AuditLog"("tenantId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_action_idx" ON "AuditLog"("tenantId", "action");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_resource_idx" ON "AuditLog"("tenantId", "resource");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_userId_idx" ON "AuditLog"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "AuditLog_resource_resourceId_idx" ON "AuditLog"("resource", "resourceId");

-- CreateIndex
CREATE INDEX "Notification_tenantId_idx" ON "Notification"("tenantId");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "Notification_read_idx" ON "Notification"("read");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_read_idx" ON "Notification"("userId", "read");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Notification_tenantId_userId_idx" ON "Notification"("tenantId", "userId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_permissions" ADD CONSTRAINT "entity_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_permissions" ADD CONSTRAINT "entity_permissions_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entity" ADD CONSTRAINT "Entity_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityData" ADD CONSTRAINT "EntityData_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityData" ADD CONSTRAINT "EntityData_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityData" ADD CONSTRAINT "EntityData_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityData" ADD CONSTRAINT "EntityData_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityData" ADD CONSTRAINT "EntityData_parentRecordId_fkey" FOREIGN KEY ("parentRecordId") REFERENCES "EntityData"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Page" ADD CONSTRAINT "Page_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomEndpoint" ADD CONSTRAINT "CustomEndpoint_sourceEntityId_fkey" FOREIGN KEY ("sourceEntityId") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomEndpoint" ADD CONSTRAINT "CustomEndpoint_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
