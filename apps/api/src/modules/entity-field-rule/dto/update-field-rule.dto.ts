import { PartialType } from '@nestjs/swagger';
import { CreateFieldRuleDto } from './create-field-rule.dto';

export class UpdateFieldRuleDto extends PartialType(CreateFieldRuleDto) {}
