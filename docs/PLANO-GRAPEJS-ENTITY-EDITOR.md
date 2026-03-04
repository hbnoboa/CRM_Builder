# Editor de Entidades com GrapeJS

## Contexto

### Problema
O editor de entidades atual (`entities/[id]/page.tsx`, 1442 linhas) e o grid editor (`field-grid-editor.tsx`, 1003 linhas) sao implementacoes custom complexas com drag-drop, resize e grid 12-colunas feitas do zero. Manter e evoluir esse codigo e custoso. GrapeJS oferece um framework visual maduro (25k+ stars, MIT) que pode ser adaptado para editar entidades visualmente.

### Objetivo
Substituir o editor de entidades por um editor baseado em GrapeJS onde:
- Cada tipo de campo e um **bloco** arrastavel na paleta e um **componente** no canvas
- A configuracao de cada campo e feita via **traits** (painel lateral)
- O layout 12-colunas e gerenciado pelo GrapeJS (grid-row + grid-cell)
- Automacoes, relacoes e sub-entidades continuam funcionando
- O formato de dados salvo no backend (Entity.fields JSON) **nao muda**
- Serializacao bidirecional: `EntityField[]` <-> `GrapeJS ProjectData`

### Pesquisa
- GrapeJS e um page builder, NAO um form builder nativo. Mas sua arquitetura de Components + Traits + Blocks e flexivel o suficiente para mapear nossos 47 tipos de campo como componentes customizados.
- `@grapesjs/react` v2.X integra com React 18+/Next.js 14+ via `<GjsEditor>` component.
- Traits permitem configuracao inline no painel lateral. Para configs complexas (options-editor, workflow, formula), usaremos React Portals renderizados em containers criados pelo trait.

## Arquitetura

```
EntityField[] (backend, sem mudanca)
       |
  serializeToGjs()  /  deserializeFromGjs()
       |
GrapeJS ProjectData (editor visual)
       |
  +----+----+----+
  |         |    |
Canvas   Traits  Blocks
(preview) (config) (paleta)
```

### Integracao React/Next.js
```typescript
// next/dynamic com ssr: false (GrapeJS depende do DOM)
const GrapeJSEditor = dynamic(() => import('@/components/entity-editor/grapejs-editor'), {
  ssr: false,
  loading: () => <EditorSkeleton />,
});
```

## Estrutura de Arquivos

```
apps/web-admin/src/components/entity-editor/
├── grapejs-editor.tsx           # Wrapper principal (<GjsEditor>)
├── config/
│   ├── editor-config.ts         # Config base do GrapeJS (panels, canvas, no style manager)
│   └── theme.ts                 # CSS vars para dark mode no iframe
├── blocks/
│   ├── index.ts                 # Registra todos os blocos
│   ├── text-blocks.ts           # text, textarea, richtext, email, url, password
│   ├── number-blocks.ts         # number, currency, percentage, slider, rating
│   ├── date-blocks.ts           # date, datetime, time
│   ├── select-blocks.ts         # select, multiselect, radio-group, checkbox-group, tags
│   ├── relation-blocks.ts       # relation, sub-entity, lookup, api-select, user-select
│   ├── file-blocks.ts           # file, image, signature
│   ├── mask-blocks.ts           # cpf, cnpj, cep, phone
│   ├── computed-blocks.ts       # formula, rollup
│   ├── workflow-blocks.ts       # workflow-status, timer, sla-status, action-button
│   ├── layout-blocks.ts         # section-title, hidden, json, color, map, boolean
│   └── special-blocks.ts        # zone-diagram, array
├── components/
│   ├── index.ts                 # Registra todos os component types
│   ├── base-field.ts            # Component type `crm-field` (base para todos)
│   ├── grid-row.ts              # Component type `grid-row` (linha do grid)
│   └── grid-cell.ts             # Component type `grid-cell` (celula 1-12 colunas)
├── traits/
│   ├── index.ts                 # Registra todos os trait types customizados
│   ├── common-traits.ts         # Traits comuns: name, label, required, placeholder, helpText, defaultValue
│   ├── options-trait.tsx         # React Portal: editor de opcoes (select/multiselect/radio/checkbox/tags)
│   ├── entity-select-trait.tsx   # React Portal: seletor de entidade (relation, sub-entity, lookup)
│   ├── field-select-trait.tsx    # React Portal: seletor de campo (formula, rollup, lookup)
│   ├── workflow-trait.tsx        # React Portal: editor de workflow (statuses, transitions)
│   ├── formula-trait.tsx         # React Portal: editor de formula
│   ├── validation-trait.tsx      # React Portal: editor de validacoes
│   └── conditional-trait.tsx     # React Portal: editor de condicoes de visibilidade
├── panels/
│   ├── automations-panel.tsx     # Painel de automacoes (React, fora do canvas)
│   ├── entity-info-panel.tsx     # Painel de info da entidade (nome, descricao, settings)
│   └── panel-manager.ts         # Gerencia paineis customizados no GrapeJS
├── serialization/
│   ├── serialize.ts             # EntityField[] -> GrapeJS ProjectData
│   ├── deserialize.ts           # GrapeJS ProjectData -> EntityField[]
│   └── field-mappers.ts         # Mapeamento type-specific (traits <-> EntityField props)
└── utils/
    ├── icons.ts                 # Icones SVG para blocos (reusar lucide-react)
    └── i18n.ts                  # Labels traduzidos para blocos/traits/categorias
```

