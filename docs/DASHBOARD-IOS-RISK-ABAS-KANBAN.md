# 📊 Dashboard iOS Risk - Com Abas e Kanban

## ✅ **Dashboard Completo Criado!**

**Nome:** iOS Risk - Dashboard Completo
**ID:** `dash-ios-risk-tabs-343c96a076`
**Entity:** sinistros
**Tenant:** Marisa Dilda
**Status:** ✅ Ativo com 4 abas

---

## 📑 **Estrutura de Abas** (Igual ao Mockup)

### **Tab 1: 📊 Visão Geral**

Dashboard principal com KPIs, gráficos e follow-ups:

```
┌─────────────────────────────────────────────────────────┐
│ 🔥 Total    │ ⚡ Em       │ 💰 Prejuízo │ ⏱️ Total     │
│  Sinistros  │  Andamento  │    Total    │  Registros   │
├─────────────────────────────────────────────────────────┤
│ 📊 Distribuição        │ 📈 Sinistros por Causa       │
│    por Status          │    [Gráfico Barras]          │
│    [Donut Chart]       │                              │
├─────────────────────────────────────────────────────────┤
│ ⏱️ Histórico de        │ 📋 Follow-Ups por Status     │
│   Interações           │    [Lista Agrupada]          │
│   [Timeline]           │                              │
├─────────────────────────────────────────────────────────┤
│ 🚛 Top Transportadoras │ 📞 Total de Follow-Ups       │
│    [Barras]            │    [Number Card]             │
└─────────────────────────────────────────────────────────┘
```

**10 Widgets:**
- 4 KPIs (Total, Em Andamento, Prejuízo, Registros)
- 2 Gráficos (Donut Status, Barras Causa)
- 2 Sub-Entity Widgets (Timeline Follow-Ups, Lista Follow-Ups)
- 2 Análises (Top Transportadoras, Total Follow-Ups)

---

### **Tab 2: 📌 Kanban** ⭐

**View tipo Kanban** (igual mockup iOS Risk):

```
┌─────────────┬─────────────┬─────────────┬─────────────┐
│  📋 Aberto  │ ⚡ Em       │ ⏳ Aguard.  │ ✅ Concluído│
│             │  Andamento  │  Regulação  │             │
├─────────────┼─────────────┼─────────────┼─────────────┤
│ ┌─────────┐ │ ┌─────────┐ │ ┌─────────┐ │ ┌─────────┐ │
│ │ SIN-030 │ │ │ SIN-028 │ │ │ SIN-025 │ │ │ SIN-020 │ │
│ │ Segurado│ │ │ Segurado│ │ │ Segurado│ │ │ Segurado│ │
│ │ ROUBO   │ │ │ AVARIA  │ │ │ ACIDENTE│ │ │ ROUBO   │ │
│ │ 🔴 Alta │ │ │ 🟡 Média│ │ │ 🟢 Baixa│ │ │ 🟡 Média│ │
│ └─────────┘ │ └─────────┘ │ └─────────┘ │ └─────────┘ │
│             │             │             │             │
│ ┌─────────┐ │ ┌─────────┐ │ ┌─────────┐ │ ┌─────────┐ │
│ │ SIN-029 │ │ │ SIN-027 │ │ │ SIN-024 │ │ │ SIN-019 │ │
│ │  ...    │ │ │  ...    │ │ │  ...    │ │ │  ...    │ │
│ └─────────┘ │ └─────────┘ │ └─────────┘ │ └─────────┘ │
└─────────────┴─────────────┴─────────────┴─────────────┘
```

**Configuração:**
- **Agrupamento:** Por campo `status`
- **Título do Card:** Campo `id` (ex: SIN-030)
- **Subtítulos:** `segurado`, `causa`
- **Badge:** Campo `prioridade` (🔴 Alta, 🟡 Média, 🟢 Baixa)
- **Ordenação:** Mais recentes primeiro
- **Drag & Drop:** Mover cards entre colunas ✨

**Funcionalidades:**
- ✅ Arraste cards entre status
- ✅ Click no card abre detalhes
- ✅ Contador de cards por coluna
- ✅ Cores automáticas por status
- ✅ Responsivo (scroll horizontal em mobile)

---

### **Tab 3: ⏱️ SLA**

