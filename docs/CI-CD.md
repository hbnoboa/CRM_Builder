# CI/CD — Deploy via GitHub Actions (keyless) + Artifact Registry

Substitui o `deploy.sh`/`deploy-dev.sh` (build lento na VM) por:
**build no runner do GitHub (com cache) → push na Google Artifact Registry (GAR) →
deploy na VM via `gcloud compute ssh` (auth keyless por Workload Identity Federation).**

```
push develop ─► GHA: build+cache ─► GAR (:dev)  ─► gcloud ssh VM: pull + up  (crm-*-dev)
push main    ─► GHA: build+cache ─► GAR (:prod) ─► gcloud ssh VM: pull + up  (crm-*-prod)
```

- **Sem secret** no GitHub (WIF/OIDC).  **Sem runner self-hosted** (usa `gcloud ssh`).
- Workflow: `.github/workflows/deploy.yml`  ·  Script na VM: `scripts/vm-deploy.sh`.
- A VM **não builda nada** — o `docker compose` usa `image:` (em `docker-compose.prod.yml`)
  apontando pra GAR; a VM só faz `pull` + `up`.

## Infra GCP (JÁ configurada — projeto ios-forms-299fb)
| Item | Valor |
|---|---|
| Repo GAR | `us-central1-docker.pkg.dev/ios-forms-299fb/crm` |
| SA de CI | `crm-ci@ios-forms-299fb.iam.gserviceaccount.com` (artifactregistry.writer) |
| WIF provider | `projects/35661851099/locations/global/workloadIdentityPools/github/providers/github-provider` (restrito ao repo `hbnoboa/CRM_Builder`) |
| SA da VM | `35661851099-compute@…` com `artifactregistry.reader` (puxa da GAR via metadata) |
| crm-ci → VM | `compute.instanceAdmin.v1` (ios-vm) + `iam.serviceAccountUser` (pro `gcloud ssh`) |

Nada disso precisa de ação no GitHub — o OIDC do repo é confiado pelo provider WIF.

## Uso no dia a dia
- **Deploy dev:** `git push origin develop` → sobe sozinho em `crm-api-dev`/`crm-web-dev`.
- **Deploy prod:** `git push origin main` → sobe em `crm-api-prod`/`crm-web-prod`.
- **Manual/rollback:** Actions → Deploy → Run workflow. Rollback: re-taggeie a imagem
  anterior na GAR como `:prod`/`:dev` (ou aponte por `:<sha>`) e rode o deploy.

## Por que fica rápido
| | Antes (`deploy.sh`) | Depois (GHA keyless) |
|---|---|---|
| Build | na VM, `--no-cache` (npm install todo deploy) | runner GitHub, cache de camada |
| Onde | trava sua máquina/VM | runner efêmero, paralelo |
| VM faz | build + up | só `pull` + `up` (≈1–2 min) |
| Disparo | manual, branch certa | automático no push |
| Credencial | — | keyless (WIF), sem secret |

## Observações
- Migrations Prisma **não** rodam automático aqui (evita migration destrutiva sem querer).
  Rode manualmente quando o schema mudar.
- O `ci-cd.yml` roda `tsc --noEmit`, que hoje falha pela dívida de tipos pré-existente. Não
  bloqueia o `deploy.yml` (workflows separados). Dá pra torná-lo informativo.
