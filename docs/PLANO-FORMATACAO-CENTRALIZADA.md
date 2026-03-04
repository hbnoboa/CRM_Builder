# Camada Centralizada de Formatacao de Dados (v2)

## Contexto

### Problema atual: fragmentacao em 6+ locais

| Local | Funcao | Cobre | Falta |
|-------|--------|-------|-------|
| `data/page.tsx:222` | `formatCellValue(val, fieldType)` | boolean, date, datetime, currency, %, {label}, arrays | CPF/CNPJ/CEP/phone, time, number, rating, color |
| `sub-entity-field.tsx:59` | `formatCellValue(val, boolY, boolN)` | {label}, boolean i18n, arrays | date, currency, %, CPF/CNPJ e TODOS os tipos tipados |
| `record-form-dialog.tsx:78` | `applyCpfMask/applyCnpjMask/...` | CPF, CNPJ, CEP, phone, currency (mascaras de INPUT) | N/A (sao mascaras de input, nao de display) |
| `pdf-generator.service.ts:2439` | `formatValue(val, format, default)` | date, datetime, time, currency, number, %, cpf, cnpj, cep, phone, boolean, case | {label}, arrays, rating, color, map |
| `data-io.service.ts:141` | inline no export Excel | {label}, arrays join(';') | TUDO mais (exporta valores crus) |
| `mobile/formatters.dart` | `Formatters.date/dateTime/currency` | date, dateTime, currency, initials, timeAgo | CPF/CNPJ/CEP/phone, boolean, %, number, todos os tipos |
| `mobile/data_card.dart:171` | `_formatValue(value, type)` | {label}, arrays, date, datetime, currency, %, boolean, rating, password | CPF/CNPJ/CEP/phone, time, map.address |
| Locais avulsos (10+) | `toLocaleDateString/toLocaleString` | datas inline | inconsistente (pt-BR vs en-US vs generico) |

### Inconsistencias criticas encontradas

1. **Currency**: web usa `toLocaleString` sem simbolo `R$`, PDF usa `Intl.NumberFormat` com `R$`, mobile usa `NumberFormat.currency` com `R$`
2. **Percentage**: web usa `toLocaleString + %`, PDF usa `toFixed(2)%` (sem locale)
3. **Locale**: dashboard usa `en-US`, tabelas usam `pt-BR`, audit-logs usa generico
4. **Boolean**: hardcoded "Sim"/"Nao" em 3 locais, i18n apenas no sub-entity
5. **Excel**: exporta valores completamente crus (sem formatacao nenhuma)
6. **Sub-entity table**: nao formata por tipo de campo (ignora date, currency, etc.)

### Como os grandes fazem (pesquisa de mercado)

| Plataforma | Padrao | Como funciona |
|------------|--------|---------------|
| **Salesforce** | Dual-value backend | API retorna `{ value: 350000, displayValue: "R$ 350.000" }` |
| **Monday.com** | Dual text/value | GraphQL retorna `value` (JSON raw) + `text` (formatado) |
| **Microsoft Dataverse** | OData annotations | Retorna `birthday` + `birthday@FormattedValue` via opt-in header |
| **HubSpot** | Metadata + client | API retorna raw + metadata de tipo; cliente formata |
| **Airtable** | Cell format param | `cell_format=string` para pre-formatado, `json` para raw |

**Conclusao**: os melhores usam backend-driven formatting (Salesforce/Monday/Dataverse). Para nosso caso (TS compartilhado + Flutter separado), a melhor abordagem e:

1. **Shared formatter library** em `@crm-builder/shared` (backend + frontend web)
2. **Backend aplica formatacao** nos endpoints de dados (retorna `_formatted` junto com `data`)
3. **Flutter espelha** os formatadores em Dart (ja tem `formatters.dart`, precisa expandir)
4. **Filtros de tabela** continuam frontend (transientes, nao persistem apos reload)

## Decisao de Arquitetura

### Backend-driven com shared library

```
packages/shared/src/formatters.ts   <-- Fonte unica (TS puro, roda em Node + browser)
        |
   +----+--------+---------+
   |              |         |
 NestJS API    Next.js    Flutter
 (aplica nos   (usa p/    (espelha em
  endpoints)   filtros     Dart)
               locais)
```

**Fluxo de dados**:

```
DB -> API findAll() -> aplica role filters -> busca records
    -> para cada record, gera `_formatted: Record<string, string>`
    -> retorna { data: raw, _formatted: formatado }
    -> Frontend renderiza `_formatted[field]` na tabela
    -> PDF/Excel usam `_formatted` ou chamam formatter direto
    -> Filtros de tabela (botao filtro, search) = frontend-only, transientes
```

**Vantagens**:

