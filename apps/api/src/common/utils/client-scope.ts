import { Prisma } from '@prisma/client';

/** Cliente que a pessoa representa no portal: um registro de uma tabela (ex.: uma empresa). */
export interface ClientLink {
  entityId: string;
  entitySlug: string;
  recordId: string;
}

interface FieldLike { slug?: string; type?: string; relatedEntityId?: string; relatedEntitySlug?: string }

/** Campos de relacao desta tabela que apontam para a tabela do cliente. */
export function clientRelationFields(fields: unknown, link: Pick<ClientLink, 'entityId' | 'entitySlug'>): string[] {
  return (Array.isArray(fields) ? (fields as FieldLike[]) : [])
    .filter((f) => f.type === 'relation' && !!f.slug && (f.relatedEntityId === link.entityId || f.relatedEntitySlug === link.entitySlug))
    .map((f) => f.slug as string);
}

/**
 * O que e do cliente nesta tabela: o proprio registro do cliente, o que esta dentro
 * dele (filhos e, via `childIds`, netos) e o que aponta para ele por um campo de
 * relacao. Sem vinculo, nada. So usa campos que existem tambem nos arquivados.
 */
export function clientScopeWhere(
  entity: { id: string; fields: unknown },
  link: ClientLink | null,
  childIds: string[] = [],
): Prisma.EntityDataWhereInput {
  if (!link) return { id: { in: [] } };
  if (entity.id === link.entityId) return { id: link.recordId };
  const or: Prisma.EntityDataWhereInput[] = [{ parentRecordId: { in: [link.recordId, ...childIds] } }];
  for (const slug of clientRelationFields(entity.fields, link)) {
    or.push({ data: { path: [slug], equals: link.recordId } });
    or.push({ data: { path: [slug, 'value'], equals: link.recordId } });
  }
  return { OR: or };
}
