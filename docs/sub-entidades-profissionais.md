# 🎨 Sub-Entidades Profissionais - Guia de Uso

## 📋 Visão Geral

Implementamos **3 componentes profissionais** para melhorar drasticamente a visualização de sub-entidades no CRM Builder:

### **1. SubEntityFieldEnhanced** - Formulário Melhorado
Substitui o componente básico com **3 modos de visualização** + busca + ordenação

### **2. SubEntityListWidget** - Dashboard: Lista/Cards
Widget de dashboard para exibir sub-entidades em formato de lista ou cards agrupados

### **3. SubEntityTimelineWidget** - Dashboard: Timeline
Widget de timeline vertical ideal para follow-ups, histórico de atividades, comentários

---

## 🚀 1. SubEntityFieldEnhanced (Formulário)

### **Recursos:**
- ✅ **3 Modos de Visualização:**
  - 📊 **Tabela** - Layout clássico com colunas
  - 🃏 **Cards** - Cards responsivos em grid
  - ⏱️ **Timeline** - Timeline vertical com ícones de status

- ✅ **Busca em Tempo Real** - Filtra por qualquer campo visível
- ✅ **Ordenação Avançada:**
  - Mais recentes / Mais antigos
  - Atualizados recentes / Atualizados antigos

- ✅ **Status Badges Visuais** - Colorização automática por status
- ✅ **Menu de Ações** - Edit/Delete em dropdown
- ✅ **Informações Contextuais** - Data, hora, usuário criador
- ✅ **Responsivo** - Design mobile-first

### **Como Usar:**

#### **Opção A: Substituir Globalmente (Recomendado)**

Renomear os arquivos para usar o componente melhorado em todos os formulários:

```bash
cd apps/web-admin/src/components/data

# Backup do componente original
mv sub-entity-field.tsx sub-entity-field-basic.tsx

# Ativar componente melhorado
mv sub-entity-field-enhanced.tsx sub-entity-field.tsx
```

**Pronto!** Todos os formulários com sub-entidades agora usam o componente melhorado automaticamente.

#### **Opção B: Uso Seletivo**

Importar explicitamente onde desejar:

```tsx
import SubEntityFieldEnhanced from '@/components/data/sub-entity-field-enhanced';

<SubEntityFieldEnhanced
  parentRecordId={record.id}
  subEntitySlug="sinistro-followups"
  subEntityId={field.subEntityId}
  subEntityDisplayFields={['data_hora', 'tipo_contato', 'status', 'descricao']}
  label="Follow Ups"
  variant="timeline"  // 'table' | 'cards' | 'timeline'
  enableSearch={true}
  enableSort={true}
/>
```

### **Props:**

| Prop | Tipo | Padrão | Descrição |
|------|------|--------|-----------|
| `parentRecordId` | string | - | ID do registro pai (obrigatório) |
| `subEntitySlug` | string | - | Slug da sub-entidade (obrigatório) |
| `subEntityId` | string | - | ID da sub-entidade (obrigatório) |
| `subEntityDisplayFields` | string[] | primeiros 4 | Campos a exibir |
| `label` | string | nome da entidade | Título do campo |
| `readOnly` | boolean | false | Modo somente leitura |
| **`variant`** | 'table' \| 'cards' \| 'timeline' | 'cards' | **Modo de visualização inicial** |
| **`enableSearch`** | boolean | true | **Habilitar busca** |
| **`enableSort`** | boolean | true | **Habilitar ordenação** |
| **`enableFilter`** | boolean | false | **Habilitar filtros** (futuro) |

### **Screenshots Conceituais:**

#### Modo Tabela:
```
┌─────────────────────────────────────────────────────┐
│ 📄 Follow Ups                        [═] [▦] [⏱]  │
├─────────────────────────────────────────────────────┤
│ 🔍 Buscar...    ▼ Mais recentes                   │
├─────────────────────────────────────────────────────┤
│ Data/Hora    │ Tipo     │ Status   │ Descrição    │
├──────────────┼──────────┼──────────┼──────────────┤
│ 01/04 14:30  │ Telefone │ Concluído│ Contato OK   │
│ 28/03 10:15  │ Email    │ Pendente │ Aguardando... │
└─────────────────────────────────────────────────────┘
```

#### Modo Cards:
```
┌──────────────────┐ ┌──────────────────┐
│ Contato OK       │ │ Aguardando resp. │
│ 📅 01/04  👤 João│ │ 📅 28/03  👤 Maria│
│                  │ │                  │
│ Tipo: Telefone   │ │ Tipo: Email      │
│ Status: ✅ Concluído│ │ Status: ⏳ Pend. │
└──────────────────┘ └──────────────────┘
```

