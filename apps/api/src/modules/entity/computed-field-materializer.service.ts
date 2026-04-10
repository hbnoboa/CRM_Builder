import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Entity, EntityData, Prisma } from '@prisma/client';
import { ComputedFieldService } from './computed-field.service';

interface EntityWithFields extends Entity {
  fields: any[];
}

@Injectable()
export class ComputedFieldMaterializerService {
  private readonly logger = new Logger(ComputedFieldMaterializerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly computedFieldService: ComputedFieldService,
  ) {}

  /**
   * Materializa computed fields e salva na coluna computedValues
   */
  async materialize(
    entity: EntityWithFields,
    record: EntityData,
  ): Promise<Record<string, unknown>> {
    const computedFields = entity.fields.filter((f) =>
      ['formula', 'rollup', 'timer', 'sla-status'].includes(f.type),
    );

    if (computedFields.length === 0) {
      return {};
    }

    const computedValues: Record<string, unknown> = {};
    const recordData = record.data as Record<string, unknown>;

    for (const field of computedFields) {
      try {
        const value = await this.computeField(field, record, entity);
        computedValues[field.key] = value;
      } catch (error) {
        const err = error as Error;
        this.logger.error(
          `Erro ao computar campo ${field.key} do registro ${record.id}: ${err.message}`,
          err.stack,
        );
        // Em caso de erro, manter valor anterior se existir
        const previousComputed = record.computedValues as Record<
          string,
          unknown
        >;
        if (previousComputed && field.key in previousComputed) {
          computedValues[field.key] = previousComputed[field.key];
        } else {
          computedValues[field.key] = null;
        }
      }
    }

    // Salvar no banco
    await this.prisma.entityData.update({
      where: { id: record.id },
      data: { computedValues: computedValues as Prisma.InputJsonValue },
    });

    this.logger.debug(
      `Materializado ${computedFields.length} campos computados para registro ${record.id}`,
    );

    return computedValues;
  }

  /**
   * Computa o valor de um campo específico
   */
  private async computeField(
    field: any,
    record: EntityData,
    entity: EntityWithFields,
  ): Promise<unknown> {
    const recordData = record.data as Record<string, unknown>;

    switch (field.type) {
      case 'formula':
        return this.computedFieldService.evaluateFormula(
          field.settings?.formula || '',
          recordData,
        );

      case 'rollup':
        return this.computedFieldService.evaluateRollup(
          field.settings?.relatedEntitySlug || '',
          field.settings?.relatedField || '',
          field.settings?.aggregation || 'count',
          record.id,
          record.tenantId,
        );

      case 'timer':
        return this.computedFieldService.calculateTimer(
          field.settings?.startField || '',
          field.settings?.endField || '',
          recordData,
        );

      case 'sla-status':
        return this.computedFieldService.calculateSLAStatus(
          field.settings?.deadlineField || '',
          field.settings?.warningHours || 24,
          recordData,
        );

      default:
        return null;
    }
  }

  /**
   * Invalida e recomputa campos de múltiplos registros
   */
  async invalidateAndRecompute(
    entitySlug: string,
    recordIds: string[],
    tenantId: string,
  ): Promise<void> {
    if (recordIds.length === 0) return;

    const entity = await this.prisma.entity.findFirst({
      where: { slug: entitySlug, tenantId },
    });

    if (!entity) {
      this.logger.warn(
        `Entidade ${entitySlug} não encontrada para tenant ${tenantId}`,
      );
      return;
    }

    // fields é uma coluna JSON, já vem por padrão
    const entityWithFields = {
      ...entity,
      fields: (entity.fields as any[]) || [],
    } as EntityWithFields;

    const records = await this.prisma.entityData.findMany({
      where: {
        id: { in: recordIds },
        tenantId,
      },
    });

    this.logger.log(
      `Recomputando ${records.length} registros da entidade ${entitySlug}`,
    );

    for (const record of records) {
      await this.materialize(entityWithFields, record);
    }
  }

  /**
   * Identifica campos computados afetados por mudanças em campos base
   */
  getAffectedComputedFields(
    entity: EntityWithFields,
    changedFields: string[],
  ): any[] {
    return entity.fields.filter((field) => {
      if (field.type === 'formula') {
        // Checar se fórmula usa algum campo alterado
        const formula = field.settings?.formula || '';
        return changedFields.some((f) => formula.includes(`{{${f}}}`));
      }

      if (field.type === 'timer') {
        // Timer depende de startField e endField
        return (
          changedFields.includes(field.settings?.startField) ||
          changedFields.includes(field.settings?.endField)
        );
      }

      if (field.type === 'sla-status') {
        // SLA status depende de deadlineField
        return changedFields.includes(field.settings?.deadlineField);
      }

      // Rollups não são afetados por mudanças locais
      // (apenas quando registros relacionados mudam)
      return false;
    });
  }

