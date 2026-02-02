import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  All,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CustomApiService } from './custom-api.service';
import { CreateCustomApiDto, UpdateCustomApiDto, HttpMethod } from './dto/custom-api.dto';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('custom-apis')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CustomApiController {
  private readonly logger = new Logger(CustomApiController.name);

  constructor(
    private readonly customApiService: CustomApiService,
    private readonly prisma: PrismaService,
  ) {}

  // Helper to get workspace from organization
  private async getWorkspaceId(organizationId: string): Promise<string> {
    const workspace = await this.prisma.workspace.findFirst({
      where: { organizationId },
      select: { id: true },
    });
    if (!workspace) {
      throw new BadRequestException('Nenhum workspace encontrado para esta organização');
    }
    return workspace.id;
  }

  @Post()
  @Roles('ADMIN')
  async create(@Body() dto: CreateCustomApiDto, @CurrentUser() user: any) {
    this.logger.log(`Creating custom API: ${dto.name}`);
    const workspaceId = await this.getWorkspaceId(user.organizationId);
    return this.customApiService.create(dto, workspaceId, user.tenantId);
  }

  @Get()
  async findAll(@CurrentUser() user: any) {
    const workspaceId = await this.getWorkspaceId(user.organizationId);
    return this.customApiService.findAll(workspaceId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    const workspaceId = await this.getWorkspaceId(user.organizationId);
    return this.customApiService.findOne(id, workspaceId);
  }

  @Put(':id')
  @Roles('ADMIN')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCustomApiDto,
    @CurrentUser() user: any,
  ) {
    const workspaceId = await this.getWorkspaceId(user.organizationId);
    return this.customApiService.update(id, dto, workspaceId);
  }

  @Patch(':id/toggle')
  @Roles('ADMIN')
  async toggleActive(@Param('id') id: string, @CurrentUser() user: any) {
    const workspaceId = await this.getWorkspaceId(user.organizationId);
    return this.customApiService.toggleActive(id, workspaceId);
  }

  @Delete(':id')
  @Roles('ADMIN')
  async remove(@Param('id') id: string, @CurrentUser() user: any) {
    const workspaceId = await this.getWorkspaceId(user.organizationId);
    return this.customApiService.remove(id, workspaceId);
  }
}

// Dynamic endpoint executor
@Controller('x/:workspaceId')
export class DynamicApiController {
  constructor(private readonly customApiService: CustomApiService) {}

  @All('*')
  async handleDynamicRequest(@Req() req: Request, @Param('workspaceId') workspaceId: string) {
    const path = req.params[0] || '';
    const method = req.method as HttpMethod;

    return this.customApiService.executeEndpoint(
      workspaceId,
      `/${path}`,
      method,
      req.body,
      req.query,
      req.headers,
      (req as any).user,
    );
  }
}