- Tabela web nao precisa de logica de formatacao (so renderiza `_formatted`)
- PDF e Excel ja recebem dados formatados
- Mobile pode chamar API com `?include=formatted` ou formatar localmente
- Filtros/sort continuam operando sobre `data` (valores crus)
- Adicionar novo tipo de campo = 1 funcao no shared, propagado automaticamente

## Fase 1: Criar `packages/shared/src/formatters.ts`

### Arquivo NOVO: `packages/shared/src/formatters.ts`

```typescript
import { FieldType } from './enums';

export interface FormatFieldOptions {
  type: FieldType;
  locale?: string;           // default: 'pt-BR'
  currency?: string;         // default: 'BRL'
  emptyValue?: string;       // default: '-'
  booleanLabels?: { true: string; false: string }; // default: Sim/Nao
  textTransform?: 'uppercase' | 'lowercase' | 'titlecase';
  decimalPlaces?: number;    // default: 2 para currency/percentage
}

export function formatFieldValue(value: unknown, options: FormatFieldOptions): string;
export function extractLabel(value: unknown): string | null;
export function formatArray(values: unknown[], options?: FormatFieldOptions, separator?: string): string;
```

**Cache de Intl (performance)**:

- Instancias de `Intl.NumberFormat` e `Intl.DateTimeFormat` sao caras de criar
- Criar um `Map<string, Intl.NumberFormat>` interno que cacheia por chave `locale:style:currency`
- Reutilizar instancias entre chamadas (padrao recomendado pela MDN e FormatJS)

**Todos os 35 FieldTypes tratados**:

| FieldType | Formatacao | Exemplo |
|-----------|-----------|---------|
| `text` | String direto | "Joao Silva" |
| `textarea` | String direto | "Texto longo..." |
| `richtext` | Strip HTML tags, retorna texto puro | "Texto sem tags" |
| `number` | `Intl.NumberFormat(locale)` com separador milhar | "1.234" |
| `currency` | `Intl.NumberFormat(locale, { style: 'currency', currency })` | "R$ 1.234,56" |
| `percentage` | `Intl.NumberFormat(locale, { minimumFractionDigits: 2 })` + `%` | "85,50%" |
| `email` | String direto | "joao@email.com" |
| `phone` | Mascara brasileira (11 ou 10 digitos) | "(11) 99999-0000" |
| `url` | String direto | "https://..." |
| `cpf` | `000.000.000-00` | "123.456.789-01" |
| `cnpj` | `00.000.000/0000-00` | "12.345.678/0001-90" |
| `cep` | `00000-000` | "01001-000" |
| `date` | `toLocaleDateString(locale)` | "15/03/2026" |
| `datetime` | `toLocaleString(locale, day/month/year/hour/minute)` | "15/03/2026, 14:30" |
| `time` | `toLocaleTimeString(locale, hour/minute)` | "14:30" |
| `boolean` | booleanLabels.true/false | "Sim" / "Nao" |
| `select` | extrai `.label` de `{value, label}` | "Ativo" |
| `multiselect` | `formatArray` com join(', ') | "Tag1, Tag2, Tag3" |
| `api-select` | extrai `.label` de `{value, label}` | "Cliente X" |
| `relation` | extrai `.label` de `{value, label}` | "Registro #123" |
| `file` | conta arquivos se array, nome se string | "3 arquivos" / "doc.pdf" |
| `image` | conta imagens se array, nome se string | "2 imagens" / "foto.jpg" |
| `color` | String direto (hex) | "#FF5733" |
| `rating` | Numero + estrelas | "4/5" |
| `slider` | Numero + unidade se configurado | "75" |
| `password` | Mascarado | "........" |
| `hidden` | String vazia | "" |
| `json` | JSON.stringify compactado | `{...}` |
| `map` | extrai `.address` ou formata `lat, lng` | "Rua X, 123 - SP" |
| `array` | `formatArray` com join(', ') | "item1, item2" |
| `sub-entity` | Contagem (se disponivel) | "5 registros" |
| `zone-diagram` | String descritiva ou vazio | "-" |
| `user-select` | extrai `.label` de `{value, label}` | "Maria Silva" |
| `workflow-status` | extrai `.label` de `{value, label}` | "Em Andamento" |
| `timer` | Formata duracao (ms -> "Xh Xm Xs") | "2h 30m 15s" |
| `sla-status` | Status textual | "Dentro do SLA" |
| `checkbox-group` | `formatArray` com join(', ') | "Opcao A, Opcao B" |
| `radio-group` | extrai `.label` de `{value, label}` | "Opcao selecionada" |
| `tags` | `formatArray` com join(', ') | "tag1, tag2" |
| `signature` | Indicador de presenca | "Assinado" / "-" |
| `lookup` | extrai `.label` de `{value, label}` | "Valor buscado" |
| `formula` | `Intl.NumberFormat` se numerico, string se texto | "1.234,56" |
| `rollup` | `Intl.NumberFormat` se numerico | "42" |
| `action-button` | N/A (nao e dado) | "-" |
| `section-title` | N/A (nao e dado) | "-" |

