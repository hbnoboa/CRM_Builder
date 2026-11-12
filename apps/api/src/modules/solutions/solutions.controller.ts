import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SolutionsService } from './solutions.service';

@ApiTags('Solutions')
@Controller('solutions')
export class SolutionsController {
  constructor(private readonly solutions: SolutionsService) {}

  @Get()
  @ApiOperation({ summary: 'Modelos de solucao para a pagina inicial e o cadastro (publico)' })
  list() {
    return this.solutions.list();
  }
}
