# Domínio próprio das empresas (site) e venda de domínios

Cada empresa pode abrir o site dela (Páginas para clientes) num endereço próprio,
como `www.meucafe.com.br`, em vez de `/p/<empresa>/<pagina>` ou `<empresa>.iossystem.com.br`.
Há dois caminhos, ambos em **Administração › Páginas para clientes › Domínio próprio**:

1. **Ligar um domínio que a empresa já tem**: ela digita o endereço, o sistema mostra o
   registro de DNS a criar (CNAME ou A) e confere sozinho quando passa a apontar para nós.
2. **Comprar um domínio**: ela busca um nome, escolhe e preenche o titular. O pedido fica
   *aguardando pagamento*; a equipe IOS System cobra por fora (Pix/boleto) e, no
   **Console › Domínios**, clica em **Marcar como pago e registrar**. O registrador registra
   o domínio no nome do titular, aponta o DNS para nós e o domínio já entra conectado.

## O que já está pronto no código

| Parte | Onde |
|---|---|
| Modelos `TenantDomain` (domínios ligados) e `DomainOrder` (pedidos) | `apps/api/prisma/schema.prisma`, migração `20261125000000_site_domains` |
| Ligar, conferir DNS, tornar principal, desligar | `apps/api/src/modules/site-domains` (`/site-domains`) |
| Conferência automática a cada 10 min dos domínios pendentes | `SiteDomainsService.recheckPending` |
| Busca, pedido e cancelamento de domínio | `/site-domains/search`, `/site-domains/orders` |
| Console: pedidos, marcar como pago, cancelar | `/platform/domain-orders` e tela `/admin/domains` (permissões `domains.read` e `domains.manage` = Dono e Financeiro) |
| Qual empresa responde num domínio | `GET /api/v1/public/domains/resolve?host=` |
| Pode emitir certificado para um domínio? (pergunta do proxy) | `GET /api/v1/public/domains/tls?domain=` (200 = sim, 404 = não) |
| Site abrindo pelo domínio do cliente | `apps/web-admin/src/middleware.ts` (pergunta à API pelo `INTERNAL_API_URL`) |
| Links do site (acompanhamento, endereço das páginas) usam o domínio principal | `site-pages.service.ts` |
| Registrador de **teste** (`DOMAIN_REGISTRAR=mock`) | `apps/api/src/modules/site-domains/registrar.ts` |

## Variáveis de ambiente

| Variável | Onde | Para que serve | Dev (compose) | Produção (compose) |
|---|---|---|---|---|
| `SITE_DOMAIN_CNAME` | API | Destino do CNAME que o cliente cria (`www` → isto) | `dev.iossystem.com.br` | `iossystem.com.br` |
| `SITE_DOMAIN_IPS` | API | IPs para o registro A de domínios sem `www` (separados por vírgula). Vazio = a tela recomenda usar `www` | vazio | vazio |
| `DOMAIN_REGISTRAR` | API | `mock` = registrador de teste. Vazio = compra desligada (só ligar domínio existente) | `mock` | vazio |
| `DOMAIN_DNS_CHECK` | API | `mock` só nos testes automáticos | — | — |
| `INTERNAL_API_URL` | Web | Endereço interno da API, para o web descobrir a empresa pelo domínio | `http://api-dev:3001/api/v1` | `http://api:3001/api/v1` |
| `PLATFORM_HOSTS` | API e Web | Outros endereços da própria plataforma, além de `*.iossystem.com.br` (opcional) | — | — |

Os valores de `docker-compose.prod.yml` já vêm com esses padrões; para mudar, defina a
variável no `.env` do servidor (em dev, com o sufixo `_DEV`: `SITE_DOMAIN_IPS_DEV` etc.).

## O que falta na infraestrutura (fazer no servidor)

Para um domínio de cliente abrir de verdade, duas coisas precisam acontecer no servidor:

1. **Encaminhar** qualquer endereço que não seja nosso para o web (e `/api/` para a API).
2. **Emitir certificado HTTPS** para cada domínio de cliente, automaticamente.