### Arquivo: `packages/shared/src/index.ts`

Adicionar exports:

```typescript
export { formatFieldValue, extractLabel, formatArray } from './formatters';
export type { FormatFieldOptions } from './formatters';
```

## Fase 2: Integrar no backend (formatacao server-side)

### 2.1 Criar utility de formatacao de records no backend

**Arquivo NOVO:** `apps/api/src/common/utils/format-record.ts`

Funcao `formatRecordData(data, fields, options)` que:

1. Recebe o `data` (Record<string, unknown>) de um EntityData
2. Recebe os `fields` da entidade (com tipo de cada campo)
3. Retorna `Record<string, string>` com todos os valores formatados
4. Usa `formatFieldValue` do shared para cada campo
5. Respeita `fieldPermissions` (campos nao visiveis = nao incluir no formatted)

### 2.2 Integrar no data.service.ts (findAll / findOne)

**Arquivo:** `apps/api/src/modules/data/data.service.ts`

Apos buscar os records e aplicar todos os filtros de role (scope, globalFilters, dataFilters, fieldPermissions), adicionar `_formatted` ao response:

```typescript
// No findAll, apos filtrar fields
for (const record of records) {
  record._formatted = formatRecordData(record.data, entityFields, {
    visibleFields: record.visibleFields, // field-level permissions
    locale: 'pt-BR',
  });
}
```

**Importante**: isso acontece DEPOIS de:

- `applyScopeFromCustomRole()` (filtro por criador)
- `applyGlobalFilters()` (filtros globais da entidade)
- `applyRoleDataFilters()` (filtros do cargo)
- Field-level permissions filtering (campos invisiveis removidos)

Ou seja, `_formatted` so contera campos que o usuario tem permissao de ver.

**ArchivedEntityData**: O mesmo se aplica a records arquivados. Quando o backend retorna registros da tabela `ArchivedEntityData`, eles tambem recebem `_formatted`.

### 2.3 Integrar no PDF generator

**Arquivo:** `apps/api/src/modules/pdf/pdf-generator.service.ts`

- Substituir `formatValue` privado (linhas 2439-2511) por chamada a `formatFieldValue` do shared
- Mapear `format` (string) para `type` (FieldType) -- sao 1:1 na maioria
- `textTransform` (uppercase/lowercase/titlecase) -- usar a opcao `textTransform` do FormatFieldOptions
- `emptyValue` -- usar `this.emptyFieldDefault` como `options.emptyValue`
- **Bonus**: PDF ganha formatacao de {label} e arrays que antes faltava

### 2.4 Integrar no Excel/JSON export

**Arquivo:** `apps/api/src/modules/data/data-io.service.ts`

- No loop de export (linhas 141-158), usar `formatFieldValue` passando `field.type`
- **Ganhos imediatos**:
  - Excel: CPF/CNPJ com mascara, datas em pt-BR, booleans como "Sim"/"Nao", currency com "R$"
  - JSON: mesma formatacao (campo `_formatted` ou valores diretos)
- Respeitar field-level permissions (campos invisiveis ja filtrados na linha 87-89)

## Fase 3: Migrar frontend para usar `_formatted`

### 3.1 Data Table principal

**Arquivo:** `apps/web-admin/src/app/[locale]/(dashboard)/data/page.tsx`

- `formatCellValue` local (linhas 222-259) -> deletar
- Na renderizacao da tabela, trocar:
  ```diff
  - {formatCellValue(value, field?.type)}
  + {record._formatted?.[col] ?? formatFieldValue(value, { type: field?.type })}
  ```
- Fallback para `formatFieldValue` do shared (caso `_formatted` nao exista, ex: dados antigos em cache)
- **Filtros de tabela** (activeFilters, search, sort): continuam operando sobre `record.data` (valores crus), NAO sobre `_formatted`
  - Filtros sao transientes (perdidos ao recarregar pagina)
  - Search client-side filtra sobre valores crus
  - Sort server-side usa valores crus no banco

### 3.2 Sub-Entity Table

**Arquivo:** `apps/web-admin/src/components/data/sub-entity-field.tsx`

- `formatCellValue` local (linhas 59-69) -> deletar
- Usar `record._formatted?.[col]` se disponivel, senao `formatFieldValue` do shared com `booleanLabels` i18n
- **Ganho**: sub-entity agora formata date, currency, %, CPF/CNPJ que antes faltava

### 3.3 Mascaras de input (NAO mudam)

