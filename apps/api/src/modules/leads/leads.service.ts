import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, SalesLeadStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { PlatformAuditService } from '../platform/platform-audit.service';
import type { PlatformStaffPrincipal } from '../platform/platform-permissions';

export interface CreateLeadInput {
  name: string;
  email: string;
  phone?: string;
  company: string;
  teamSize?: string;
  segment?: string;
  interest?: string;
  message?: string;
  source?: string;
}

/** Pedidos de contato comercial ("Falar com especialista") e a fila no console. */
@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly email: EmailService,
    private readonly audit: PlatformAuditService,
  ) {}

  async create(input: CreateLeadInput, ip?: string): Promise<{ ok: true }> {
    const lead = await this.prisma.salesLead.create({ data: { ...input, email: input.email.toLowerCase().trim(), ip } });
    this.logger.log(`Contato comercial ${lead.id} (${lead.company})`);
    await this.notify(lead).catch((error) => this.logger.warn(`Aviso do contato ${lead.id} nao enviado: ${(error as Error).message}`));
    return { ok: true };
  }

  /** Aviso opcional por e-mail (SALES_NOTIFY_EMAIL); sem ele, o contato fica so no console. */
  private async notify(lead: { id: string; name: string; email: string; phone: string | null; company: string; teamSize: string | null; segment: string | null; interest: string | null; message: string | null }) {
    const to = this.config.get<string>('SALES_NOTIFY_EMAIL');
    if (!to) return;
    const lines = [
      `${lead.name} — ${lead.company}`,
      `E-mail: ${lead.email}`,
      `Telefone: ${lead.phone ?? '-'}`,
      `Equipe: ${lead.teamSize ?? '-'} · Segmento: ${lead.segment ?? '-'} · Modelo: ${lead.interest ?? '-'}`,
      '',
      lead.message ?? '',
    ];
    const text = lines.join('\n');
    const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    await this.email.send({
      to,
      subject: `[Contato comercial] ${lead.company}`,
      text,
      html: lines.map((l) => `<p>${escape(l)}</p>`).join(''),
    });
  }

  async list(query: { status?: string; search?: string; page?: number }) {
    const page = Math.max(1, query.page ?? 1);
    const take = 30;
    const where: Prisma.SalesLeadWhereInput = {
      ...(query.status === 'open'
        ? { status: { in: [SalesLeadStatus.NEW, SalesLeadStatus.CONTACTED, SalesLeadStatus.QUALIFIED] } }
        : query.status && query.status in SalesLeadStatus
          ? { status: query.status as SalesLeadStatus }
          : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { company: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.salesLead.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * take, take }),
      this.prisma.salesLead.count({ where }),
    ]);
    return { data, meta: { total, page, totalPages: Math.max(1, Math.ceil(total / take)) } };
  }

  async counts() {
    const open = await this.prisma.salesLead.count({ where: { status: SalesLeadStatus.NEW } });
    return { new: open };
  }

  async update(staff: PlatformStaffPrincipal, id: string, dto: { status?: SalesLeadStatus; notes?: string }) {
    const lead = await this.prisma.salesLead.findUnique({ where: { id }, select: { id: true } });
    if (!lead) throw new NotFoundException('Contato nao encontrado');
    const updated = await this.prisma.salesLead.update({ where: { id }, data: dto });
    await this.audit.log(staff, { action: 'lead.update', targetType: 'SalesLead', targetId: id, metadata: { ...dto } });
    return updated;
  }
}
