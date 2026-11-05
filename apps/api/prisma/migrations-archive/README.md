# Migrations antigas (arquivo)

Estas 50 migrations foram substituidas em 05/11/2026 pela migration
`prisma/migrations/00000000000000_baseline`, gerada com `pg_dump --schema-only` do dev.

- **Por que:** fora de ordem, elas nao subiam num banco vazio (ex.: a do filtro global
  cria indice com `deletedAt` antes dessa coluna existir). Isso impedia CI, ambiente novo
  e recuperacao a partir das migrations.
- **Ficam aqui so para consulta.** O Prisma nao le esta pasta.
- **Dev:** ja marcado (`prisma migrate resolve --applied 00000000000000_baseline`); os
  registros antigos do `_prisma_migrations` continuam e nao atrapalham.
- **Prod:** ver "Baseline das migrations" em `docs/DEPLOY.md` antes do primeiro deploy.
- **Migration nova:** criar normalmente em `prisma/migrations/` (nome com data, depois do baseline).