## Fase 1: Fundacao (GrapeJS + Grid + Serializacao)

### 1.1 Instalar dependencias
```bash
pnpm add grapesjs @grapesjs/react --filter web-admin
```

### 1.2 Editor Config (`config/editor-config.ts`)
- Canvas: **WYSIWYG** (campos renderizados exatamente como no formulario final, disabled)
- Style Manager: **desabilitado** (layout e controlado por grid-row/grid-cell, nao CSS livre)
- Layer Manager: **desabilitado** (campos sao flat, nao aninhados)
- Panels: Blocks (esquerda), Traits (direita), Automations (tab no direita)
- Storage: nenhum built-in (nos controlamos save via API)
- Canvas CSS: injetar CSS completo do design system (shadcn/ui vars, componentes, dark mode)
- Canvas width: fixo em largura do formulario real (ex: 800px) para WYSIWYG perfeito

### 1.3 Grid System (`components/grid-row.ts`, `grid-cell.ts`)
- `grid-row`: wrapper de linha, nao-removivel, auto-criado quando campo e solto no canvas
- `grid-cell`: wrapper de celula, propriedade `colSpan` (1-12), resize via trait ou drag
- CSS Grid no canvas: `display: grid; grid-template-columns: repeat(12, 1fr); gap: 16px;`
- Drop zone: campos so podem ser soltos dentro de `grid-cell`
- Regra: soma de colSpan na row <= 12; se exceder, campo vai para nova row