#### Modo Timeline:
```
    ●─┐  Contato realizado com sucesso
      │  📅 01/04/26 14:30  👤 João Silva
      │  Tipo: Telefone | Status: ✅ Concluído
      │  Descrição: Cliente confirmou recebimento...
      │
    ○─┐  Aguardando retorno do cliente
      │  📅 28/03/26 10:15  👤 Maria Santos
      │  Tipo: Email | Status: ⏳ Pendente
      │  Descrição: Email enviado solicitando...
```

---

## 📊 2. SubEntityListWidget (Dashboard)

Widget de dashboard para exibir listas de sub-entidades com agrupamento opcional.

### **Recursos:**
- ✅ Lista/Cards de sub-registros
- ✅ **Agrupamento** por campo (ex: status, tipo)
- ✅ Filtro por registro pai
- ✅ Informações do pai (opcional)
- ✅ Click para drill-through
- ✅ Contador de registros
- ✅ Badge de status colorido

### **Como Adicionar ao Dashboard:**

#### 1. **Registrar o Widget no Sistema**

Adicionar aos tipos de widget disponíveis:

```typescript
// apps/web-admin/src/components/dashboard-widgets/entity-dashboard.tsx

import SubEntityListWidget from './sub-entity-list-widget';

const WIDGET_COMPONENTS = {
  // ... widgets existentes
  'sub-entity-list': SubEntityListWidget,
};
```

#### 2. **Configurar no Dashboard Template**

Exemplo: Dashboard de Sinistros mostrando Follow-Ups:

```typescript
// Exemplo via seed ou criação manual
const dashboardConfig = {
  layout: [
    { i: 'followups-list', x: 0, y: 0, w: 6, h: 10 },
  ],
  widgets: {
    'followups-list': {
      type: 'sub-entity-list',
      title: 'Follow-Ups Recentes',
      config: {
        entitySlug: 'sinistros',
        subEntitySlug: 'sinistro-followups',
        displayFields: ['data_hora', 'tipo_contato', 'status', 'descricao'],
        groupBy: 'status',  // Agrupar por status
        limit: 20,
        showParentInfo: false,
      },
    },
  },
};
```

### **Config Props:**

| Prop | Tipo | Descrição |
|------|------|-----------|
| `entitySlug` | string | Slug da entidade pai |
| `subEntitySlug` | string | Slug da sub-entidade |
| `parentRecordId` | string | (Opcional) Filtrar por pai específico |
| `displayFields` | string[] | Campos a exibir |
| **`groupBy`** | string | **Campo para agrupar** (ex: 'status') |
| `limit` | number | Máximo de registros (padrão: 10) |
| `showParentInfo` | boolean | Mostrar info do registro pai |
| `title` | string | Título customizado |

### **Exemplo de Uso no Tenant Marisa Dilda:**

```typescript
{
  type: 'sub-entity-list',
  title: 'Documentos Pendentes',
  config: {
    entitySlug: 'sinistros',
    subEntitySlug: 'sinistro-documentos',  // Se criar sub-entidade de docs
    displayFields: ['tipo_documento', 'status', 'data_upload'],
    groupBy: 'status',
    limit: 15,
  },
}
```

---

## ⏱️ 3. SubEntityTimelineWidget (Dashboard)

Widget de timeline vertical ideal para histórico de atividades.

### **Recursos:**
- ✅ Timeline vertical com conectores
- ✅ Ícones de status automáticos (✓, ✗, ⏱, ○)
- ✅ Tempo relativo ("Há 2h", "Há 3 dias")
- ✅ Cards expansíveis
- ✅ Info do usuário e timestamp
- ✅ Descrições com line-clamp
- ✅ Cores por status

### **Como Adicionar ao Dashboard:**

#### 1. **Registrar o Widget**

```typescript
// apps/web-admin/src/components/dashboard-widgets/entity-dashboard.tsx

import SubEntityTimelineWidget from './sub-entity-timeline-widget';

const WIDGET_COMPONENTS = {
  // ... widgets existentes
  'sub-entity-timeline': SubEntityTimelineWidget,
};
```

#### 2. **Configurar no Dashboard**

```typescript
const dashboardConfig = {
  layout: [
    { i: 'timeline-followups', x: 6, y: 0, w: 6, h: 12 },
  ],
  widgets: {
    'timeline-followups': {
      type: 'sub-entity-timeline',
      title: 'Histórico de Follow-Ups',
      config: {
        subEntitySlug: 'sinistro-followups',
        titleField: 'tipo_contato',
        descriptionField: 'descricao',
        statusField: 'status',
        dateField: 'data_hora',  // ou 'createdAt'
        limit: 15,
        sortOrder: 'desc',  // Mais recentes primeiro
      },
    },
  },
};
```

