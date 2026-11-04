import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, SupportTicketPriority, SupportTicketStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentUser } from '../../common/types';
import { hasFullTenantAccess } from '../../common/utils/platform-access';
import { NotificationService } from '../notification/notification.service';
import { EmailService } from '../email/email.service';
import { PlatformAuditService } from '../platform/platform-audit.service';
import type { PlatformStaffPrincipal } from '../platform/platform-permissions';

export const SUPPORT_CATEGORIES = ['question', 'problem', 'billing', 'suggestion'] as const;
const CUSTOMER_PRIORITIES: SupportTicketPriority[] = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];

const LIST_SELECT = {
  id: true, number: true, subject: true, category: true, priority: true, status: true,
  createdByName: true, createdByEmail: true, createdById: true, lastMessageAt: true, lastMessageBy: true,
  createdAt: true, closedAt: true, assignedStaffId: true,
} as const;

/**
 * Chamados de suporte. Cliente: qualquer pessoa da empresa abre e acompanha os
 * proprios; quem administra a empresa (acesso total ou settings.update) ve todos
 * dela. Console: fila, conversa, nota interna, situacao/prioridade/responsavel.
 */
@Injectable()
export class SupportService {
  private readonly logger = new Logger(SupportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
    private readonly email: EmailService,
    private readonly audit: PlatformAuditService,
    private readonly config: ConfigService,
  ) {}

  // ── Cliente ─────────────────────────────────────────────────────────────

  private seesAllTickets(user: CurrentUser): boolean {
    const mp = user.customRole?.modulePermissions as Record<string, { canUpdate?: boolean }> | undefined;
    return hasFullTenantAccess(mp) || mp?.settings?.canUpdate === true;
  }

  private async ownTicket(user: CurrentUser, id: string) {
    const ticket = await this.prisma.supportTicket.findFirst({ where: { id, tenantId: user.tenantId } });
    if (!ticket) throw new NotFoundException('Chamado nao encontrado');
    if (ticket.createdById !== user.id && !this.seesAllTickets(user)) throw new NotFoundException('Chamado nao encontrado');
    return ticket;
  }

  async listForCustomer(user: CurrentUser, status?: string) {
    const all = this.seesAllTickets(user);
    const where: Prisma.SupportTicketWhereInput = {
      tenantId: user.tenantId,
      ...(all ? {} : { createdById: user.id }),
      ...(status === 'open' ? { status: { in: ['OPEN', 'WAITING_CUSTOMER'] } } : status === 'closed' ? { status: { in: ['RESOLVED', 'CLOSED'] } } : {}),
    };
    const tickets = await this.prisma.supportTicket.findMany({ where, select: LIST_SELECT, orderBy: { lastMessageAt: 'desc' }, take: 200 });
    return { seesAll: all, data: tickets };
  }

  async create(user: CurrentUser, dto: { subject: string; category: string; priority?: SupportTicketPriority; body: string }) {
    if (!SUPPORT_CATEGORIES.includes(dto.category as never)) throw new BadRequestException('Categoria invalida');
    const priority = dto.priority && CUSTOMER_PRIORITIES.includes(dto.priority) ? dto.priority : 'NORMAL';
    const ticket = await this.prisma.supportTicket.create({
      data: {
        tenantId: user.tenantId,
        createdById: user.id,
        createdByName: user.name,
        createdByEmail: user.email,
        subject: dto.subject.trim(),
        category: dto.category,
        priority,
        messages: { create: { authorType: 'customer', authorUserId: user.id, authorName: user.name, body: dto.body.trim() } },
      },
      select: LIST_SELECT,
    });
    this.notifySupportTeam(user, ticket.number, ticket.subject, dto.body).catch(() => {});
    return ticket;
  }

  async getForCustomer(user: CurrentUser, id: string) {
    await this.ownTicket(user, id);
    return this.prisma.supportTicket.findUniqueOrThrow({
      where: { id },
      select: {
        ...LIST_SELECT,
        messages: {
          where: { internal: false },
          orderBy: { createdAt: 'asc' },
          select: { id: true, authorType: true, authorName: true, authorUserId: true, body: true, createdAt: true },
        },
      },
    });
  }

  async customerReply(user: CurrentUser, id: string, body: string) {
    const ticket = await this.ownTicket(user, id);
    if (ticket.status === 'CLOSED') throw new BadRequestException('Chamado encerrado. Abra um novo chamado.');
    await this.prisma.$transaction([
      this.prisma.supportMessage.create({ data: { ticketId: id, authorType: 'customer', authorUserId: user.id, authorName: user.name, body: body.trim() } }),
      this.prisma.supportTicket.update({
        where: { id },
        data: { status: 'OPEN', lastMessageAt: new Date(), lastMessageBy: 'customer', closedAt: null },
      }),
    ]);
    return this.getForCustomer(user, id);
  }

