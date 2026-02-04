import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CurrentUser,
  PaginationQuery,
  parsePaginationParams,
  createPaginationMeta,
} from '../../common/types';
import { Prisma } from '@prisma/client';

export type QueryEntityDto = PaginationQuery;

export interface FieldDefinition {
  slug: string;
  name: string;
  type: string;
  required?: boolean;
  default?: string | number | boolean | null;
  options?: { value: string; label: string; color?: string }[];
  validations?: Record<string, unknown>;
  relation?: {
    entity: string;
    displayField: string;
  };
}

export interface CreateEntityDto {
  name: string;
  namePlural?: string;
  slug: string;
  description?: string;
  icon?: string;
  color?: string;
  fields?: FieldDefinition[];
  settings?: Record<string, unknown>;
  isSystem?: boolean;
}

export interface UpdateEntityDto {
  name?: string;
  namePlural?: string;
  description?: string;
  icon?: string;
  color?: string;
  fields?: FieldDefinition[];
  settings?: Record<string, unknown>;
}

@Injectable()
export class EntityService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateEntityDto, currentUser: CurrentUser) {
    // Verificar se slug ja existe no tenant
    const existing = await this.prisma.entity.findFirst({
      where: {
        tenantId: currentUser.tenantId,
        slug: dto.slug,
      },
    });

    if (existing) {
      throw new ConflictException('Entidade com este slug ja existe');
    }

    // Gerar namePlural se nao fornecido
    const namePlural = dto.namePlural || `${dto.name}s`;

    return this.prisma.entity.create({
      data: {
        name: dto.name,
        namePlural,
        slug: dto.slug,
        description: dto.description,
        icon: dto.icon,
        color: dto.color,
        tenantId: currentUser.tenantId,
        fields: (dto.fields || []) as unknown as Prisma.InputJsonValue,
        settings: (dto.settings || {}) as Prisma.InputJsonValue,
        isSystem: dto.isSystem || false,
      },
    });
  }

  async findAll(currentUser: CurrentUser, query: QueryEntityDto = {}) {
    const { page, limit, skip } = parsePaginationParams(query);
    const { search, sortBy = 'name', sortOrder = 'asc' } = query;

    const where: Prisma.EntityWhereInput = {
      tenantId: currentUser.tenantId,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.entity.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          _count: {
            select: { data: true },
          },
        },
      }),
      this.prisma.entity.count({ where }),
    ]);

    return {
      data,
      meta: createPaginationMeta(total, page, limit),
    };
  }

  async findBySlug(slug: string, currentUser: CurrentUser) {
    const entity = await this.prisma.entity.findFirst({
      where: {
        slug,
        tenantId: currentUser.tenantId,
      },
    });

    if (!entity) {
      throw new NotFoundException(`Entidade "${slug}" nao encontrada`);
    }

    return entity;
  }

  async findOne(id: string, currentUser: CurrentUser) {
    const entity = await this.prisma.entity.findFirst({
      where: {
        id,
        tenantId: currentUser.tenantId,
      },
    });

    if (!entity) {
      throw new NotFoundException('Entidade nao encontrada');
    }

    return entity;
  }

  async update(id: string, dto: UpdateEntityDto, currentUser: CurrentUser) {
    await this.findOne(id, currentUser);

    const updateData: Prisma.EntityUpdateInput = {
      name: dto.name,
      namePlural: dto.namePlural,
      description: dto.description,
      icon: dto.icon,
      color: dto.color,
    };

    if (dto.fields !== undefined) {
      updateData.fields = dto.fields as unknown as Prisma.InputJsonValue;
    }
    if (dto.settings !== undefined) {
      updateData.settings = dto.settings as Prisma.InputJsonValue;
    }

    return this.prisma.entity.update({
      where: { id },
      data: updateData,
    });
  }

  async remove(id: string, currentUser: CurrentUser) {
    await this.findOne(id, currentUser);

    // Isso tambem deleta todos os dados da entidade (cascade)
    await this.prisma.entity.delete({ where: { id } });

    return { message: 'Entidade excluida com sucesso' };
  }

  // Validar dados baseado na definicao dos campos
  validateData(fields: FieldDefinition[], data: Record<string, any>): string[] {
    const errors: string[] = [];

    for (const field of fields) {
      const value = data[field.slug];

      // Verificar campos obrigatorios
      if (field.required && (value === undefined || value === null || value === '')) {
        errors.push(`Campo "${field.name}" e obrigatorio`);
        continue;
      }

      // Pular validacao se campo vazio e nao obrigatorio
      if (value === undefined || value === null || value === '') {
        continue;
      }

      // Validacoes por tipo
      switch (field.type) {
        case 'email':
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            errors.push(`"${field.name}" deve ser um email valido`);
          }
          break;

        case 'number':
        case 'decimal':
        case 'currency':
          if (isNaN(Number(value))) {
            errors.push(`"${field.name}" deve ser um numero`);
          }
          break;

        case 'url':
          try {
            new URL(value);
          } catch {
            errors.push(`"${field.name}" deve ser uma URL valida`);
          }
          break;

        case 'select':
          if (field.options) {
            const validValues = field.options.map((o) => o.value);
            if (!validValues.includes(value)) {
              errors.push(`"${field.name}" deve ser um dos valores: ${validValues.join(', ')}`);
            }
          }
          break;

        case 'multiselect':
          if (field.options && Array.isArray(value)) {
            const validValues = field.options.map((o) => o.value);
            for (const v of value) {
              if (!validValues.includes(v)) {
                errors.push(`"${field.name}" contem valor invalido: ${v}`);
              }
            }
          }
          break;
      }
    }

    return errors;
  }
}
