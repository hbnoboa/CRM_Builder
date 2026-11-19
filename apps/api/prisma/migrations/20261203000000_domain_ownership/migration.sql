-- Prova de dono do dominio ligado: registro TXT _crm-verificacao.<dominio> com este codigo.
-- Dominios ja verificados (verifiedAt) continuam valendo sem o TXT.
ALTER TABLE "TenantDomain" ADD COLUMN IF NOT EXISTS "verifyToken" TEXT;
