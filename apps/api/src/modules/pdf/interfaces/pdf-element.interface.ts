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
  showCaptions?: boolean;
  captionFields?: string[];
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
}

// Estrutura do footer
export interface PdfFooter {
  text?: string;
  showPageNumbers?: boolean;
  position?: 'left' | 'center' | 'right';
}

// Conteudo completo do template
export interface PdfTemplateContent {
  header?: PdfHeader;
  body: PdfElement[];
  footer?: PdfFooter;
}

// Margens do PDF
export interface PdfMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}
