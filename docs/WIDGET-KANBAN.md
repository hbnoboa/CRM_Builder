# 📌 Widget Kanban Board - Documentação

## ✅ **Widget Criado e Implementado!**

O **Kanban Board** agora é um widget normal, fácil de usar como qualquer outro widget do sistema!

---

## 🎯 **O Que É**

Widget de quadro Kanban com colunas agrupadas por um **campo categórico**, permitindo visualização tipo "board" com drag & drop (arraste e solte) de cards entre colunas.

**Tipo:** `kanban-board`

**Campos suportados:**
- ✅ **Select** - Mostra TODAS as opções (ex: Status, Prioridade, Fase)
- ✅ **Radio** - Mostra TODAS as opções (ex: Tipo, Categoria)
- ✅ **Checkbox** - 2 colunas fixas (✓ Sim / ✗ Não)
- ✅ **Relação** - Colunas dinâmicas (apenas valores existentes nos dados)

---

## 📊 **Visual**

```
┌─────────────┬─────────────┬─────────────┬─────────────┐
│  📋 Aberto  │ ⚡ Em       │ ⏳ Aguard.  │ ✅ Concluído│
│      (5)    │  Andamento  │  Regulação  │     (12)    │
│             │     (8)     │     (3)     │             │
├─────────────┼─────────────┼─────────────┼─────────────┤
│ ┌─────────┐ │ ┌─────────┐ │ ┌─────────┐ │ ┌─────────┐ │
│ │🔗 SIN-030│ │ │🔗 SIN-028│ │ │🔗 SIN-025│ │ │🔗 SIN-020│ │
│ │ Segurado │ │ │ Segurado │ │ │ Segurado │ │ │ Segurado │ │
│ │ ROUBO    │ │ │ AVARIA   │ │ │ ACIDENTE │ │ │ ROUBO    │ │
│ │ 🔴 Alta  │ │ │ 🟡 Média │ │ │ 🟢 Baixa │ │ │ 🟡 Média │ │
│ └─────────┘ │ └─────────┘ │ └─────────┘ │ └─────────┘ │
│             │             │             │             │
│ ┌─────────┐ │ ┌─────────┐ │             │ ┌─────────┐ │
│ │🔗 SIN-029│ │ │🔗 SIN-027│ │             │ │🔗 SIN-019│ │
│ │  ...     │ │ │  ...     │ │             │ │  ...     │ │
│ └─────────┘ │ └─────────┘ │             │ └─────────┘ │
└─────────────┴─────────────┴─────────────┴─────────────┘
        ↑ ARRASTE CARDS ENTRE COLUNAS ↑
```

---

## ⚙️ **Configuração**

### **Config Básico:**

```json
{
  "type": "kanban-board",
  "title": "📌 Quadro Kanban",
  "config": {
    "groupByField": "status",
    "cardTitleField": "id",
    "cardSubtitleFields": ["segurado", "causa"],
    "cardBadgeField": "prioridade",
    "sortBy": "createdAt",
    "sortOrder": "desc",
    "limit": 100
  }
}
```

### **Parâmetros:**

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `groupByField` | string | ✅ Sim | Campo **Select, Radio, Checkbox ou Relação** para agrupar em colunas (ex: "Status") |
| `cardTitleField` | string | ✅ Sim | Campo exibido como título do card (ex: "id") |
| `cardSubtitleFields` | string[] | ❌ Não | Array de campos exibidos como subtítulos |
| `cardBadgeField` | string | ❌ Não | Campo para badge/etiqueta (ex: "prioridade") |
| `sortBy` | string | ❌ Não | Campo para ordenar cards dentro das colunas |
| `sortOrder` | 'asc' \| 'desc' | ❌ Não | Ordem de classificação (padrão: 'desc') |
| `limit` | number | ❌ Não | Limite de cards totais (padrão: 100) |
| `columnOrder` | string[] | ❌ Não | Ordem específica das colunas (deve conter valores das opções do Select) |

**⚠️ IMPORTANTE:**
- O campo `groupByField` **DEVE** ser do tipo `select`, `radio`, `checkbox` ou `relation`
- **Select/Radio/Checkbox**: Mostra **todas as opções**, mesmo colunas vazias (sem registros)
- **Relação**: Mostra apenas valores que existem nos dados (dinâmico)
- Se usar `columnOrder`, os valores devem corresponder exatamente às opções do campo

---

## 🎨 **Exemplos de Uso**

### **1. Kanban de Sinistros (Completo)**

```json
{
  "type": "kanban-board",
  "title": "📌 Gestão de Sinistros",
  "config": {
    "groupByField": "status",
    "cardTitleField": "id",
    "cardSubtitleFields": ["segurado", "causa", "transportadora"],
    "cardBadgeField": "prioridade",
    "sortBy": "data_aviso",
    "sortOrder": "desc",
    "limit": 150,
    "columnOrder": [
      "Aberto",
      "Pendente",
      "Em Andamento",
      "Aguardando Regulação",
      "Concluído",
      "Cancelado",
      "Negado"
    ]
  }
}
```

