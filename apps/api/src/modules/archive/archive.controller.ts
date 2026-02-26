import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ArchiveService } from './archive.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('archive')
@ApiTags('Archive')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
export class ArchiveController {
  constructor(private readonly archiveService: ArchiveService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Estatisticas de archival por entidade' })
  @Roles('ADMIN', 'PLATFORM_ADMIN')
  async getStats() {
    return this.archiveService.getStats();
  }

  @Post('run')
  @ApiOperation({ summary: 'Executar archival manualmente (PLATFORM_ADMIN)' })
  @Roles('PLATFORM_ADMIN')
  async runArchival() {
    return this.archiveService.runArchival();
  }
}
