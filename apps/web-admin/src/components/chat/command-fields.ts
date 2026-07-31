// Modelo unificado dos campos de um comando de criação (create_record).
// Uma lista ORDENADA — a ordem de exibição/validação é a ordem do array — em que
// cada item sabe se vem da tabela-alvo ou da tabela-pai e se é obrigatório.
// Substitui o antigo trio quickFields/heavyFields/parentFields (que não tinha
// ordem nem obrigatoriedade configuráveis). Mantém compatibilidade: comandos
// antigos são derivados na hora.

export type FieldSource = 'target' | 'parent';

export interface FormFieldCfg {
  slug: string;
  source: FieldSource;
  required: boolean;
}

/**
 * Lê os campos do formulário do actionConfig. Se já houver `formFields`
 * (formato novo), usa-o como fonte da verdade. Senão, deriva do legado
 * preservando o comportamento atual: fotos do pai primeiro, depois pesados,
 * depois rápidos — todos obrigatórios.
 */
export function deriveFormFields(cfg: Record<string, unknown> | null | undefined): FormFieldCfg[] {
  const c = cfg || {};
  const existing = c.formFields;
  if (Array.isArray(existing)) {
    return existing
      .filter((f): f is FormFieldCfg => !!f && typeof (f as FormFieldCfg).slug === 'string')
      .map((f) => ({ slug: f.slug, source: f.source === 'parent' ? 'parent' : 'target', required: f.required !== false }));
  }
  const parentFields = (c.parentFields as string[]) || [];
  const heavyFields = (c.heavyFields as string[]) || [];
  const quickFields = (c.quickFields as string[]) || [];
  return [
    ...parentFields.map((slug) => ({ slug, source: 'parent' as const, required: true })),
    ...heavyFields.map((slug) => ({ slug, source: 'target' as const, required: true })),
    ...quickFields.map((slug) => ({ slug, source: 'target' as const, required: true })),
  ];
}

/** Id estável para dnd/keys. Slugs de campo não contêm ':'. */
export const fieldCfgId = (ff: FormFieldCfg): string => `${ff.source}:${ff.slug}`;
