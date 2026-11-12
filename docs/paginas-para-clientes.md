# Páginas para clientes

Páginas que o cliente final abre sem login, montadas em **Administração → Páginas para clientes**:

- **Formulário**: o cliente preenche (com fotos e arquivos) e vira registro na tabela, com as automações de sempre. Só os campos escolhidos na página são aceitos; a situação começa na primeira opção.
- **Acompanhamento**: cada registro tem um link secreto (botão **Link de acompanhamento** no registro, ou mostrado ao cliente depois de enviar o formulário). Quem tem o link vê só os campos que a página libera, o histórico, envia arquivos nos campos liberados e baixa o PDF publicado.

Permissão: a mesma dos links públicos (`publicLinks.canManage`) e o recurso `publicLinks` do plano. O link de um registro pode ser pedido por quem enxerga o registro.

Código: `apps/api/src/modules/site-pages` (regras dos blocos em `site-blocks.ts`), `apps/web-admin/src/components/site`, rota pública `app/[locale]/(public)/p/[slug]/[page]`.

## Endereço

Sem configuração: `https://<site>/p/<empresa>/<pagina>`.

Subdomínio da empresa (`<empresa>.iossystem.com.br/<pagina>`; no dev `<empresa>.dev.iossystem.com.br/<pagina>`): o código já está pronto (`apps/web-admin/src/middleware.ts` reconhece o host). Para ligar:

1. **DNS**: registro curinga `*.iossystem.com.br` (e `*.dev.iossystem.com.br`) apontando para o IP da VM.
2. **Certificado curinga** para `*.iossystem.com.br` / `*.dev.iossystem.com.br` (Let's Encrypt exige desafio DNS para curinga).
3. **nginx**: um `server` para esses hosts mandando `/` para o web e `/api/` para a API, como o de `dev.iossystem.com.br`. Subdomínios reservados (www, dev, api, app, admin, mail, sync) não são tratados como empresa.
4. **API**: `SITE_PAGES_BASE_URL=https://{empresa}.iossystem.com.br` (dev: `SITE_PAGES_BASE_URL_DEV=https://{empresa}.dev.iossystem.com.br` no `.env`) para os links gerados usarem o subdomínio.

O subdomínio é o identificador da empresa (`Tenant.slug`).
