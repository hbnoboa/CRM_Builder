import type { DataRecord, EntityField } from '@/components/entity-data/unified-filter-types';

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    if (Array.isArray(value)) return value.map(v => formatValue(v)).join(', ');
    const obj = value as Record<string, unknown>;
    if ('label' in obj) return String(obj.label);
    if ('name' in obj) return String(obj.name);
    if ('value' in obj) return String(obj.value);
    return JSON.stringify(value);
  }
  return String(value);
}

export function exportToJson(
  records: DataRecord[],
  fileName: string = 'export',
) {
  const data = records.map(r => ({
    id: r.id,
    ...r.data,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  downloadBlob(blob, `${fileName}.json`);
}

export async function exportToXlsx(
  records: DataRecord[],
  fields: EntityField[],
  fileName: string = 'export',
) {
  // Dynamic import para não carregar xlsx em todos os bundles
  const XLSX = await import('xlsx');

  const headers = fields.map(f => f.label || f.name);
  const rows = records.map(r =>
    fields.map(f => {
      const val = (f.slug === 'createdAt' || f.slug === '__createdAt') ? r.createdAt
        : (f.slug === 'updatedAt' || f.slug === '__updatedAt') ? r.updatedAt
        : r.data?.[f.slug];
      return formatValue(val);
    }),
  );

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Dados');

  const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  downloadBlob(blob, `${fileName}.xlsx`);
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
