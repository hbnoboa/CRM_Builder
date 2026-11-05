-- CreateFunction: user_can_read_entity
-- Checks if a user (via customRoleId) has read permission for an entity
-- Used by PowerSync sync rules to filter data by user permissions

CREATE OR REPLACE FUNCTION user_can_read_entity(
  custom_role_id UUID,
  entity_slug TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  role_permissions JSONB;
  entity_permission JSONB;
  can_read BOOLEAN;
BEGIN
  -- If no role, deny access
  IF custom_role_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Get permissions from CustomRole
  SELECT permissions::jsonb INTO role_permissions
  FROM "CustomRole"
  WHERE id = custom_role_id;

  -- If no permissions found, deny access
  IF role_permissions IS NULL OR jsonb_typeof(role_permissions) != 'array' THEN
    RETURN FALSE;
  END IF;

  -- Find permission for this entity
  SELECT perm INTO entity_permission
  FROM jsonb_array_elements(role_permissions) AS perm
  WHERE perm->>'entitySlug' = entity_slug
  LIMIT 1;

  -- If no permission for this entity, deny access
  IF entity_permission IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Check canRead permission
  can_read := COALESCE((entity_permission->>'canRead')::boolean, false);

  RETURN can_read;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to check 'own' scope - user can only see their own records
CREATE OR REPLACE FUNCTION user_has_own_scope(
  custom_role_id UUID,
  entity_slug TEXT
) RETURNS BOOLEAN AS $$
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

  RETURN scope = 'own';
END;
$$ LANGUAGE plpgsql STABLE;
