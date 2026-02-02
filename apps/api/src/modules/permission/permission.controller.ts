import { Controller, Get, UseGuards, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PermissionService } from './permission.service';

@ApiTags('Permissions')
@Controller('permissions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PermissionController {
  constructor(private readonly permissionService: PermissionService) {}

  @Get()
  @ApiOperation({ summary: 'Listar todas as permissões disponíveis' })
  getAllPermissions() {
    return this.permissionService.getAllPermissions();
  }

  @Get('grouped')
  @ApiOperation({ summary: 'Listar permissões agrupadas por categoria' })
  getPermissionsByCategory() {
    return this.permissionService.getPermissionsByCategory();
  }

  @Get('me')
  @ApiOperation({ summary: 'Obter permissões do usuário atual' })
  async getMyPermissions(@CurrentUser() user: any) {
    if (!user?.id) {
      throw new BadRequestException('User ID not found in token');
    }
    return this.permissionService.getUserPermissions(user.id);
  }
}