### 1.4 Base Field Component (`components/base-field.ts`)
```typescript
// Todos os 47 tipos estendem este component type
editor.DomComponents.addType('crm-field', {
  model: {
    defaults: {
      tagName: 'div',
      droppable: false,
      copyable: true,
      removable: true,
      draggable: 'grid-cell', // so pode ser arrastado para dentro de grid-cell
      traits: [
        { name: 'fieldName', label: 'Nome do campo', type: 'text' },
        { name: 'fieldLabel', label: 'Label', type: 'text' },
        { name: 'fieldType', label: 'Tipo', type: 'text', changeProp: true },
        { name: 'required', label: 'Obrigatorio', type: 'checkbox' },
        { name: 'placeholder', label: 'Placeholder', type: 'text' },
        { name: 'helpText', label: 'Texto de ajuda', type: 'text' },
      ],
      // Atributos customizados para cada tipo
      'field-name': '',
      'field-label': '',
      'field-type': 'text',
      required: false,
    },
  },
  view: {
    onRender() {
      // Renderiza campo WYSIWYG (exatamente como no formulario final)
      const type = this.model.get('field-type');
      const label = this.model.get('field-label') || 'Campo';
      const required = this.model.get('required');
      const placeholder = this.model.get('placeholder') || '';

      this.el.innerHTML = `
        <div class="space-y-2">
          <label class="text-sm font-medium leading-none">
            ${label}${required ? ' <span class="text-destructive">*</span>' : ''}
          </label>
          ${renderFieldByType(type, { placeholder, disabled: true })}
        </div>
      `;
    },
  },
});

// Helper para renderizar cada tipo de campo como WYSIWYG
function renderFieldByType(type: string, opts: { placeholder?: string; disabled?: boolean }): string {
  const baseInput = `class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50" disabled`;

  switch (type) {
    case 'text':
    case 'email':
    case 'url':
    case 'cpf':
    case 'cnpj':
    case 'cep':
    case 'phone':
      return `<input type="text" ${baseInput} placeholder="${opts.placeholder}" />`;
    case 'textarea':
      return `<textarea ${baseInput} rows="3" placeholder="${opts.placeholder}"></textarea>`;
    case 'number':
    case 'currency':
    case 'percentage':
      return `<input type="text" ${baseInput} placeholder="0,00" />`;
    case 'date':
      return `<div class="relative"><input type="text" ${baseInput} placeholder="dd/mm/aaaa" /><span class="absolute right-3 top-2.5">📅</span></div>`;
    case 'select':
      return `<div class="relative"><input type="text" ${baseInput} placeholder="Selecione..." /><span class="absolute right-3 top-2.5">▼</span></div>`;
    case 'boolean':
      return `<div class="flex items-center gap-2"><div class="h-5 w-9 rounded-full bg-muted"></div><span class="text-sm">Nao</span></div>`;
    case 'image':
    case 'file':
      return `<div class="border-2 border-dashed rounded-md p-6 text-center text-muted-foreground">📎 Clique ou arraste</div>`;
    case 'map':
      return `<div class="border rounded-md bg-muted h-48 flex items-center justify-center text-muted-foreground">🗺️ Mapa</div>`;
    default:
      return `<input type="text" ${baseInput} />`;
  }
}
```

### 1.5 Serializacao Bidirecional (`serialization/`)

**`serialize.ts`** - EntityField[] -> GrapeJS ProjectData:
```typescript
export function serializeToGjs(fields: EntityField[]): GjsProjectData {
  // 1. Agrupar campos por gridRow (ou calcular rows se nao tem gridRow)
  // 2. Para cada row, criar componente grid-row
  // 3. Para cada campo na row, criar grid-cell com colSpan do campo
  // 4. Dentro do grid-cell, criar componente crm-field-{type}
  // 5. Mapear TODAS as propriedades do EntityField para traits do componente
  // 6. Retornar { pages: [{ component: rootComponent }] }
}
```

**`deserialize.ts`** - GrapeJS ProjectData -> EntityField[]:
```typescript
export function deserializeFromGjs(projectData: GjsProjectData): EntityField[] {
  // 1. Iterar sobre grid-rows no root
  // 2. Para cada grid-cell, extrair o crm-field interno
  // 3. Mapear traits de volta para propriedades EntityField
  // 4. Calcular order baseado na posicao no canvas
  // 5. Manter gridRow e gridCol do grid-cell
  // 6. Retornar EntityField[] pronto para salvar na API
}
```

**Propriedades criticas que DEVEM sobreviver ao roundtrip**:
- `name`, `label`, `type`, `required`, `placeholder`, `helpText`, `defaultValue`
- `order`, `gridRow`, `gridCol`, `colSpan`
- `options` (select/multiselect/radio/checkbox/tags)
- `config` (workflow, formula, rollup, lookup, timer, sla, action-button, user-select, tags, signature, checkbox-group, radio-group)
- `validators`, `conditions` (validacao e visibilidade condicional)
- `sourceEntityId`, `sourceEntitySlug`, `displayField`, `searchFields` (relation)
- `parentEntityId` (sub-entity)

### 1.6 Wrapper Principal (`grapejs-editor.tsx`)
```typescript
interface EntityEditorProps {
  entity: Entity;                    // Entidade carregada
  onSave: (fields: EntityField[], settings: EntitySettings) => void;
  onCancel: () => void;
}

