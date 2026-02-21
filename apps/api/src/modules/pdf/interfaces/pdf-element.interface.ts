/**
 * Interfaces para elementos de template PDF
 */

// Formato unificado de campos
export type FieldFormat =
  | 'text' | 'number' | 'currency' | 'date' | 'datetime' | 'time' | 'percentage'
  | 'cpf' | 'cnpj' | 'cep' | 'phone' | 'boolean'
  | 'uppercase' | 'lowercase' | 'titlecase';

// Tipos de elementos suportados
export type PdfElementType =
  | 'text'
  | 'field-group'
  | 'table'
  | 'image'
  | 'image-grid'
  | 'divider'
  | 'spacer'
  | 'statistics';

// Condicao de visibilidade
export interface VisibilityCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'greater' | 'less' | 'contains' | 'not_empty' | 'has_items' | 'no_items';
  value?: string;
}

// Elemento base
export interface BasePdfElement {
  id: string;
  type: PdfElementType;
  marginTop?: number;
  marginBottom?: number;
  visibility?: VisibilityCondition;
  repeatPerRecord?: boolean; // Para batch: renderizar para cada registro
}

// Elemento de texto
export interface TextElement extends BasePdfElement {
  type: 'text';
  content: string; // Suporta {{campo}} para data binding
  fontSize?: number;
  fontWeight?: 'normal' | 'bold';
  color?: string;
  align?: 'left' | 'center' | 'right';
}

// Grupo de campos (label: valor)
export interface FieldGroupElement extends BasePdfElement {
  type: 'field-group';
  title?: string;
  layout: 'horizontal' | 'vertical' | 'grid';
  columns?: number;
  labelFontSize?: number;
  valueFontSize?: number;
  lineSpacing?: number; // Espacamento entre linhas em pt
  fields: {
    label: string;
    binding: string; // {{campo}}
    format?: FieldFormat;
    labelBold?: boolean;
    defaultValue?: string;
  }[];
}

// Coluna de tabela
export interface TableColumn {
  field: string;
  header: string;
  width?: number;
  align?: 'left' | 'center' | 'right';
  format?: FieldFormat;
  defaultValue?: string;
}

// Filtro de linha de tabela
export interface TableRowFilter {
  field: string;
  operator: 'equals' | 'not_equals' | 'greater' | 'less' | 'contains' | 'not_empty' | 'has_items' | 'no_items';
  value: string;
}

// Regra de ordenacao de tabela
export interface TableSortRule {
  field: string;
  direction: 'asc' | 'desc';
}

// Elemento de tabela
export interface TableElement extends BasePdfElement {
  type: 'table';
  title?: string;
  dataSource?: string; // Campo com array de dados (ex: "naoConformidades")
  columns: TableColumn[];
  showHeader?: boolean;
  headerStyle?: {
    bold?: boolean;
    fontSize?: number;
    bgColor?: string;
  };
  cellStyle?: {
    fontSize?: number;
  };
  emptyMessage?: string;
  filters?: TableRowFilter[];
  filterLogic?: 'and' | 'or';
  sorting?: TableSortRule[];
}

// Elemento de imagem
export interface ImageElement extends BasePdfElement {
  type: 'image';
  source: string; // URL ou {{campo}}
  width?: number;
  height?: number;
  align?: 'left' | 'center' | 'right';
}

// Grid de imagens (para nao-conformidades)
export interface ImageGridElement extends BasePdfElement {
  type: 'image-grid';
  title?: string;
  columns: number; // 2, 3 ou 4
  dataSource: string; // Campo com array de imagens
  imageWidth?: number;
  imageHeight?: number;
  cellHeight?: number; // Altura da celula (para controle de layout)
  showCaptions?: boolean;
  captionFields?: string[];
  captionFontSize?: number;
  captionDataFields?: string[]; // Campos dos dados para captions dinamicos (ex: ["chassi", "modelo", "local", "medida"])
  imageFields?: string[]; // Campos de imagem para extrair de sub-entidades
  parentImageFields?: string[]; // Campos de imagem do registro principal (foto_chassi, foto_perfil)
}