### **2. Kanban de Projetos (Simples)**

```json
{
  "type": "kanban-board",
  "title": "📋 Projetos",
  "config": {
    "groupByField": "fase",
    "cardTitleField": "nome",
    "cardSubtitleFields": ["cliente"],
    "cardBadgeField": "urgencia",
    "limit": 50
  }
}
```

### **3. Kanban de Tickets (Sem Badge)**

```json
{
  "type": "kanban-board",
  "title": "🎫 Atendimentos",
  "config": {
    "groupByField": "situacao",
    "cardTitleField": "ticket_id",
    "cardSubtitleFields": ["assunto", "cliente"],
    "sortBy": "abertura",
    "sortOrder": "asc"
  }
}
```

### **4. Kanban com Checkbox (Pago/Não Pago)**

```json
{
  "type": "kanban-board",
  "title": "💰 Pagamentos",
  "config": {
    "groupByField": "pago",
    "cardTitleField": "numero_fatura",
    "cardSubtitleFields": ["cliente", "valor"],
    "cardBadgeField": "vencimento",
    "sortBy": "data_emissao",
    "sortOrder": "desc"
  }
}
```
**Resultado:** 2 colunas fixas: "✓ Sim" (pagos) e "✗ Não" (pendentes)

### **5. Kanban por Relação (Por Empresa)**

```json
{
  "type": "kanban-board",
  "title": "🏢 Sinistros por Empresa",
  "config": {
    "groupByField": "empresa_id",
    "cardTitleField": "numero",
    "cardSubtitleFields": ["segurado", "causa"],
    "cardBadgeField": "Status",
    "limit": 100
  }
}
```
**Resultado:** Colunas dinâmicas, uma para cada empresa que tem sinistros nos dados

---

## 📋 **Colunas do Kanban**

O comportamento das colunas depende do **tipo de campo**:

### **Select / Radio** → TODAS as opções (fixo)
Se o campo "Status" (tipo Select) tem as opções:
- Aberto
- Pendente
- Em Andamento
- Aguardando Regulação
- Concluído
- Cancelado
- Negado

O Kanban vai mostrar **7 colunas**, mesmo que:
- Não existam registros "Pendente" (coluna vazia com 0)
- Não existam registros "Negado" (coluna vazia com 0)

**Por quê?**
- ✅ **Visibilidade completa** do fluxo de trabalho
- ✅ Usuário vê **todas as etapas possíveis**
- ✅ Fácil de arrastar cards para **qualquer status**

### **Checkbox** → 2 colunas fixas
O Kanban sempre mostra:
- ✓ Sim (registros com valor `true`)
- ✗ Não (registros com valor `false`)

**Exemplo de uso:** Ativo/Inativo, Pago/Pendente, Concluído/Em aberto

### **Relação** → Colunas dinâmicas
O Kanban mostra apenas os valores que **existem nos dados**.

**Exemplo:** Se agrupar por "Empresa" (relação):
- Se existem 3 empresas nos registros → 3 colunas
- Se uma empresa não tem sinistros → não aparece coluna vazia

**Por quê?** Relações podem ter centenas de registros possíveis (empresas, usuários, etc.), então só mostramos os relevantes.

---

## 🎯 **Badges Automáticos**

O sistema detecta automaticamente a cor do badge baseado no valor:

| Valor | Cor | Variante |
|-------|-----|----------|
| **Alta**, **Urgente**, **High** | 🔴 Vermelho | destructive |
| **Média**, **Medium** | 🟡 Amarelo | default |
| **Baixa**, **Low** | 🟢 Cinza | secondary |
| Outros | ⚪ Outline | outline |

**Exemplo automático:**
- Badge com valor "Alta" → 🔴 Badge vermelho
- Badge com valor "Média" → 🟡 Badge amarelo
- Badge com valor "Baixa" → 🟢 Badge cinza

---

## 📐 **Layout Recomendado**

Para melhor visualização, use **largura total** (12 colunas) e **altura generosa**:

```json
{
  "i": "kanban-widget",
  "x": 0,
  "y": 0,
  "w": 12,
  "h": 16,
  "minW": 8,
  "minH": 12
}
```

**Dicas:**
- **Largura mínima:** 8 colunas (para caber 3-4 colunas kanban)
- **Altura recomendada:** 16 unidades (para scroll confortável)
- **Posição:** Geralmente sozinho em uma linha

---

## 🔄 **Drag & Drop**

**Status:** ✅ Implementado (visual)
**Funcionalidade:** Arraste cards entre colunas

**Nota:** Atualmente o drag & drop é **apenas visual**. Para **salvar a mudança de status** ao arrastar, será necessário:

