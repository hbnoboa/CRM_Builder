'use client';

import React from 'react';

// ============================================================================
// ROW COMPONENT - Container for columns with preset layouts
// ============================================================================

export interface RowProps {
  layout:
    | '1'
    | '2-equal'
    | '2-left'
    | '2-right'
    | '3-equal'
    | '3-center'
    | '4-equal'
    | 'custom';
  customColumns?: number[];
  gap?: 'none' | 'sm' | 'md' | 'lg';
  verticalAlign?: 'top' | 'center' | 'bottom' | 'stretch';
  puck?: any;
}

// Predefined layouts (columns in 12-grid system)
const LAYOUTS: Record<string, number[]> = {
  '1': [12],                    // 1 column 100%
  '2-equal': [6, 6],           // 2 columns 50/50
  '2-left': [8, 4],            // 2 columns 66/33
  '2-right': [4, 8],           // 2 columns 33/66
  '3-equal': [4, 4, 4],        // 3 columns 33/33/33
  '3-center': [3, 6, 3],       // 3 columns 25/50/25
  '4-equal': [3, 3, 3, 3],     // 4 columns 25x4
};

const LAYOUT_LABELS: Record<string, string> = {
  '1': '1 Coluna (100%)',
  '2-equal': '2 Colunas (50/50)',
  '2-left': '2 Colunas (66/33)',
  '2-right': '2 Colunas (33/66)',
  '3-equal': '3 Colunas (33/33/33)',
  '3-center': '3 Colunas (25/50/25)',
  '4-equal': '4 Colunas (25x4)',
  'custom': 'Customizado',
};

const GAP_CLASSES = {
  none: 'gap-0',
  sm: 'gap-2',
  md: 'gap-4',
  lg: 'gap-6',
};

const ALIGN_CLASSES = {
  top: 'items-start',
  center: 'items-center',
  bottom: 'items-end',
  stretch: 'items-stretch',
};

export function Row({ layout, customColumns, gap = 'md', verticalAlign = 'stretch', puck }: RowProps) {
  const columns = layout === 'custom' && customColumns?.length
    ? customColumns.map(c => typeof c === 'object' ? (c as any).size || 6 : c)
    : LAYOUTS[layout] || LAYOUTS['2-equal'];

  const isEditing = puck?.isEditing;

  return (
    <div
      className={`grid grid-cols-12 ${GAP_CLASSES[gap]} ${ALIGN_CLASSES[verticalAlign]} ${isEditing ? 'border-2 border-dashed border-blue-300 rounded-lg p-2 bg-blue-50/30' : ''}`}
    >
      {columns.map((span, idx) => (
        <div
          key={idx}
          className={`min-h-[60px] ${isEditing ? 'border border-dashed border-blue-200 rounded bg-white/50' : ''}`}
          style={{ gridColumn: `span ${span}` }}
        >
          {isEditing && (
            <div className="text-[10px] text-blue-400 text-center py-1 border-b border-blue-100">
              Col {idx + 1} ({Math.round((span / 12) * 100)}%)
            </div>
          )}
          <div className={isEditing ? 'p-1' : ''}>
            {puck?.renderDropZone({ zone: `col-${idx}` })}
          </div>
        </div>
      ))}
    </div>
  );
}

