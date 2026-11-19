import { RequireFeature } from '../../common/decorators/require-feature.decorator';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { NoClientPortalGuard } from '../../common/guards/no-client-portal.guard';
import { AuthThrottlerGuard } from '../../common/guards/auth-throttler.guard';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser as CurrentUserType } from '../../common/types';


/** Tamanho maximo de uma pergunta ao bot (vai inteira para a IA). */
const BOT_MESSAGE_MAX = 4000;
@ApiTags('Chat')
@RequireFeature('chat')
@Controller('chat')
@UseGuards(JwtAuthGuard, NoClientPortalGuard)
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

  @Get('people')
  @ApiOperation({ summary: 'Colegas da empresa para iniciar conversa direta' })
  async people(@Query('q') q: string | undefined, @CurrentUser() user: CurrentUserType) {
    return this.chatService.listPeople(user, q);
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

  @Delete('channels/:id')
  @ApiOperation({ summary: 'Exclui um canal (criador do canal ou quem gerencia o chat)' })
  async deleteChannel(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.chatService.deleteChannel(user, id);
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
    @Query('filters') filters: string | undefined,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.chatService.searchRecords(user, entitySlug, q || '', 8, parentId || undefined, filters || undefined);
  }

  @Get('entity-columns')
  @ApiOperation({ summary: 'Colunas disponíveis p/ consulta (campos + chaves do data + geo + sistema)' })
  async entityColumns(
    @Query('entitySlug') entitySlug: string,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.chatService.entityColumns(user, entitySlug);
  }

  @Get('field-suggestions')
  @ApiOperation({ summary: 'Valores distintos já usados num campo (autocomplete)' })
  async fieldSuggestions(
    @Query('entitySlug') entitySlug: string,
    @Query('field') field: string,
    @Query('q') q: string,
    @Query('parentId') parentId: string | undefined,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.chatService.fieldSuggestions(user, entitySlug, field, q || '', 8, parentId || undefined);
  }

  @Post('channels/:id/commands/:slug')
  @ApiOperation({ summary: 'Executa um comando-formulário no canal' })
  async runCommand(
    @Param('id') id: string,
    @Param('slug') slug: string,
    @Body()
    body: {
      values?: Record<string, unknown>;
      items?: Array<Record<string, unknown>>;
      recordId?: string;
      parentRecordId?: string;
      parent?: { entitySlug: string; values: Record<string, unknown> };
      parentUpdate?: Record<string, unknown>;
    },
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.chatService.executeCommand(user, id, slug, {
      values: body.values || {},
      items: body.items,
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
      pdfTemplateId?: string;
      scopeParentId?: string;
    },
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.chatService.runQuery(user, id, slug, {
      filters: body?.filters || [],
      format: body?.format || 'card',
      limit: body?.limit,
      pdfTemplateId: body?.pdfTemplateId,
      scopeParentId: body?.scopeParentId,
    });
  }

  @Post('channels/:id/bot')
  @UseGuards(AuthThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Pergunta ao bot (read-only, as_user)' })
  async askBot(
    @Param('id') id: string,
    @Body() body: { message: string },
    @CurrentUser() user: CurrentUserType,
  ) {
    const message = typeof body?.message === 'string' ? body.message : '';
    if (message.length > BOT_MESSAGE_MAX) {
      throw new BadRequestException(`A pergunta ao bot pode ter até ${BOT_MESSAGE_MAX} caracteres.`);
    }
    return this.chatService.askBot(user, id, message);
  }

  @Get('channels/:id/messages')
  @ApiOperation({ summary: 'Lista mensagens de um canal (before = pagina p/ trás)' })
  async getMessages(
    @Param('id') id: string,
    @Query('limit') limit: string | undefined,
    @Query('before') before: string | undefined,
    @Query('after') after: string | undefined,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.chatService.getMessages(user, id, limit ? Number(limit) : 50, before || undefined, after || undefined);
  }

  @Get('channels/:id/messages/search')
  @ApiOperation({ summary: 'Busca mensagens por texto dentro do canal' })
  async searchMessages(
    @Param('id') id: string,
    @Query('q') q: string,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.chatService.searchMessages(user, id, q || '');
  }

  @Get('channels/:id/messages/:messageId/file')
  @ApiOperation({ summary: 'Baixa o anexo ou o relatório de uma mensagem (só quem participa do canal)' })
  async messageFile(
    @Param('id') id: string,
    @Param('messageId') messageId: string,
    @Query('i') i: string | undefined,
    @CurrentUser() user: CurrentUserType,
    @Res({ passthrough: true }) res: Response,
  ) {
    const file = await this.chatService.getMessageFile(user, id, messageId, Math.max(0, parseInt(i || '0', 10) || 0));
    const inline = /^(image\/(jpeg|png|gif|webp)|video\/|application\/pdf)/.test(file.mime);
    res.set({
      'Content-Type': file.mime,
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'Cache-Control': 'private, max-age=300',
    });
    return new StreamableFile(file.buffer);
  }

  @Post('channels/:id/attachments')
  @ApiOperation({ summary: 'Envia uma imagem ou arquivo no canal (um por vez; legenda opcional)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 25 * 1024 * 1024 } }))
  async postAttachment(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { caption?: string },
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.chatService.postAttachment(user, id, file, body?.caption);
  }

  @Post('channels/:id/messages')
  @ApiOperation({ summary: 'Posta uma mensagem de texto' })
  async postMessage(
    @Param('id') id: string,
    @Body() body: { content: string; id?: string },
    @CurrentUser() user: CurrentUserType,
  ) {
    // body.id: cuid gerado pelo app (envio otimista) -> upsert idempotente.
    return this.chatService.postMessage(user, id, body.content, body.id);
  }
}
