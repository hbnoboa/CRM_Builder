import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  All,
  Logger,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedRequest } from '../../common/types';
import { CustomApiService, QueryCustomApiDto } from './custom-api.service';
import { CreateCustomApiDto, UpdateCustomApiDto, HttpMethod } from './dto/custom-api.dto';

@Controller('custom-apis')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CustomApiController {
  private readonly logger = new Logger(CustomApiController.name);

  constructor(private readonly customApiService: CustomApiService) {}

  @Post()
  @Roles('ADMIN')
  async create(@Body() dto: CreateCustomApiDto, @CurrentUser() user: any) {
    this.logger.log(`Creating custom API: ${dto.name}`);
    return this.customApiService.create(dto, user.tenantId);
  }

  @Get()
  async findAll(@Query() query: QueryCustomApiDto, @CurrentUser() user: any) {
    return this.customApiService.findAll(user.tenantId, query);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.customApiService.findOne(id, user.tenantId);
  }

  @Patch(':id')
  @Roles('ADMIN')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCustomApiDto,
    @CurrentUser() user: any,
  ) {
    return this.customApiService.update(id, dto, user.tenantId);
  }

  @Patch(':id/toggle')
  @Roles('ADMIN')
  async toggleActive(@Param('id') id: string, @CurrentUser() user: any) {
    return this.customApiService.toggleActive(id, user.tenantId);
  }

  @Patch(':id/activate')
  @Roles('ADMIN')
  async activate(@Param('id') id: string, @CurrentUser() user: any) {
    return this.customApiService.activate(id, user.tenantId);
  }

  @Patch(':id/deactivate')
  @Roles('ADMIN')
  async deactivate(@Param('id') id: string, @CurrentUser() user: any) {
    return this.customApiService.deactivate(id, user.tenantId);
  }

  @Delete(':id')
  @Roles('ADMIN')
  async remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.customApiService.remove(id, user.tenantId);
  }
}

// Dynamic endpoint executor
@Controller('x/:tenantId')
export class DynamicApiController {
  constructor(private readonly customApiService: CustomApiService) {}

  @All('*')
  async handleDynamicRequest(@Req() req: AuthenticatedRequest, @Param('tenantId') tenantId: string) {
    const path = (req.params as Record<string, string>)[0] || '';
    const method = req.method as HttpMethod;

    return this.customApiService.executeEndpoint(
      tenantId,
      `/${path}`,
      method,
      req.body as Record<string, unknown>,
      req.query as Record<string, string>,
      req.headers as unknown as Record<string, string>,
      req.user,
    );
  }
}
