import type { FieldType } from './enums';

// ============================================================================
// TYPES
// ============================================================================

export interface FormatFieldOptions {
  type: FieldType;
  locale?: string;
  currency?: string;
  emptyValue?: string;
  booleanLabels?: { true: string; false: string };
  textTransform?: 'uppercase' | 'lowercase' | 'titlecase';
  decimalPlaces?: number;
}

// ============================================================================
// INTL CACHE (performance — instancias sao caras de criar, baratas de usar)
// ============================================================================

const numberFormatCache = new Map<string, Intl.NumberFormat>();
const dateTimeFormatCache = new Map<string, Intl.DateTimeFormat>();

function getNumberFormat(locale: string, options?: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = `${locale}:${JSON.stringify(options || {})}`;
  let fmt = numberFormatCache.get(key);
  if (!fmt) {
    fmt = new Intl.NumberFormat(locale, options);
    numberFormatCache.set(key, fmt);
  }
  return fmt;
}

function getDateTimeFormat(locale: string, options?: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale}:${JSON.stringify(options || {})}`;
  let fmt = dateTimeFormatCache.get(key);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(locale, options);
    dateTimeFormatCache.set(key, fmt);
  }
  return fmt;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Extrai label de objetos {value, label} comuns em select/relation/api-select
 */
export function extractLabel(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object' && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    if ('label' in obj && obj.label !== undefined && obj.label !== null) {
      return String(obj.label);
    }
    if ('name' in obj && obj.name !== undefined && obj.name !== null) {
      return String(obj.name);
    }
    if ('value' in obj && obj.value !== undefined && obj.value !== null) {
      return String(obj.value);
    }
  }
  return null;
}

/**
 * Formata array de valores com separador
 */
export function formatArray(
  values: unknown[],
  options?: FormatFieldOptions,
  separator?: string,
): string {
  const sep = separator ?? ', ';
  const emptyVal = options?.emptyValue ?? '-';
  if (!Array.isArray(values) || values.length === 0) return emptyVal;

  return values
    .map((v) => {
      const label = extractLabel(v);
      if (label) return label;
      if (v === null || v === undefined) return '';
      return String(v);
    })
    .filter(Boolean)
    .join(sep);
}

// ============================================================================
// FORMATADORES ESPECIFICOS
// ============================================================================

function formatCpf(value: string): string {
  const digits = value.replace(/\D/g, '').padStart(11, '0');
  if (digits.length !== 11) return value;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
}

function formatCnpj(value: string): string {
  const digits = value.replace(/\D/g, '').padStart(14, '0');
  if (digits.length !== 14) return value;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`;
}

function formatCep(value: string): string {
  const digits = value.replace(/\D/g, '').padStart(8, '0');
  if (digits.length !== 8) return value;
  return `${digits.slice(0, 5)}-${digits.slice(5, 8)}`;
}

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return value;
}

function formatDuration(ms: number): string {
  if (isNaN(ms) || ms < 0) return '-';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);
  return parts.join(' ');
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').trim();
}

function parseDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  const str = String(value);
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return value;
  const n = Number(value);
  return isNaN(n) ? null : n;
}

// ============================================================================
// FUNCAO PRINCIPAL
// ============================================================================

/**
 * Formata um valor de campo para exibicao.
 * Fonte unica de verdade — usar em tabelas, PDFs, Excel, dashboards.
 */