export function RowPreview({ layout, customColumns, gap = 'md' }: RowProps) {
  const columns = layout === 'custom' && customColumns?.length
    ? customColumns
    : LAYOUTS[layout] || LAYOUTS['2-equal'];

  const total = columns.reduce((a, b) => a + b, 0);

  return (
    <div className="p-4 border-2 border-dashed border-blue-300 rounded-lg bg-blue-50/50">
      <div className="text-xs text-blue-600 font-medium mb-2">
        Row - {LAYOUT_LABELS[layout] || layout}
      </div>
      <div className={`grid grid-cols-12 ${GAP_CLASSES[gap]}`}>
        {columns.map((span, idx) => (
          <div
            key={idx}
            className="h-12 bg-blue-100 border border-blue-300 rounded flex items-center justify-center text-xs text-blue-700 font-medium"
            style={{ gridColumn: `span ${span}` }}
          >
            {Math.round((span / 12) * 100)}%
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// COLUMN COMPONENT - Single column for more control
// ============================================================================

export interface ColProps {
  size: '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | '11' | '12' | 'auto';
  sizeMd?: '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | '11' | '12' | 'auto';
  sizeLg?: '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | '11' | '12' | 'auto';
  background?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  puck?: any;
}

const COL_SIZES: Record<string, string> = {
  '1': 'col-span-1',
  '2': 'col-span-2',
  '3': 'col-span-3',
  '4': 'col-span-4',
  '5': 'col-span-5',
  '6': 'col-span-6',
  '7': 'col-span-7',
  '8': 'col-span-8',
  '9': 'col-span-9',
  '10': 'col-span-10',
  '11': 'col-span-11',
  '12': 'col-span-12',
  'auto': 'col-auto',
};

const PADDING_CLASSES = {
  none: 'p-0',
  sm: 'p-2',
  md: 'p-4',
  lg: 'p-6',
};

export function Col({ size, background, padding = 'none', puck }: ColProps) {
  return (
    <div
      className={`${COL_SIZES[size]} ${PADDING_CLASSES[padding]} min-h-[40px]`}
      style={{ background }}
    >
      {puck?.renderDropZone({ zone: 'content' })}
    </div>
  );
}

export function ColPreview({ size, padding = 'none' }: ColProps) {
  const percentage = size === 'auto' ? 'auto' : `${Math.round((parseInt(size) / 12) * 100)}%`;

  return (
    <div className={`border-2 border-dashed border-purple-300 rounded-lg bg-purple-50/50 ${PADDING_CLASSES[padding]} min-h-[60px] flex items-center justify-center`}>
      <span className="text-xs text-purple-600 font-medium">
        Coluna {size}/12 ({percentage})
      </span>
    </div>
  );
}

// ============================================================================
// SECTION COMPONENT - Full-width section with background options
// ============================================================================

export interface SectionProps {
  background?: 'none' | 'muted' | 'primary' | 'secondary' | 'gradient' | 'custom';
  customBackground?: string;
  paddingY?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  puck?: any;
}

const SECTION_BG: Record<string, string> = {
  none: '',
  muted: 'bg-muted',
  primary: 'bg-primary text-primary-foreground',
  secondary: 'bg-secondary',
  gradient: 'bg-gradient-to-r from-primary/10 to-secondary/10',
  custom: '',
};

const SECTION_PADDING_Y: Record<string, string> = {
  none: 'py-0',
  sm: 'py-4',
  md: 'py-8',
  lg: 'py-12',
  xl: 'py-16',
};

const SECTION_MAX_WIDTH: Record<string, string> = {
  sm: 'max-w-screen-sm',
  md: 'max-w-screen-md',
  lg: 'max-w-screen-lg',
  xl: 'max-w-screen-xl',
  full: 'max-w-full',
};

export function Section({ background = 'none', customBackground, paddingY = 'md', maxWidth = 'lg', puck }: SectionProps) {
  const bgClass = background === 'custom' ? '' : SECTION_BG[background];
  const style = background === 'custom' && customBackground ? { background: customBackground } : {};
  const isEditing = puck?.isEditing;

  return (
    <section
      className={`w-full ${bgClass} ${SECTION_PADDING_Y[paddingY]} ${isEditing ? 'border-2 border-dashed border-green-300 rounded-lg' : ''}`}
      style={style}
    >
      {isEditing && (
        <div className="text-[10px] text-green-500 text-center py-1 bg-green-50/50">
          Section - {maxWidth} - {background}
        </div>
      )}
      <div className={`mx-auto px-4 ${SECTION_MAX_WIDTH[maxWidth]} ${isEditing ? 'min-h-[60px]' : ''}`}>
        {puck?.renderDropZone({ zone: 'content' })}
      </div>
    </section>
  );
}

export function SectionPreview({ background = 'none', paddingY = 'md' }: SectionProps) {
  const bgClass = background === 'none' ? 'bg-gray-100' : SECTION_BG[background] || 'bg-gray-100';

  return (
    <div className={`border-2 border-dashed border-green-300 rounded-lg ${bgClass} ${SECTION_PADDING_Y[paddingY]}`}>
      <div className="text-center text-xs text-green-600 font-medium py-4">
        Section - {background}
      </div>
    </div>
  );
}

// ============================================================================
// FLEX ROW - Simple flex container
// ============================================================================

export interface FlexRowProps {
  justify?: 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly';
  align?: 'start' | 'center' | 'end' | 'stretch';
  wrap?: boolean;
  gap?: 'none' | 'sm' | 'md' | 'lg';
  puck?: any;
}

const JUSTIFY_CLASSES: Record<string, string> = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
  between: 'justify-between',
  around: 'justify-around',
  evenly: 'justify-evenly',
};

const FLEX_ALIGN_CLASSES: Record<string, string> = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch',
};

export function FlexRow({ justify = 'start', align = 'center', wrap = false, gap = 'md', puck }: FlexRowProps) {
  const isEditing = puck?.isEditing;

  return (
    <div className={isEditing ? 'border-2 border-dashed border-orange-300 rounded-lg bg-orange-50/30' : ''}>
      {isEditing && (
        <div className="text-[10px] text-orange-500 text-center py-1">
          Flex Row: {justify}
        </div>
      )}
      <div
        className={`flex ${wrap ? 'flex-wrap' : ''} ${JUSTIFY_CLASSES[justify]} ${FLEX_ALIGN_CLASSES[align]} ${GAP_CLASSES[gap]} min-h-[40px] ${isEditing ? 'p-2' : ''}`}
      >
        {puck?.renderDropZone({ zone: 'content' })}
      </div>
    </div>
  );
}

export function FlexRowPreview({ justify = 'start', gap = 'md' }: FlexRowProps) {
  return (
    <div className={`border-2 border-dashed border-orange-300 rounded-lg bg-orange-50/50 p-4`}>
      <div className="text-xs text-orange-600 font-medium mb-2">
        Flex Row - {justify}
      </div>
      <div className={`flex ${JUSTIFY_CLASSES[justify]} ${GAP_CLASSES[gap]}`}>
        <div className="w-16 h-8 bg-orange-200 rounded"></div>
        <div className="w-16 h-8 bg-orange-200 rounded"></div>
        <div className="w-16 h-8 bg-orange-200 rounded"></div>
      </div>
    </div>
  );
}

// ============================================================================
// GRID - CSS Grid with custom columns/rows
// ============================================================================

export interface GridProps {
  columns?: number;
  columnsMd?: number;
  columnsLg?: number;
  gap?: 'none' | 'sm' | 'md' | 'lg';
  puck?: any;
}

const GRID_COLS: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  5: 'grid-cols-5',
  6: 'grid-cols-6',
};

export function Grid({ columns = 2, columnsMd, columnsLg, gap = 'md', puck }: GridProps) {
  const colClass = GRID_COLS[columns] || 'grid-cols-2';
  const mdClass = columnsMd ? `md:${GRID_COLS[columnsMd]}` : '';
  const lgClass = columnsLg ? `lg:${GRID_COLS[columnsLg]}` : '';
  const isEditing = puck?.isEditing;

  return (
    <div className={`${isEditing ? 'border-2 border-dashed border-pink-300 rounded-lg p-2 bg-pink-50/30' : ''}`}>
      {isEditing && (
        <div className="text-[10px] text-pink-500 text-center py-1 mb-1">
          Grid: {columns} colunas
        </div>
      )}
      <div className={`grid ${colClass} ${mdClass} ${lgClass} ${GAP_CLASSES[gap]} min-h-[40px]`}>
        {puck?.renderDropZone({ zone: 'content' })}
      </div>
    </div>
  );
}

export function GridPreview({ columns = 2, gap = 'md' }: GridProps) {
  return (
    <div className={`border-2 border-dashed border-pink-300 rounded-lg bg-pink-50/50 p-4`}>
      <div className="text-xs text-pink-600 font-medium mb-2">
        Grid - {columns} colunas
      </div>
      <div className={`grid ${GRID_COLS[columns] || 'grid-cols-2'} ${GAP_CLASSES[gap]}`}>
        {Array.from({ length: columns }).map((_, i) => (
          <div key={i} className="h-8 bg-pink-200 rounded"></div>
        ))}
      </div>
    </div>
  );
}

// Export layout options for config
export const LAYOUT_OPTIONS = Object.entries(LAYOUT_LABELS).map(([value, label]) => ({
  value,
  label,
}));

export const SIZE_OPTIONS = [
  { value: '1', label: '1/12 (8%)' },
  { value: '2', label: '2/12 (16%)' },
  { value: '3', label: '3/12 (25%)' },
  { value: '4', label: '4/12 (33%)' },
  { value: '5', label: '5/12 (41%)' },
  { value: '6', label: '6/12 (50%)' },
  { value: '7', label: '7/12 (58%)' },
  { value: '8', label: '8/12 (66%)' },
  { value: '9', label: '9/12 (75%)' },
  { value: '10', label: '10/12 (83%)' },
  { value: '11', label: '11/12 (91%)' },
  { value: '12', label: '12/12 (100%)' },
];