O nginx atual não emite certificados sozinho. Há duas formas recomendadas:

### Opção A — Caddy com certificado sob demanda (sem custo)

O Caddy pede o certificado ao Let's Encrypt na primeira visita de cada domínio, **depois de
perguntar à nossa API** se o domínio é de um cliente (assim ninguém consegue gerar
certificado apontando um domínio qualquer).

Exemplo de `Caddyfile` (produção; em dev troque `api`/`web` por `api-dev`/`web-dev`):

```
{
	on_demand_tls {
		ask http://api:3001/api/v1/public/domains/tls
	}
}

# Domínios das empresas (qualquer endereço que não seja da plataforma)
https:// {
	tls {
		on_demand
	}
	handle /api/* {
		reverse_proxy api:3001
	}
	handle {
		reverse_proxy web:3000
	}
}
```

Como o nginx hoje ocupa as portas 80 e 443, há dois arranjos possíveis:

- **Caddy na frente de tudo** (recomendado): o Caddy fica com 80/443; os endereços da
  plataforma (`iossystem.com.br`, `dev.iossystem.com.br`) continuam indo para o nginx
  (`reverse_proxy nginx:80`, com o nginx passando a escutar só por dentro), e os demais
  seguem o bloco acima.
- **Um IP só para sites de clientes**: o Caddy escuta num segundo IP público e
  `SITE_DOMAIN_IPS`/`SITE_DOMAIN_CNAME` apontam para ele; o nginx fica como está.

### Opção B — Cloudflare for SaaS

A Cloudflare emite e renova os certificados de cada domínio de cliente e protege contra
ataques. O cliente aponta o CNAME para um endereço nosso na Cloudflare (o *fallback origin*),
e cada domínio precisa ser cadastrado como *custom hostname* na Cloudflare: pelo painel, à mão,
ou por uma integração com a API deles, que **ainda não existe no código**. As primeiras 100
empresas não têm custo; acima disso há cobrança por domínio (confira a tabela atual da
Cloudflare). No servidor, o nginx precisa de um `server` padrão que encaminhe endereços
desconhecidos para o web e `/api/` para a API.

### Domínio sem `www` (registro A)

Domínios sem `www` (ex.: `meucafe.com.br`) não aceitam CNAME. Para eles funcionarem, defina
`SITE_DOMAIN_IPS` com o IP público que recebe o tráfego dos sites (Caddy ou Cloudflare).
Enquanto estiver vazio, a tela orienta o cliente a ligar a versão com `www`.

## Venda de domínios: trocar o registrador de teste por um de verdade

Hoje a compra usa o **registrador de teste** (`DOMAIN_REGISTRAR=mock`, ligado só em dev):
preços simulados, nada é registrado nem cobrado. Para vender de verdade:

1. **Contratar uma revenda de domínios com API** (conta em nome da IOS System). Antes de
   assinar, confirmar se ela registra **`.com.br`** pela API. Para `.br`, a outra alternativa
   é virar provedor credenciado no Registro.br/NIC.br (processo próprio, com integração EPP).
2. **Criar o provedor** em `apps/api/src/modules/site-domains/registrar.ts`: uma classe com a
   mesma interface do de teste (`quote` = disponibilidade e preço; `register` = registrar no
   nome do titular e apontar o DNS para `SITE_DOMAIN_CNAME`/`SITE_DOMAIN_IPS`), escolhida por
   `DOMAIN_REGISTRAR=<nome>`. As chaves da revenda vão no `.env` do servidor, nunca no código.
3. **Definir os preços de venda** (margem sobre o custo da revenda) no provedor.

### Ainda não existe (próximos passos)

- **Cobrança integrada**: hoje a cobrança é por fora e a equipe marca como pago no console.
- **Renovação anual**: o vencimento (`expiresAt`) fica gravado e aparece para a empresa e no
  console, mas ainda não há aviso automático nem renovação. Sem renovar, o domínio expira no
  registrador e o site deixa de abrir nele.
- **Transferência para fora** (código de transferência) e troca de titular.
- **Cadastro automático na Cloudflare** (só se a opção B for escolhida).
