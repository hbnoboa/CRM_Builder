import { Injectable, UnauthorizedException, ConflictException, BadRequestException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto, RegisterDto, RefreshTokenDto, UpdateProfileDto, ChangePasswordDto, ForgotPasswordDto, ResetPasswordDto } from './dto/auth.dto';
import { Status } from '@prisma/client';
import { RoleType } from '../../common/decorators/roles.decorator';

interface UserForTokenGeneration {
  id: string;
  email: string;
  tenantId: string;
  customRoleId: string;
  customRole: {
    roleType: string;
  };
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    // Verificar se email ja existe no tenant
    const existingUser = await this.prisma.user.findFirst({
      where: {
        email: dto.email,
        tenantId: dto.tenantId,
      },
    });

    if (existingUser) {
      throw new ConflictException('Email ja esta em uso');
    }

    // Buscar role default do tenant ou role especificada
    let customRoleId = dto.customRoleId;

    // Validar que customRoleId pertence ao tenant
    if (customRoleId) {
      const roleExists = await this.prisma.customRole.findFirst({
        where: { id: customRoleId, tenantId: dto.tenantId },
        select: { id: true },
      });
      if (!roleExists) {
        throw new BadRequestException('Role nao encontrada para este tenant');
      }
    }

    if (!customRoleId) {
      // Buscar role default (USER) do tenant
      const defaultRole = await this.prisma.customRole.findFirst({
        where: {
          tenantId: dto.tenantId,
          isDefault: true,
        },
        select: { id: true },
      });

      if (!defaultRole) {
        throw new BadRequestException('Tenant sem role default configurada');
      }

      customRoleId = defaultRole.id;
    }

    // Hash da senha
    const hashedPassword = await bcrypt.hash(dto.password, 12);

