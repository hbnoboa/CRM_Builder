# Analise: Sistemas de Tickets, Sinistros e Documentos no CRM Builder

> Documento consolidado comparando funcionalidades de sistemas de gestao com as capacidades do CRM Builder.

---

## 1. Sistemas Analisados

### 1.1 Sistema de Tickets (Referencia: Screenshots do Sidebar)

Sistema de gestao de projetos/tickets com as seguintes funcionalidades:

| Item | Descricao | Tipo |
|------|-----------|------|
| Quadro Kanban | Cards em colunas por status com drag-drop | Visualizacao |
| Hierarquia | Arvore de relacionamentos pai-filho | Visualizacao |
| Gantt | Timeline com dependencias e datas | Visualizacao |
| Sprints | Ciclos de tempo (ex: 2 semanas) | Agrupamento |
| Projetos | Containers de alto nivel | Entidade |
| Epics | Grandes iniciativas que agrupam historias | Entidade |
| Historias | User stories | Entidade |
| Todas as Tarefas | Lista consolidada | Visualizacao |
| Rascunhos | Items em draft | Filtro |
| Estatisticas | Dashboards e metricas | Dashboard |
| Pessoas | Gestao de usuarios | Modulo |
| Equipes | Times/squads | Entidade |
| DAs | Departamentos/Areas | Entidade |
| Documentos | Wiki com pastas hierarquicas | Entidade + Sub-entity |
| Decisoes | ADRs/registros de decisoes | Entidade |

### 1.2 iOS Risk (Gestao de Sinistros de Transporte)

Sistema completo de gestao de sinistros com:

**Entidades de Cadastro:**
- Segurados (nome, CNPJ, cidade, estado)
- Seguradoras (razao social, CNPJ, email)
- Corretores (nome, email, telefone)
- Transportadoras (razao social, CNPJ, RNTRC)
- Reguladoras (razao social, CNPJ)
- Gerenciadoras de Risco (razao social, CNPJ)

**Entidade Principal - Sinistro:**
- 30+ campos (partes envolvidas, identificacao, evento, valores, motorista/rota)
- Status workflow: Pendente → Em Andamento → Concluido → Cancelado → Negado
- Prioridades: Baixa, Media, Alta, Urgente
- SLA com timer e deadlines por prioridade
- Causas: ACIDENTE, AVARIA, ROUBO
- Classificacoes: COLISAO, TOMBAMENTO, FURTO, INCENDIO, etc.

**Sub-entidades:**
- Veiculos (cavalo, carreta 1, carreta 2)
- Documentos (14 tipos obrigatorios com checklist)
- Follow-ups (contatos, acoes, proximos passos)

**Funcionalidades:**
- Dashboard com KPIs (total, em andamento, prejuizo, SLA compliance)
- Kanban board com drag-drop
- Cross-filter (clicar em grafico filtra tabela)
- Timeline de acoes
- Notificacoes de SLA violado
- Roles: Admin, Gerente, Corretor, Visualizador
- Tags para classificacao
- Politicas de SLA configuraveis

---

## 2. Capacidades Atuais do CRM Builder

### 2.1 Sistema de Entidades

| Capacidade | Status | Observacoes |
|------------|--------|-------------|
| Entidades dinamicas | ✅ Pronto | Nome, slug, icone, cor, categoria |
| 47+ tipos de campo | ✅ Pronto | text, number, date, relation, etc. |
| Relacionamentos (relation) | ✅ Pronto | Display field, lookup |
| Sub-entidades (sub-entity) | ✅ Pronto | parentRecordId, hierarquia |
| Workflow status | ✅ Pronto | Transicoes, regras, cores |
| SLA status | ✅ Pronto | Deadline, countdown, alertas |
| Timer | ✅ Pronto | Tempo gasto em registros |
| Formula | ✅ Pronto | Campos calculados |
| Tags | ✅ Pronto | Multi-select com cores |
| User select | ✅ Pronto | Atribuicao de usuarios |
| Lookup | ✅ Pronto | Busca cross-entity |
| API select | ✅ Pronto | Integracao externa |

### 2.2 Sistema de Dashboards

