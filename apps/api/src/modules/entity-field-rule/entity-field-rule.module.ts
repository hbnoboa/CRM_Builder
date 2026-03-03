import { Module } from '@nestjs/common';
import { EntityFieldRuleService } from './entity-field-rule.service';
import { EntityFieldRuleController } from './entity-field-rule.controller';

@Module({
  controllers: [EntityFieldRuleController],
  providers: [EntityFieldRuleService],
  exports: [EntityFieldRuleService],
})
export class EntityFieldRuleModule {}
