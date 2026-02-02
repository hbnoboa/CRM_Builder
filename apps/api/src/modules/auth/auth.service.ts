import { Injectable, UnauthorizedException, ConflictException, BadRequestException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto, RegisterDto, RefreshTokenDto, UpdateProfileDto, ChangePasswordDto, ForgotPasswordDto, ResetPasswordDto } from './dto/auth.dto';
import { UserRole, Status, User } from '@prisma/client';

interface UserForTokenGeneration {
  id: string;
  email: string;
  role: UserRole;
  tenantId: string;
  organizationId: string | null;
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
    // Verificar se email já existe no tenant
    const existingUser = await this.prisma.user.findFirst({
      where: {
        email: dto.email,
        tenantId: dto.tenantId,
      },
    });

    if (existingUser) {
      throw new ConflictException('Email já está em uso');
    }

    // Hash da senha
    const hashedPassword = await bcrypt.hash(dto.password, 12);

    // Criar usuário
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        name: dto.name,
        tenantId: dto.tenantId,
        organizationId: dto.organizationId,
        role: dto.role || UserRole.USER,
        status: Status.ACTIVE,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        tenantId: true,
        organizationId: true,
        createdAt: true,
      },
    });

    this.logger.log(`Usuário registrado: ${user.email}`);
    return user;
  }

  async login(dto: LoginDto) {
    // Buscar usuário
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
          },
        },
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        userRoles: {
          include: {
            role: {
              select: {
                id: true,
                name: true,
                permissions: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    // Verificar se tenant está ativo
    if (user.tenant.status !== Status.ACTIVE) {
      throw new UnauthorizedException('Tenant suspenso ou inativo');
    }

    // Verificar senha
    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    // Gerar tokens
    const tokens = await this.generateTokens(user);

    // Atualizar último login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Coletar todas as permissões
    const additionalPermissions = user.userRoles.flatMap(
      (ur) => ur.role.permissions as string[],
    );

    this.logger.log(`Login: ${user.email}`);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        role: user.role,
        tenantId: user.tenantId,
        organizationId: user.organizationId,
        tenant: user.tenant,
        organization: user.organization,
        additionalRoles: user.userRoles.map((ur) => ({
          id: ur.role.id,
          name: ur.role.name,
        })),
        permissions: additionalPermissions,
      },
      ...tokens,
    };
  }

  async refreshToken(dto: RefreshTokenDto) {
    try {
      // Verificar refresh token
      const payload = this.jwtService.verify(dto.refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });

      // Buscar refresh token no banco
      const storedToken = await this.prisma.refreshToken.findUnique({
        where: { token: dto.refreshToken },
        include: {
          user: {
            include: {
              tenant: true,
              organization: true,
            },
          },
        },
      });

      if (!storedToken || storedToken.expiresAt < new Date()) {
        throw new UnauthorizedException('Refresh token inválido ou expirado');
      }

      // Deletar token usado
      await this.prisma.refreshToken.delete({
        where: { id: storedToken.id },
      });

      // Gerar novos tokens
      const tokens = await this.generateTokens(storedToken.user);

      return tokens;
    } catch (error) {
      throw new UnauthorizedException('Refresh token inválido');
    }
  }

  async logout(userId: string) {
    // Remover todos os refresh tokens do usuário
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
        role: true,
        status: true,
        tenantId: true,
        organizationId: true,
        lastLoginAt: true,
        createdAt: true,
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
            plan: true,
          },
        },
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        userRoles: {
          include: {
            role: {
              select: {
                id: true,
                name: true,
                slug: true,
                permissions: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Usuário não encontrado');
    }

    // Coletar todas as permissões
    const permissions = user.userRoles.flatMap(
      (ur) => ur.role.permissions as string[],
    );

    return {
      ...user,
      additionalRoles: user.userRoles.map((ur) => ur.role),
      permissions,
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
        role: true,
        tenantId: true,
        organizationId: true,
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
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email, status: Status.ACTIVE },
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

  private async generateTokens(user: UserForTokenGeneration) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      organizationId: user.organizationId,
    };

    // Access Token (curta duração)
    const accessToken = this.jwtService.sign(payload);

    // Refresh Token (longa duração)
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRATION') || '7d',
    });

    // Calcular expiração
    const refreshExpiration = new Date();
    refreshExpiration.setDate(refreshExpiration.getDate() + 7);

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
      expiresIn: this.configService.get<string>('JWT_EXPIRATION') || '15m',
    };
  }
}
