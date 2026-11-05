import { chamadosManutencao } from './chamados-manutencao';
import { crmVendasB2b } from './crm-vendas-b2b';
import { ordemServico } from './ordem-servico';
import type { SolutionSpec } from './types';
import { vistoriaVeicular } from './vistoria-veicular';

/** Modelos de solucao montados por build.ts (ordem = ordem na pagina inicial). */
export const SOLUTIONS: SolutionSpec[] = [vistoriaVeicular, ordemServico, crmVendasB2b, chamadosManutencao];