  async customerResolve(user: CurrentUser, id: string) {
    const ticket = await this.ownTicket(user, id);
    if (ticket.status === 'RESOLVED' || ticket.status === 'CLOSED') return this.getForCustomer(user, id);
    await this.prisma.$transaction([
      this.prisma.supportMessage.create({ data: { ticketId: id, authorType: 'system', authorName: user.name, body: 'resolved_by_customer' } }),
      this.prisma.supportTicket.update({ where: { id }, data: { status: 'RESOLVED', closedAt: new Date() } }),
    ]);
    return this.getForCustomer(user, id);
  }

  /** Aviso opcional para a caixa do suporte (SUPPORT_NOTIFY_EMAIL). */
  private async notifySupportTeam(user: CurrentUser, number: number, subject: string, body: string) {
    const to = this.config.get<string>('SUPPORT_NOTIFY_EMAIL');
    if (!to) return;
    const tenant = await this.prisma.tenant.findUnique({ where: { id: user.tenantId }, select: { name: true } });
    const text = `Chamado #${number} de ${user.name} (${user.email}) — ${tenant?.name ?? ''}\n\n${subject}\n\n${body}`;
    await this.email.send({ to, subject: `[Chamado #${number}] ${subject}`, text, html: text.split('\n').map((l) => `<p>${l}</p>`).join('') });
  }

  // ── Console ─────────────────────────────────────────────────────────────