| Widget | Status | Uso |
|--------|--------|-----|
| data-table | ✅ Pronto | Listagem com CRUD |
| mini-table | ✅ Pronto | Tabela compacta |
| kpi-card | ✅ Pronto | Metricas principais |
| number-card | ✅ Pronto | Valores numericos |
| stat-list | ✅ Pronto | Rankings |
| area-chart | ✅ Pronto | Tendencias |
| line-chart | ✅ Pronto | Series temporais |
| bar-chart | ✅ Pronto | Comparacoes |
| column-chart | ✅ Pronto | Distribuicoes |
| pie-chart | ✅ Pronto | Proporcoes |
| donut-chart | ✅ Pronto | Status distribution |
| funnel-chart | ✅ Pronto | Pipeline |
| gauge-chart | ✅ Pronto | Indicadores |
| heatmap-chart | ✅ Pronto | Correlacoes |
| treemap-chart | ✅ Pronto | Hierarquias |
| activity-feed | ✅ Pronto | Timeline de acoes |
| filter-slicer | ✅ Pronto | Filtros dinamicos |

### 2.3 Sistema de Automacao

| Funcionalidade | Status | Uso |
|----------------|--------|-----|
| Triggers ON_CREATE | ✅ Pronto | Ao criar registro |
| Triggers ON_UPDATE | ✅ Pronto | Ao atualizar |
| Triggers ON_STATUS_CHANGE | ✅ Pronto | Mudanca de status |
| Triggers ON_FIELD_CHANGE | ✅ Pronto | Mudanca de campo |
| Triggers SCHEDULE | ✅ Pronto | Cron jobs |
| Action: send_email | ✅ Pronto | Notificacoes |
| Action: update_field | ✅ Pronto | Atualizacoes automaticas |
| Action: create_record | ✅ Pronto | Criar registros |
| Action: notify_user | ✅ Pronto | Notificar usuarios |
| Action: call_webhook | ✅ Pronto | Integracoes |
| Action: change_status | ✅ Pronto | Transicoes |
| Escalation Service | ✅ Pronto | SLA breach actions |

### 2.4 Permissoes e RBAC

| Funcionalidade | Status |
|----------------|--------|
| CustomRole por tenant | ✅ Pronto |
| Role types (ADMIN, MANAGER, USER, VIEWER, CUSTOM) | ✅ Pronto |
| Scope (all, own) | ✅ Pronto |
| Permissoes por entidade (CRUD) | ✅ Pronto |
| Data filters por role | ✅ Pronto |
| visibleToRoles em registros | ✅ Pronto |

---

## 3. Gap Analysis

### 3.1 Funcionalidades que FALTAM

| Funcionalidade | Prioridade | Esforco | Descricao |
|----------------|------------|---------|-----------|
| **Widget Kanban** | ALTA | 2-3 dias | Cards em colunas com drag-drop por status |
| **Widget Gantt** | MEDIA | 3-5 dias | Timeline com dependencias |
| **Sidebar com secoes** | MEDIA | 1 dia | Agrupar entidades por categoria |
| **Busca global (Cmd+K)** | BAIXA | 1-2 dias | Busca cross-entity |
| **Checklist de documentos** | MEDIA | 1 dia | Campo especial ou config de sub-entity |
| **Notificacoes in-app** | MEDIA | 2 dias | Popover com alertas em tempo real |

### 3.2 Funcionalidades que EXISTEM mas precisam ADAPTACAO

| Funcionalidade | Adaptacao Necessaria |
|----------------|---------------------|
| Cross-filter | Configurar cross-filter context nos widgets |
| Timeline | Usar activity-feed widget + audit log |
| Documentos/Wiki | Entidade com richtext + sub-entity para pastas |
| Follow-ups | Sub-entity com campos de contato |
| SLA Timer | Configurar sla-status field + escalation |

---

## 4. Arquitetura Proposta

### 4.1 Para Sistema de Tickets