Análise de conformidade com prazos:

```
┌─────────────────────────────────────────────────────────┐
│              ⏱️ Conformidade SLA: 85%                    │
├─────────────────────────────────────────────────────────┤
│ SLA por Prioridade     │ Status SLA                     │
│ [Gráfico Barras]       │ [Donut Chart]                  │
│                        │                                │
│ 🔴 Urgente: 95%        │ ✅ No Prazo: 85%               │
│ 🟠 Alta: 88%           │ ⚠️ Próximo: 10%                │
│ 🟡 Média: 82%          │ ❌ Atrasado: 5%                │
│ 🟢 Baixa: 75%          │                                │
├─────────────────────────────────────────────────────────┤
│           📋 Histórico de Prazos                        │
│           [Timeline de Follow-Ups]                      │
│                                                         │
│  ✅─┐ Resposta enviada dentro do prazo                  │
│    │ Há 1h · Corretor 1                                │
│    │                                                    │
│  ⚠️─┐ Prazo próximo do vencimento                       │
│    │ Há 2h · Corretor 2                                │
└─────────────────────────────────────────────────────────┘
```

**4 Widgets:**
- Conformidade SLA geral (%)
- SLA por Prioridade (barras)
- Status SLA (donut)
- Timeline de prazos (follow-ups)

---

### **Tab 4: 👔 Por Corretor**

Análise de performance por corretor:

```
┌─────────────────────────────────────────────────────────┐
│ 👔 Total     │ ⚡ Em          │ ✅ Concluídos            │
│  Corretores  │  Andamento     │                         │
├─────────────────────────────────────────────────────────┤
│           📊 Sinistros por Corretor                     │
│           [Gráfico de Barras Horizontal]                │
│                                                         │
│  Corretor 1  ████████████████████ 20                    │
│  Corretor 2  ███████████████ 15                         │
│  Corretor 3  ████████████ 12                            │
│  Gestor      ██████ 6                                   │
├─────────────────────────────────────────────────────────┤
│           📞 Follow-Ups Recentes                        │
│           [Lista com informação do sinistro pai]        │
│                                                         │
│  📊 Corretor 1                                          │
│     [Card] SIN-030 → Telefone → ✅ Concluído            │
│     [Card] SIN-028 → Email → ⏳ Pendente                │
│                                                         │
│  📊 Corretor 2                                          │
│     [Card] SIN-027 → Visita → ⚡ Em Andamento           │
└─────────────────────────────────────────────────────────┘
```

**5 Widgets:**
- Total de Corretores
- Sinistros Em Andamento
- Sinistros Concluídos
- Distribuição por Corretor (barras)
- Follow-Ups Recentes (com info do sinistro pai)

---

## 🎯 **Comparação com Mockup iOS Risk**

| Mockup                          | Dashboard Real                    | Status |
|---------------------------------|-----------------------------------|--------|
| Tab "Visão Geral"              | ✅ Tab "📊 Visão Geral"           | ✅ OK  |
| Tab "Kanban"                   | ✅ Tab "📌 Kanban"                | ✅ OK  |
| Tab "SLA"                      | ✅ Tab "⏱️ SLA"                   | ✅ OK  |
| Tab "Por Corretor"             | ✅ Tab "👔 Por Corretor"          | ✅ OK  |
| Kanban com drag & drop         | ✅ View tipo kanban               | ✅ OK  |
| Cards com prioridade           | ✅ Badge de prioridade            | ✅ OK  |
| Agrupamento por status         | ✅ groupByField: "status"         | ✅ OK  |
| 4 KPIs no topo                 | ✅ 4 KPIs configurados            | ✅ OK  |
| Gráficos interativos           | ✅ Donut + Bar Charts             | ✅ OK  |
| Feed de atividades             | ✅ Timeline de Follow-Ups         | ✅ OK  |

---

## 🚀 **Como Usar**

### **1. Acessar Dashboard**

```
https://dev.iossystem.com.br
Login: admin@marisadilda.com / 12345678

Menu → Dados → Sinistros → Dashboard 📊
Selecionar: "iOS Risk - Dashboard Completo"
```

### **2. Navegar entre Abas**