  async staffList(query: { status?: string; priority?: string; tenantId?: string; assigned?: string; search?: string; page?: number }, staff: PlatformStaffPrincipal) {
    const page = Math.max(1, query.page ?? 1);
    const take = 30;
    const statusFilter: Prisma.SupportTicketWhereInput =
      query.status === 'active' ? { status: { in: ['OPEN', 'WAITING_CUSTOMER'] } }
        : query.status && query.status in SupportTicketStatus ? { status: query.status as SupportTicketStatus } : {};
    const num = Number(query.search?.replace(/^#/, ''));
    const where: Prisma.SupportTicketWhereInput = {
      ...statusFilter,
      ...(query.priority && query.priority in SupportTicketPriority ? { priority: query.priority as SupportTicketPriority } : {}),
      ...(query.tenantId ? { tenantId: query.tenantId } : {}),
      ...(query.assigned === 'me' ? { assignedStaffId: staff.id } : query.assigned === 'none' ? { assignedStaffId: null } : {}),
      ...(query.search
        ? {
            OR: [
              { subject: { contains: query.search, mode: 'insensitive' } },
              { createdByEmail: { contains: query.search, mode: 'insensitive' } },
              { tenant: { name: { contains: query.search, mode: 'insensitive' } } },
              ...(Number.isInteger(num) && num > 0 ? [{ number: num }] : []),
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.supportTicket.findMany({
        where,
        // Quem espera o suporte primeiro, mais urgentes primeiro, depois os mais antigos.
        orderBy: [{ status: 'asc' }, { priority: 'desc' }, { lastMessageAt: 'asc' }],
        skip: (page - 1) * take, take,
        select: { ...LIST_SELECT, tenant: { select: { id: true, name: true, slug: true } } },
      }),
      this.prisma.supportTicket.count({ where }),
    ]);
    const staffIds = [...new Set(rows.map((r) => r.assignedStaffId).filter((x): x is string => !!x))];
    const names = new Map((await this.prisma.platformStaff.findMany({ where: { id: { in: staffIds } }, select: { id: true, name: true } })).map((s) => [s.id, s.name]));
    return {
      data: rows.map((r) => ({ ...r, assignedStaffName: r.assignedStaffId ? names.get(r.assignedStaffId) ?? null : null })),
      meta: { total, page, totalPages: Math.ceil(total / take) },
    };
  }

  async staffCounts(staff: PlatformStaffPrincipal) {
    const [open, mine, unassigned] = await Promise.all([
      this.prisma.supportTicket.count({ where: { status: 'OPEN' } }),
      this.prisma.supportTicket.count({ where: { status: 'OPEN', assignedStaffId: staff.id } }),
      this.prisma.supportTicket.count({ where: { status: 'OPEN', assignedStaffId: null } }),
    ]);
    return { open, mine, unassigned };
  }

  async staffGet(id: string) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id },
      select: {
        ...LIST_SELECT,
        tenant: { select: { id: true, name: true, slug: true, lifecycle: true, plan: { select: { name: true } } } },
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!ticket) throw new NotFoundException('Chamado nao encontrado');
    return ticket;
  }

  async staffReply(staff: PlatformStaffPrincipal, id: string, body: string, internal: boolean) {
    const ticket = await this.staffGet(id);
    await this.prisma.$transaction([
      this.prisma.supportMessage.create({ data: { ticketId: id, authorType: 'staff', authorStaffId: staff.id, authorName: staff.name, body: body.trim(), internal } }),
      ...(internal ? [] : [this.prisma.supportTicket.update({
        where: { id },
        data: {
          status: ticket.status === 'CLOSED' || ticket.status === 'RESOLVED' ? ticket.status : 'WAITING_CUSTOMER',
          lastMessageAt: new Date(), lastMessageBy: 'staff',
          ...(ticket.assignedStaffId ? {} : { assignedStaffId: staff.id }),
        },
      })]),
    ]);
    if (!internal) this.tellCustomer(ticket.tenant.id, ticket.createdById, ticket.createdByEmail, id, ticket.number, ticket.subject, body).catch(() => {});
    this.audit.log(staff, { action: internal ? 'support.note' : 'support.reply', targetType: 'support_ticket', targetId: id, tenantId: ticket.tenant.id }).catch(() => {});
    return this.staffGet(id);
  }

  async staffUpdate(staff: PlatformStaffPrincipal, id: string, dto: { status?: SupportTicketStatus; priority?: SupportTicketPriority; assignedStaffId?: string | null }) {
    const ticket = await this.staffGet(id);
    if (dto.assignedStaffId) {
      const exists = await this.prisma.platformStaff.findFirst({ where: { id: dto.assignedStaffId, deletedAt: null } });
      if (!exists) throw new BadRequestException('Pessoa da equipe nao encontrada');
    }
    const data: Prisma.SupportTicketUpdateInput = {};
    const notes: Prisma.SupportMessageCreateManyInput[] = [];
    if (dto.status && dto.status !== ticket.status) {
      data.status = dto.status;
      data.closedAt = dto.status === 'RESOLVED' || dto.status === 'CLOSED' ? new Date() : null;
      notes.push({ ticketId: id, authorType: 'system', authorStaffId: staff.id, authorName: staff.name, body: `status:${dto.status}` });
    }
    if (dto.priority && dto.priority !== ticket.priority) data.priority = dto.priority;
    if (dto.assignedStaffId !== undefined && dto.assignedStaffId !== ticket.assignedStaffId) {
      data.assignedStaffId = dto.assignedStaffId;
      notes.push({ ticketId: id, authorType: 'system', authorStaffId: staff.id, authorName: staff.name, body: `assigned:${dto.assignedStaffId ?? ''}`, internal: true });
    }
    if (Object.keys(data).length === 0) return ticket;
    await this.prisma.$transaction([
      this.prisma.supportTicket.update({ where: { id }, data }),
      ...(notes.length ? [this.prisma.supportMessage.createMany({ data: notes })] : []),
    ]);
    if (dto.status === 'RESOLVED' && ticket.createdById) {
      this.notifications.notifyUser(ticket.createdById, {
        type: 'success', title: `Chamado #${ticket.number} resolvido`, message: ticket.subject,
        data: { supportTicketId: id },
      }, ticket.tenant.id).catch(() => {});
    }
    this.audit.log(staff, { action: 'support.update', targetType: 'support_ticket', targetId: id, tenantId: ticket.tenant.id, metadata: { ...dto } }).catch(() => {});
    return this.staffGet(id);
  }

  private async tellCustomer(tenantId: string, userId: string | null, email: string, ticketId: string, number: number, subject: string, body: string) {
    if (userId) {
      await this.notifications.notifyUser(userId, {
        type: 'info', title: `Resposta do suporte — chamado #${number}`, message: subject,
        data: { supportTicketId: ticketId, supportTicketNumber: number },
      }, tenantId);
    }
    const appUrl = this.config.get<string>('APP_URL') ?? '';
    const text = `O suporte respondeu ao seu chamado #${number} (${subject}):\n\n${body}\n\nResponda pelo sistema: ${appUrl}`;
    await this.email.send({ to: email, subject: `Re: [Chamado #${number}] ${subject}`, text, html: text.split('\n').map((l) => `<p>${l}</p>`).join('') });
  }
}
