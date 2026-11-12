/**
 * Valor padrao dos campos (definido na tabela). Vale para o cadastro normal e para
 * os formularios do site: campo obrigatorio com padrao se preenche sozinho.
 */
export const hasDefault = (f: { default?: unknown }) => f.default !== undefined && f.default !== null && f.default !== '';

/** Padrao com marcador de data ({{now}} = agora, {{today}} = hoje no horario de Brasilia). */
export function resolveDefault(value: unknown, now = new Date()): unknown {
  if (value === '{{now}}') return now.toISOString();
  if (value === '{{today}}') return now.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  return value;
}

const isMarker = (v: unknown) => v === '{{now}}' || v === '{{today}}';

/**
 * O que veio no campo e o proprio padrao? O formulario manda os padroes ja na
 * abertura; com marcador de data, qualquer data vale (o servidor poe a hora certa).
 */
export function isDefaultValue(field: { default?: unknown }, value: unknown): boolean {
  if (!hasDefault(field)) return false;
  if (isMarker(field.default)) return value === undefined || value === null || value === '' || !Number.isNaN(Date.parse(String(value)));
  return JSON.stringify(value) === JSON.stringify(field.default);
}
