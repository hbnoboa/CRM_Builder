import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreatePlatformStaffDto,
  PlatformChangePasswordDto,
  PlatformLoginDto,
  UpdatePlatformStaffDto,
} from './dto/platform.dto';
import { PLATFORM_JWT_AUDIENCE, PlatformJwtPayload, platformJwtSecret } from './platform-jwt.strategy';
import { PlatformAuditService } from './platform-audit.service';
import { PlatformStaffPrincipal, platformPermissionsFor } from './platform-permissions';

const STAFF_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  status: true,
  lastLoginAt: true,
  createdAt: true,
} as const;

// Sessao da equipe: sem refresh token — expira e pede login de novo.
const STAFF_TOKEN_TTL = '8h';

// Hash real (gerado uma vez) para comparar quando o email nao existe: o tempo
// de resposta fica igual e nao revela quem e da equipe.
const DUMMY_HASH = bcrypt.hashSync('platform-login-dummy', 12);

@Injectable()
export class PlatformStaffService {
  private readonly logger = new Logger(PlatformStaffService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: PlatformAuditService,
  ) {}

  async login(dto: PlatformLoginDto, ip?: string) {
    const staff = await this.prisma.platformStaff.findFirst({
      where: { email: dto.email.toLowerCase(), status: 'ACTIVE', deletedAt: null },
    });
    const valid = await bcrypt.compare(dto.password, staff?.password ?? DUMMY_HASH);
    if (!staff || !valid) throw new UnauthorizedException('Credenciais invalidas');

    await this.prisma.platformStaff.update({
      where: { id: staff.id },
      data: { lastLoginAt: new Date() },
    });

    const payload: PlatformJwtPayload = { sub: staff.id, typ: 'platform' };
    const accessToken = this.jwt.sign(payload, {
      secret: platformJwtSecret(this.config),
      audience: PLATFORM_JWT_AUDIENCE,
      expiresIn: STAFF_TOKEN_TTL,
    });

    const principal = { id: staff.id, email: staff.email, name: staff.name, role: staff.role };
    await this.audit.log(principal, { action: 'staff.login', targetType: 'staff', targetId: staff.id, ip });
    this.logger.log(`Login da equipe: ${staff.email}`);

    return { accessToken, expiresIn: STAFF_TOKEN_TTL, staff: this.withPermissions(principal) };
  }

  async me(staff: PlatformStaffPrincipal) {
    return this.withPermissions(staff);
  }

  async changePassword(staff: PlatformStaffPrincipal, dto: PlatformChangePasswordDto) {
    const row = await this.prisma.platformStaff.findUnique({ where: { id: staff.id } });
    if (!row || !(await bcrypt.compare(dto.currentPassword, row.password))) {
      throw new BadRequestException('Senha atual incorreta');
    }
    await this.prisma.platformStaff.update({
      where: { id: staff.id },
      data: { password: await bcrypt.hash(dto.newPassword, 12) },
    });
    await this.audit.log(staff, { action: 'staff.password_changed', targetType: 'staff', targetId: staff.id });
    return { message: 'Senha alterada' };
  }

  findAll() {
    return this.prisma.platformStaff.findMany({
      where: { deletedAt: null },
      select: STAFF_SELECT,
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
    });
  }

  async create(actor: PlatformStaffPrincipal, dto: CreatePlatformStaffDto) {
    const email = dto.email.toLowerCase();
    const existing = await this.prisma.platformStaff.findUnique({ where: { email } });
    if (existing && !existing.deletedAt) throw new ConflictException('Email ja cadastrado na equipe');

    const data = {
      email,
      name: dto.name,
      role: dto.role,
      status: 'ACTIVE' as const,
      deletedAt: null,
      password: await bcrypt.hash(dto.password, 12),
    };
    // Email de um staff removido (soft delete) pode ser reaproveitado.
    const staff = existing
      ? await this.prisma.platformStaff.update({ where: { id: existing.id }, data, select: STAFF_SELECT })
      : await this.prisma.platformStaff.create({ data, select: STAFF_SELECT });

    await this.audit.log(actor, {
      action: 'staff.created',
      targetType: 'staff',
      targetId: staff.id,
      metadata: { email: staff.email, role: staff.role },
    });
    return staff;
  }

  async update(actor: PlatformStaffPrincipal, id: string, dto: UpdatePlatformStaffDto) {
    const target = await this.prisma.platformStaff.findFirst({ where: { id, deletedAt: null } });
    if (!target) throw new NotFoundException('Membro da equipe nao encontrado');

    if (id === actor.id && (dto.role || dto.status)) {
      throw new BadRequestException('Voce nao pode mudar o proprio cargo ou status');
    }
    const losingOwner =
      target.role === 'OWNER' &&
      ((dto.role && dto.role !== 'OWNER') || (dto.status && dto.status !== 'ACTIVE'));
    if (losingOwner) await this.assertAnotherActiveOwner(id);

    const staff = await this.prisma.platformStaff.update({
      where: { id },
      data: {
        ...(dto.name ? { name: dto.name } : {}),
        ...(dto.role ? { role: dto.role } : {}),
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.password ? { password: await bcrypt.hash(dto.password, 12) } : {}),
      },
      select: STAFF_SELECT,
    });

    await this.audit.log(actor, {
      action: 'staff.updated',
      targetType: 'staff',
      targetId: id,
      metadata: {
        ...(dto.name ? { name: dto.name } : {}),
        ...(dto.role ? { role: { from: target.role, to: dto.role } } : {}),
        ...(dto.status ? { status: { from: target.status, to: dto.status } } : {}),
        ...(dto.password ? { passwordReset: true } : {}),
      },
    });
    return staff;
  }

  async remove(actor: PlatformStaffPrincipal, id: string) {
    if (id === actor.id) throw new BadRequestException('Voce nao pode remover a si mesmo');
    const target = await this.prisma.platformStaff.findFirst({ where: { id, deletedAt: null } });
    if (!target) throw new NotFoundException('Membro da equipe nao encontrado');
    if (target.role === 'OWNER') await this.assertAnotherActiveOwner(id);

    await this.prisma.platformStaff.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'INACTIVE' },
    });
    await this.audit.log(actor, {
      action: 'staff.removed',
      targetType: 'staff',
      targetId: id,
      metadata: { email: target.email },
    });
    return { message: 'Removido da equipe' };
  }

  private async assertAnotherActiveOwner(exceptId: string) {
    const owners = await this.prisma.platformStaff.count({
      where: { role: 'OWNER', status: 'ACTIVE', deletedAt: null, id: { not: exceptId } },
    });
    if (owners === 0) throw new BadRequestException('A plataforma precisa de pelo menos um dono ativo');
  }

  private withPermissions(staff: PlatformStaffPrincipal) {
    return { ...staff, permissions: platformPermissionsFor(staff.role) };
  }
}
