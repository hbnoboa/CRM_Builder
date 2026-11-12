-- Armazenamento usado por tenant (limite maxStorageMb do plano).
-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "storageUsedKb" INTEGER NOT NULL DEFAULT 0;