// Usa @grapesjs/react <GjsEditor>
// onEditor callback: registra plugins, carrega dados serializados
// onSave: deserializa GrapeJS -> EntityField[], chama onSave prop
```

## Fase 2: Registrar os 47 Tipos de Campo

### Organizacao por categoria (mesmo do editor atual)

| Categoria | Tipos | Bloco |
|-----------|-------|-------|
| **Texto** | text, textarea, richtext, email, url, password | text-blocks.ts |
| **Numeros** | number, currency, percentage, slider, rating | number-blocks.ts |
| **Datas** | date, datetime, time | date-blocks.ts |
| **Selecao** | select, multiselect, radio-group, checkbox-group, tags | select-blocks.ts |
| **Relacoes** | relation, sub-entity, lookup, api-select, user-select | relation-blocks.ts |
| **Arquivos** | file, image, signature | file-blocks.ts |
| **Mascaras BR** | cpf, cnpj, cep, phone | mask-blocks.ts |
| **Computados** | formula, rollup | computed-blocks.ts |
| **Workflow** | workflow-status, timer, sla-status, action-button | workflow-blocks.ts |
| **Layout/Outros** | section-title, boolean, hidden, json, color, map, array, zone-diagram | layout-blocks.ts |

### Para cada tipo, registrar:

1. **Block** (paleta esquerda):
   - `label`: nome traduzido do tipo
   - `category`: categoria (agrupamento na paleta)
   - `media`: icone SVG (reusar de lucide-react)
   - `content`: component type a ser criado

2. **Component Type** (estende `crm-field`):
   - `model.defaults.traits`: traits comuns + traits especificos do tipo
   - `view.onRender()`: preview visual no canvas
   - Component types especificos pra cada tipo: `crm-field-text`, `crm-field-select`, etc.

3. **Traits especificos por tipo** (exemplos):

| Tipo | Traits Adicionais |
|------|-------------------|
| `text` | maxLength, textTransform |
| `textarea` | rows, maxLength |
| `richtext` | (nenhum extra) |
| `number` | min, max, step, decimalPlaces |
| `currency` | currencySymbol, decimalPlaces |
| `percentage` | min, max, decimalPlaces |
| `slider` | min, max, step, showValue |
| `rating` | maxRating, icon |
| `select` | options (React Portal: options-trait) |
| `multiselect` | options (React Portal), maxItems |
| `radio-group` | options (React Portal), layout (vertical/horizontal) |
| `checkbox-group` | options (React Portal), maxItems |
| `tags` | options (React Portal), allowCreate, maxTags |
| `relation` | sourceEntity (React Portal), displayField, searchFields, allowCreate |
| `sub-entity` | parentEntity (React Portal), fields config |
| `lookup` | sourceEntity, searchFields, displayFields, previewFields, filterConditions |
| `api-select` | apiUrl, labelField, valueField, searchField |
| `user-select` | scope (all/team), displayFormat |
| `formula` | formula expression (React Portal) |
| `rollup` | relationField, rollupField, aggregation |
| `workflow-status` | statuses, transitions (React Portal) |
| `timer` | autoStart, format |
| `sla-status` | slaRules, warningThreshold |
| `action-button` | buttonLabel, actionType, config |
| `date/datetime/time` | minDate, maxDate, disablePast/Future |
| `boolean` | trueLabel, falseLabel, defaultValue |
| `cpf/cnpj/cep/phone` | (nenhum extra - mascaras sao fixas) |
| `file` | accept, maxSize, maxFiles |
| `image` | accept, maxSize, maxFiles, aspectRatio |
| `signature` | width, height |
| `map` | defaultCenter, zoom |
| `color` | format (hex/rgb/hsl) |
| `section-title` | (nenhum extra) |
| `hidden` | defaultValue |
| `json` | schema |
| `zone-diagram` | zones config (React Portal) |

## Fase 3: Traits Complexos (React Portals)

### Padrao React Portal para Traits

GrapeJS traits usam DOM puro. Para configs complexas que precisam de shadcn/ui, usamos React Portals:

```typescript
// No registro do trait type
editor.TraitManager.addType('crm-options-editor', {
  createInput({ trait }) {
    const container = document.createElement('div');
    container.id = `trait-portal-${trait.cid}`;
    container.className = 'crm-trait-portal';
    // React portal sera montado aqui pelo wrapper
    return container;
  },
  onEvent({ component }) {
    // Disparado quando trait muda
    // Propaga para o model do componente
  },
});
```

```tsx
// No wrapper React (grapejs-editor.tsx)
// Observa o DOM por containers .crm-trait-portal
// Renderiza React components via createPortal
```

### Traits que precisam de React Portal:
1. **options-trait.tsx** — Editor de opcoes com drag-reorder, add/remove, cores
2. **entity-select-trait.tsx** — Combobox de entidades do tenant
3. **field-select-trait.tsx** — Combobox de campos da entidade selecionada
4. **workflow-trait.tsx** — Editor visual de status + transicoes
5. **formula-trait.tsx** — Editor de formula com autocomplete de campos
6. **validation-trait.tsx** — Lista de validacoes com operadores
7. **conditional-trait.tsx** — Condicoes de visibilidade (if field X = Y, show/hide)

## Fase 4: Paineis (Automacoes + Info)

### 4.1 Automations Panel (`panels/automations-panel.tsx`)

Automacoes NAO sao componentes GrapeJS (nao fazem sentido no canvas visual). Serao um painel React separado na sidebar direita, como uma **tab** ao lado dos Traits:

- Tab "Campos" → Traits do componente selecionado (GrapeJS nativo)
- Tab "Automacoes" → Lista de automacoes (React)
- Tab "Info" → Nome/descricao/settings da entidade (React)

O painel de automacoes reutiliza a logica existente do editor atual (linhas ~1100-1440 de `entities/[id]/page.tsx`):
- Lista de automacoes com triggers e acoes
- Adicionar/editar/remover automacao
- Configurar triggers (ON_CREATE, ON_UPDATE, ON_FIELD_CHANGE, etc.)
- Configurar acoes (send_email, call_webhook, update_field, etc.)
- Drag-reorder de acoes

### 4.2 Entity Info Panel (`panels/entity-info-panel.tsx`)

Painel colapsavel com:
- Nome da entidade
- Descricao
- Slug (readonly)
- Settings (globalFilters, notifyOnCreate, archiveEnabled, etc.)

## Fase 5: Integrar na Pagina de Entidade

### 5.1 Pagina de Edicao (`entities/[id]/page.tsx`)

**Substituir** o conteudo atual por:
```tsx
export default function EntityEditPage() {
  const { entity, isLoading } = useEntity(id);
  const updateMutation = useUpdateEntity();

  const handleSave = (fields, settings) => {
    updateMutation.mutate({ id, fields, settings });
  };

  return (
    <GrapeJSEditor
      entity={entity}
      onSave={handleSave}
      onCancel={() => router.back()}
    />
  );
}
```

A pagina fica MUITO menor pois toda a logica do editor esta nos componentes GrapeJS.

### 5.2 Pagina de Criacao (`entities/new/page.tsx`)

- Manter o fluxo de selecao de template
- Apos selecionar template (ou "do zero"), abrir o GrapeJS editor com campos pre-populados
- Templates populam `EntityField[]` que sao serializados para GrapeJS

### 5.3 Backend — Nenhuma mudanca

O backend continua recebendo `{ name, description, fields: EntityField[], settings }` no PATCH.
A serializacao GrapeJS -> EntityField[] garante o mesmo formato.

## Fase 6: Polish e Dark Mode

### 6.1 Dark Mode
- Plugin GrapeJS que injeta CSS vars do nosso design system no iframe do canvas
- Detecta tema atual (next-themes) e atualiza vars

### 6.2 i18n
- Labels de blocos, categorias e traits passados como opcoes do plugin
- Reusar chaves do next-intl existente

### 6.3 Atalhos de Teclado
- Ctrl+S: salvar
- Ctrl+Z/Y: undo/redo (built-in GrapeJS)
- Delete: remover campo selecionado
- Ctrl+D: duplicar campo selecionado

### 6.4 Performance
- Lazy load do GrapeJS (ja feito pelo dynamic import)
- Cache de Intl formatters (ja existente no shared)
- Debounce no save de traits (evitar re-render a cada keypress)

### 6.5 gridRowSpan (campos multi-linha)
- Adicionar propriedade `gridRowSpan` ao `grid-cell`
- Permite campos como mapa/richtext/image ocupar 2+ linhas
- Exemplo: mapa em 2 linhas com inputs lat/lng ao lado
- Trait de resize vertical no canvas (arrastar borda inferior)
- Atualizar serializacao para incluir `gridRowSpan` no EntityField

### 6.6 Canvas WYSIWYG (What You See Is What You Get)
- Canvas renderiza campos **exatamente** como aparecerao no formulario final
- Nao precisa de botao "Preview" separado - o canvas JA e o preview
- Cada tipo de campo renderiza com:
  - Estilos reais do design system (shadcn/ui)
  - Tamanhos reais (altura, largura)
  - Placeholders e labels visiveis
  - Icones apropriados (calendario, upload, busca)
- Dados de mock para campos que precisam:
  - select: mostra primeira opcao como exemplo
  - relation: "Registro Exemplo"
  - image: placeholder de upload
- Campos sao **disabled** no canvas (nao editaveis, apenas visuais)
- Feedback imediato: mudar propriedade atualiza o campo no canvas

## Arquivos Criticos

| Arquivo | Acao |
|---------|------|
| `components/entity-editor/grapejs-editor.tsx` | **CRIAR** - Wrapper principal |
| `components/entity-editor/config/editor-config.ts` | **CRIAR** - Config GrapeJS |
| `components/entity-editor/config/theme.ts` | **CRIAR** - Dark mode CSS |
| `components/entity-editor/blocks/*.ts` | **CRIAR** - 11 arquivos de blocos |
| `components/entity-editor/components/base-field.ts` | **CRIAR** - Component type base |
| `components/entity-editor/components/grid-row.ts` | **CRIAR** - Grid row |
| `components/entity-editor/components/grid-cell.ts` | **CRIAR** - Grid cell |
| `components/entity-editor/traits/*.tsx` | **CRIAR** - 7+ trait types |
| `components/entity-editor/panels/*.tsx` | **CRIAR** - Automations + Info |
| `components/entity-editor/serialization/*.ts` | **CRIAR** - Serialize/Deserialize |
| `app/[locale]/(dashboard)/entities/[id]/page.tsx` | **REESCREVER** - Usar GrapeJS editor |
| `app/[locale]/(dashboard)/entities/new/page.tsx` | **EDITAR** - Usar GrapeJS apos template |
| `components/entities/field-grid-editor.tsx` | **DEPRECAR** - Substituido pelo GrapeJS |

## Verificacao

1. **Roundtrip test**: Carregar entidade existente -> GrapeJS -> salvar -> recarregar. Campos devem ser identicos.
2. **Todos os 47 tipos**: Arrastar cada tipo para o canvas, configurar via traits, salvar, verificar no backend.
3. **Grid layout**: Campos lado a lado, redimensionar colSpan, reordenar linhas.
4. **Automacoes**: Criar/editar/remover automacoes, salvar, verificar execucao.
5. **Relacoes**: Configurar relation/sub-entity/lookup via traits, verificar no formulario de dados.
6. **Workflow**: Configurar statuses e transicoes via trait, verificar no formulario.
7. **Dark mode**: Alternar tema, canvas e paineis devem seguir.
8. **Templates**: Criar entidade com template, verificar campos pre-populados no editor.
9. **Permissoes**: ADMIN/MANAGER podem editar, VIEWER nao.
10. **Mobile**: Verificar que entidades editadas no GrapeJS funcionam no app Flutter (mesmo formato EntityField[]).
11. **gridRowSpan**: Campo mapa ocupando 2 linhas com inputs lat/lng ao lado, verificar layout correto.
12. **Undo/Redo**: Desfazer multiplas acoes (Ctrl+Z), refazer (Ctrl+Y), verificar estado correto do canvas.
13. **Copy/Paste**: Copiar campo (Ctrl+C), colar (Ctrl+V), verificar que novo campo tem slug unico gerado.
14. **WYSIWYG**: Verificar que cada tipo de campo renderiza no canvas exatamente como aparecera no formulario final.

## Ordem de Implementacao

1. **Fase 1** (Fundacao): ~3-4 sessoes — GrapeJS setup, grid, serializacao, wrapper
2. **Fase 2** (Campos): ~3-4 sessoes — Registrar todos os 47 tipos com blocos, componentes, traits simples
3. **Fase 3** (Traits Complexos): ~2-3 sessoes — React Portals para options, workflow, formula, validacao
4. **Fase 4** (Paineis): ~1-2 sessoes — Automacoes e Info como tabs React
5. **Fase 5** (Integracao): ~1-2 sessoes — Substituir paginas de edicao/criacao
6. **Fase 6** (Polish): ~2 sessoes — Dark mode, i18n, atalhos, performance, gridRowSpan, preview com mock

**Total estimado: 12-18 sessoes**