// Linha divisoria
export interface DividerElement extends BasePdfElement {
  type: 'divider';
  color?: string;
  thickness?: number;
}

// Espacamento
export interface SpacerElement extends BasePdfElement {
  type: 'spacer';
  height: number;
}

// Estatisticas (agrupamento)
export interface StatisticsElement extends BasePdfElement {
  type: 'statistics';
  title: string;
  groupBy: string[]; // Campos para agrupar (ex: ["marca", "modelo"])
  columnWidths?: number[]; // Larguras customizadas para cada coluna (groupBy + metrics)
  rowHeight?: number; // Altura das linhas (default 20)
  headerFill?: string | null; // Cor de fundo do header (null = sem fill)
  metrics: {
    field: string;
    aggregation: 'count' | 'sum' | 'avg' | 'percentage' | 'min' | 'max';
    label: string;
    percentageFilter?: {
      field: string;
      operator: string;
      value: string;
    };
  }[];
}

// Union type de todos os elementos
export type PdfElement =
  | TextElement
  | FieldGroupElement
  | TableElement
  | ImageElement
  | ImageGridElement
  | DividerElement
  | SpacerElement
  | StatisticsElement;

// Estrutura do header
export interface PdfHeader {
  logo?: {
    url: string;
    width?: number;
    height?: number;
    position?: 'left' | 'center' | 'right';
  };
  title?: {
    text: string;
    fontSize?: number;
    bold?: boolean;
  };
  subtitle?: {
    text: string;
    binding?: string;
  };
  showOnAllPages?: boolean;
  showDivider?: boolean; // Mostrar linha divisoria apos header (default true)
}

// Estrutura do footer
export interface PdfFooter {
  text?: string;
  showPageNumbers?: boolean;
  position?: 'left' | 'center' | 'right';
}

// =============== Computed Fields ===============

export interface ArithmeticConfig {
  operands: Array<{ type: 'field' | 'number'; value: string }>;
  operators: Array<'+' | '-' | '*' | '/'>;
}

export interface ConditionalConfig {
  field: string;
  operator: 'equals' | 'not_equals' | 'greater' | 'less' | 'contains' | 'not_empty' | 'has_items' | 'no_items';
  compareValue: string;
  trueResult: { type: 'text' | 'field'; value: string };
  falseResult: { type: 'text' | 'field'; value: string };
}

export interface FilteredCountFilter {
  field: string;
  operator: 'equals' | 'not_equals' | 'greater' | 'less' | 'contains' | 'not_empty' | 'has_items' | 'no_items';
  value: string;
}

export interface FilteredCountConfig {
  filters: FilteredCountFilter[];
}

export interface ConcatConfig {
  parts: Array<{ type: 'field' | 'text'; value: string }>;
  separator: string;
}

export interface MapConfig {
  field: string;
  mappings: Array<{ from: string; to: string }>;
  defaultMapping?: string;
}

export interface SubEntityAggregateConfig {
  subEntityField: string;
  aggregation: 'count' | 'sum' | 'avg' | 'min' | 'max';
  field?: string; // Necessario para sum/avg/min/max
  filters?: FilteredCountFilter[];
}

export type ComputedFieldType = 'arithmetic' | 'conditional' | 'filtered-count' | 'concat' | 'map' | 'sub-entity-aggregate';

export interface ComputedField {
  id: string;
  slug: string;
  label: string;
  type: ComputedFieldType;
  config: ArithmeticConfig | ConditionalConfig | FilteredCountConfig | ConcatConfig | MapConfig | SubEntityAggregateConfig;
}

// Configuracoes globais do template
export interface PdfTemplateSettings {
  emptyFieldDefault?: string; // Texto padrao para campos vazios (ex: "-", "N/A")
}

// Conteudo completo do template
export interface PdfTemplateContent {
  header?: PdfHeader;
  body: PdfElement[];
  footer?: PdfFooter;
  computedFields?: ComputedField[];
  settings?: PdfTemplateSettings;
}

// Margens do PDF
export interface PdfMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}
