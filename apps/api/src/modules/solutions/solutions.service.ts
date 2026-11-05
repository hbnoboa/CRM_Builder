import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SOLUTION_CATALOG, solutionOwnerEmail, type SolutionCatalogItem } from '@crm-builder/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantCopyService, type CopyResult } from '../tenant/tenant-copy.service';

export interface SolutionListItem extends SolutionCatalogItem {
  /** A empresa-modelo existe neste ambiente (senao o cadastro cria empresa em branco). */
  available: boolean;
}

/**
 * Modelos de solucao: cada slug do catalogo aponta para uma empresa-modelo
 * (montada por prisma/solutions/build.ts), achada pelo e-mail do dono.
 * No cadastro, a estrutura do modelo e copiada para a empresa nova.
 */
@Injectable()
export class SolutionsService {
  private readonly logger = new Logger(SolutionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantCopy: TenantCopyService,
  ) {}

  /** E-mail do dono da empresa-modelo; SOLUTIONS_TAG aponta para uma montagem de teste. */
  private ownerEmail(slug: string): string {
    const tag = process.env.SOLUTIONS_TAG;
    return tag ? solutionOwnerEmail(slug).replace('@', `-${tag}@`) : solutionOwnerEmail(slug);
  }

  private async templateTenantId(slug: string): Promise<string | null> {
    // A empresa-modelo e a que tem esse usuario como dono (e nao foi encerrada)
    const tenant = await this.prisma.tenant.findFirst({
      where: { owner: { email: this.ownerEmail(slug) }, deletedAt: null },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
    });
    return tenant?.id ?? null;
  }

  async list(): Promise<SolutionListItem[]> {
    const ids = await Promise.all(SOLUTION_CATALOG.map((s) => this.templateTenantId(s.slug)));
    return SOLUTION_CATALOG.map((s, i) => ({ ...s, available: !!ids[i] }));
  }

  /**
   * Copia o modelo para a empresa (tabelas, cargos, paineis, PDFs publicados,
   * comandos do chat e, se pedido, os registros de exemplo). Cargos padrao
   * (Administrador, Gerente...) ja existem no destino e sao reaproveitados pelo nome.
   */
  async applyToTenant(slug: string, targetTenantId: string, includeSamples: boolean): Promise<CopyResult> {
    if (!SOLUTION_CATALOG.some((s) => s.slug === slug)) throw new NotFoundException('Modelo nao encontrado');
    const sourceTenantId = await this.templateTenantId(slug);
    if (!sourceTenantId) throw new NotFoundException(`Empresa-modelo "${slug}" nao montada neste ambiente`);

    const source = await this.tenantCopy.getCopyableData(sourceTenantId);
    const result = await this.tenantCopy.executeCopy(
      {
        sourceTenantId,
        targetTenantId,
        conflictStrategy: 'skip',
        modules: {
          roles: source.roles.map((r) => r.id),
          entities: source.entities.map((e) => ({ id: e.id, includeData: includeSamples })),
          pdfTemplates: source.pdfTemplates.map((t) => t.id),
          fieldRules: source.fieldRules.map((r) => r.id),
          dashboardTemplates: source.dashboardTemplates.map((d) => d.id),
          commandTemplates: source.commandTemplates.map((c) => c.id),
        },
      },
      { publishPdfTemplates: true },
    );
    this.logger.log(`Modelo ${slug} aplicado em ${targetTenantId}: ${JSON.stringify(result.copied)}`);
    return result;
  }
}
