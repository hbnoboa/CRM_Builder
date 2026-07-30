import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser as CurrentUserType } from '../../common/types';

@ApiTags('Chat')
@Controller('chat')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('channels')
  @ApiOperation({ summary: 'Lista canais visíveis (grupos por tabela + DMs)' })
  async listChannels(@CurrentUser() user: CurrentUserType) {
    return this.chatService.listChannels(user);
  }

  @Post('channels/group/:entitySlug')
  @ApiOperation({ summary: 'Abre/garante o canal de grupo de uma tabela' })
  async openGroup(
    @Param('entitySlug') entitySlug: string,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.chatService.openGroupChannel(user, entitySlug);
  }

  @Post('channels/dm')
  @ApiOperation({ summary: 'Abre/encontra uma DM com outro usuário do tenant' })
  async openDm(
    @Body() body: { userId: string },
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.chatService.openDm(user, body.userId);
  }

  @Get('channels/record/:entitySlug/:recordId/meta')
  @ApiOperation({ summary: 'Metadados do thread: existe? comandos anexados?' })
  async recordChannelMeta(
    @Param('entitySlug') entitySlug: string,
    @Param('recordId') recordId: string,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.chatService.recordChannelMeta(user, entitySlug, recordId);
  }

  @Post('channels/record/:entitySlug/:recordId')
  @ApiOperation({ summary: 'Abre/garante o chat de um registro; commandIds anexa na criação' })
  async openRecordChannel(
    @Param('entitySlug') entitySlug: string,
    @Param('recordId') recordId: string,
    @Body() body: { commandIds?: string[] } | undefined,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.chatService.openRecordChannel(user, entitySlug, recordId, body?.commandIds);
  }

  @Patch('channels/:id')
  @ApiOperation({ summary: 'Renomeia um canal (criador do canal ou quem gerencia o chat)' })
  async renameChannel(
    @Param('id') id: string,
    @Body() body: { name: string },
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.chatService.renameChannel(user, id, body?.name || '');
  }

  @Put('channels/:id/commands')
  @ApiOperation({ summary: 'Define quais comandos aparecem neste chat' })
  async setChannelCommands(
    @Param('id') id: string,
    @Body() body: { commandIds: string[] },
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.chatService.setChannelCommands(user, id, body.commandIds || []);
  }

  @Get('commands')
  @ApiOperation({ summary: 'Lista comandos disponíveis (por canal, ou por tabela)' })
  async listCommands(
    @Query('entitySlug') entitySlug: string | undefined,
    @Query('channelId') channelId: string | undefined,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.chatService.listCommands(user, { entitySlug, channelId });
  }

  @Get('commands/manage')
  @ApiOperation({ summary: '[admin] Lista todos os comandos do tenant p/ gestão' })
  async listManageCommands(@CurrentUser() user: CurrentUserType) {
    return this.chatService.listManageCommands(user);
  }

  @Post('commands')
  @ApiOperation({ summary: '[admin] Cria um comando' })
  async createCommand(
    @Body() body: Record<string, unknown>,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.chatService.createCommand(user, body);
  }

  @Patch('commands/:id')
  @ApiOperation({ summary: '[admin] Edita um comando' })
  async updateCommand(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.chatService.updateCommand(user, id, body);
  }

  @Delete('commands/:id')
  @ApiOperation({ summary: '[admin] Exclui um comando' })
  async deleteCommand(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.chatService.deleteCommand(user, id);
  }

  @Get('search')
  @ApiOperation({ summary: 'Autocomplete de registros (pai) por busca; parentId escopa aos filhos' })
  async search(
    @Query('entitySlug') entitySlug: string,
    @Query('q') q: string,
    @Query('parentId') parentId: string | undefined,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.chatService.searchRecords(user, entitySlug, q || '', 8, parentId || undefined);
  }

  @Get('field-suggestions')
  @ApiOperation({ summary: 'Valores distintos já usados num campo (autocomplete)' })
  async fieldSuggestions(
    @Query('entitySlug') entitySlug: string,
    @Query('field') field: string,
    @Query('q') q: string,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.chatService.fieldSuggestions(user, entitySlug, field, q || '');
  }

  @Post('channels/:id/commands/:slug')
  @ApiOperation({ summary: 'Executa um comando-formulário no canal' })
  async runCommand(
    @Param('id') id: string,
    @Param('slug') slug: string,
    @Body()
    body: {
      values?: Record<string, unknown>;
      recordId?: string;
      parentRecordId?: string;
      parent?: { entitySlug: string; values: Record<string, unknown> };
      parentUpdate?: Record<string, unknown>;
    },
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.chatService.executeCommand(user, id, slug, {
      values: body.values || {},
      recordId: body.recordId,
      parentRecordId: body.parentRecordId,
      parent: body.parent,
      parentUpdate: body.parentUpdate,
    });
  }

  @Post('channels/:id/query/:slug')
  @ApiOperation({ summary: 'Executa um comando de consulta/relatório (card no chat ou arquivo)' })
  async runQuery(
    @Param('id') id: string,
    @Param('slug') slug: string,
    @Body()
    body: {
      filters?: Array<{ fieldSlug: string; fieldType?: string; operator: string; value?: unknown; value2?: unknown }>;
      format?: 'card' | 'json' | 'xlsx' | 'pdf';
      limit?: number;
    },
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.chatService.runQuery(user, id, slug, {
      filters: body?.filters || [],
      format: body?.format || 'card',
      limit: body?.limit,
    });
  }

  @Post('channels/:id/bot')
  @ApiOperation({ summary: 'Pergunta ao bot (read-only, as_user)' })
  async askBot(
    @Param('id') id: string,
    @Body() body: { message: string },
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.chatService.askBot(user, id, body.message || '');
  }

  @Get('channels/:id/messages')
  @ApiOperation({ summary: 'Lista mensagens de um canal' })
  async getMessages(
    @Param('id') id: string,
    @Query('limit') limit: string | undefined,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.chatService.getMessages(user, id, limit ? Number(limit) : 50);
  }

  @Post('channels/:id/messages')
  @ApiOperation({ summary: 'Posta uma mensagem de texto' })
  async postMessage(
    @Param('id') id: string,
    @Body() body: { content: string },
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.chatService.postMessage(user, id, body.content);
  }
}
