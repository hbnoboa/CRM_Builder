import { ApiProperty } from '@nestjs/swagger';
import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { DataFilterDto } from '../../custom-role/dto/custom-role.dto';

export class UpdateRoleFiltersDto {
  @ApiProperty({ description: 'Array de filtros para esta role', type: [DataFilterDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DataFilterDto)
  filters: DataFilterDto[];
}
