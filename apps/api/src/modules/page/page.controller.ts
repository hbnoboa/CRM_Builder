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
  Logger,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PageService, QueryPageDto } from './page.service';
import { CreatePageDto, UpdatePageDto } from './dto/page.dto';

@Controller('pages')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PageController {
  private readonly logger = new Logger(PageController.name);

  constructor(private readonly pageService: PageService) {}

  @Post()
  @Roles('ADMIN', 'MANAGER')
  async create(
    @Body() dto: CreatePageDto,
    @CurrentUser() user: any,
  ) {
    this.logger.log(`Creating page: ${dto.title}`);
    return this.pageService.create(dto, user.id, user.tenantId);
  }

  @Get()
  async findAll(@Query() query: QueryPageDto, @CurrentUser() user: any) {
    return this.pageService.findAll(user.tenantId, query);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.pageService.findOne(id, user.tenantId);
  }

  @Get('slug/:slug')
  async findBySlug(@Param('slug') slug: string, @CurrentUser() user: any) {
    return this.pageService.findBySlug(slug, user.tenantId);
  }

  // Preview endpoint - permite visualizar paginas nao publicadas (autenticado)
  @Get('preview/:slug')
  async preview(
    @Param('slug') slug: string,
    @CurrentUser() user: any,
  ) {
    this.logger.log(`Preview page: ${slug}`);
    return this.pageService.getPreviewPage(slug, user.tenantId);
  }

  @Patch(':id')
  @Roles('ADMIN', 'MANAGER')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdatePageDto,
    @CurrentUser() user: any,
  ) {
    return this.pageService.update(id, dto, user.tenantId);
  }

  @Patch(':id/publish')
  @Roles('ADMIN', 'MANAGER')
  async publish(@Param('id') id: string, @CurrentUser() user: any) {
    return this.pageService.publish(id, user.tenantId);
  }

  @Patch(':id/unpublish')
  @Roles('ADMIN', 'MANAGER')
  async unpublish(@Param('id') id: string, @CurrentUser() user: any) {
    return this.pageService.unpublish(id, user.tenantId);
  }

  @Post(':id/duplicate')
  @Roles('ADMIN', 'MANAGER')
  async duplicate(@Param('id') id: string, @CurrentUser() user: any) {
    return this.pageService.duplicate(id, user.tenantId);
  }

  @Delete(':id')
  @Roles('ADMIN')
  async remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.pageService.remove(id, user.tenantId);
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

  @Get(':tenantId/:slug')
  async getPublicPage(
    @Param('tenantId') tenantId: string,
    @Param('slug') slug: string,
  ) {
    return this.pageService.getPublicPage(slug, tenantId);
  }
}
