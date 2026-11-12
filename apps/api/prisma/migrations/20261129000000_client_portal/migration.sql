-- Portal do cliente: o acesso de um usuario a empresa pode estar vinculado a um
-- registro (o cliente: uma empresa, um segurado...). Cargos com escopo 'client'
-- veem so esse registro e o que esta dentro dele ou ligado a ele.
ALTER TABLE "UserTenantAccess" ADD COLUMN "clientEntityId" TEXT;
ALTER TABLE "UserTenantAccess" ADD COLUMN "clientRecordId" TEXT;
CREATE INDEX "UserTenantAccess_tenantId_clientRecordId_idx" ON "UserTenantAccess"("tenantId", "clientRecordId");

-- Celular (PowerSync): a regra de cliente nao existe nas listas de visibilidade do
-- banco; por seguranca, escopo 'client' vale como 'own' (so o que a pessoa criou).
CREATE OR REPLACE FUNCTION public.get_role_entity_scope(p_perms jsonb, p_entity_slug text) RETURNS text
    LANGUAGE plpgsql STABLE
    AS $$
DECLARE
  perm_item JSONB;
BEGIN
  IF p_perms IS NULL OR jsonb_typeof(p_perms) <> 'array' THEN
    RETURN 'all';
  END IF;

  SELECT x INTO perm_item
  FROM jsonb_array_elements(p_perms) AS x
  WHERE x->>'entitySlug' = p_entity_slug
  LIMIT 1;

  IF perm_item IS NULL THEN
    SELECT x INTO perm_item
    FROM jsonb_array_elements(p_perms) AS x
    WHERE x->>'entitySlug' = '*'
    LIMIT 1;
  END IF;

  IF perm_item IS NOT NULL AND perm_item->>'scope' = 'client' THEN
    RETURN 'own';
  END IF;

  IF perm_item IS NOT NULL AND perm_item->>'scope' IN ('own', 'team') THEN
    RETURN perm_item->>'scope';
  END IF;

  RETURN 'all';
END;
$$;

CREATE OR REPLACE FUNCTION public.user_has_own_scope(custom_role_id uuid, entity_slug text) RETURNS boolean
    LANGUAGE plpgsql STABLE
    AS $$
DECLARE
  role_permissions JSONB;
  entity_permission JSONB;
  scope TEXT;
BEGIN
  IF custom_role_id IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT permissions::jsonb INTO role_permissions
  FROM "CustomRole"
  WHERE id = custom_role_id;

  IF role_permissions IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT perm INTO entity_permission
  FROM jsonb_array_elements(role_permissions) AS perm
  WHERE perm->>'entitySlug' = entity_slug
  LIMIT 1;

  IF entity_permission IS NULL THEN
    RETURN FALSE;
  END IF;

  scope := COALESCE(entity_permission->>'scope', 'all');

  RETURN scope IN ('own', 'client');
END;
$$;
