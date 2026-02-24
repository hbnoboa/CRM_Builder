import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { CopyTenantDataDto } from './dto/copy-tenant-data.dto';

export interface CopyResult {
  copied: {
    roles: number;
    entities: number;
    entityData: number;
    endpoints: number;
    pdfTemplates: number;
    pages: number;
  };
  skipped: string[];
  warnings: string[];
}

@Injectable()
export class TenantCopyService {
  private readonly logger = new Logger(TenantCopyService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns all copyable data from a tenant (preview).
   */
  async getCopyableData(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant nao encontrado');
    }

    const [roles, entities, pages, endpoints, pdfTemplates] = await Promise.all([
      this.prisma.customRole.findMany({
        where: { tenantId },
        select: {
          id: true,
          name: true,
          roleType: true,
          color: true,
          isSystem: true,
          _count: { select: { users: true } },
        },
        orderBy: { name: 'asc' },
      }),
      this.prisma.entity.findMany({
        where: { tenantId },
        select: {
          id: true,
          name: true,
          slug: true,
          icon: true,
          color: true,
          _count: { select: { data: { where: { deletedAt: null } } } },
        },
        orderBy: { name: 'asc' },
      }),
      this.prisma.page.findMany({
        where: { tenantId },
        select: {
          id: true,
          title: true,
          slug: true,
          isPublished: true,
        },
        orderBy: { title: 'asc' },
      }),
      this.prisma.customEndpoint.findMany({
        where: { tenantId },
        select: {
          id: true,
          name: true,
          path: true,
          method: true,
          isActive: true,
        },
        orderBy: { name: 'asc' },
      }),
      this.prisma.pdfTemplate.findMany({
        where: { tenantId },
        select: {
          id: true,
          name: true,
          slug: true,
          templateType: true,
          isPublished: true,
        },
        orderBy: { name: 'asc' },
      }),
    ]);

    return { roles, entities, pages, endpoints, pdfTemplates };
  }

