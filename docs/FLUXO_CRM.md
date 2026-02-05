# Passo a passo: Fluxo completo CRM Builder

Este guia cobre o fluxo principal do sistema, desde o cadastro de um tenant por um SuperAdmin até o uso por vendedores e usuários leitores.

## 1. SuperAdmin: Criar um novo Tenant

1. Faça login como SuperAdmin em `/pt-BR/login`.
2. Acesse o menu "Tenants" no dashboard.
3. Clique em "Criar Tenant".
4. Preencha os dados do novo tenant (nome, CNPJ, plano, etc).
5. Salve e confirme a criação.
6. O tenant aparecerá na lista e estará ativo.

## 2. SuperAdmin/Admin: Criar usuários para o Tenant

1. Selecione o tenant desejado.
2. Acesse o menu "Usuários".
3. Clique em "Adicionar Usuário".
4. Preencha os dados do usuário (nome, e-mail, papel: vendedor, leitor, etc).
5. Defina permissões e roles (ex: Vendedor, Leitor).
6. Salve o usuário.

## 3. Vendedor: Inserir dados no sistema

1. Faça login com o usuário vendedor em `/pt-BR/login`.
2. Acesse o menu "Entidades" ou "Dados".
3. Clique em "Criar" ou "Novo Registro".
4. Preencha os campos obrigatórios (ex: nome do cliente, valor, status, etc).
5. Salve o registro.
6. O dado ficará disponível para consulta e edição conforme permissões.

## 4. Usuário Leitor: Consultar dados

1. Faça login com o usuário leitor.
2. Acesse o menu "Dados" ou "Entidades".
3. Visualize os registros disponíveis.
4. Usuários leitores não podem editar, apenas visualizar.

## Observações
- Cada tenant tem seu próprio conjunto de dados e usuários.
- Permissões e roles são configuráveis por Admin/SuperAdmin.
- O fluxo pode ser adaptado conforme regras do negócio e módulos ativados.

## Dicas
- Use o LanguageSwitcher para trocar o idioma da interface.
- Sempre confira se está no tenant correto antes de criar ou consultar dados.

---

Este documento cobre o fluxo básico. Para detalhes sobre APIs, integrações ou customizações, consulte a documentação técnica ou o suporte.