### **Config Props:**

| Prop | Tipo | Padrão | Descrição |
|------|------|--------|-----------|
| `subEntitySlug` | string | - | Slug da sub-entidade |
| `parentRecordId` | string | - | (Opcional) Filtrar por pai |
| `titleField` | string | primeiro campo | Campo para título |
| `descriptionField` | string | auto-detect | Campo para descrição |
| `statusField` | string | - | Campo de status (para cores/ícones) |
| `dateField` | string | 'createdAt' | Campo de data |
| `limit` | number | 10 | Máximo de itens |
| `sortOrder` | 'asc' \| 'desc' | 'desc' | Ordem cronológica |
| `title` | string | auto | Título customizado |

### **Auto-Detecção de Campos:**

O widget detecta automaticamente:
- **Descrição:** Campos com `descr`, `observ`, `nota` no slug
- **Status:** Usa ícones/cores baseados em palavras-chave:
  - ✅ Verde: "concluído", "aprovado", "finalizado"
  - ⏱️ Laranja: "pendente", "aguardando", "em andamento"
  - ✗ Vermelho: "cancelado", "rejeitado", "negado"
  - ○ Cinza: Outros

---

## 🎯 Exemplo Completo: Dashboard iOS Risk com Sub-Entidades

### **Cenário:** Dashboard de Sinistro mostrando Follow-Ups

```typescript
// seed-dashboard-sinistros-followups.ts

const dashboardTemplate = {
  tenantId: 'cmlgw7qy70001wyn7vlwiijcj', // marisa-dilda
  name: 'Sinistro - Visão Completa com Follow-Ups',
  entitySlug: 'sinistros',
  layout: [
    // KPIs
    { i: 'kpi-total', x: 0, y: 0, w: 3, h: 4 },
    { i: 'kpi-abertos', x: 3, y: 0, w: 3, h: 4 },
    { i: 'kpi-valor', x: 6, y: 0, w: 3, h: 4 },
    { i: 'kpi-sla', x: 9, y: 0, w: 3, h: 4 },

    // Charts
    { i: 'chart-causa', x: 0, y: 4, w: 6, h: 8 },
    { i: 'chart-status', x: 6, y: 4, w: 6, h: 8 },

    // SUB-ENTIDADES: Follow-Ups
    { i: 'followups-list', x: 0, y: 12, w: 6, h: 12 },      // Lista agrupada
    { i: 'followups-timeline', x: 6, y: 12, w: 6, h: 12 },  // Timeline
  ],
  widgets: {
    // ... KPIs e charts ...

    // Widget de Lista com Agrupamento
    'followups-list': {
      type: 'sub-entity-list',
      title: 'Follow-Ups por Status',
      config: {
        entitySlug: 'sinistros',
        subEntitySlug: 'sinistro-followups',
        displayFields: ['data_hora', 'tipo_contato', 'status', 'descricao'],
        groupBy: 'status',  // Agrupado: Concluído (5), Pendente (3), etc.
        limit: 20,
        showParentInfo: false,
      },
    },

    // Widget de Timeline
    'followups-timeline': {
      type: 'sub-entity-timeline',
      title: 'Histórico de Interações',
      config: {
        subEntitySlug: 'sinistro-followups',
        titleField: 'tipo_contato',
        descriptionField: 'descricao',
        statusField: 'status',
        dateField: 'data_hora',
        limit: 15,
        sortOrder: 'desc',
      },
    },
  },
};
```

### **Resultado Visual:**