  /**
   * Invalida rollups de registros pais quando um filho muda
   */
  async invalidateParentRollups(
    childEntity: EntityWithFields,
    childRecord: EntityData,
  ): Promise<void> {
    // Buscar entidades que fazem rollup desta entidade
    const parentEntities = await this.prisma.entity.findMany({
      where: {
        tenantId: childEntity.tenantId,
      },
    });

    for (const parentEntity of parentEntities) {
      const parentFields = (parentEntity.fields as any[]) || [];
      const rollupFields = parentFields.filter(
        (f) =>
          f.type === 'rollup' &&
          f.settings?.relatedEntitySlug === childEntity.slug,
      );

      if (rollupFields.length === 0) continue;

      // Encontrar registros pais que referenciam este filho
      const parentRecords = await this.findParentRecords(
        parentEntity,
        childEntity,
        childRecord,
      );

      if (parentRecords.length > 0) {
        await this.invalidateAndRecompute(
          parentEntity.slug,
          parentRecords.map((r) => r.id),
          parentEntity.tenantId,
        );
      }
    }
  }

  /**
   * Encontra registros pais que referenciam um registro filho
   */
  private async findParentRecords(
    parentEntity: Entity,
    childEntity: Entity,
    childRecord: EntityData,
  ): Promise<EntityData[]> {
    // Buscar campos relationship que apontam para o childEntity
    const parentFields = (parentEntity.fields as any[]) || [];
    const relationshipFields = parentFields.filter(
      (f) =>
        f.type === 'relationship' &&
        f.settings?.relatedEntitySlug === childEntity.slug,
    );

    if (relationshipFields.length === 0) return [];

    const childRecordData = childRecord.data as Record<string, unknown>;
    const orConditions: any[] = [];

    for (const relField of relationshipFields) {
      // Registros pais que têm o childRecord.id no campo de relationship
      orConditions.push({
        [`data.${relField.key}`]: { equals: childRecord.id },
      });
    }

    if (orConditions.length === 0) return [];

    // NOTA: Prisma não suporta queries JSON complexas de forma nativa
    // Para otimizar, seria necessário usar raw SQL ou índices GIN
    // Por enquanto, vamos buscar todos os registros e filtrar em memória
    const allParentRecords = await this.prisma.entityData.findMany({
      where: {
        entityId: parentEntity.id,
        tenantId: parentEntity.tenantId,
      },
    });

    return allParentRecords.filter((record) => {
      const recordData = record.data as Record<string, unknown>;
      return relationshipFields.some((relField) => {
        const fieldValue = recordData[relField.key];
        // Suporta tanto valor único quanto array
        if (Array.isArray(fieldValue)) {
          return fieldValue.includes(childRecord.id);
        }
        return fieldValue === childRecord.id;
      });
    });
  }

  /**
   * Recomputa todos os timers e SLA status (cron job diário)
   */
  async recomputeTimeBasedFields(): Promise<void> {
    this.logger.log('🕒 Iniciando recompute de campos baseados em tempo...');

    const entitiesWithTimers = await this.prisma.entity.findMany({
      where: {
        OR: [
          { fields: { path: ['$[*].type'], array_contains: ['timer'] } },
          {
            fields: { path: ['$[*].type'], array_contains: ['sla-status'] },
          },
        ],
      },
    });

    this.logger.log(
      `Encontradas ${entitiesWithTimers.length} entidades com campos temporais`,
    );

    for (const entity of entitiesWithTimers) {
      const records = await this.prisma.entityData.findMany({
        where: { entityId: entity.id },
        select: { id: true },
      });

      if (records.length === 0) continue;

      this.logger.log(
        `Recomputando ${records.length} registros da entidade ${entity.slug}`,
      );

      // Processar em lotes de 100
      for (let i = 0; i < records.length; i += 100) {
        const batch = records.slice(i, i + 100);
        await this.invalidateAndRecompute(
          entity.slug,
          batch.map((r) => r.id),
          entity.tenantId,
        );
      }
    }

    this.logger.log('✅ Recompute de campos temporais concluído');
  }
}
