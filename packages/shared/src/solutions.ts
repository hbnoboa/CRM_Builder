/**
 * Catalogo dos modelos de solucao (pagina inicial e cadastro com ?modelo=).
 * Cada slug corresponde a uma empresa-modelo montada por apps/api/prisma/solutions.
 */

export interface SolutionCatalogItem {
  slug: string;
  name: string;
  /** Uma linha para o cartao. */
  tagline: string;
  /** Para quem e (segmentos). */
  audience: string;
  /** Icone lucide-react. */
  icon: string;
  color: string;
  /** Tabela principal (onde fica o painel do modelo); o cadastro abre nela. */
  rootEntity: string;
  /** Captura do painel para a pagina inicial (em apps/web-admin/public). */
  image: string;
  /** O que vem pronto. */
  includes: {
    tables: string[];
    roles: string[];
    dashboards: string[];
    documents: string[];
    commands: string[];
  };
}

export const SOLUTION_CATALOG: SolutionCatalogItem[] = [
  {
    slug: 'vistoria-veicular',
    name: 'Vistoria veicular',
    tagline: 'Checklist com fotos, não conformidades e laudo em PDF, até sem internet.',
    audience: 'Frotas, transportadoras, locadoras e oficinas',
    icon: 'Truck',
    color: '#ea580c',
    rootEntity: 'veiculos',
    image: '/home/vistoria-veicular.webp',
    includes: {
      tables: ['Veículos', 'Vistorias', 'Não conformidades'],
      roles: ['Vistoriador', 'Gestor de frota'],
      dashboards: ['Painel da frota', 'Minhas vistorias'],
      documents: ['Laudo de vistoria'],
      commands: ['/vistoria', '/pendencias'],
    },
  },
  {
    slug: 'ordem-servico',
    name: 'Ordem de serviço',
    tagline: 'Abra, agende e feche OS em campo com fotos, peças e assinatura do cliente.',
    audience: 'Assistência técnica, climatização, elétrica e manutenção',
    icon: 'Wrench',
    color: '#2563eb',
    rootEntity: 'clientes',
    image: '/home/ordem-servico.webp',
    includes: {
      tables: ['Clientes', 'Ordens de serviço', 'Peças e serviços'],
      roles: ['Técnico', 'Atendente'],
      dashboards: ['Painel de serviços', 'Minhas ordens'],
      documents: ['Ordem de serviço'],
      commands: ['/os', '/fila'],
    },
  },
  {
    slug: 'crm-vendas-b2b',
    name: 'CRM de vendas B2B',
    tagline: 'Funil por etapa, valor em negociação, atividades e proposta em PDF.',
    audience: 'Equipes comerciais, distribuidores e prestadores de serviço',
    icon: 'Target',
    color: '#7c3aed',
    rootEntity: 'empresas',
    image: '/home/crm-vendas-b2b.webp',
    includes: {
      tables: ['Empresas', 'Oportunidades', 'Atividades'],
      roles: ['Vendedor', 'Gestor comercial'],
      dashboards: ['Funil de vendas', 'Minhas vendas'],
      documents: ['Proposta comercial'],
      commands: ['/oportunidade', '/negociacao'],
    },
  },
  {
    slug: 'chamados-manutencao',
    name: 'Chamados e manutenção',
    tagline: 'Chamados com prioridade e prazo, horas apontadas e histórico por equipamento.',
    audience: 'Facilities, indústrias, condomínios, escolas e hospitais',
    icon: 'LifeBuoy',
    color: '#0d9488',
    rootEntity: 'ativos',
    image: '/home/chamados-manutencao.webp',
    includes: {
      tables: ['Ativos', 'Chamados', 'Apontamentos'],
      roles: ['Solicitante', 'Técnico de manutenção'],
      dashboards: ['Central de chamados', 'Meus chamados'],
      documents: ['Relatório de atendimento'],
      commands: ['/chamado', '/abertos'],
    },
  },
];

export const SOLUTION_SLUGS = SOLUTION_CATALOG.map((s) => s.slug);

/** Dono da empresa-modelo (as empresas-modelo sao achadas por ele). */
export function solutionOwnerEmail(slug: string): string {
  return `modelos+${slug}@iossystem.com.br`;
}