```
Tenant: Gestao de Projetos
│
├── Entidades
│   ├── Projeto
│   │   ├── nome (text)
│   │   ├── descricao (richtext)
│   │   ├── status (workflow-status)
│   │   ├── responsavel (user-select)
│   │   └── dataInicio, dataFim (date)
│   │
│   ├── Epic
│   │   ├── titulo (text)
│   │   ├── projeto (relation → Projeto)
│   │   ├── status (workflow-status)
│   │   └── prioridade (select)
│   │
│   ├── Historia
│   │   ├── titulo (text)
│   │   ├── epic (relation → Epic)
│   │   ├── pontos (number)
│   │   └── status (workflow-status)
│   │
│   ├── Tarefa
│   │   ├── titulo (text)
│   │   ├── historia (relation → Historia)
│   │   ├── responsavel (user-select)
│   │   ├── status (workflow-status: Backlog, Doing, Done)
│   │   ├── prioridade (select)
│   │   ├── tempoGasto (timer)
│   │   ├── prazo (sla-status)
│   │   └── sprint (relation → Sprint)
│   │
│   ├── Sprint
│   │   ├── nome (text)
│   │   ├── dataInicio, dataFim (date)
│   │   └── totalTarefas (rollup)
│   │
│   ├── Documento
│   │   ├── titulo (text)
│   │   ├── conteudo (richtext)
│   │   ├── projeto (relation → Projeto)
│   │   └── sub-entity: Paginas (hierarquia)
│   │
│   └── Decisao
│       ├── titulo (text)
│       ├── descricao (richtext)
│       ├── status (select: Proposta, Aprovada, Rejeitada)
│       └── projeto (relation → Projeto)
│
└── Dashboards
    ├── Visao Geral (KPIs, status por projeto)
    ├── Sprint Atual (tarefas, burndown)
    ├── Kanban Board (widget kanban) ← NOVO
    └── Gantt (widget gantt) ← NOVO
```

### 4.2 Para Sistema iOS Risk (Sinistros)

```
Tenant: iOS Risk
│
├── Entidades de Cadastro
│   ├── Segurado
│   │   ├── nome (text)
│   │   ├── cnpj (cnpj)
│   │   ├── cidade (text)
│   │   └── estado (select: UFs)
│   │
│   ├── Seguradora
│   │   ├── razaoSocial (text)
│   │   ├── cnpj (cnpj)
│   │   └── email (email)
│   │
│   ├── Corretor
│   │   ├── nome (text)
│   │   ├── email (email)
│   │   └── telefone (phone)
│   │
│   ├── Transportadora
│   │   ├── razaoSocial (text)
│   │   ├── cnpj (cnpj)
│   │   └── rntrc (text)
│   │
│   ├── Reguladora
│   │   ├── razaoSocial (text)
│   │   └── cnpj (cnpj)
│   │
│   └── Gerenciadora
│       ├── razaoSocial (text)
│       └── cnpj (cnpj)
│
├── Entidade Principal
│   └── Sinistro
│       ├── -- Partes Envolvidas --
│       ├── corretor (relation → Corretor)
│       ├── seguradora (relation → Seguradora)
│       ├── segurado (relation → Segurado)
│       ├── transportadora (relation → Transportadora)
│       ├── reguladora (relation → Reguladora)
│       ├── gerenciadora (relation → Gerenciadora)
│       │
│       ├── -- Identificacao --
│       ├── numApolice (text)
│       ├── ramo (select: Transporte Nacional, Internacional, RCTR-C, RCF-DC)
│       ├── numSeguradora (text)
│       ├── numReguladora (text)
│       │
│       ├── -- Evento --
│       ├── causa (select: ACIDENTE, AVARIA, ROUBO)
│       ├── classificacao (select: COLISAO, TOMBAMENTO, ...)
│       ├── mercadoria (select: Alimentos, Eletronicos, ...)
│       ├── dataHoraEvento (datetime)
│       ├── dataHoraAviso (datetime)
│       ├── localEvento (text)
│       │
│       ├── -- Status e SLA --
│       ├── status (workflow-status: Pendente, Em Andamento, Concluido, Cancelado, Negado)
│       ├── prioridade (select: Baixa, Media, Alta, Urgente)
│       ├── sla (sla-status)
│       ├── tags (tags)
│       │
│       ├── -- Valores --
│       ├── valorNota (currency)
│       ├── prejuizo (currency)
│       ├── valorIndenizado (currency)
│       ├── franquia (currency)
│       ├── salvados (currency)
│       ├── despesasRegulacao (currency)
│       │
│       ├── -- Motorista e Rota --
│       ├── motorista (text)
│       ├── cpfMotorista (cpf)
│       ├── remetente (text)
│       ├── localOrigem (text)
│       ├── destinatario (text)
│       ├── localDestino (text)
│       │
│       ├── -- Descricao --
│       ├── descricao (textarea)
│       ├── observacoes (textarea)
│       │
│       ├── -- Sub-entidades --
│       ├── veiculos (sub-entity)
│       │   ├── tipo (select: Cavalo, Carreta 1, Carreta 2)
│       │   ├── marca (text)
│       │   ├── modelo (text)
│       │   ├── placa (text)
│       │   └── ano (number)
│       │
│       ├── documentos (sub-entity)
│       │   ├── tipo (select: NF, CTE, MDFE, Averbacao, CNH, BO, ...)
│       │   ├── arquivo (file)
│       │   ├── dataEnvio (datetime)
│       │   └── status (select: Pendente, Enviado, Aprovado)
│       │
│       └── followUps (sub-entity)
│           ├── dataHora (datetime)
│           ├── tipoContato (select: Ligacao, Email, WhatsApp, Visita, ...)
│           ├── contato (text)
│           ├── telefoneEmail (text)
│           ├── descricao (textarea)
│           ├── prioridade (select)
│           ├── proximaAcao (text)
│           └── dataPrevista (date)
│
├── Administracao
│   ├── Tags (configuracao de entidade ou entidade separada)
│   └── Politicas SLA (configuracao ou entidade)
│
└── Dashboards
    ├── Dashboard Geral
    │   ├── KPIs: Total, Em Andamento, Prejuizo, SLA Compliance
    │   ├── Donut: Por Status
    │   ├── Bar: Por Causa
    │   └── Activity Feed
    │
    ├── Sinistros
    │   ├── Data Table (listagem principal)
    │   ├── Kanban Board ← NOVO
    │   └── Filter Slicers
    │
    ├── Por Corretor
    │   ├── Bar: Sinistros por Corretor
    │   └── Stat List: Top Mercadorias
    │
    └── SLA Report
        ├── KPIs: Compliance, Dentro do Prazo, Em Atencao, Violados
        ├── Bar: Tempo Medio por Prioridade
        └── Heatmap: Prioridade x Status
```

