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
import { AuthenticatedRequest } from '../../common/types';
import { CustomApiService, QueryCustomApiDto } from './custom-api.service';
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

  @Post()
  @Roles('ADMIN')
  async create(@Body() dto: CreateCustomApiDto, @CurrentUser() user: any) {
    this.logger.log(`Creating custom API: ${dto.name}`);
    return this.customApiService.create(dto, user.organizationId, user.tenantId);
  }

  @Get()
  async findAll(@Query() query: QueryCustomApiDto, @CurrentUser() user: any) {
    return this.customApiService.findAll(user.organizationId, query);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.customApiService.findOne(id, user.organizationId);
  }

  @Patch(':id')
  @Roles('ADMIN')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCustomApiDto,
    @CurrentUser() user: any,
  ) {
    return this.customApiService.update(id, dto, user.organizationId);
  }

  @Patch(':id/toggle')
  @Roles('ADMIN')
  async toggleActive(@Param('id') id: string, @CurrentUser() user: any) {
    return this.customApiService.toggleActive(id, user.organizationId);
  }

  @Patch(':id/activate')
  @Roles('ADMIN')
  async activate(@Param('id') id: string, @CurrentUser() user: any) {
    return this.customApiService.activate(id, user.organizationId);
  }

  @Patch(':id/deactivate')
  @Roles('ADMIN')
  async deactivate(@Param('id') id: string, @CurrentUser() user: any) {
    return this.customApiService.deactivate(id, user.organizationId);
  }

  @Delete(':id')
  @Roles('ADMIN')
  async remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.customApiService.remove(id, user.organizationId);
  }
}

// Dynamic endpoint executor
@Controller('x/:organizationId')
export class DynamicApiController {
  constructor(private readonly customApiService: CustomApiService) {}

  @All('*')
  async handleDynamicRequest(@Req() req: AuthenticatedRequest, @Param('organizationId') organizationId: string) {
    const path = (req.params as Record<string, string>)[0] || '';
    const method = req.method as HttpMethod;

    return this.customApiService.executeEndpoint(
      organizationId,
      `/${path}`,
      method,
      req.body as Record<string, unknown>,
      req.query as Record<string, string>,
      req.headers as unknown as Record<string, string>,
      req.user,
    );
  }
}
