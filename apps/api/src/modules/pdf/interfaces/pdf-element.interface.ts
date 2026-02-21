/**
 * Interfaces para elementos de template PDF
 */

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

// Elemento base
export interface BasePdfElement {
  id: string;
  type: PdfElementType;
  marginTop?: number;
  marginBottom?: number;
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
    format?: 'text' | 'number' | 'currency' | 'date' | 'datetime';
    labelBold?: boolean;
  }[];
}

// Coluna de tabela
export interface TableColumn {
  field: string;
  header: string;
  width?: number;
  align?: 'left' | 'center' | 'right';
  format?: 'text' | 'number' | 'currency' | 'date' | 'datetime' | 'percentage';
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
    aggregation: 'count' | 'sum' | 'avg' | 'percentage';
    label: string;
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
  operator: 'equals' | 'not_equals' | 'greater' | 'less' | 'contains' | 'not_empty';
  compareValue: string;
  trueResult: { type: 'text' | 'field'; value: string };
  falseResult: { type: 'text' | 'field'; value: string };
}

export interface FilteredCountFilter {
  field: string;
  operator: 'equals' | 'not_equals' | 'greater' | 'less' | 'contains' | 'not_empty';
  value: string;
}

export interface FilteredCountConfig {
  filters: FilteredCountFilter[];
}

export interface ConcatConfig {
  parts: Array<{ type: 'field' | 'text'; value: string }>;
  separator: string;
}

export type ComputedFieldType = 'arithmetic' | 'conditional' | 'filtered-count' | 'concat';

export interface ComputedField {
  id: string;
  slug: string;
  label: string;
  type: ComputedFieldType;
  config: ArithmeticConfig | ConditionalConfig | FilteredCountConfig | ConcatConfig;
}

// Conteudo completo do template
export interface PdfTemplateContent {
  header?: PdfHeader;
  body: PdfElement[];
  footer?: PdfFooter;
  computedFields?: ComputedField[];
}

// Margens do PDF
export interface PdfMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}
