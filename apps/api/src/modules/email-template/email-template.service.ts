import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

interface CreateEmailTemplateDto {
  name: string;
  slug: string;
  description?: string;
  subject: string;
  bodyHtml: string;
  bodyText?: string;
  variables?: string[];
  fromName?: string;
  fromEmail?: string;
  replyTo?: string;
}

interface UpdateEmailTemplateDto extends Partial<CreateEmailTemplateDto> {
  isActive?: boolean;
}

interface SendEmailContext {
  user?: { id: string; name: string; email: string };
  record?: Record<string, unknown>;
  entity?: { id: string; slug: string; name: string };
  custom?: Record<string, unknown>;
}

@Injectable()
export class EmailTemplateService {
  private readonly logger = new Logger(EmailTemplateService.name);

  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string) {
    return this.prisma.emailTemplate.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, tenantId: string) {
    const template = await this.prisma.emailTemplate.findFirst({
      where: { id, tenantId },
    });

    if (!template) {
      throw new NotFoundException('Template de email nao encontrado');
    }

    return template;
  }

  async findBySlug(slug: string, tenantId: string) {
    const template = await this.prisma.emailTemplate.findFirst({
      where: { slug, tenantId },
    });

    if (!template) {
      throw new NotFoundException('Template de email nao encontrado');
    }

    return template;
  }

  async create(tenantId: string, dto: CreateEmailTemplateDto) {
    // Extrair variaveis do template se nao fornecidas
    const variables =
      dto.variables || this.extractVariables(dto.subject + dto.bodyHtml + (dto.bodyText || ''));

    return this.prisma.emailTemplate.create({
      data: {
        tenantId,
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
        subject: dto.subject,
        bodyHtml: dto.bodyHtml,
        bodyText: dto.bodyText,
        variables,
        fromName: dto.fromName,
        fromEmail: dto.fromEmail,
        replyTo: dto.replyTo,
      },
    });
  }

  async update(id: string, tenantId: string, dto: UpdateEmailTemplateDto) {
    await this.findOne(id, tenantId);

    // Re-extrair variaveis se o conteudo mudou
    let variables = dto.variables;
    if (!variables && (dto.subject || dto.bodyHtml || dto.bodyText)) {
      const current = await this.prisma.emailTemplate.findUnique({ where: { id } });
      const fullContent =
        (dto.subject || current?.subject || '') +
        (dto.bodyHtml || current?.bodyHtml || '') +
        (dto.bodyText || current?.bodyText || '');
      variables = this.extractVariables(fullContent);
    }

    return this.prisma.emailTemplate.update({
      where: { id },
      data: {
        ...dto,
        ...(variables && { variables }),
        updatedAt: new Date(),
      },
    });
  }

  async delete(id: string, tenantId: string) {
    await this.findOne(id, tenantId);

    return this.prisma.emailTemplate.delete({
      where: { id },
    });
  }

  /**
   * Renderiza um template com contexto
   */
  async renderTemplate(
    templateIdOrSlug: string,
    tenantId: string,
    context: SendEmailContext,
  ): Promise<{ subject: string; html: string; text?: string }> {
    let template = await this.prisma.emailTemplate.findFirst({
      where: {
        tenantId,
        OR: [{ id: templateIdOrSlug }, { slug: templateIdOrSlug }],
      },
    });

    if (!template) {
      throw new NotFoundException('Template de email nao encontrado');
    }

    const subject = this.replacePlaceholders(template.subject, context);
    const html = this.replacePlaceholders(template.bodyHtml, context);
    const text = template.bodyText
      ? this.replacePlaceholders(template.bodyText, context)
      : undefined;

    return { subject, html, text };
  }

  /**
   * Substitui placeholders no template
   * Formato: {{user.name}}, {{record.data.fieldName}}, {{now:format(DD/MM/YYYY)}}
   */
  private replacePlaceholders(content: string, context: SendEmailContext): string {
    // Substituir variaveis de usuario
    content = content
      .replace(/\{\{user\.id\}\}/g, context.user?.id || '')
      .replace(/\{\{user\.name\}\}/g, context.user?.name || '')
      .replace(/\{\{user\.email\}\}/g, context.user?.email || '');

    // Substituir variaveis de entidade
    content = content
      .replace(/\{\{entity\.id\}\}/g, context.entity?.id || '')
      .replace(/\{\{entity\.slug\}\}/g, context.entity?.slug || '')
      .replace(/\{\{entity\.name\}\}/g, context.entity?.name || '');

    // Substituir variaveis de data
    const now = new Date();
    content = content
      .replace(/\{\{now\}\}/g, now.toISOString())
      .replace(/\{\{today\}\}/g, now.toISOString().split('T')[0])
      .replace(/\{\{timestamp\}\}/g, String(now.getTime()));

    // Substituir formatadores de data
    content = content.replace(
      /\{\{now:format\(([^)]+)\)\}\}/g,
      (_, format) => this.formatDate(now, format),
    );

    // Substituir variaveis de record
    content = content.replace(/\{\{record\.([^}]+)\}\}/g, (_, path) => {
      if (!context.record) return '';
      return this.getNestedValue(context.record, path);
    });

    // Substituir variaveis customizadas
    content = content.replace(/\{\{custom\.([^}]+)\}\}/g, (_, key) => {
      if (!context.custom) return '';
      return String(context.custom[key] ?? '');
    });

    return content;
  }

  /**
   * Extrai variaveis de um template
   */
  private extractVariables(content: string): string[] {
    const matches = content.match(/\{\{([^}]+)\}\}/g) || [];
    const variables = matches.map((m) => m.replace(/\{\{|\}\}/g, '').split(':')[0].trim());
    return [...new Set(variables)];
  }

  /**
   * Obtem valor aninhado de um objeto
   */
  private getNestedValue(obj: Record<string, unknown>, path: string): string {
    const parts = path.split('.');
    let current: unknown = obj;

    for (const part of parts) {
      if (current && typeof current === 'object') {
        current = (current as Record<string, unknown>)[part];
      } else {
        return '';
      }
    }

    return current != null ? String(current) : '';
  }

  /**
   * Formata data de forma simples
   */
  private formatDate(date: Date, format: string): string {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return format
      .replace('DD', day)
      .replace('MM', month)
      .replace('YYYY', String(year))
      .replace('YY', String(year).slice(-2))
      .replace('HH', hours)
      .replace('mm', minutes)
      .replace('ss', seconds);
  }

  /**
   * Preview de um template (para o editor)
   */
  async previewTemplate(
    id: string,
    tenantId: string,
    sampleData?: SendEmailContext,
  ) {
    const template = await this.findOne(id, tenantId);

    const context: SendEmailContext = sampleData || {
      user: { id: 'user-123', name: 'Joao Silva', email: 'joao@exemplo.com' },
      record: {
        id: 'record-456',
        data: {
          nome: 'Cliente Exemplo',
          email: 'cliente@exemplo.com',
          status: 'ativo',
        },
      },
      entity: { id: 'entity-789', slug: 'clientes', name: 'Clientes' },
    };

    const rendered = await this.renderTemplate(id, tenantId, context);

    return {
      template,
      rendered,
      variables: template.variables,
    };
  }
}