export function formatFieldValue(value: unknown, options: FormatFieldOptions): string {
  const {
    type,
    locale = 'pt-BR',
    currency = 'BRL',
    emptyValue = '-',
    booleanLabels = { true: 'Sim', false: 'Nao' },
    textTransform,
    decimalPlaces = 2,
  } = options;

  // Null/undefined/vazio
  if (value === null || value === undefined || value === '') {
    return emptyValue;
  }

  let result: string;

  switch (type) {
    // --- Texto simples ---
    case 'text':
    case 'textarea':
    case 'email':
    case 'url':
      result = String(value);
      break;

    case 'richtext':
      result = stripHtml(String(value));
      break;

    // --- Numericos ---
    case 'number':
    case 'slider': {
      const n = toNumber(value);
      if (n === null) { result = String(value); break; }
      result = getNumberFormat(locale).format(n);
      break;
    }

    case 'currency': {
      const n = toNumber(value);
      if (n === null) { result = String(value); break; }
      result = getNumberFormat(locale, {
        style: 'currency',
        currency,
        minimumFractionDigits: decimalPlaces,
        maximumFractionDigits: decimalPlaces,
      }).format(n);
      break;
    }

    case 'percentage': {
      const n = toNumber(value);
      if (n === null) { result = String(value); break; }
      result = `${getNumberFormat(locale, {
        minimumFractionDigits: decimalPlaces,
        maximumFractionDigits: decimalPlaces,
      }).format(n)}%`;
      break;
    }

    case 'formula':
    case 'rollup': {
      const n = toNumber(value);
      if (n !== null) {
        result = getNumberFormat(locale).format(n);
      } else {
        result = String(value);
      }
      break;
    }

    case 'rating': {
      const n = toNumber(value);
      if (n === null) { result = emptyValue; break; }
      result = `${n}/5`;
      break;
    }

    // --- Datas ---
    case 'date': {
      const d = parseDate(value);
      if (!d) { result = String(value); break; }
      result = getDateTimeFormat(locale, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(d);
      break;
    }

    case 'datetime': {
      const d = parseDate(value);
      if (!d) { result = String(value); break; }
      result = getDateTimeFormat(locale, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(d);
      break;
    }

    case 'time': {
      const d = parseDate(value);
      if (d) {
        result = getDateTimeFormat(locale, {
          hour: '2-digit',
          minute: '2-digit',
        }).format(d);
      } else {
        // Pode ser string "14:30" direta
        result = String(value);
      }
      break;
    }

    // --- Boolean ---
    case 'boolean': {
      const boolVal =
        value === true || value === 'true' || value === '1' || value === 1;
      result = boolVal ? booleanLabels.true : booleanLabels.false;
      break;
    }

    // --- Mascaras BR ---
    case 'cpf':
      result = formatCpf(String(value));
      break;

    case 'cnpj':
      result = formatCnpj(String(value));
      break;

    case 'cep':
      result = formatCep(String(value));
      break;

    case 'phone':
      result = formatPhone(String(value));
      break;

    // --- Select/Relation (objetos {value, label}) ---
    case 'select':
    case 'api-select':
    case 'relation':
    case 'user-select':
    case 'workflow-status':
    case 'radio-group':
    case 'lookup': {
      const label = extractLabel(value);
      result = label ?? String(value);
      break;
    }

    // --- Arrays ---
    case 'multiselect':
    case 'checkbox-group':
    case 'tags':
    case 'array': {
      if (Array.isArray(value)) {
        result = formatArray(value, options);
      } else {
        const label = extractLabel(value);
        result = label ?? String(value);
      }
      break;
    }

    // --- Arquivos ---
    case 'file':
    case 'image': {
      if (Array.isArray(value)) {
        const count = value.length;
        if (type === 'image') {
          result = count === 1 ? '1 imagem' : `${count} imagens`;
        } else {
          result = count === 1 ? '1 arquivo' : `${count} arquivos`;
        }
      } else if (typeof value === 'string') {
        // Nome do arquivo ou URL
        const parts = value.split('/');
        result = parts[parts.length - 1] || value;
      } else if (typeof value === 'object') {
        const label = extractLabel(value);
        result = label ?? emptyValue;
      } else {
        result = String(value);
      }
      break;
    }

    // --- Cor ---
    case 'color':
      result = String(value);
      break;

    // --- Map/Endereco ---
    case 'map': {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        const obj = value as Record<string, unknown>;
        if (obj.address) {
          result = String(obj.address);
        } else if (obj.lat !== undefined && obj.lng !== undefined) {
          result = `${obj.lat}, ${obj.lng}`;
        } else {
          result = JSON.stringify(value);
        }
      } else {
        result = String(value);
      }
      break;
    }

    // --- Especiais ---
    case 'password':
      result = '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022';
      break;

    case 'hidden':
      result = '';
      break;

    case 'json':
      result = typeof value === 'string' ? value : JSON.stringify(value);
      break;

    case 'sub-entity':
      if (typeof value === 'number') {
        result = value === 1 ? '1 registro' : `${value} registros`;
      } else {
        result = emptyValue;
      }
      break;

    case 'zone-diagram':
      result = emptyValue;
      break;

    case 'timer': {
      const ms = toNumber(value);
      if (ms === null) { result = emptyValue; break; }
      result = formatDuration(ms);
      break;
    }

    case 'sla-status':
      result = String(value);
      break;

    case 'signature':
      if (value && String(value).length > 0) {
        result = 'Assinado';
      } else {
        result = emptyValue;
      }
      break;

    case 'action-button':
    case 'section-title':
      result = emptyValue;
      break;

    default:
      result = String(value);
      break;
  }

  // Aplicar textTransform se solicitado
  if (textTransform && result !== emptyValue) {
    switch (textTransform) {
      case 'uppercase':
        result = result.toUpperCase();
        break;
      case 'lowercase':
        result = result.toLowerCase();
        break;
      case 'titlecase':
        result = result.replace(/\b\w/g, (c) => c.toUpperCase());
        break;
    }
  }

  return result;
}

// ============================================================================
// HELPER PARA DATAS DE METADADOS (createdAt, updatedAt, etc.)
// ============================================================================

/**
 * Formata uma data/hora de metadado (createdAt, updatedAt, lastLogin, etc.)
 * Usar em audit-logs, detalhes de tenant/usuario, notificacoes.
 */
export function formatDate(value: unknown, locale = 'pt-BR'): string {
  const d = parseDate(value);
  if (!d) return '-';
  return getDateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

export function formatDateTime(value: unknown, locale = 'pt-BR'): string {
  const d = parseDate(value);
  if (!d) return '-';
  return getDateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function formatCurrency(value: unknown, locale = 'pt-BR', curr = 'BRL'): string {
  const n = toNumber(value);
  if (n === null) return '-';
  return getNumberFormat(locale, {
    style: 'currency',
    currency: curr,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function formatNumber(value: unknown, locale = 'pt-BR'): string {
  const n = toNumber(value);
  if (n === null) return '-';
  return getNumberFormat(locale).format(n);
}

export function formatPercentage(value: unknown, locale = 'pt-BR', decimals = 2): string {
  const n = toNumber(value);
  if (n === null) return '-';
  return `${getNumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n)}%`;
}
