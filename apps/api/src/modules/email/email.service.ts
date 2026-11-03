import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { EmailOptions, EmailResult } from './email.interface';

/**
 * Envio de e-mail. EMAIL_PROVIDER=smtp usa SMTP generico (Google Workspace, Amazon SES,
 * Brevo, Resend...): SMTP_HOST, SMTP_PORT (587), SMTP_SECURE (true so na 465),
 * SMTP_USER, SMTP_PASS e EMAIL_FROM. Sem provedor, so registra no log e devolve
 * sent=false — quem chama decide o que fazer (ex.: convite mostra o link para copiar).
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly provider: string;
  private readonly defaultFrom: string;
  private transporter: Transporter | null = null;

  constructor(private configService: ConfigService) {
    this.provider = this.configService.get<string>('EMAIL_PROVIDER') || 'console';
    this.defaultFrom = this.configService.get<string>('EMAIL_FROM') || 'noreply@example.com';
  }

  /** true quando um provedor real esta configurado (o e-mail sai de verdade). */
  get isConfigured(): boolean {
    return this.provider === 'smtp' && !!this.configService.get<string>('SMTP_HOST');
  }

  async send(options: EmailOptions): Promise<EmailResult> {
    const from = options.from || this.defaultFrom;
    const to = Array.isArray(options.to) ? options.to.join(', ') : options.to;

    if (!this.isConfigured) return this.sendViaConsole(options, from, to);
    try {
      return await this.sendViaSMTP(options, from, to);
    } catch (error) {
      this.logger.error(`[EMAIL] Falha ao enviar para ${to}: ${error instanceof Error ? error.message : error}`);
      return { sent: false, provider: 'smtp' };
    }
  }

  private async sendViaConsole(options: EmailOptions, from: string, to: string): Promise<EmailResult> {
    this.logger.log(`[EMAIL nao enviado: sem provedor] De: ${from} | Para: ${to} | Assunto: ${options.subject}`);
    return { sent: false, provider: 'console' };
  }

  private async sendViaSMTP(options: EmailOptions, from: string, to: string): Promise<EmailResult> {
    if (!this.transporter) {
      const port = Number(this.configService.get<string>('SMTP_PORT') || 587);
      this.transporter = nodemailer.createTransport({
        host: this.configService.get<string>('SMTP_HOST'),
        port,
        secure: (this.configService.get<string>('SMTP_SECURE') ?? String(port === 465)) === 'true',
        auth: this.configService.get<string>('SMTP_USER')
          ? { user: this.configService.get<string>('SMTP_USER'), pass: this.configService.get<string>('SMTP_PASS') }
          : undefined,
      });
    }
    const info = await this.transporter.sendMail({
      from,
      to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      replyTo: options.replyTo,
    });
    this.logger.log(`[EMAIL] Enviado para ${to}: ${options.subject}`);
    return { sent: true, messageId: info.messageId, provider: 'smtp' };
  }
}