  /**
   * Executes the copy operation inside a Prisma transaction.
   */
  async executeCopy(dto: CopyTenantDataDto): Promise<CopyResult> {
    const { sourceTenantId, targetTenantId, conflictStrategy = 'skip', modules } = dto;

    if (sourceTenantId === targetTenantId) {
      throw new BadRequestException('Tenant de origem e destino devem ser diferentes');
    }

    // Validate both tenants exist
    const [source, target] = await Promise.all([
      this.prisma.tenant.findUnique({ where: { id: sourceTenantId }, select: { id: true, name: true } }),
      this.prisma.tenant.findUnique({ where: { id: targetTenantId }, select: { id: true, name: true } }),
    ]);

    if (!source) throw new NotFoundException('Tenant de origem nao encontrado');
    if (!target) throw new NotFoundException('Tenant de destino nao encontrado');

    const hasAnything =
      modules.roles?.length ||
      modules.entities?.length ||
      modules.pages?.length ||
      modules.endpoints?.length ||
      modules.pdfTemplates?.length;

    if (!hasAnything) {
      throw new BadRequestException('Nenhum item selecionado para copiar');
    }

    this.logger.log(
      `Iniciando copia: ${source.name} → ${target.name} (strategy: ${conflictStrategy})`,
    );

    // Execute in a single transaction with 2-minute timeout for large datasets
    const result = await this.prisma.$transaction(
      async (tx) => {
        const roleIdMap = new Map<string, string>();
        const entityIdMap = new Map<string, string>();
        const entityDataIdMap = new Map<string, string>();
        const skipped: string[] = [];
        const warnings: string[] = [];
        const copied = { roles: 0, entities: 0, entityData: 0, endpoints: 0, pdfTemplates: 0, pages: 0 };

        // ═══════════════════════════════════════
        // 1. COPY ROLES
        // ═══════════════════════════════════════
        if (modules.roles?.length) {
          const sourceRoles = await tx.customRole.findMany({
            where: { id: { in: modules.roles }, tenantId: sourceTenantId },
          });

          const existingRoles = await tx.customRole.findMany({
            where: { tenantId: targetTenantId },
            select: { id: true, name: true },
          });
          const existingNames = new Set(existingRoles.map((r) => r.name));

          for (const role of sourceRoles) {
            let name = role.name;

            if (existingNames.has(name)) {
              if (conflictStrategy === 'skip') {
                skipped.push(`Role: ${name}`);
                // Map to existing role with same name for EntityData _visibleToRoles remapping
                const existing = existingRoles.find((r) => r.name === name);
                if (existing) roleIdMap.set(role.id, existing.id);
                continue;
              }
              name = `${name} (copia)`;
              // If suffix also exists, keep adding numbers
              let suffix = 2;
              while (existingNames.has(name)) {
                name = `${role.name} (copia ${suffix})`;
                suffix++;
              }
            }

            const newRole = await tx.customRole.create({
              data: {
                tenantId: targetTenantId,
                name,
                description: role.description,
                color: role.color,
                roleType: role.roleType,
                isSystem: false, // Copied roles are never system roles
                isDefault: false,
                permissions: role.permissions as Prisma.InputJsonValue,
                modulePermissions: role.modulePermissions as Prisma.InputJsonValue,
                tenantPermissions: role.tenantPermissions as Prisma.InputJsonValue,
              },
            });

            roleIdMap.set(role.id, newRole.id);
            existingNames.add(name);
            copied.roles++;
          }
        }

        // ═══════════════════════════════════════
        // 2. COPY ENTITIES (structure only first)
        // ═══════════════════════════════════════
        const entitySelections = modules.entities || [];
        if (entitySelections.length) {
          const entityIds = entitySelections.map((e) => e.id);
          const sourceEntities = await tx.entity.findMany({
            where: { id: { in: entityIds }, tenantId: sourceTenantId },
          });

          const existingEntities = await tx.entity.findMany({
            where: { tenantId: targetTenantId },
            select: { id: true, slug: true },
          });
          const existingSlugs = new Set(existingEntities.map((e) => e.slug));

          for (const entity of sourceEntities) {
            let slug = entity.slug;
            let name = entity.name;
            let namePlural = entity.namePlural;

            if (existingSlugs.has(slug)) {
              if (conflictStrategy === 'skip') {
                skipped.push(`Entidade: ${name} (${slug})`);
                continue;
              }
              slug = `${slug}-copy`;
              name = `${name} (copia)`;
              namePlural = `${namePlural} (copia)`;
              let suffix = 2;
              while (existingSlugs.has(slug)) {
                slug = `${entity.slug}-copy-${suffix}`;
                name = `${entity.name} (copia ${suffix})`;
                namePlural = `${entity.namePlural} (copia ${suffix})`;
                suffix++;
              }
            }

            const newEntity = await tx.entity.create({
              data: {
                tenantId: targetTenantId,
                name,
                namePlural,
                slug,
                description: entity.description,
                icon: entity.icon,
                color: entity.color,
                fields: entity.fields as Prisma.InputJsonValue,
                settings: entity.settings as Prisma.InputJsonValue,
                isSystem: false,
              },
            });

            entityIdMap.set(entity.id, newEntity.id);
            existingSlugs.add(slug);
            copied.entities++;
          }
        }

        // ═══════════════════════════════════════
        // 3. COPY ENTITY DATA
        // ═══════════════════════════════════════
        for (const selection of entitySelections) {
          if (!selection.includeData) continue;

          const newEntityId = entityIdMap.get(selection.id);
          if (!newEntityId) {
            warnings.push(`Dados de entidade ${selection.id} pulados - entidade nao foi copiada`);
            continue;
          }

          // First pass: copy top-level records (no parentRecordId)
          const topLevelRecords = await tx.entityData.findMany({
            where: {
              entityId: selection.id,
              tenantId: sourceTenantId,
              deletedAt: null,
              parentRecordId: null,
            },
          });

          for (const record of topLevelRecords) {
            const visibleToRoles = this.remapRoleIds(
              record.visibleToRoles,
              roleIdMap,
            );

            const newRecord = await tx.entityData.create({
              data: {
                tenantId: targetTenantId,
                entityId: newEntityId,
                data: record.data as Prisma.InputJsonValue,
                parentRecordId: null,
                createdById: null,
                updatedById: null,
                visibleToRoles,
                hasRoleFilter: record.hasRoleFilter,
                visibleToRolesJson: visibleToRoles.length > 0
                  ? (visibleToRoles as unknown as Prisma.InputJsonValue)
                  : ([] as unknown as Prisma.InputJsonValue),
              },
            });

            entityDataIdMap.set(record.id, newRecord.id);
            copied.entityData++;
          }

          // Second pass: copy sub-records (with parentRecordId)
          const subRecords = await tx.entityData.findMany({
            where: {
              entityId: selection.id,
              tenantId: sourceTenantId,
              deletedAt: null,
              parentRecordId: { not: null },
            },
          });

          for (const record of subRecords) {
            const newParentId = entityDataIdMap.get(record.parentRecordId!);
            if (!newParentId) {
              warnings.push(
                `Sub-registro ${record.id} pulado - registro pai nao encontrado no mapa`,
              );
              continue;
            }

            const visibleToRoles = this.remapRoleIds(
              record.visibleToRoles,
              roleIdMap,
            );

            const newRecord = await tx.entityData.create({
              data: {
                tenantId: targetTenantId,
                entityId: newEntityId,
                data: record.data as Prisma.InputJsonValue,
                parentRecordId: newParentId,
                createdById: null,
                updatedById: null,
                visibleToRoles,
                hasRoleFilter: record.hasRoleFilter,
                visibleToRolesJson: visibleToRoles.length > 0
                  ? (visibleToRoles as unknown as Prisma.InputJsonValue)
                  : ([] as unknown as Prisma.InputJsonValue),
              },
            });

            entityDataIdMap.set(record.id, newRecord.id);
            copied.entityData++;
          }
        }

        // ═══════════════════════════════════════
        // 3.5. REMAP RELATION FIELD VALUES IN DATA JSON
        // ═══════════════════════════════════════
        if (entityDataIdMap.size > 0) {
          await this.remapRelationFields(tx, entitySelections, entityIdMap, entityDataIdMap, sourceTenantId, targetTenantId);
        }

        // ═══════════════════════════════════════
        // 4. COPY CUSTOM ENDPOINTS
        // ═══════════════════════════════════════
        if (modules.endpoints?.length) {
          const sourceEndpoints = await tx.customEndpoint.findMany({
            where: { id: { in: modules.endpoints }, tenantId: sourceTenantId },
          });

          const existingEndpoints = await tx.customEndpoint.findMany({
            where: { tenantId: targetTenantId },
            select: { id: true, path: true, method: true },
          });
          const existingPaths = new Set(
            existingEndpoints.map((e) => `${e.method}:${e.path}`),
          );

          for (const endpoint of sourceEndpoints) {
            let path = endpoint.path;
            let name = endpoint.name;
            const key = `${endpoint.method}:${path}`;

            if (existingPaths.has(key)) {
              if (conflictStrategy === 'skip') {
                skipped.push(`API: ${endpoint.method} ${path}`);
                continue;
              }
              path = `${path}-copy`;
              name = `${name} (copia)`;
              let suffix = 2;
              while (existingPaths.has(`${endpoint.method}:${path}`)) {
                path = `${endpoint.path}-copy-${suffix}`;
                name = `${endpoint.name} (copia ${suffix})`;
                suffix++;
              }
            }

            // Remap sourceEntityId
            let sourceEntityId = endpoint.sourceEntityId;
            if (sourceEntityId) {
              const mapped = entityIdMap.get(sourceEntityId);
              if (mapped) {
                sourceEntityId = mapped;
              } else {
                warnings.push(
                  `API "${endpoint.name}": entidade fonte nao foi copiada, sourceEntityId removido`,
                );
                sourceEntityId = null;
              }
            }

            await tx.customEndpoint.create({
              data: {
                tenantId: targetTenantId,
                name,
                description: endpoint.description,
                path,
                method: endpoint.method,
                mode: endpoint.mode,
                requestSchema: endpoint.requestSchema as Prisma.InputJsonValue,
                responseSchema: endpoint.responseSchema as Prisma.InputJsonValue,
                sourceEntityId,
                selectedFields: endpoint.selectedFields as Prisma.InputJsonValue,
                filters: endpoint.filters as Prisma.InputJsonValue,
                queryParams: endpoint.queryParams as Prisma.InputJsonValue,
                orderBy: endpoint.orderBy as Prisma.InputJsonValue,
                limitRecords: endpoint.limitRecords,
                responseType: endpoint.responseType,
                computedValues: endpoint.computedValues as Prisma.InputJsonValue,
                logic: endpoint.logic as Prisma.InputJsonValue,
                auth: endpoint.auth,
                permissions: endpoint.permissions as Prisma.InputJsonValue,
                rateLimit: endpoint.rateLimit,
                isActive: endpoint.isActive,
              },
            });

            existingPaths.add(`${endpoint.method}:${path}`);
            copied.endpoints++;
          }
        }

        // ═══════════════════════════════════════
        // 5. COPY PDF TEMPLATES
        // ═══════════════════════════════════════
        if (modules.pdfTemplates?.length) {
          const sourceTemplates = await tx.pdfTemplate.findMany({
            where: { id: { in: modules.pdfTemplates }, tenantId: sourceTenantId },
          });

          const existingTemplates = await tx.pdfTemplate.findMany({
            where: { tenantId: targetTenantId },
            select: { id: true, slug: true },
          });
          const existingSlugs = new Set(existingTemplates.map((t) => t.slug));

          for (const template of sourceTemplates) {
            let slug = template.slug;
            let name = template.name;

            if (existingSlugs.has(slug)) {
              if (conflictStrategy === 'skip') {
                skipped.push(`Template PDF: ${name} (${slug})`);
                continue;
              }
              slug = `${slug}-copy`;
              name = `${name} (copia)`;
              let suffix = 2;
              while (existingSlugs.has(slug)) {
                slug = `${template.slug}-copy-${suffix}`;
                name = `${template.name} (copia ${suffix})`;
                suffix++;
              }
            }

            let sourceEntityId = template.sourceEntityId;
            if (sourceEntityId) {
              const mapped = entityIdMap.get(sourceEntityId);
              if (mapped) {
                sourceEntityId = mapped;
              } else {
                warnings.push(
                  `Template PDF "${template.name}": entidade fonte nao foi copiada, sourceEntityId removido`,
                );
                sourceEntityId = null;
              }
            }

            await tx.pdfTemplate.create({
              data: {
                tenantId: targetTenantId,
                name,
                slug,
                description: template.description,
                icon: template.icon,
                pageSize: template.pageSize,
                orientation: template.orientation,
                margins: template.margins as Prisma.InputJsonValue,
                content: template.content as Prisma.InputJsonValue,
                sourceEntityId,
                selectedFields: template.selectedFields as Prisma.InputJsonValue,
                logoUrl: template.logoUrl,
                templateType: template.templateType,
                isPublished: false, // Always unpublished on copy
                version: 1,
              },
            });

            existingSlugs.add(slug);
            copied.pdfTemplates++;
          }
        }

        // ═══════════════════════════════════════
        // 6. COPY PAGES
        // ═══════════════════════════════════════
        if (modules.pages?.length) {
          const sourcePages = await tx.page.findMany({
            where: { id: { in: modules.pages }, tenantId: sourceTenantId },
          });

          const existingPages = await tx.page.findMany({
            where: { tenantId: targetTenantId },
            select: { id: true, slug: true },
          });
          const existingSlugs = new Set(existingPages.map((p) => p.slug));

          for (const page of sourcePages) {
            let slug = page.slug;
            let title = page.title;

            if (existingSlugs.has(slug)) {
              if (conflictStrategy === 'skip') {
                skipped.push(`Pagina: ${title} (${slug})`);
                continue;
              }
              slug = `${slug}-copy`;
              title = `${title} (copia)`;
              let suffix = 2;
              while (existingSlugs.has(slug)) {
                slug = `${page.slug}-copy-${suffix}`;
                title = `${page.title} (copia ${suffix})`;
                suffix++;
              }
            }

            await tx.page.create({
              data: {
                tenantId: targetTenantId,
                title,
                slug,
                description: page.description,
                icon: page.icon,
                content: page.content as Prisma.InputJsonValue,
                isPublished: false, // Always unpublished on copy
                permissions: page.permissions as Prisma.InputJsonValue,
              },
            });

            existingSlugs.add(slug);
            copied.pages++;
          }
        }

        return { copied, skipped, warnings };
      },
      { timeout: 120000 }, // 2 minutes for large datasets
    );

    this.logger.log(
      `Copia concluida: ${JSON.stringify(result.copied)} | skipped: ${result.skipped.length} | warnings: ${result.warnings.length}`,
    );

    return result;
  }

