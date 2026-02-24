# CRM Builder - Setup de Producao no Windows

## Requisitos Minimos

| Item | Minimo | Recomendado |
|------|--------|-------------|
| RAM | 8 GB | 16 GB |
| CPU | 4 cores | 8 cores |
| Disco | 30 GB livres | 50 GB livres |
| SO | Windows 10/11 (64-bit) | Windows 11 |

---

## Passo 1: Instalar Docker Desktop

1. Baixar em: https://www.docker.com/products/docker-desktop/
2. Executar o instalador
3. Durante a instalacao, marcar **"Use WSL 2 instead of Hyper-V"**
4. Reiniciar o computador quando pedido
5. Abrir o Docker Desktop e esperar inicializar (icone fica verde na bandeja)

### Verificar instalacao

Abrir **PowerShell** ou **Terminal** e rodar:

```powershell
docker --version
# Deve mostrar algo como: Docker version 27.x.x

docker compose version
# Deve mostrar algo como: Docker Compose version v2.x.x
```

### Configurar recursos do Docker

1. Abrir Docker Desktop
2. Ir em **Settings > Resources > WSL Integration**
3. Garantir que o WSL 2 esta ativado
4. Em **Settings > Resources > Advanced**:
   - Memory: pelo menos **4 GB** (recomendado 6 GB)
   - CPUs: pelo menos **2** (recomendado 4)
   - Disk: pelo menos **20 GB**

---

## Passo 2: Instalar Git

1. Baixar em: https://git-scm.com/download/win
2. Instalar com opcoes padrao
3. Verificar:

```powershell
git --version
```

---

## Passo 3: Instalar Node.js 20+

1. Baixar em: https://nodejs.org/ (versao LTS, 20 ou superior)
2. Instalar com opcoes padrao (marcar "Add to PATH")
3. Verificar:

```powershell
node --version
# Deve ser v20.x.x ou superior

npm --version
```

---

## Passo 4: Instalar pnpm

```powershell
npm install -g pnpm@10
```

Verificar:

```powershell
pnpm --version
# Deve ser 10.x.x
```

---

## Passo 5: Clonar o Repositorio

Escolher uma pasta onde vai ficar o projeto (ex: `C:\projetos`):

```powershell
cd C:\
mkdir projetos
cd projetos
git clone git@github.com:hbnoboa/CRM_Builder.git crm-builder
cd crm-builder
```

> **Nota:** Se der erro de SSH, configurar a chave SSH do GitHub primeiro:
> https://docs.github.com/en/authentication/connecting-to-github-with-ssh

Alternativa com HTTPS:

```powershell
git clone https://github.com/hbnoboa/CRM_Builder.git crm-builder
cd crm-builder
```

---

## Passo 6: Criar o arquivo .env.production

Na raiz do projeto (`C:\projetos\crm-builder`), criar o arquivo `.env.production` com o seguinte conteudo:

```env
# ===========================================
# CRM Builder - Production Environment (Windows)
# ===========================================

# Database
POSTGRES_USER=postgres
POSTGRES_PASSWORD=SuaSenhaSeguraAqui123
POSTGRES_DB=crm_builder

# Redis
REDIS_PASSWORD=SuaSenhaRedisAqui456

# JWT (IMPORTANTE: trocar para valores unicos e longos)
JWT_SECRET=MudeIstoParaUmaChaveSecretaLongaEAleatoriaComPeloMenos64Caracteres1234567890
JWT_REFRESH_SECRET=MudeIstoParaOutraChaveSecretaDiferenteLongaEAleatoriaComPeloMenos64Chars
JWT_EXPIRATION=1h
JWT_REFRESH_EXPIRATION=30d

# CORS - trocar SEU_IP pelo IP da maquina Windows na rede
# Para descobrir o IP: abrir PowerShell e rodar "ipconfig"
# Procurar "IPv4 Address" no adaptador de rede ativo
CORS_ORIGIN=http://SEU_IP

# API URL publica (path relativo funciona em qualquer host)
NEXT_PUBLIC_API_URL=/api/v1

# PowerSync (se estiver usando)
POWERSYNC_URL=http://SEU_IP:8081

# Node Environment
NODE_ENV=production
```

### Como descobrir seu IP

```powershell
ipconfig
```

Procurar a linha `IPv4 Address` no adaptador de rede ativo (Wi-Fi ou Ethernet).
Exemplo: `192.168.1.100`

Substituir `SEU_IP` por esse valor em todos os lugares do `.env.production`.

---

## Passo 7: Criar as pastas do Nginx

```powershell
# Na raiz do projeto
mkdir nginx\ssl -Force
mkdir nginx\logs -Force
```

A pasta `nginx/ssl` fica vazia por enquanto (so precisa de certificados se quiser HTTPS).

---

## Passo 8: Instalar dependencias e buildar

```powershell
# Na raiz do projeto
pnpm install
pnpm build
```

> **Nota:** O primeiro build pode demorar 5-10 minutos.
> Se der erro de Prisma, rodar: `cd apps\api && npx prisma generate && cd ..\..`

---

## Passo 9: Subir a producao

```powershell
# Buildar as imagens Docker
docker compose -f docker-compose.prod.yml build api web

# Subir todos os containers
docker compose -f docker-compose.prod.yml up -d

# Verificar se esta tudo rodando
docker compose -f docker-compose.prod.yml ps
```

Todos os 5 containers devem estar com status `Up` ou `healthy`:

