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
import { PageService } from './page.service';
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
  @Roles('ADMIN', 'MANAGER')
  async create(
    @Body() dto: CreatePageDto,
    @CurrentUser() user: any,
  ) {
    this.logger.log(`Creating page: ${dto.title}`);
    const workspaceId = await this.getWorkspaceId(user.organizationId);
    return this.pageService.create(dto, user.id, workspaceId, user.tenantId);
  }

  @Get()
  async findAll(@CurrentUser() user: any) {
    const workspaceId = await this.getWorkspaceId(user.organizationId);
    return this.pageService.findAll(workspaceId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    const workspaceId = await this.getWorkspaceId(user.organizationId);
    return this.pageService.findOne(id, workspaceId);
  }

  @Get('slug/:slug')
  async findBySlug(@Param('slug') slug: string, @CurrentUser() user: any) {
    const workspaceId = await this.getWorkspaceId(user.organizationId);
    return this.pageService.findBySlug(slug, workspaceId);
  }

  @Put(':id')
  @Roles('ADMIN', 'MANAGER')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdatePageDto,
    @CurrentUser() user: any,
  ) {
    const workspaceId = await this.getWorkspaceId(user.organizationId);
    return this.pageService.update(id, dto, workspaceId);
  }

  @Patch(':id/publish')
  @Roles('ADMIN', 'MANAGER')
  async publish(@Param('id') id: string, @CurrentUser() user: any) {
    const workspaceId = await this.getWorkspaceId(user.organizationId);
    return this.pageService.publish(id, workspaceId);
  }

  @Patch(':id/unpublish')
  @Roles('ADMIN', 'MANAGER')
  async unpublish(@Param('id') id: string, @CurrentUser() user: any) {
    const workspaceId = await this.getWorkspaceId(user.organizationId);
    return this.pageService.unpublish(id, workspaceId);
  }

  @Post(':id/duplicate')
  @Roles('ADMIN', 'MANAGER')
  async duplicate(@Param('id') id: string, @CurrentUser() user: any) {
    const workspaceId = await this.getWorkspaceId(user.organizationId);
    return this.pageService.duplicate(id, workspaceId, user.tenantId);
  }

  @Delete(':id')
  @Roles('ADMIN')
  async remove(@Param('id') id: string, @CurrentUser() user: any) {
    const workspaceId = await this.getWorkspaceId(user.organizationId);
    return this.pageService.remove(id, workspaceId);
  }
}

// Public controller for rendering pages
@Controller('public/pages')
export class PublicPageController {
  constructor(private readonly pageService: PageService) {}

  @Get(':workspaceId/:slug')
  async getPublicPage(
    @Param('workspaceId') workspaceId: string,
    @Param('slug') slug: string,
  ) {
    return this.pageService.getPublicPage(slug, workspaceId);
  }
}