```
┌─────────────────────────────────────────────────────────────────┐
│  Total: 30  │  Abertos: 12  │  R$ 2.5M  │  SLA: 85%            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  📊 Sinistros por Causa      │  🍩 Sinistros por Status        │
│  ───────────────────────────  │  ──────────────────────────────  │
│  Acidente     ████████ 45%   │  Novo          ⚫ 20%           │
│  Roubo        ████   25%     │  Em Análise    ⚫ 35%           │
│  Avaria       ███    20%     │  Concluído     ⚫ 45%           │
│                               │                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  📋 Follow-Ups por Status    │  ⏱️ Histórico de Interações     │
│  ───────────────────────────  │  ──────────────────────────────  │
│  ✅ Concluído (5)             │      ●─┐ Telefone               │
│  ┌──────────────────────┐    │        │ Há 2h · João Silva     │
│  │ Contato com cliente  │    │        │ ✅ Concluído            │
│  │ 01/04 14:30 · João   │    │        │ Cliente confirmou...   │
│  │ Status: ✅ Concluído  │    │      ○─┐ Email                  │
│  └──────────────────────┘    │        │ Há 1 dia · Maria       │
│                               │        │ ⏳ Pendente             │
│  ⏳ Pendente (3)              │        │ Aguardando retorno...  │
│  ┌──────────────────────┐    │      ●─┐ WhatsApp               │
│  │ Email p/ reguladora  │    │        │ Há 2 dias · Carlos     │
│  │ 28/03 10:15 · Maria  │    │        │ ✅ Concluído            │
│  │ Status: ⏳ Pendente   │    │        │ Docs enviados...       │
│  └──────────────────────┘    │                                  │
│                               │                                  │
│  Ver todos →                  │  Ver todos →                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📝 Checklist de Implementação

### **Para o Formulário (SubEntityFieldEnhanced):**

- [ ] **Backup do componente original:**
  ```bash
  mv apps/web-admin/src/components/data/sub-entity-field.tsx \
     apps/web-admin/src/components/data/sub-entity-field-basic.tsx
  ```

- [ ] **Ativar componente melhorado:**
  ```bash
  mv apps/web-admin/src/components/data/sub-entity-field-enhanced.tsx \
     apps/web-admin/src/components/data/sub-entity-field.tsx
  ```

- [ ] **Testar em um formulário existente** (ex: Sinistros → Follow Ups)

- [ ] **Escolher modo padrão:** Editar para definir `variant` padrão
  ```tsx
  const [viewMode, setViewMode] = useState<'table' | 'cards' | 'timeline'>('timeline'); // ← Alterar aqui
  ```

### **Para os Widgets de Dashboard:**

- [ ] **Registrar widgets no sistema:**
  ```typescript
  // apps/web-admin/src/components/dashboard-widgets/entity-dashboard.tsx
  import SubEntityListWidget from './sub-entity-list-widget';
  import SubEntityTimelineWidget from './sub-entity-timeline-widget';

  const WIDGET_COMPONENTS = {
    // ... existentes
    'sub-entity-list': SubEntityListWidget,
    'sub-entity-timeline': SubEntityTimelineWidget,
  };
  ```

- [ ] **Adicionar aos tipos permitidos:**
  ```typescript
  // packages/shared/src/entity.ts ou onde estão definidos os widget types
  export type WidgetType =
    | 'kpi-card'
    | 'bar-chart'
    // ... outros
    | 'sub-entity-list'
    | 'sub-entity-timeline';
  ```

- [ ] **Criar dashboard de exemplo:**
  - Usar script seed (ver exemplo acima)
  - Ou criar manualmente via UI Admin

- [ ] **Testar no tenant marisa-dilda**

---

## 🎨 Customização

### **Cores e Ícones de Status**

Editar em cada componente as funções:
- `getStatusBadgeVariant()` - Variantes de badge
- `getStatusColor()` - Cor da timeline
- `getStatusIcon()` - Ícone do status

Exemplo:
```typescript
function getStatusIcon(status: unknown) {
  const statusStr = String(status).toLowerCase();

  // Adicionar novos status
  if (statusStr.includes('em_analise')) {
    return <Search className="h-4 w-4 text-blue-500" />;
  }
  if (statusStr.includes('conclu')) {
    return <CheckCircle className="h-4 w-4 text-green-500" />;
  }
  // ...
}
```

### **Campos de Display**

Configurar via props ou auto-detecção:
```tsx
<SubEntityFieldEnhanced
  subEntityDisplayFields={[
    'data_hora',      // Datetime
    'tipo_contato',   // Select
    'status',         // Select (com badge colorido)
    'descricao',      // Textarea
  ]}
/>
```

---

## 🚀 Próximos Passos

1. **Testar os componentes** no tenant marisa-dilda
2. **Criar dashboards específicos** para cada role (Admin, Corretor, Reguladora)
3. **Adicionar filtros avançados** (enableFilter prop)
4. **Implementar paginação** para muitos registros
5. **Adicionar ações em massa** (aprovar múltiplos, etc.)
6. **Exportar para PDF** diretamente do timeline

---

## 📚 Referências

- Componentes base: `apps/web-admin/src/components/data/`
- Widgets: `apps/web-admin/src/components/dashboard-widgets/`
- Tipos compartilhados: `packages/shared/src/entity.ts`
- Documentação de sub-entidades: `.claude/docs/sub-entities.md`

---

**Criado em:** 2026-04-06
**Versão:** 1.0
**Compatível com:** CRM Builder v1.0+
