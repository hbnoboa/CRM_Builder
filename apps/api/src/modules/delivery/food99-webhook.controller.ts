import { Controller, Headers, HttpCode, HttpStatus, Logger, Post, Req } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { ServiceScope } from '../../common/service-scope/service-scope.decorator';
import { Food99Client, parse99, verify99, type Food99Event } from './food99.client';
import { Food99Service } from './food99.service';

/** A 99 espera resposta em ate 6 s; o que passar disso continua sendo feito depois. */
const ANSWER_MS = 4_500;

/**
 * Avisos da 99Food (pedido novo, confirmado, pronto, concluido, cancelado, loja
 * autorizada). Sem login: vale a assinatura (MD5 do corpo cru + segredo do aplicativo).
 * O corpo cru chega por um leitor proprio em main.ts (os ids sao inteiros de 64 bits).
 */
@ApiExcludeController()
@Controller('delivery/99food/webhook')
@ServiceScope('admin')
export class Food99WebhookController {
  private readonly logger = new Logger(Food99WebhookController.name);

  constructor(private readonly client: Food99Client, private readonly service: Food99Service) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async receive(@Req() req: { rawBody99?: Buffer }, @Headers('didi-header-sign') signature?: string) {
    if (!this.client.configured) return { errno: 1, errmsg: 'connector off' };
    const raw = req.rawBody99 ?? Buffer.alloc(0);
    if (!verify99(raw, signature, this.client.secret)) {
      this.logger.warn('99Food: aviso com assinatura invalida recusado');
      return { errno: 1, errmsg: 'invalid sign' };
    }
    let ev: Food99Event;
    try {
      ev = parse99<Food99Event>(raw.toString('utf8'));
    } catch {
      return { errno: 1, errmsg: 'invalid body' };
    }
    const work = this.service.handle(ev);
    try {
      // Erro rapido: a 99 manda de novo; demorado: responde ok e termina aqui mesmo
      await Promise.race([work, new Promise((r) => setTimeout(r, ANSWER_MS))]);
    } catch (err) {
      this.logger.warn(`99Food aviso ${ev.type}: ${(err as Error).message}`);
      return { errno: 1, errmsg: 'retry' };
    }
    work.catch((err) => this.logger.warn(`99Food aviso ${ev.type} (depois da resposta): ${(err as Error).message}`));
    return { errno: 0, errmsg: 'ok' };
  }
}
