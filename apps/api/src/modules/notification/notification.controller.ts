import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationService, QueryNotificationDto } from './notification.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser as CurrentUserType } from '../../common/types';

@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  @ApiOperation({ summary: 'Get user notifications' })
  async getNotifications(
    @Query() query: QueryNotificationDto,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.notificationService.getUserNotifications(
      user.id,
      user.tenantId,
      query,
    );
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notification count' })
  async getUnreadCount(@CurrentUser() user: CurrentUserType) {
    const count = await this.notificationService.getUnreadCount(
      user.id,
      user.tenantId,
    );
    return { count };
  }

  @Post(':id/read')
  @ApiOperation({ summary: 'Mark notification as read' })
  async markAsRead(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserType,
  ) {
    await this.notificationService.markAsRead(id, user.id);
    return { success: true };
  }

  @Post('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  async markAllAsRead(@CurrentUser() user: CurrentUserType) {
    await this.notificationService.markAllAsRead(user.id, user.tenantId);
    return { success: true };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a notification' })
  async deleteNotification(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserType,
  ) {
    await this.notificationService.deleteNotification(id, user.id);
    return { success: true };
  }
}
