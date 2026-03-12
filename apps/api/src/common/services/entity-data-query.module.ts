import { Module } from '@nestjs/common';
import { EntityModule } from '../../modules/entity/entity.module';
import { CustomRoleModule } from '../../modules/custom-role/custom-role.module';
import { EntityDataQueryService } from './entity-data-query.service';

@Module({
  imports: [EntityModule, CustomRoleModule],
  providers: [EntityDataQueryService],
  exports: [EntityDataQueryService],
})
export class EntityDataQueryModule {}
