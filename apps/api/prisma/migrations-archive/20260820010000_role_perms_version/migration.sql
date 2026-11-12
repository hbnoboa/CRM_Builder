-- permsVersion: contador incrementado a cada mudanca de autorizacao do cargo
-- (permissions / modulePermissions / tenantPermissions). O access token carrega o
-- claim `permsV`; o JwtStrategy rejeita com 401 os tokens cujo permsV esta defasado.
-- O cliente entao faz um refresh SILENCIOSO (reusa o fluxo 401 -> refresh que ja
-- existe) e recebe um token novo + permissoes frescas. Complementa o recompute
-- async da visibilidade (lado da linha) cobrindo o lado da SESSAO.
ALTER TABLE "CustomRole" ADD COLUMN IF NOT EXISTS "permsVersion" INTEGER NOT NULL DEFAULT 0;
