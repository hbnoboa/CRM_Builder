import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailOptions, EmailResult } from './email.interface';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly provider: string;
  private readonly defaultFrom: string;

  constructor(private configService: ConfigService) {
    this.provider = this.configService.get<string>('EMAIL_PROVIDER') || 'console';
    this.defaultFrom = this.configService.get<string>('EMAIL_FROM') || 'noreply@example.com';
  }

  async send(options: EmailOptions): Promise<EmailResult> {
    const from = options.from || this.defaultFrom;
    const to = Array.isArray(options.to) ? options.to.join(', ') : options.to;

    switch (this.provider) {
      case 'smtp':
        return this.sendViaSMTP(options, from);
      default:
        return this.sendViaConsole(options, from, to);
    }
  }

  private async sendViaConsole(
    options: EmailOptions,
    from: string,
    to: string,
  ): Promise<EmailResult> {
    this.logger.log(
      `[EMAIL] De: ${from} | Para: ${to} | Assunto: ${options.subject}`,
    );
    this.logger.debug(`[EMAIL] HTML: ${options.html?.substring(0, 200)}...`);

    return {
      sent: true,
      messageId: `console-${Date.now()}`,
      provider: 'console',
    };
  }

  private async sendViaSMTP(
    options: EmailOptions,
    from: string,
  ): Promise<EmailResult> {
    // Quando o usuario decidir o provedor, implementar aqui
    // Exemplo com nodemailer:
    // const transporter = nodemailer.createTransport({ host, port, auth });
    // const info = await transporter.sendMail({ from, to, subject, html, text });
    // return { sent: true, messageId: info.messageId, provider: 'smtp' };

    this.logger.warn('SMTP provider configurado mas nao implementado. Usando console.');
    return this.sendViaConsole(
      options,
      from,
      Array.isArray(options.to) ? options.to.join(', ') : options.to,
    );
  }
}
