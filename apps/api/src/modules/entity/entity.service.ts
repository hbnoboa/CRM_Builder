import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface FieldDefinition {
  slug: string;
  name: string;
  type: string;
  required?: boolean;
  default?: any;
  options?: { value: string; label: string; color?: string }[];
  validations?: Record<string, any>;
  relation?: {
    entity: string;
    displayField: string;
  };
}

@Injectable()
export class EntityService {
  constructor(private prisma: PrismaService) {}

  async create(dto: any, currentUser: any) {
    // Verificar se slug já existe no workspace
    const existing = await this.prisma.entity.findFirst({
      where: {
        workspaceId: dto.workspaceId,
        slug: dto.slug,
      },
    });

    if (existing) {
      throw new ConflictException('Entidade com este slug já existe');
    }

    // Gerar namePlural se não fornecido
    const namePlural = dto.namePlural || `${dto.name}s`;

    return this.prisma.entity.create({
      data: {
        name: dto.name,
        namePlural,
        slug: dto.slug,
        description: dto.description,
        icon: dto.icon,
        color: dto.color,
        workspaceId: dto.workspaceId,
        tenantId: currentUser.tenantId,
        fields: dto.fields || [],
        settings: dto.settings || {},
        isSystem: dto.isSystem || false,
      },
    });
  }

  async findAll(workspaceId: string, currentUser: any) {
    return this.prisma.entity.findMany({
      where: {
        workspaceId,
        tenantId: currentUser.tenantId,
      },
      include: {
        _count: {
          select: { data: true },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findBySlug(workspaceId: string, slug: string, currentUser: any) {
    const entity = await this.prisma.entity.findFirst({
      where: {
        workspaceId,
        slug,
        tenantId: currentUser.tenantId,
      },
    });

    if (!entity) {
      throw new NotFoundException(`Entidade "${slug}" não encontrada`);
    }

    return entity;
  }

  async findOne(id: string, currentUser: any) {
    const entity = await this.prisma.entity.findFirst({
      where: {
        id,
        tenantId: currentUser.tenantId,
      },
    });

    if (!entity) {
      throw new NotFoundException('Entidade não encontrada');
    }

    return entity;
  }

  async update(id: string, dto: any, currentUser: any) {
    await this.findOne(id, currentUser);

    return this.prisma.entity.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string, currentUser: any) {
    await this.findOne(id, currentUser);

    // Isso também deleta todos os dados da entidade (cascade)
    await this.prisma.entity.delete({ where: { id } });

    return { message: 'Entidade excluída com sucesso' };
  }

  // Validar dados baseado na definição dos campos
  validateData(fields: FieldDefinition[], data: Record<string, any>): string[] {
    const errors: string[] = [];

    for (const field of fields) {
      const value = data[field.slug];

      // Verificar campos obrigatórios
      if (field.required && (value === undefined || value === null || value === '')) {
        errors.push(`Campo "${field.name}" é obrigatório`);
        continue;
      }

      // Pular validação se campo vazio e não obrigatório
      if (value === undefined || value === null || value === '') {
        continue;
      }

      // Validações por tipo
      switch (field.type) {
        case 'email':
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            errors.push(`"${field.name}" deve ser um email válido`);
          }
          break;

        case 'number':
        case 'decimal':
        case 'currency':
          if (isNaN(Number(value))) {
            errors.push(`"${field.name}" deve ser um número`);
          }
          break;

        case 'url':
          try {
            new URL(value);
          } catch {
            errors.push(`"${field.name}" deve ser uma URL válida`);
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
                errors.push(`"${field.name}" contém valor inválido: ${v}`);
              }
            }
          }
          break;
      }
    }

    return errors;
  }
}