**Arquivo:** `apps/web-admin/src/components/data/record-form-dialog.tsx`

- `applyCpfMask`, `applyCnpjMask`, `applyCepMask`, `applyPhoneMask` -- sao mascaras de INPUT, nao de display
- Continuam como estao (sao para a experiencia de digitacao, nao para exibicao)

### 3.4 Locais avulsos com toLocaleDateString/toLocaleString

Esses NAO serao migrados agora pois sao datas de metadados (createdAt de tenant, logs, etc.), nao valores de campo de entidade. O formatter e especifico para FieldType de entidades.

## Fase 4: Expandir Flutter formatters

**Arquivo:** `apps/mobile/lib/shared/utils/formatters.dart`

Expandir a classe `Formatters` para espelhar os tipos do shared TypeScript:

- Adicionar: `cpf`, `cnpj`, `cep`, `phone`, `percentage`, `number`, `boolean`, `time`, `rating`
- Adicionar: `formatFieldValue(dynamic value, String fieldType)` -- funcao principal que despacha por tipo
- Manter `date`, `dateTime`, `currency`, `initials`, `timeAgo` existentes
- Usar no `data_card.dart` e `dynamic_field.dart` em vez de formatacao inline

**Nota**: Flutter nao usa o package shared (Dart vs TS), entao precisa manter em sincronia manualmente. A logica e simples o suficiente para nao divergir.

## Fase 5: Build, Deploy, Verificacao

1. `cd packages/shared && pnpm build` (compila formatters.ts)
2. `pnpm build` na raiz (shared -> api + web-admin)
3. Deploy com `./deploy.sh`
4. Testar cenarios

### Checklist de verificacao

| Cenario | O que verificar | Antes | Depois |
|---------|----------------|-------|--------|
| Tabela de dados | CPF/CNPJ formatados na coluna | "12345678901" | "123.456.789-01" |
| Tabela de dados | Datas formatadas | "2026-03-04T..." | "04/03/2026" |
| Tabela de dados | Currency com simbolo | "1234.56" | "R$ 1.234,56" |
| Tabela de dados | Boolean traduzido | "true"/"false" | "Sim"/"Nao" |
| Tabela de dados | Phone formatado | "11999990000" | "(11) 99999-0000" |
| Sub-entity table | Mesma formatacao da tabela principal | valores crus em alguns tipos | formatados |
| Excel export | Valores formatados | valores crus | formatados com mascaras |
| PDF | Formatacao mantida (zero regressao) | formatado pelo pdf-gen | formatado pelo shared |
| Filtro de tabela | Continua funcionando (filtra sobre raw) | funciona | funciona |
| Search da tabela | Continua funcionando (busca sobre raw) | funciona | funciona |
| CUSTOM role | So ve campos permitidos (field permissions) | funciona | funciona (formatted respeita) |
| CUSTOM role (scope) | Conta de registros respeita scope | funciona | funciona |
| ArchivedEntityData | Records arquivados tambem tem _formatted | N/A | formatted |
| PLATFORM_ADMIN | Ve tudo sem filtro | funciona | funciona |

## Arquivos Criticos

| Arquivo | Acao | Tipo |
|---------|------|------|
| `packages/shared/src/formatters.ts` | **CRIAR** - formatter centralizado | NOVO |
| `packages/shared/src/index.ts` | + exports formatters | EDITAR |
| `apps/api/src/common/utils/format-record.ts` | **CRIAR** - utility de formatacao de records | NOVO |
| `apps/api/src/modules/data/data.service.ts` | + `_formatted` nos records retornados | EDITAR |
| `apps/api/src/modules/pdf/pdf-generator.service.ts` | Substituir formatValue (linhas 2439-2511) | EDITAR |
| `apps/api/src/modules/data/data-io.service.ts` | Melhorar formatacao do export (linhas 141-158) | EDITAR |
| `apps/web-admin/src/app/[locale]/(dashboard)/data/page.tsx` | Deletar formatCellValue, usar _formatted | EDITAR |
| `apps/web-admin/src/components/data/sub-entity-field.tsx` | Deletar formatCellValue, usar _formatted | EDITAR |
| `apps/mobile/lib/shared/utils/formatters.dart` | Expandir com todos os tipos | EDITAR |

## Nao incluso neste plano (futuro)

- Locale configuravel por tenant (hoje hardcoded pt-BR) -- pode ser adicionado depois passando locale do tenant settings
- `include=formatted` como query param opt-in na API -- pode ser adicionado depois se mobile precisar
- Formatacao de campos computed (formula/rollup/timer/sla-status) com tipos especificos -- por agora formata como number ou string generico
- Migracao dos `toLocaleDateString` avulsos em logs/tenants/etc. -- nao sao valores de campo de entidade
