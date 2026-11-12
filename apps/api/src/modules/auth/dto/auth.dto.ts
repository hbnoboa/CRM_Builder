import { IsEmail, IsString, MinLength, MaxLength, IsOptional, Matches, IsBoolean, ValidateIf, IsIn } from 'class-validator';
import { SOLUTION_SLUGS } from '@crm-builder/shared';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'admin@demo.com' })
  @IsEmail({}, { message: 'Email invalido' })
  email: string;

  @ApiProperty({ example: 'Admin123!' })
  @IsString()
  @MinLength(8, { message: 'Senha deve ter no minimo 8 caracteres' })
  @MaxLength(128, { message: 'Senha deve ter no maximo 128 caracteres' })
  password: string;

  @ApiPropertyOptional({ example: true, description: 'Manter sessao por mais tempo (30 dias em vez de 7)' })
  @IsBoolean()
  @IsOptional()
  rememberMe?: boolean;
}

export class RegisterDto {
  @ApiProperty({ example: 'usuario@empresa.com' })
  @IsEmail({}, { message: 'Email invalido' })
  email: string;

  @ApiProperty({ example: 'Senha123!' })
  @IsString()
  @MinLength(8, { message: 'Senha deve ter no minimo 8 caracteres' })
  @MaxLength(128, { message: 'Senha deve ter no maximo 128 caracteres' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Senha deve conter pelo menos uma letra maiuscula, uma minuscula e um numero',
  })
  password: string;

  @ApiProperty({ example: 'Joao Silva' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  // Cadastro self-service: cria uma EMPRESA nova (tenant em trial) com este
  // usuario como administrador. Nao existe mais "entrar num tenant por id".
  @ApiProperty({ example: 'Minha Empresa Ltda' })
  @IsString()
  @MinLength(2, { message: 'Nome da empresa deve ter no minimo 2 caracteres' })
  @MaxLength(100)
  tenantName: string;

  @ApiPropertyOptional({ description: 'Modelo de solucao para comecar (slug do catalogo)', enum: SOLUTION_SLUGS })
  @IsOptional()
  @IsIn(SOLUTION_SLUGS, { message: 'Modelo invalido' })
  modelo?: string;

  @ApiPropertyOptional({ description: 'Copiar os registros de exemplo do modelo (padrao: sim)' })
  @IsOptional()
  @IsBoolean()
  includeSamples?: boolean;
}

export class RefreshTokenDto {
  @ApiProperty()
  @IsString()
  refreshToken: string;
}

export class AuthResponseDto {
  @ApiProperty()
  accessToken: string;

  @ApiProperty()
  refreshToken: string;

  @ApiProperty()
  expiresIn: string;

  @ApiProperty()
  user: {
    id: string;
    email: string;
    name: string;
    customRoleId: string;
    customRole: {
      id: string;
      name: string;
      isSystem: boolean;
    };
    tenantId: string;
  };
}

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Joao Silva' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: 'https://example.com/avatar.jpg' })
  @IsString()
  @IsOptional()
  avatar?: string;
}

export class ChangePasswordDto {
  @ApiProperty({ example: 'SenhaAtual123!' })
  @IsString()
  @MinLength(8, { message: 'Senha atual deve ter no minimo 8 caracteres' })
  currentPassword: string;

  @ApiProperty({ example: 'NovaSenha123!' })
  @IsString()
  @MinLength(8, { message: 'Nova senha deve ter no minimo 8 caracteres' })
  @MaxLength(128, { message: 'Nova senha deve ter no maximo 128 caracteres' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Nova senha deve conter pelo menos uma letra maiuscula, uma minuscula e um numero',
  })
  newPassword: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: 'usuario@empresa.com' })
  @IsEmail({}, { message: 'Email invalido' })
  email: string;

  @ApiPropertyOptional({ description: 'ID do tenant (para ambientes multi-tenant com mesmo email)' })
  @IsString()
  @IsOptional()
  tenantId?: string;
}

export class ResetPasswordDto {
  @ApiProperty({ example: 'token_de_reset' })
  @IsString()
  token: string;

  @ApiProperty({ example: 'NovaSenha123!' })
  @IsString()
  @MinLength(8, { message: 'Nova senha deve ter no minimo 8 caracteres' })
  @MaxLength(128, { message: 'Nova senha deve ter no maximo 128 caracteres' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Nova senha deve conter pelo menos uma letra maiuscula, uma minuscula e um numero',
  })
  newPassword: string;
}

export class LoginMfaDto {
  @ApiProperty({ description: 'Token devolvido pelo /auth/login quando mfaRequired' })
  @IsString()
  mfaToken: string;

  @ApiProperty({ example: '123456', description: 'Codigo do app autenticador ou de recuperacao' })
  @IsString()
  @MinLength(6)
  @MaxLength(20)
  code: string;
}