---

## 5. Implementacao do Widget Kanban

### 5.1 Especificacao

**Tipo:** `kanban-board`

**Configuracao:**
```typescript
interface KanbanWidgetConfig {
  entitySlug: string;
  statusField: string; // campo workflow-status
  columns: {
    value: string;
    label: string;
    color: string;
  }[];
  cardFields: {
    title: string; // campo para titulo do card
    subtitle?: string; // campo para subtitulo
    badges?: string[]; // campos para badges
    avatar?: string; // campo user-select para avatar
    footer?: string[]; // campos para rodape
  };
  enableDragDrop: boolean;
  showColumnCount: boolean;
  showAddButton: boolean;
}
```

**Funcionalidades:**
- Arrastar cards entre colunas (atualiza status)
- Contador de cards por coluna
- Botao + para criar novo registro
- Click no card abre detalhe
- Indicador de SLA no card
- Avatar do responsavel
- Badges de prioridade, causa, etc.

### 5.2 Estrutura de Arquivos

```
apps/web-admin/src/components/dashboard-widgets/
├── kanban-board/
│   ├── kanban-board-widget.tsx    # Componente principal
│   ├── kanban-column.tsx          # Coluna do kanban
│   ├── kanban-card.tsx            # Card individual
│   ├── use-kanban-drag-drop.ts    # Hook para drag-drop
│   └── kanban-board-config.tsx    # Configuracao do widget
```

---

## 6. Roadmap de Implementacao

### Fase 1: Core (3-5 dias)
- [ ] Widget Kanban com drag-drop
- [ ] Sidebar com secoes colapsiveis
- [ ] Cross-filter entre widgets

### Fase 2: Melhorias (2-3 dias)
- [ ] Checklist de documentos (config de sub-entity)
- [ ] Notificacoes in-app
- [ ] Busca global (Cmd+K)

### Fase 3: Avancado (5-7 dias)
- [ ] Widget Gantt
- [ ] Sprints com burndown
- [ ] Dashboards por periodo

---

## 7. Conclusao

### Compatibilidade

| Sistema | Compatibilidade | Observacoes |
|---------|-----------------|-------------|
| Tickets/Projetos | 85% | Falta Kanban e Gantt |
| iOS Risk/Sinistros | 90% | Falta Kanban |
| Documentos/Wiki | 80% | Via entidade + sub-entity |

### Principais Gaps

1. **Widget Kanban** - Essencial para os 3 sistemas
2. **Widget Gantt** - Importante para projetos
3. **Sidebar com categorias** - UX melhorada

### Recomendacao

O CRM Builder ja possui a grande maioria das funcionalidades necessarias. Com a implementacao do **Widget Kanban** (estimativa: 2-3 dias), sera possivel atender 95%+ dos casos de uso apresentados.

A arquitetura atual de entidades dinamicas, sub-entidades, workflow-status, SLA e automacoes fornece uma base solida para construir qualquer sistema de gestao similar sem necessidade de codigo customizado.
