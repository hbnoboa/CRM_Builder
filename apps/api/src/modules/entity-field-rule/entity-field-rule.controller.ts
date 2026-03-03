import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { EntityFieldRuleService } from './entity-field-rule.service';
import { CreateFieldRuleDto } from './dto/create-field-rule.dto';
import { UpdateFieldRuleDto } from './dto/update-field-rule.dto';

interface AuthUser {
  id: string;
  tenantId: string;
  email: string;
  name: string;
}

@ApiTags('Entity Field Rules')
@ApiBearerAuth()
@Controller('entities/:entityId/field-rules')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EntityFieldRuleController {
  constructor(
    private readonly entityFieldRuleService: EntityFieldRuleService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Lista regras de campo de uma entidade' })
  async findAll(
    @Param('entityId') entityId: string,
    @CurrentUser() user: AuthUser,
    @Query('fieldSlug') fieldSlug?: string,
  ) {
    if (fieldSlug) {
      return this.entityFieldRuleService.findByField(
        user.tenantId,
        entityId,
        fieldSlug,
      );
    }
    return this.entityFieldRuleService.findAll(user.tenantId, entityId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Busca regra de campo por ID' })
  async findOne(
    @Param('entityId') entityId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.entityFieldRuleService.findOne(user.tenantId, entityId, id);
  }

  @Post()
  @ApiOperation({ summary: 'Cria nova regra de campo' })
  async create(
    @Param('entityId') entityId: string,
    @Body() dto: CreateFieldRuleDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.entityFieldRuleService.create(user.tenantId, entityId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza regra de campo' })
  async update(
    @Param('entityId') entityId: string,
    @Param('id') id: string,
    @Body() dto: UpdateFieldRuleDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.entityFieldRuleService.update(
      user.tenantId,
      entityId,
      id,
      dto,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove regra de campo' })
  async remove(
    @Param('entityId') entityId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.entityFieldRuleService.remove(user.tenantId, entityId, id);
  }
}
