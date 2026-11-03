import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateInvitationDto {
  @ApiProperty({ example: 'pessoa@empresa.com' })
  @IsEmail({}, { message: 'Email invalido' })
  email: string;

  @ApiPropertyOptional({ example: 'Maria Souza' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiProperty()
  @IsString()
  customRoleId: string;
}

export class AcceptInvitationDto {
  @ApiPropertyOptional({ description: 'Obrigatorio para quem ainda nao tem conta' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @ApiProperty({ description: 'Nova senha (conta nova) ou a senha atual (quem ja tem conta)' })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password: string;
}

/** Mesma regra de senha do cadastro (vale so para conta nova). */
export const NEW_PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,128}$/;
