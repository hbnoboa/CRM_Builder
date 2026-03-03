import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { CreateFieldRuleDto } from './dto/create-field-rule.dto';
import { UpdateFieldRuleDto } from './dto/update-field-rule.dto';

@Injectable()
export class EntityFieldRuleService {
  private readonly logger = new Logger(EntityFieldRuleService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Valida que a entidade pertence ao tenant
   */
  private async validateEntityOwnership(
    tenantId: string,
    entityId: string,
  ): Promise<void> {
    const entity = await this.prisma.entity.findFirst({
      where: { id: entityId, tenantId },
    });

    if (!entity) {
      throw new NotFoundException('Entidade nao encontrada');
    }
  }

  /**
   * Lista todas as regras de campo de uma entidade
   */
  async findAll(tenantId: string, entityId: string) {
    await this.validateEntityOwnership(tenantId, entityId);

    return this.prisma.entityFieldRule.findMany({
      where: {
        tenantId,
        entityId,
      },
      orderBy: [{ fieldSlug: 'asc' }, { priority: 'asc' }],
    });
  }

  /**
   * Lista regras de um campo especifico
   */
  async findByField(tenantId: string, entityId: string, fieldSlug: string) {
    await this.validateEntityOwnership(tenantId, entityId);

    return this.prisma.entityFieldRule.findMany({
      where: {
        tenantId,
        entityId,
        fieldSlug,
      },
      orderBy: { priority: 'asc' },
    });
  }

  /**
   * Busca uma regra por ID
   */
  async findOne(tenantId: string, entityId: string, id: string) {
    await this.validateEntityOwnership(tenantId, entityId);

    const rule = await this.prisma.entityFieldRule.findFirst({
      where: {
        id,
        tenantId,
        entityId,
      },
    });

    if (!rule) {
      throw new NotFoundException('Regra de campo nao encontrada');
    }

    return rule;
  }

  /**
   * Cria uma nova regra de campo
   */
  async create(tenantId: string, entityId: string, dto: CreateFieldRuleDto) {
    await this.validateEntityOwnership(tenantId, entityId);

    return this.prisma.entityFieldRule.create({
      data: {
        tenantId,
        entityId,
        fieldSlug: dto.fieldSlug,
        ruleType: dto.ruleType,
        condition: dto.condition as Prisma.InputJsonValue,
        config: dto.config as Prisma.InputJsonValue,
        priority: dto.priority ?? 0,
        isActive: dto.isActive ?? true,
      },
    });
  }

  /**
   * Atualiza uma regra de campo existente
   */
  async update(
    tenantId: string,
    entityId: string,
    id: string,
    dto: UpdateFieldRuleDto,
  ) {
    await this.findOne(tenantId, entityId, id);

    const updateData: Prisma.EntityFieldRuleUpdateInput = {};

    if (dto.fieldSlug !== undefined) updateData.fieldSlug = dto.fieldSlug;
    if (dto.ruleType !== undefined) updateData.ruleType = dto.ruleType;
    if (dto.condition !== undefined)
      updateData.condition = dto.condition as Prisma.InputJsonValue;
    if (dto.config !== undefined)
      updateData.config = dto.config as Prisma.InputJsonValue;
    if (dto.priority !== undefined) updateData.priority = dto.priority;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

    return this.prisma.entityFieldRule.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Remove uma regra de campo
   */
  async remove(tenantId: string, entityId: string, id: string) {
    await this.findOne(tenantId, entityId, id);

    return this.prisma.entityFieldRule.delete({
      where: { id },
    });
  }
}