```
┌──────────────────────────────────────────────────────┐
│ [📊 Visão Geral] [📌 Kanban] [⏱️ SLA] [👔 Por Corretor] │
└──────────────────────────────────────────────────────┘
```

Click nas abas para alternar entre visualizações.

### **3. Usar Kanban**

1. Click na aba **"📌 Kanban"**
2. **Arraste cards** entre colunas (status)
3. **Click em um card** para ver/editar detalhes
4. **Filtros** disponíveis no topo

**Exemplo de Card:**
```
┌─────────────────┐
│ SIN-030         │ ← ID (título)
│ Segurado ABC    │ ← Segurado (subtítulo 1)
│ ROUBO           │ ← Causa (subtítulo 2)
│ 🔴 Alta         │ ← Badge de prioridade
└─────────────────┘
```

---

## ⚙️ **Configuração Técnica**

### **Estrutura de Tabs:**

```json
{
  "tabs": [
    {
      "id": "overview",
      "label": "📊 Visão Geral",
      "layout": [...],
      "widgets": {...}
    },
    {
      "id": "kanban",
      "label": "📌 Kanban",
      "viewType": "kanban",
      "config": {
        "groupByField": "status",
        "cardTitleField": "id",
        "cardSubtitleFields": ["segurado", "causa"],
        "cardBadgeField": "prioridade",
        "sortBy": "createdAt",
        "sortOrder": "desc"
      }
    },
    {
      "id": "sla",
      "label": "⏱️ SLA",
      "layout": [...],
      "widgets": {...}
    },
    {
      "id": "corretor",
      "label": "👔 Por Corretor",
      "layout": [...],
      "widgets": {...}
    }
  ]
}
```

### **Kanban Config:**

- **groupByField:** Campo para agrupar colunas (status)
- **cardTitleField:** Campo exibido como título do card (id)
- **cardSubtitleFields:** Array de campos para subtítulos
- **cardBadgeField:** Campo para badge/etiqueta (prioridade)
- **sortBy/sortOrder:** Ordenação dos cards

### **View Types:**

- `default` - Grid com widgets
- `kanban` - View kanban com colunas
- `table` - Tabela de dados
- `timeline` - Timeline vertical

---

## 🎨 **Funcionalidades Avançadas**

### **Kanban Drag & Drop:**
```javascript
// Arrastar card SIN-030 de "Aberto" para "Em Andamento"
// Sistema automaticamente atualiza campo "status"
// Webhook pode disparar automação (enviar email, etc)
```

### **Filtros Globais:**
```
🔍 Filtros: [Status] [Prioridade] [Período] [Corretor]
```

### **Export:**
```
🔽 Exportar: PDF | Excel | CSV
```

### **Notificações:**
```
🔔 Alertas:
- SLA próximo do vencimento
- Novo follow-up registrado
- Status alterado
```

---

## 📊 **Total de Widgets por Aba**

| Aba             | Widgets | View Type |
|-----------------|---------|-----------|
| Visão Geral     | 10      | Grid      |
| Kanban          | -       | Kanban    |
| SLA             | 4       | Grid      |
| Por Corretor    | 5       | Grid      |
| **TOTAL**       | **19**  | -         |

---

## ✅ **Status**

- ✅ **4 Abas criadas** (Visão Geral, Kanban, SLA, Por Corretor)
- ✅ **Kanban configurado** (drag & drop, badges, colunas por status)
- ✅ **19 widgets** distribuídos nas abas
- ✅ **Sub-entity widgets** (timeline + lista de follow-ups)
- ✅ **Responsivo** (mobile/tablet/desktop)
- ✅ **Ativo para todas as roles**

**Pronto para uso em:** https://dev.iossystem.com.br

---

## 🎯 **Próximos Passos (Opcional)**

1. **Personalizar cores do Kanban** por status
2. **Adicionar filtros quick** no topo de cada aba
3. **Criar automações** (webhook quando card muda de coluna)
4. **Tab "Registros"** com tabela completa + filtros avançados
5. **Template selector** (Dashboard Geral | Por Seguradora | SLA Report)

---

**Documentação Completa:** `docs/DASHBOARD-IOS-RISK-CRIADO.md`
**Data de Atualização:** 2026-04-06 21:30
**Versão:** 2.0 (Com Abas e Kanban)