  /**
   * Remaps old role IDs to new ones using the roleIdMap.
   */
  private remapRoleIds(
    visibleToRoles: string[],
    roleIdMap: Map<string, string>,
  ): string[] {
    if (!visibleToRoles || visibleToRoles.length === 0) return [];
    return visibleToRoles
      .map((oldId) => roleIdMap.get(oldId) || oldId)
      .filter(Boolean);
  }

  /**
   * Remaps relation field values in EntityData.data JSON.
   * If an entity has a field of type "relation", the value is an ID
   * from the source tenant that needs to be remapped.
   */
  private async remapRelationFields(
    tx: Prisma.TransactionClient,
    entitySelections: { id: string; includeData?: boolean }[],
    entityIdMap: Map<string, string>,
    entityDataIdMap: Map<string, string>,
    sourceTenantId: string,
    targetTenantId: string,
  ) {
    // Only process entities that had data copied
    const entitiesWithData = entitySelections.filter((e) => e.includeData);
    if (entitiesWithData.length === 0) return;

    // Get source entities to check for relation fields
    const sourceEntities = await tx.entity.findMany({
      where: {
        id: { in: entitiesWithData.map((e) => e.id) },
        tenantId: sourceTenantId,
      },
      select: { id: true, fields: true },
    });

    for (const sourceEntity of sourceEntities) {
      const fields = sourceEntity.fields as Array<{
        slug: string;
        type: string;
        relation?: { entity: string; displayField?: string };
      }>;

      if (!Array.isArray(fields)) continue;

      const relationFields = fields.filter(
        (f) => f.type === 'relation' && f.relation?.entity,
      );

      if (relationFields.length === 0) continue;

      const newEntityId = entityIdMap.get(sourceEntity.id);
      if (!newEntityId) continue;

      // Get all copied records for this entity
      const records = await tx.entityData.findMany({
        where: { entityId: newEntityId, tenantId: targetTenantId },
        select: { id: true, data: true },
      });

      for (const record of records) {
        const data = record.data as Record<string, unknown>;
        let needsUpdate = false;

        for (const field of relationFields) {
          const oldValue = data[field.slug];
          if (typeof oldValue === 'string' && entityDataIdMap.has(oldValue)) {
            data[field.slug] = entityDataIdMap.get(oldValue)!;
            needsUpdate = true;
          }
          // Handle array of relation IDs (multi-select relations)
          if (Array.isArray(oldValue)) {
            const newArr = oldValue.map((v) =>
              typeof v === 'string' && entityDataIdMap.has(v)
                ? entityDataIdMap.get(v)!
                : v,
            );
            if (JSON.stringify(newArr) !== JSON.stringify(oldValue)) {
              data[field.slug] = newArr;
              needsUpdate = true;
            }
          }
        }

        if (needsUpdate) {
          await tx.entityData.update({
            where: { id: record.id },
            data: { data: data as Prisma.InputJsonValue },
          });
        }
      }
    }
  }
}
