import { IsEmail, IsString, MinLength, MaxLength, IsOptional, IsEnum, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

export class LoginDto {
  @ApiProperty({ example: 'admin@demo.com' })
  @IsEmail({}, { message: 'Email invalido' })
  email: string;

  @ApiProperty({ example: 'Admin123!' })
  @IsString()
  @MinLength(8, { message: 'Senha deve ter no minimo 8 caracteres' })
  @MaxLength(128, { message: 'Senha deve ter no maximo 128 caracteres' })
  password: string;
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
  name: string;

  @ApiProperty({ example: 'cuid_do_tenant' })
  @IsString()
  tenantId: string;

  @ApiPropertyOptional({ enum: UserRole, default: UserRole.USER })
  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;
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
    role: string;
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
