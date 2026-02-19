import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { CurrentUser } from '../../common/types';
import { buildFilterClause } from '../../common/utils/build-filter-clause';
import { CreateDataSourceDto } from './dto/create-data-source.dto';
import { UpdateDataSourceDto } from './dto/update-data-source.dto';

interface DataSourceDefinition {
  sources: Array<{
    entitySlug: string;
    fields: Array<{ slug: string; alias?: string }>;
  }>;
  filters?: Array<{
    field: string; // entitySlug.fieldSlug
    fieldType?: string;
    operator: string;
    value?: unknown;
    value2?: unknown;
  }>;
  orderBy?: { field: string; order: 'asc' | 'desc' };
  limit?: number;
  aggregations?: Array<{
    function: 'count' | 'sum' | 'avg' | 'min' | 'max';
    field?: string;
    alias: string;
  }>;
}

interface EntityField {
  slug: string;
  name: string;
  label?: string;
  type: string;
  relatedEntitySlug?: string;
  subEntitySlug?: string;
}

interface ExecuteOptions {
  runtimeFilters?: Array<{
    field: string;
    fieldType?: string;
    operator: string;
    value?: unknown;
    value2?: unknown;
  }>;
  page?: number;
  limit?: number;
}

@Injectable()
export class DataSourceService {
  private readonly logger = new Logger(DataSourceService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ==================== CRUD ====================

  async create(dto: CreateDataSourceDto, user: CurrentUser, tenantId?: string) {
    const effectiveTenantId = tenantId || user.tenantId;
    const existing = await this.prisma.dataSource.findUnique({
      where: { tenantId_slug: { tenantId: effectiveTenantId, slug: dto.slug } },
    });
    if (existing) {
      throw new ConflictException(`DataSource com slug "${dto.slug}" ja existe`);
    }

    return this.prisma.dataSource.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
        definition: (dto.definition as Prisma.InputJsonValue) || {},
        tenantId: effectiveTenantId,
        createdById: user.id,
      },
    });
  }

  async findAll(tenantId: string, search?: string) {
    const where: Prisma.DataSourceWhereInput = {
      tenantId,
      isActive: true,
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { description: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.dataSource.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.dataSource.count({ where }),
    ]);

    return { data, total };
  }

  async findOne(id: string, tenantId: string) {
    const ds = await this.prisma.dataSource.findFirst({
      where: { id, tenantId },
    });
    if (!ds) throw new NotFoundException('Fonte de dados nao encontrada');
    return ds;
  }

  async update(id: string, dto: UpdateDataSourceDto, user: CurrentUser, tenantId?: string) {
    const effectiveTenantId = tenantId || user.tenantId;
    await this.findOne(id, effectiveTenantId);

    if (dto.slug) {
      const existing = await this.prisma.dataSource.findFirst({
        where: { tenantId: effectiveTenantId, slug: dto.slug, id: { not: id } },
      });
      if (existing) {
        throw new ConflictException(`DataSource com slug "${dto.slug}" ja existe`);
      }
    }

    return this.prisma.dataSource.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.slug !== undefined && { slug: dto.slug }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.definition !== undefined && { definition: dto.definition as Prisma.InputJsonValue }),
      },
    });
  }

  async remove(id: string, tenantId: string) {
    await this.findOne(id, tenantId);
    return this.prisma.dataSource.delete({ where: { id } });
  }

  // ==================== EXECUTE ====================

  async execute(id: string, tenantId: string, options: ExecuteOptions = {}) {
    const ds = await this.findOne(id, tenantId);
    const definition = ds.definition as unknown as DataSourceDefinition;
    return this.executeDefinition(definition, tenantId, options);
  }

  async preview(definition: DataSourceDefinition, tenantId: string, options: ExecuteOptions = {}) {
    return this.executeDefinition(definition, tenantId, { ...options, limit: options.limit || 10 });
  }

  private async executeDefinition(
    definition: DataSourceDefinition,
    tenantId: string,
    options: ExecuteOptions = {},
  ) {
    const { sources = [], filters = [], orderBy, aggregations = [] } = definition;
    const { runtimeFilters = [], page = 1, limit: requestLimit } = options;
    const limit = requestLimit || definition.limit || 100;

    if (sources.length === 0) {
      return { columns: [], rows: [], aggregations: {}, meta: { total: 0, page: 1, limit } };
    }

    // 1. Load entities and their field definitions
    const entities = await Promise.all(
      sources.map(async (source) => {
        const entity = await this.prisma.entity.findFirst({
          where: { tenantId, slug: source.entitySlug },
        });
        if (!entity) {
          throw new NotFoundException(`Entidade "${source.entitySlug}" nao encontrada`);
        }
        return { entity, source };
      }),
    );

    // 2. Build entity field maps
    const entityFieldMap = new Map<string, EntityField[]>();
    for (const { entity } of entities) {
      entityFieldMap.set(entity.slug, (entity.fields as unknown as EntityField[]) || []);
    }

    // 3. Detect auto-joins between entities via relation/sub-entity fields
    const joinInfo = this.detectJoins(entities.map(e => ({
      slug: e.entity.slug,
      fields: entityFieldMap.get(e.entity.slug) || [],
    })));

    // 4. Query each entity's data
    const allFilters = [...filters, ...runtimeFilters];
    const entityDataMap = new Map<string, Array<Record<string, unknown>>>();

    for (const { entity, source } of entities) {
      const entityFields = entityFieldMap.get(entity.slug) || [];
      const where: Prisma.EntityDataWhereInput = {
        tenantId,
        entityId: entity.id,
        deletedAt: null,
      };

      // Apply filters for this entity
      const andArray: Prisma.EntityDataWhereInput[] = [];
      for (const filter of allFilters) {
        const [filterEntitySlug, filterFieldSlug] = filter.field.includes('.')
          ? filter.field.split('.')
          : [entity.slug, filter.field];

        if (filterEntitySlug !== entity.slug) continue;

        const fieldDef = entityFields.find(f => f.slug === filterFieldSlug);
        const fieldType = filter.fieldType || fieldDef?.type || 'text';
        const clause = buildFilterClause(filterFieldSlug, fieldType, filter.operator, filter.value, filter.value2);
        if (clause) andArray.push(clause);
      }

      if (andArray.length > 0) {
        where.AND = andArray;
      }

      const records = await this.prisma.entityData.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit * 2, // fetch extra for joins
      });

      const rows = records.map((r) => {
        const data = r.data as Record<string, unknown>;
        const row: Record<string, unknown> = {
          [`${entity.slug}.__id`]: r.id,
          [`${entity.slug}.__createdAt`]: r.createdAt,
        };

        // Project selected fields
        const selectedSlugs = source.fields.length > 0
          ? source.fields.map(f => f.slug)
          : entityFields.map(f => f.slug);

        for (const slug of selectedSlugs) {
          const alias = source.fields.find(f => f.slug === slug)?.alias;
          const key = alias || `${entity.slug}.${slug}`;
          row[key] = data[slug] ?? null;
        }

        // Also store raw id for joins
        row[`__raw_id_${entity.slug}`] = r.id;
        row[`__raw_parentRecordId_${entity.slug}`] = r.parentRecordId;

        // Store relation field values for joining
        for (const field of entityFields) {
          if (field.type === 'relation' && field.relatedEntitySlug) {
            row[`__rel_${entity.slug}_${field.slug}`] = data[field.slug] ?? null;
          }
        }

        return row;
      });

      entityDataMap.set(entity.slug, rows);
    }

    // 5. Join data if multiple entities
    let resultRows: Record<string, unknown>[];

    if (entities.length === 1) {
      resultRows = entityDataMap.get(entities[0].entity.slug) || [];
    } else {
      resultRows = this.joinData(entityDataMap, joinInfo, entities.map(e => e.entity.slug));
    }

    // 6. Apply ordering
    if (orderBy) {
      const { field: orderField, order } = orderBy;
      resultRows.sort((a, b) => {
        const valA = a[orderField] ?? '';
        const valB = b[orderField] ?? '';
        const cmp = String(valA).localeCompare(String(valB), undefined, { numeric: true });
        return order === 'desc' ? -cmp : cmp;
      });
    }

    // 7. Calculate total before pagination
    const total = resultRows.length;

    // 8. Paginate
    const offset = (page - 1) * limit;
    resultRows = resultRows.slice(offset, offset + limit);

    // 9. Clean internal fields from output
    resultRows = resultRows.map(row => {
      const clean: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(row)) {
        if (!key.startsWith('__raw_') && !key.startsWith('__rel_')) {
          clean[key] = val;
        }
      }
      return clean;
    });

    // 10. Build columns metadata
    const columns: Array<{ key: string; label: string; type: string; entitySlug: string }> = [];
    for (const { entity, source } of entities) {
      const entityFields = entityFieldMap.get(entity.slug) || [];
      const selectedSlugs = source.fields.length > 0
        ? source.fields.map(f => f.slug)
        : entityFields.map(f => f.slug);

      for (const slug of selectedSlugs) {
        const fieldDef = entityFields.find(f => f.slug === slug);
        const alias = source.fields.find(f => f.slug === slug)?.alias;
        columns.push({
          key: alias || `${entity.slug}.${slug}`,
          label: fieldDef?.label || fieldDef?.name || slug,
          type: fieldDef?.type || 'text',
          entitySlug: entity.slug,
        });
      }
    }

    // 11. Calculate aggregations
    const aggResult: Record<string, number> = {};
    for (const agg of aggregations) {
      const values = resultRows
        .map(r => agg.field ? r[agg.field] : null)
        .filter(v => v !== null && v !== undefined)
        .map(v => Number(v))
        .filter(v => !isNaN(v));

      switch (agg.function) {
        case 'count':
          aggResult[agg.alias] = total;
          break;
        case 'sum':
          aggResult[agg.alias] = values.reduce((a, b) => a + b, 0);
          break;
        case 'avg':
          aggResult[agg.alias] = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
          break;
        case 'min':
          aggResult[agg.alias] = values.length > 0 ? Math.min(...values) : 0;
          break;
        case 'max':
          aggResult[agg.alias] = values.length > 0 ? Math.max(...values) : 0;
          break;
      }
    }

    return {
      columns,
      rows: resultRows,
      aggregations: aggResult,
      meta: { total, page, limit },
    };
  }

  // ==================== AUTO-JOIN DETECTION ====================

  private detectJoins(
    entityInfos: Array<{ slug: string; fields: EntityField[] }>,
  ): Array<{ from: string; to: string; fromField: string; type: 'relation' | 'sub-entity' }> {
    const joins: Array<{ from: string; to: string; fromField: string; type: 'relation' | 'sub-entity' }> = [];
    const slugs = new Set(entityInfos.map(e => e.slug));

    for (const entityInfo of entityInfos) {
      for (const field of entityInfo.fields) {
        if (field.type === 'relation' && field.relatedEntitySlug && slugs.has(field.relatedEntitySlug)) {
          joins.push({
            from: entityInfo.slug,
            to: field.relatedEntitySlug,
            fromField: field.slug,
            type: 'relation',
          });
        }
        if (field.type === 'sub-entity' && field.subEntitySlug && slugs.has(field.subEntitySlug)) {
          joins.push({
            from: entityInfo.slug,
            to: field.subEntitySlug,
            fromField: field.slug,
            type: 'sub-entity',
          });
        }
      }
    }

    return joins;
  }

  /**
   * Retorna as entidades relacionadas a uma entidade principal.
   * Usado pelo frontend para mostrar quais entidades podem ser adicionadas.
   */
  async getRelatedEntities(entitySlug: string, tenantId: string) {
    const entity = await this.prisma.entity.findFirst({
      where: { tenantId, slug: entitySlug },
    });
    if (!entity) throw new NotFoundException(`Entidade "${entitySlug}" nao encontrada`);

    const fields = (entity.fields as unknown as EntityField[]) || [];
    const related: Array<{ entitySlug: string; fieldSlug: string; fieldLabel: string; type: string }> = [];

    for (const field of fields) {
      if (field.type === 'relation' && field.relatedEntitySlug) {
        related.push({
          entitySlug: field.relatedEntitySlug,
          fieldSlug: field.slug,
          fieldLabel: field.label || field.name || field.slug,
          type: 'relation',
        });
      }
      if (field.type === 'sub-entity' && field.subEntitySlug) {
        related.push({
          entitySlug: field.subEntitySlug,
          fieldSlug: field.slug,
          fieldLabel: field.label || field.name || field.slug,
          type: 'sub-entity',
        });
      }
    }

    // Also check reverse: entities that have a relation TO this entity
    const allEntities = await this.prisma.entity.findMany({
      where: { tenantId, slug: { not: entitySlug } },
      select: { slug: true, fields: true },
    });

    for (const other of allEntities) {
      const otherFields = (other.fields as unknown as EntityField[]) || [];
      for (const field of otherFields) {
        if (field.type === 'relation' && field.relatedEntitySlug === entitySlug) {
          related.push({
            entitySlug: other.slug,
            fieldSlug: field.slug,
            fieldLabel: field.label || field.name || field.slug,
            type: 'reverse-relation',
          });
        }
        if (field.type === 'sub-entity' && field.subEntitySlug === entitySlug) {
          related.push({
            entitySlug: other.slug,
            fieldSlug: field.slug,
            fieldLabel: field.label || field.name || field.slug,
            type: 'reverse-sub-entity',
          });
        }
      }
    }

    return related;
  }

  // ==================== IN-MEMORY JOIN ====================

  private joinData(
    entityDataMap: Map<string, Array<Record<string, unknown>>>,
    joins: Array<{ from: string; to: string; fromField: string; type: 'relation' | 'sub-entity' }>,
    entitySlugs: string[],
  ): Record<string, unknown>[] {
    if (entitySlugs.length < 2 || joins.length === 0) {
      // No join possible - return first entity's data
      return entityDataMap.get(entitySlugs[0]) || [];
    }

    const primarySlug = entitySlugs[0];
    let result = entityDataMap.get(primarySlug) || [];

    for (const join of joins) {
      const targetRows = entityDataMap.get(join.to) || entityDataMap.get(join.from) || [];
      if (targetRows.length === 0) continue;

      if (join.type === 'relation') {
        // relation: from entity has a field pointing to target entity's record ID
        if (join.from === primarySlug) {
          // Hash the target rows by their raw ID
          const targetIndex = new Map<string, Record<string, unknown>>();
          for (const row of targetRows) {
            const id = row[`__raw_id_${join.to}`] as string;
            if (id) targetIndex.set(id, row);
          }

          result = result.map(row => {
            const refId = row[`__rel_${join.from}_${join.fromField}`] as string;
            const matched = refId ? targetIndex.get(refId) : null;
            return matched ? { ...row, ...matched } : row;
          });
        } else {
          // Reverse relation: target entity points to primary entity
          const sourceRows = entityDataMap.get(join.from) || [];
          const sourceIndex = new Map<string, Record<string, unknown>>();
          for (const row of sourceRows) {
            const refId = row[`__rel_${join.from}_${join.fromField}`] as string;
            if (refId) sourceIndex.set(refId, row);
          }

          result = result.map(row => {
            const id = row[`__raw_id_${primarySlug}`] as string;
            const matched = id ? sourceIndex.get(id) : null;
            return matched ? { ...row, ...matched } : row;
          });
        }
      } else if (join.type === 'sub-entity') {
        // sub-entity: child records have parentRecordId pointing to parent
        const childSlug = join.to;
        const childRows = entityDataMap.get(childSlug) || [];

        // Group children by parentRecordId
        const childrenByParent = new Map<string, Record<string, unknown>[]>();
        for (const row of childRows) {
          const parentId = row[`__raw_parentRecordId_${childSlug}`] as string;
          if (parentId) {
            if (!childrenByParent.has(parentId)) childrenByParent.set(parentId, []);
            childrenByParent.get(parentId)!.push(row);
          }
        }

        // Expand: one row per parent-child combination
        const expanded: Record<string, unknown>[] = [];
        for (const row of result) {
          const parentId = row[`__raw_id_${primarySlug}`] as string;
          const children = parentId ? childrenByParent.get(parentId) : null;
          if (children && children.length > 0) {
            for (const child of children) {
              expanded.push({ ...row, ...child });
            }
          } else {
            expanded.push(row);
          }
        }
        result = expanded;
      }
    }

    return result;
  }
}
