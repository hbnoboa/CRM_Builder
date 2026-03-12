import { Module } from '@nestjs/common';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';
import { CustomRoleModule } from '../custom-role/custom-role.module';
import { EntityDataQueryModule } from '../../common/services/entity-data-query.module';

@Module({
  imports: [CustomRoleModule, EntityDataQueryModule],
  controllers: [StatsController],
  providers: [StatsService],
  exports: [StatsService],
})
export class StatsModule {}