| Container | Porta | Funcao |
|-----------|-------|--------|
| crm-postgres-prod | (interna) | Banco de dados |
| crm-redis-prod | (interna) | Cache |
| crm-api-prod | (interna 3001) | API NestJS |
| crm-web-prod | (interna 3000) | Frontend Next.js |
| crm-nginx-prod | 80, 443 | Proxy reverso (entrada) |

---

## Passo 10: Rodar o seed (primeira vez)

Somente na primeira vez, popular o banco com dados iniciais:

```powershell
# Entrar no container da API
docker exec -it crm-api-prod sh

# Dentro do container, rodar:
npx prisma migrate deploy
npx prisma db seed

# Sair do container
exit
```

---

## Passo 11: Testar

Abrir o navegador e acessar:

```
http://SEU_IP
```

Exemplo: `http://192.168.1.100`

Login padrao:
- Email: `superadmin@platform.com`
- Senha: `superadmin123`

> **IMPORTANTE:** Trocar a senha do super admin imediatamente apos o primeiro login.

---

## Passo 12: Configurar acesso externo (opcional)

Se quiser que pessoas fora da sua rede local acessem:

### 12.1 Port Forwarding no roteador

1. Acessar o painel do roteador (geralmente `192.168.1.1` ou `192.168.0.1`)
2. Procurar **Port Forwarding** ou **Encaminhamento de Portas**
3. Criar regra:
   - Porta externa: `80`
   - Porta interna: `80`
   - IP interno: IP da maquina Windows (ex: `192.168.1.100`)
   - Protocolo: TCP
4. Repetir para porta `443` se usar HTTPS

### 12.2 Windows Firewall

```powershell
# Abrir PowerShell como Administrador e rodar:

# Liberar porta 80 (HTTP)
netsh advfirewall firewall add rule name="CRM HTTP" dir=in action=allow protocol=tcp localport=80

# Liberar porta 443 (HTTPS)
netsh advfirewall firewall add rule name="CRM HTTPS" dir=in action=allow protocol=tcp localport=443
```

### 12.3 IP fixo ou DDNS

A maioria das conexoes residenciais tem IP publico dinamico (muda periodicamente).
Opcoes:

- **IP fixo:** Pedir ao provedor de internet (geralmente tem custo mensal)
- **DDNS gratuito:** Usar servicos como:
  - https://www.noip.com/
  - https://www.duckdns.org/
  - Configurar no roteador em **DDNS** com o servico escolhido
  - Voce recebe um endereco tipo `meucrm.duckdns.org`

---

## Comandos do Dia a Dia

### Ver status dos containers

```powershell
docker compose -f docker-compose.prod.yml ps
```

### Ver logs

```powershell
# Todos
docker compose -f docker-compose.prod.yml logs -f

# So a API
docker compose -f docker-compose.prod.yml logs -f api

# So o frontend
docker compose -f docker-compose.prod.yml logs -f web
```

### Parar tudo

```powershell
docker compose -f docker-compose.prod.yml down
```

### Reiniciar tudo

```powershell
docker compose -f docker-compose.prod.yml restart
```

### Atualizar o codigo e fazer deploy

```powershell
# 1. Puxar codigo novo do GitHub
git pull origin main

# 2. Instalar dependencias novas (se houver)
pnpm install

# 3. Buildar
pnpm build

# 4. Rebuildar e recriar containers
docker compose -f docker-compose.prod.yml build api web
docker compose -f docker-compose.prod.yml up -d api web

# 5. Reiniciar nginx
docker compose -f docker-compose.prod.yml restart nginx
```

---

## Configurar Mobile para apontar no Windows

Se o app mobile precisa apontar para esta maquina Windows, buildar o APK com:

```bash
flutter build apk --split-per-abi \
  --dart-define=API_URL=http://SEU_IP/api/v1 \
  --dart-define=POWERSYNC_URL=http://SEU_IP:8081
```

---

## Manter o Windows ligado 24/7

Para funcionar como servidor, a maquina precisa ficar ligada:

1. **Desativar suspensao:**
   - Configuracoes > Sistema > Energia > Tela e Suspensao
   - Colocar tudo em **Nunca**

2. **Docker Desktop iniciar com Windows:**
   - Docker Desktop > Settings > General > **Start Docker Desktop when you sign in** (marcar)

3. **Login automatico (opcional):**
   - Pressionar `Win + R`, digitar `netplwiz`, desmarcar "Users must enter a user name and password"

---

## Solucao de Problemas

### Container nao sobe

```powershell
# Ver logs de erro
docker compose -f docker-compose.prod.yml logs api
docker compose -f docker-compose.prod.yml logs postgres
```

### Porta 80 em uso

Outro programa pode estar usando a porta 80 (ex: IIS, Skype, Apache).

```powershell
# Descobrir quem esta usando a porta 80
netstat -ano | findstr ":80"
```

Se for o IIS:
```powershell
# Desativar IIS
iisreset /stop
```

### Docker Desktop nao inicia

1. Verificar se a virtualizacao esta ativada na BIOS
2. Verificar se o WSL 2 esta instalado: `wsl --status`
3. Se nao estiver: `wsl --install`

### Build falha

```powershell
# Limpar tudo e comecar de novo
pnpm clean
pnpm install
cd apps\api && npx prisma generate && cd ..\..
pnpm build
```

### Banco de dados com problema

```powershell
# Resetar o banco (APAGA TODOS OS DADOS)
docker compose -f docker-compose.prod.yml down -v
docker compose -f docker-compose.prod.yml up -d
# Esperar subir e rodar o seed novamente
```