1. Implementar hook `useMutation` para atualizar registro
2. Adicionar `onDragEnd` que chama API:
   ```typescript
   updateRecord(cardId, { [groupByField]: newColumnValue });
   ```

**Próxima versão:** Salvar mudanças automaticamente ao arrastar.

---

## 🚀 **Como Usar no Dashboard**

### **1. Via Interface (UI)**

1. Acessar: **Configurações → Dashboards**
2. Editar ou criar dashboard
3. Adicionar widget → Tipo: **"kanban-board"**
4. Configurar campos:
   - Campo de agrupamento (ex: status)
   - Campo do título (ex: id)
   - Campos dos subtítulos
   - Campo do badge (opcional)

### **2. Via SQL (Direto no Banco)**

```sql
-- Adicionar widget kanban a um dashboard existente
UPDATE "DashboardTemplate"
SET
  widgets = widgets || '{
    "meu-kanban": {
      "type": "kanban-board",
      "title": "📌 Meu Kanban",
      "config": {
        "groupByField": "status",
        "cardTitleField": "nome",
        "cardSubtitleFields": ["cliente"],
        "cardBadgeField": "prioridade"
      }
    }
  }'::jsonb,

  layout = layout || '[
    {"i":"meu-kanban","x":0,"y":0,"w":12,"h":16}
  ]'::jsonb

WHERE id = 'SEU_DASHBOARD_ID';
```

### **3. Em uma Aba (Tab)**

```sql
-- Adicionar aba Kanban a um dashboard
UPDATE "DashboardTemplate"
SET
  tabs = tabs || '[{
    "id": "kanban",
    "label": "📌 Kanban",
    "widgetIds": ["meu-kanban"]
  }]'::jsonb

WHERE id = 'SEU_DASHBOARD_ID';
```

---

## 🎨 **Responsividade**

- **Desktop:** Mostra até 4-5 colunas lado a lado
- **Tablet:** 2-3 colunas com scroll horizontal
- **Mobile:** 1-2 colunas com scroll horizontal

**Scroll:** Horizontal entre colunas, vertical dentro de cada coluna.

---

## 📊 **Integração com Dashboard iOS Risk**

O widget foi **automaticamente adicionado** ao dashboard "iOS Risk - Dashboard Completo":

```
┌──────────────────────────────────────────────────────┐
│ [📊 Visão Geral] [📌 Kanban] [⏱️ SLA] [👔 Por Corretor] │
└──────────────────────────────────────────────────────┘
```

**Aba Kanban:**
- Widget: `kanban-widget`
- Agrupamento: Por campo "status"
- Título do card: "id" (ex: SIN-030)
- Subtítulos: "segurado" + "causa"
- Badge: "prioridade" (🔴 Alta, 🟡 Média, 🟢 Baixa)

---

## ✅ **Checklist de Funcionalidades**

- ✅ **Agrupamento** por campo configurável
- ✅ **Cards visuais** com título, subtítulos e badge
- ✅ **Drag & drop** entre colunas
- ✅ **Cores automáticas** para badges
- ✅ **Ordenação** configurável dentro das colunas
- ✅ **Limite** de cards exibidos
- ✅ **Ordem customizada** de colunas
- ✅ **Scroll** horizontal e vertical
- ✅ **Responsivo** para todos os dispositivos
- ✅ **Contador** de cards por coluna
- ⏳ **Salvar no banco** ao arrastar (próxima versão)

---

## 🔧 **Troubleshooting**

### **Colunas não aparecem:**
- Verifique se o campo `groupByField` existe na entidade
- Confira se há registros com valores diferentes nesse campo

### **Cards vazios:**
- Verifique se o campo `cardTitleField` tem valores
- Campos null/undefined aparecem vazios

### **Badge não aparece:**
- Verifique se o campo `cardBadgeField` está correto
- Campos null não exibem badge

### **Drag & drop não salva:**
- Comportamento esperado na versão atual
- Apenas visual, não persiste mudanças

---

## 🎯 **Próximas Melhorias**

1. **Persistir mudanças** ao arrastar cards
2. **Filtros** por coluna
3. **Busca** de cards
4. **Limites** por coluna
5. **Criar novo card** direto no kanban
6. **Editar inline** no card
7. **Avatares** de responsáveis
8. **Prazo** visual no card

---

## 📚 **Arquivos Criados**

- **Widget:** `apps/web-admin/src/components/dashboard-widgets/kanban-board-widget.tsx`
- **Tipo:** `packages/shared/src/dashboard-template.ts` (tipo `kanban-board` adicionado)
- **Registro:** `apps/web-admin/src/components/dashboard-widgets/entity-dashboard.tsx` (case adicionado)

---

## 🎉 **Status**

✅ **Implementado** e **funcionando**!
✅ **Adicionado** ao dashboard iOS Risk
✅ **Fácil de usar** como qualquer outro widget
✅ **Drag & drop** visual implementado

**Data de Implementação:** 2026-04-06
**Versão:** 1.0
