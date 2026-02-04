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
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PageService, QueryPageDto } from './page.service';
import { CreatePageDto, UpdatePageDto } from './dto/page.dto';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('pages')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PageController {
  private readonly logger = new Logger(PageController.name);

  constructor(
    private readonly pageService: PageService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @Roles('ADMIN', 'MANAGER')
  async create(
    @Body() dto: CreatePageDto,
    @CurrentUser() user: any,
  ) {
    this.logger.log(`Creating page: ${dto.title}`);
    return this.pageService.create(dto, user.id, user.organizationId, user.tenantId);
  }

  @Get()
  async findAll(@Query() query: QueryPageDto, @CurrentUser() user: any) {
    return this.pageService.findAll(user.organizationId, query);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.pageService.findOne(id, user.organizationId);
  }

  @Get('slug/:slug')
  async findBySlug(@Param('slug') slug: string, @CurrentUser() user: any) {
    return this.pageService.findBySlug(slug, user.organizationId);
  }

  // Preview endpoint - permite visualizar paginas nao publicadas (autenticado)
  @Get('preview/:organizationId/:slug')
  async preview(
    @Param('organizationId') organizationId: string,
    @Param('slug') slug: string,
    @CurrentUser() user: any,
  ) {
    this.logger.log(`Preview page: ${slug} in organization ${organizationId}`);
    return this.pageService.getPreviewPage(slug, organizationId, user.tenantId);
  }

  @Patch(':id')
  @Roles('ADMIN', 'MANAGER')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdatePageDto,
    @CurrentUser() user: any,
  ) {
    return this.pageService.update(id, dto, user.organizationId);
  }

  @Patch(':id/publish')
  @Roles('ADMIN', 'MANAGER')
  async publish(@Param('id') id: string, @CurrentUser() user: any) {
    return this.pageService.publish(id, user.organizationId);
  }

  @Patch(':id/unpublish')
  @Roles('ADMIN', 'MANAGER')
  async unpublish(@Param('id') id: string, @CurrentUser() user: any) {
    return this.pageService.unpublish(id, user.organizationId);
  }

  @Post(':id/duplicate')
  @Roles('ADMIN', 'MANAGER')
  async duplicate(@Param('id') id: string, @CurrentUser() user: any) {
    return this.pageService.duplicate(id, user.organizationId, user.tenantId);
  }

  @Delete(':id')
  @Roles('ADMIN')
  async remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.pageService.remove(id, user.organizationId);
  }
}

// Public controller for rendering pages
@Controller('public/pages')
export class PublicPageController {
  constructor(private readonly pageService: PageService) {}

  // Simple slug-only lookup (for simpler URLs)
  @Get('slug/:slug')
  async getPublicPageBySlug(@Param('slug') slug: string) {
    return this.pageService.getPublicPageBySlug(slug);
  }

  @Get(':organizationId/:slug')
  async getPublicPage(
    @Param('organizationId') organizationId: string,
    @Param('slug') slug: string,
  ) {
    return this.pageService.getPublicPage(slug, organizationId);
  }
}
