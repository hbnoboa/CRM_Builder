import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ArchiveService } from './archive.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ModulePermissionGuard } from '../../common/guards/module-permission.guard';
import { RequireModulePermission } from '../../common/decorators/module-permission.decorator';

@Controller('archive')
@ApiTags('Archive')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ModulePermissionGuard)
export class ArchiveController {
  constructor(private readonly archiveService: ArchiveService) {}

  @Get('stats')
  @RequireModulePermission('archive', 'canRead')
  @ApiOperation({ summary: 'Estatisticas de archival por entidade' })
  async getStats() {
    return this.archiveService.getStats();
  }

  @Post('run')
  @RequireModulePermission('archive', 'canPermanentDelete')
  @ApiOperation({ summary: 'Executar archival manualmente (PLATFORM_ADMIN)' })
  async runArchival() {
    return this.archiveService.runArchival();
  }
}