    // Criar usuario
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        name: dto.name,
        tenantId: dto.tenantId,
        customRoleId: customRoleId,
        status: Status.ACTIVE,
      },
      select: {
        id: true,
        email: true,
        name: true,
        tenantId: true,
        customRoleId: true,
        createdAt: true,
      },
    });

    this.logger.log(`Usuario registrado: ${user.email}`);
    return user;
  }

  async login(dto: LoginDto) {
    // Buscar usuario
    const user = await this.prisma.user.findFirst({
      where: {
        email: dto.email,
        status: Status.ACTIVE,
      },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
            settings: true,
          },
        },
        customRole: {
          select: {
            id: true,
            name: true,
            description: true,
            color: true,
            roleType: true,
            isSystem: true,
            permissions: true,
            modulePermissions: true,
            tenantPermissions: true,
            isDefault: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Credenciais invalidas');
    }

    // Verificar se usuario tem customRole
    if (!user.customRole || !user.customRoleId) {
      throw new UnauthorizedException('Usuario sem role definida');
    }

    // Verificar se tenant esta ativo
    if (user.tenant.status !== Status.ACTIVE) {
      throw new UnauthorizedException('Tenant suspenso ou inativo');
    }

    // Verificar senha
    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciais invalidas');
    }

    // Gerar tokens (com TTL estendido se rememberMe)
    const tokens = await this.generateTokens(user, dto.rememberMe);

    // Atualizar ultimo login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    this.logger.log(`Login: ${user.email}${dto.rememberMe ? ' (remember me)' : ''}`);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        customRoleId: user.customRoleId,
        customRole: user.customRole,
        tenantId: user.tenantId,
        tenant: user.tenant,
      },
      ...tokens,
    };
  }

  async refreshToken(dto: RefreshTokenDto) {
    try {
      // Verificar refresh token
      this.jwtService.verify(dto.refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });

      // Buscar e deletar token atomicamente para prevenir reuso
      const storedToken = await this.prisma.$transaction(async (tx) => {
        const token = await tx.refreshToken.findUnique({
          where: { token: dto.refreshToken },
          include: {
            user: {
              include: {
                tenant: true,
                customRole: {
                  select: {
                    id: true,
                    roleType: true,
                  },
                },
              },
            },
          },
        });

        if (!token || token.expiresAt < new Date()) {
          throw new UnauthorizedException('Refresh token invalido ou expirado');
        }

        // Deletar token dentro da mesma transacao
        await tx.refreshToken.delete({
          where: { id: token.id },
        });

        return token;
      });

      // Decodificar refresh token para preservar contexto (tenant switch + rememberMe)
      const decoded = this.jwtService.decode(dto.refreshToken) as { tenantId?: string; customRoleId?: string; rememberMe?: boolean } | null;
      const switchedTenantId = decoded?.tenantId;
      const wasRememberMe = decoded?.rememberMe ?? false;

      if (switchedTenantId && switchedTenantId !== storedToken.user.tenantId) {
        // Usuario esta em contexto de tenant trocado - preservar
        const access = await this.prisma.userTenantAccess.findUnique({
          where: {
            userId_tenantId: {
              userId: storedToken.user.id,
              tenantId: switchedTenantId,
            },
          },
          include: {
            customRole: { select: { id: true, roleType: true } },
          },
        });

        if (access && access.status === 'ACTIVE' && (!access.expiresAt || access.expiresAt > new Date())) {
          const tokens = await this.generateTokens({
            ...storedToken.user,
            tenantId: switchedTenantId,
            customRoleId: access.customRoleId,
            customRole: access.customRole,
          }, wasRememberMe);
          return tokens;
        }
      }

      // Gerar novos tokens com home tenant
      const tokens = await this.generateTokens(storedToken.user, wasRememberMe);

      return tokens;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Refresh token invalido');
    }
  }

  async logout(userId: string) {
    // Remover todos os refresh tokens do usuario
    await this.prisma.refreshToken.deleteMany({
      where: { userId },
    });

    return { message: 'Logout realizado com sucesso' };
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        status: true,
        tenantId: true,
        customRoleId: true,
        lastLoginAt: true,
        createdAt: true,
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
            settings: true,
          },
        },
        customRole: {
          select: {
            id: true,
            name: true,
            description: true,
            color: true,
            roleType: true,
            isSystem: true,
            permissions: true,
            modulePermissions: true,
            tenantPermissions: true,
            isDefault: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Usuario nao encontrado');
    }

    // Verificar se usuario tem acesso a outros tenants
    const accessCount = await this.prisma.userTenantAccess.count({
      where: {
        userId,
        status: 'ACTIVE',
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
    });

    return {
      ...user,
      hasMultipleTenants: accessCount > 0,
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.avatar && { avatar: dto.avatar }),
      },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        tenantId: true,
        customRoleId: true,
      },
    });

    this.logger.log(`Perfil atualizado: ${user.email}`);
    return user;
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, password: true },
    });

    if (!user) {
      throw new UnauthorizedException('Usuario nao encontrado');
    }

    const isCurrentPasswordValid = await bcrypt.compare(dto.currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      throw new BadRequestException('Senha atual incorreta');
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    this.logger.log(`Senha alterada: ${user.email}`);
    return { message: 'Senha alterada com sucesso' };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const where: any = { email: dto.email, status: Status.ACTIVE };
    if (dto.tenantId) {
      where.tenantId = dto.tenantId;
    }

    const user = await this.prisma.user.findFirst({
      where,
      select: { id: true, email: true, name: true },
    });

    // Always return success to prevent email enumeration
    if (!user) {
      return { message: 'Se o email existir, voce recebera um link de recuperacao' };
    }

    // Generate reset token (valid for 1 hour)
    const resetToken = require('crypto').randomBytes(32).toString('hex');
    const resetExpires = new Date();
    resetExpires.setHours(resetExpires.getHours() + 1);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken,
        resetTokenExpires: resetExpires,
      },
    });

    // TODO: Send email with reset link
    // In production, integrate with email service
    this.logger.log(`Reset token gerado para: ${user.email}`);

    return { message: 'Se o email existir, voce recebera um link de recuperacao' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.prisma.user.findFirst({
      where: {
        resetToken: dto.token,
        resetTokenExpires: { gt: new Date() },
        status: Status.ACTIVE,
      },
      select: { id: true, email: true },
    });

    if (!user) {
      throw new BadRequestException('Token invalido ou expirado');
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpires: null,
      },
    });

    // Invalidate all refresh tokens
    await this.prisma.refreshToken.deleteMany({
      where: { userId: user.id },
    });

    this.logger.log(`Senha resetada: ${user.email}`);
    return { message: 'Senha redefinida com sucesso' };
  }

  async switchTenant(userId: string, targetTenantId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        tenant: {
          select: { id: true, name: true, slug: true, status: true, settings: true },
        },
        customRole: {
          select: {
            id: true, name: true, description: true, color: true,
            roleType: true, isSystem: true, permissions: true,
            modulePermissions: true, tenantPermissions: true, isDefault: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Usuario nao encontrado');
    }

    // Trocar para o home tenant
    if (targetTenantId === user.tenantId) {
      const tokens = await this.generateTokens(user);
      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar: user.avatar,
          customRoleId: user.customRoleId,
          customRole: user.customRole,
          tenantId: user.tenantId,
          tenant: user.tenant,
        },
        ...tokens,
      };
    }

    // Buscar acesso ao tenant destino
    const access = await this.prisma.userTenantAccess.findUnique({
      where: {
        userId_tenantId: { userId, tenantId: targetTenantId },
      },
      include: {
        tenant: {
          select: { id: true, name: true, slug: true, status: true, settings: true },
        },
        customRole: {
          select: {
            id: true, name: true, description: true, color: true,
            roleType: true, isSystem: true, permissions: true,
            modulePermissions: true, tenantPermissions: true, isDefault: true,
          },
        },
      },
    });

    if (!access || access.status !== 'ACTIVE') {
      throw new UnauthorizedException('Sem acesso a este tenant');
    }

    if (access.expiresAt && access.expiresAt < new Date()) {
      throw new UnauthorizedException('Acesso ao tenant expirado');
    }

    if (access.tenant.status !== 'ACTIVE') {
      throw new UnauthorizedException('Tenant suspenso ou inativo');
    }

    // Gerar tokens com o tenant destino
    const tokens = await this.generateTokens({
      id: user.id,
      email: user.email,
      tenantId: targetTenantId,
      customRoleId: access.customRoleId,
      customRole: access.customRole,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        customRoleId: access.customRoleId,
        customRole: access.customRole,
        tenantId: targetTenantId,
        tenant: access.tenant,
      },
      ...tokens,
    };
  }

  async getAccessibleTenants(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        tenantId: true,
        customRoleId: true,
        tenant: {
          select: { id: true, name: true, slug: true, logo: true },
        },
        customRole: {
          select: { id: true, name: true, roleType: true },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Usuario nao encontrado');
    }

    const accessList = await this.prisma.userTenantAccess.findMany({
      where: {
        userId,
        status: 'ACTIVE',
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
      include: {
        tenant: {
          select: { id: true, name: true, slug: true, logo: true },
        },
        customRole: {
          select: { id: true, name: true, roleType: true },
        },
      },
      orderBy: { tenant: { name: 'asc' } },
    });

    return [
      {
        id: user.tenant.id,
        name: user.tenant.name,
        slug: user.tenant.slug,
        logo: user.tenant.logo,
        isHome: true,
        customRole: {
          id: user.customRole.id,
          name: user.customRole.name,
          roleType: user.customRole.roleType,
        },
      },
      ...accessList.map((a) => ({
        id: a.tenant.id,
        name: a.tenant.name,
        slug: a.tenant.slug,
        logo: a.tenant.logo,
        isHome: false,
        customRole: {
          id: a.customRole.id,
          name: a.customRole.name,
          roleType: a.customRole.roleType,
        },
      })),
    ];
  }

  private async generateTokens(user: UserForTokenGeneration, rememberMe = false) {
    const payload = {
      sub: user.id,
      tenantId: user.tenantId,
      customRoleId: user.customRoleId,
      roleType: user.customRole.roleType as RoleType,
    };

    // Access Token (duracao configuravel via JWT_EXPIRATION)
    const accessToken = this.jwtService.sign(payload);

    // Refresh Token TTL: 30 dias se rememberMe, 7 dias padrao
    const refreshDays = rememberMe ? 30 : 7;
    const refreshExpiration = new Date();
    refreshExpiration.setDate(refreshExpiration.getDate() + refreshDays);

    // Refresh Token (longa duracao) - inclui rememberMe para preservar no refresh
    const refreshPayload = { ...payload, rememberMe };
    const refreshToken = this.jwtService.sign(refreshPayload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: rememberMe ? '30d' : (this.configService.get<string>('JWT_REFRESH_EXPIRATION') || '7d'),
    });

    // Salvar refresh token no banco
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt: refreshExpiration,
      },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: this.configService.get<string>('JWT_EXPIRATION') || '8h',
    };
  }
}
