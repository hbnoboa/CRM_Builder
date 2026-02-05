/**
 * Seed para Custom APIs dos modulos iOS Sinistros e iOS Car API
 *
 * Este arquivo cria todas as Custom APIs necessarias para os dropdowns
 * e selects das paginas de sinistros e veiculos.
 */

import { PrismaClient, HttpMethod, AuthType } from '@prisma/client';

const prisma = new PrismaClient();

// ============================================================================
// DEFINICOES DE CUSTOM APIS
// ============================================================================

interface CustomApiDefinition {
  name: string;
  description: string;
  path: string;
  method: HttpMethod;
  mode: 'visual' | 'code';
  sourceEntitySlug?: string;
  selectedFields?: string[];
  orderBy?: { field: string; direction: 'asc' | 'desc' };
  limitRecords?: number;
  logic?: string;
  auth?: AuthType;
}

// ============================================================================
// APIs do Modulo SINISTROS
// ============================================================================

const sinistrosVisualApis: CustomApiDefinition[] = [
  {
    name: 'Listar Corretores',
    description: 'Lista corretores para select',
    path: '/corretores',
    method: HttpMethod.GET,
    mode: 'visual',
    sourceEntitySlug: 'corretor',
    selectedFields: ['email', 'city'],
    orderBy: { field: 'email', direction: 'asc' },
  },
  {
    name: 'Listar Seguradoras',
    description: 'Lista seguradoras para select',
    path: '/seguradoras',
    method: HttpMethod.GET,
    mode: 'visual',
    sourceEntitySlug: 'seguradora',
    selectedFields: ['company_name', 'cnpj'],
    orderBy: { field: 'company_name', direction: 'asc' },
  },
  {
    name: 'Listar Segurados',
    description: 'Lista segurados para select',
    path: '/segurados',
    method: HttpMethod.GET,
    mode: 'visual',
    sourceEntitySlug: 'segurado',
    selectedFields: ['company_name', 'fantasy_name', 'cnpj'],
    orderBy: { field: 'company_name', direction: 'asc' },
  },
  {
    name: 'Listar Reguladoras',
    description: 'Lista reguladoras para select',
    path: '/reguladoras',
    method: HttpMethod.GET,
    mode: 'visual',
    sourceEntitySlug: 'reguladora',
    selectedFields: ['name', 'cnpj'],
    orderBy: { field: 'name', direction: 'asc' },
  },
  {
    name: 'Listar Gerenciadoras de Risco',
    description: 'Lista gerenciadoras de risco para select',
    path: '/gerenciadoras-risco',
    method: HttpMethod.GET,
    mode: 'visual',
    sourceEntitySlug: 'gerenciadora-risco',
    selectedFields: ['name', 'cnpj'],
    orderBy: { field: 'name', direction: 'asc' },
  },
  {
    name: 'Listar Transportadoras',
    description: 'Lista transportadoras para select',
    path: '/transportadoras',
    method: HttpMethod.GET,
    mode: 'visual',
    sourceEntitySlug: 'transportadora',
    selectedFields: ['company_name', 'cnpj_cpf'],
    orderBy: { field: 'company_name', direction: 'asc' },
  },
  {
    name: 'Listar Categorias de Documento',
    description: 'Lista categorias de documento para select',
    path: '/categorias-documento',
    method: HttpMethod.GET,
    mode: 'visual',
    sourceEntitySlug: 'categoria-documento',
    selectedFields: ['name', 'code'],
    orderBy: { field: 'name', direction: 'asc' },
  },
];

const sinistrosCodeApis: CustomApiDefinition[] = [
  {
    name: 'Listar Estados do Brasil',
    description: 'Retorna lista de estados brasileiros',
    path: '/estados',
    method: HttpMethod.GET,
    mode: 'code',
    auth: AuthType.NONE,
    logic: `
const estados = [
  { sigla: 'AC', nome: 'Acre' },
  { sigla: 'AL', nome: 'Alagoas' },
  { sigla: 'AP', nome: 'Amapa' },
  { sigla: 'AM', nome: 'Amazonas' },
  { sigla: 'BA', nome: 'Bahia' },
  { sigla: 'CE', nome: 'Ceara' },
  { sigla: 'DF', nome: 'Distrito Federal' },
  { sigla: 'ES', nome: 'Espirito Santo' },
  { sigla: 'GO', nome: 'Goias' },
  { sigla: 'MA', nome: 'Maranhao' },
  { sigla: 'MT', nome: 'Mato Grosso' },
  { sigla: 'MS', nome: 'Mato Grosso do Sul' },
  { sigla: 'MG', nome: 'Minas Gerais' },
  { sigla: 'PA', nome: 'Para' },
  { sigla: 'PB', nome: 'Paraiba' },
  { sigla: 'PR', nome: 'Parana' },
  { sigla: 'PE', nome: 'Pernambuco' },
  { sigla: 'PI', nome: 'Piaui' },
  { sigla: 'RJ', nome: 'Rio de Janeiro' },
  { sigla: 'RN', nome: 'Rio Grande do Norte' },
  { sigla: 'RS', nome: 'Rio Grande do Sul' },
  { sigla: 'RO', nome: 'Rondonia' },
  { sigla: 'RR', nome: 'Roraima' },
  { sigla: 'SC', nome: 'Santa Catarina' },
  { sigla: 'SP', nome: 'Sao Paulo' },
  { sigla: 'SE', nome: 'Sergipe' },
  { sigla: 'TO', nome: 'Tocantins' },
];
return estados.map(e => ({ value: e.sigla, label: e.nome, sigla: e.sigla, nome: e.nome }));
`,
  },
  {
    name: 'Sinistros por Status',
    description: 'Retorna contagem de sinistros por status',
    path: '/sinistros/por-status',
    method: HttpMethod.GET,
    mode: 'code',
    logic: `
const sinistroEntity = await db.entity.findFirst({ where: { slug: 'sinistro', tenantId } });
if (!sinistroEntity) return { error: 'Entity not found' };
const sinistros = await db.entityData.findMany({
  where: { tenantId, entityId: sinistroEntity.id },
  select: { data: true },
});
const statusCount = {};
for (const s of sinistros) {
  const status = s.data?.status || 'sem_status';
  statusCount[status] = (statusCount[status] || 0) + 1;
}
return Object.entries(statusCount).map(([status, count]) => ({ status, count }));
`,
  },
  {
    name: 'Follow-ups por Sinistro',
    description: 'Retorna follow-ups de um sinistro',
    path: '/sinistro/:id/followups',
    method: HttpMethod.GET,
    mode: 'code',
    logic: `
const entity = await db.entity.findFirst({ where: { slug: 'sinistro-followup', tenantId } });
if (!entity) return { error: 'Entity not found' };
const followups = await db.entityData.findMany({
  where: { tenantId, entityId: entity.id, data: { path: ['sinistro_id'], equals: params.id } },
  orderBy: { createdAt: 'desc' },
});
return followups.map(f => ({ id: f.id, ...f.data, createdAt: f.createdAt }));
`,
  },
  {
    name: 'Arquivos por Sinistro',
    description: 'Retorna arquivos de um sinistro',
    path: '/sinistro/:id/arquivos',
    method: HttpMethod.GET,
    mode: 'code',
    logic: `
const entity = await db.entity.findFirst({ where: { slug: 'sinistro-arquivo', tenantId } });
if (!entity) return { error: 'Entity not found' };
const arquivos = await db.entityData.findMany({
  where: { tenantId, entityId: entity.id, data: { path: ['sinistro_id'], equals: params.id } },
  orderBy: { createdAt: 'desc' },
});
return arquivos.map(a => ({ id: a.id, ...a.data, createdAt: a.createdAt }));
`,
  },
];

// ============================================================================
// APIs do Modulo VEICULOS
// ============================================================================

const veiculosVisualApis: CustomApiDefinition[] = [
  {
    name: 'Listar Pecas de Veiculo',
    description: 'Lista pecas de veiculo para select',
    path: '/pecas-veiculo',
    method: HttpMethod.GET,
    mode: 'visual',
    sourceEntitySlug: 'peca-veiculo',
    selectedFields: ['area', 'name'],
    orderBy: { field: 'area', direction: 'asc' },
  },
  {
    name: 'Listar Tipos de Nao Conformidade',
    description: 'Lista tipos de NC para select',
    path: '/tipos-nao-conformidade',
    method: HttpMethod.GET,
    mode: 'visual',
    sourceEntitySlug: 'tipo-nao-conformidade',
    selectedFields: ['nctype'],
    orderBy: { field: 'nctype', direction: 'asc' },
  },
  {
    name: 'Listar Niveis de Nao Conformidade',
    description: 'Lista niveis de NC para select',
    path: '/niveis-nao-conformidade',
    method: HttpMethod.GET,
    mode: 'visual',
    sourceEntitySlug: 'nivel-nao-conformidade',
    selectedFields: ['level'],
    orderBy: { field: 'level', direction: 'asc' },
  },
  {
    name: 'Listar Quadrantes',
    description: 'Lista quadrantes para select',
    path: '/quadrantes',
    method: HttpMethod.GET,
    mode: 'visual',
    sourceEntitySlug: 'quadrante',
    selectedFields: ['option'],
    orderBy: { field: 'option', direction: 'asc' },
  },
  {
    name: 'Listar Medidas',
    description: 'Lista medidas para select',
    path: '/medidas',
    method: HttpMethod.GET,
    mode: 'visual',
    sourceEntitySlug: 'medida',
    selectedFields: ['size'],
    orderBy: { field: 'size', direction: 'asc' },
  },
  {
    name: 'Listar Locais de Nao Conformidade',
    description: 'Lista locais de NC para select',
    path: '/locais-nao-conformidade',
    method: HttpMethod.GET,
    mode: 'visual',
    sourceEntitySlug: 'local-nao-conformidade',
    selectedFields: ['local'],
    orderBy: { field: 'local', direction: 'asc' },
  },
];

const veiculosCodeApis: CustomApiDefinition[] = [
  {
    name: 'Listar Navios e Viagens',
    description: 'Retorna combinacoes unicas de navio-viagem',
    path: '/navios-viagens',
    method: HttpMethod.GET,
    mode: 'code',
    logic: `
const veiculoEntity = await db.entity.findFirst({ where: { slug: 'veiculo', tenantId } });
if (!veiculoEntity) return [];
const veiculos = await db.entityData.findMany({
  where: { tenantId, entityId: veiculoEntity.id },
  select: { data: true },
});
const combos = new Set();
const result = [];
for (const v of veiculos) {
  const ship = v.data?.ship;
  const travel = v.data?.travel;
  if (ship && travel) {
    const key = ship + '-' + travel;
    if (!combos.has(key)) {
      combos.add(key);
      result.push({ value: key, label: ship + ' - ' + travel, ship, travel });
    }
  }
}
return result.sort((a, b) => a.label.localeCompare(b.label));
`,
  },
  {
    name: 'Status de Conclusao',
    description: 'Retorna opcoes Sim/Nao',
    path: '/veiculos-status-done',
    method: HttpMethod.GET,
    mode: 'code',
    auth: AuthType.NONE,
    logic: `return [{ value: 'yes', label: 'Sim' }, { value: 'no', label: 'Nao' }];`,
  },
  {
    name: 'Veiculos por Status',
    description: 'Retorna contagem de veiculos por status',
    path: '/veiculos/por-status',
    method: HttpMethod.GET,
    mode: 'code',
    logic: `
const veiculoEntity = await db.entity.findFirst({ where: { slug: 'veiculo', tenantId } });
if (!veiculoEntity) return { error: 'Entity not found' };
const veiculos = await db.entityData.findMany({
  where: { tenantId, entityId: veiculoEntity.id },
  select: { data: true },
});
const statusCount = {};
for (const v of veiculos) {
  const status = v.data?.status || 'sem_status';
  statusCount[status] = (statusCount[status] || 0) + 1;
}
return Object.entries(statusCount).map(([status, count]) => ({ status, count }));
`,
  },
  {
    name: 'Nao Conformidades por Veiculo',
    description: 'Retorna NCs de um veiculo',
    path: '/veiculo/:id/nao-conformidades',
    method: HttpMethod.GET,
    mode: 'code',
    logic: `
const entity = await db.entity.findFirst({ where: { slug: 'nao-conformidade', tenantId } });
if (!entity) return { error: 'Entity not found' };
const ncs = await db.entityData.findMany({
  where: { tenantId, entityId: entity.id, data: { path: ['veiculo_id'], equals: params.id } },
});
return ncs.map(nc => ({ id: nc.id, ...nc.data, createdAt: nc.createdAt }));
`,
  },
];

// ============================================================================
// FUNCOES DE SEED
// ============================================================================

async function createApi(tenantId: string, apiDef: CustomApiDefinition, entityIdMap: Record<string, string>) {
  const sourceEntityId = apiDef.sourceEntitySlug ? entityIdMap[apiDef.sourceEntitySlug] : undefined;

  if (apiDef.sourceEntitySlug && !sourceEntityId) {
    console.log(`    SKIP: ${apiDef.name} (entity ${apiDef.sourceEntitySlug} nao encontrada)`);
    return false;
  }

  await prisma.customEndpoint.upsert({
    where: {
      tenantId_path_method: { tenantId, path: apiDef.path, method: apiDef.method },
    },
    update: {},
    create: {
      tenantId,
      name: apiDef.name,
      description: apiDef.description,
      path: apiDef.path,
      method: apiDef.method,
      mode: apiDef.mode,
      sourceEntityId: sourceEntityId || null,
      selectedFields: apiDef.selectedFields || [],
      filters: [],
      queryParams: [],
      orderBy: apiDef.orderBy || null,
      limitRecords: apiDef.limitRecords || null,
      logic: apiDef.logic ? [{ code: apiDef.logic }] : [],
      auth: apiDef.auth || AuthType.JWT,
      permissions: [],
      isActive: true,
    },
  });
  console.log(`    ${apiDef.name}`);
  return true;
}

export async function seedSinistrosApis(tenantId: string, entityIdMap: Record<string, string>) {
  console.log('\n  Criando Custom APIs - Sinistros...');

  let count = 0;
  for (const apiDef of sinistrosVisualApis) {
    if (await createApi(tenantId, apiDef, entityIdMap)) count++;
  }
  for (const apiDef of sinistrosCodeApis) {
    if (await createApi(tenantId, apiDef, entityIdMap)) count++;
  }

  console.log(`  ${count} APIs criadas para Sinistros`);
  return count;
}

export async function seedVeiculosApis(tenantId: string, entityIdMap: Record<string, string>) {
  console.log('\n  Criando Custom APIs - Veiculos...');

  let count = 0;
  for (const apiDef of veiculosVisualApis) {
    if (await createApi(tenantId, apiDef, entityIdMap)) count++;
  }
  for (const apiDef of veiculosCodeApis) {
    if (await createApi(tenantId, apiDef, entityIdMap)) count++;
  }

  console.log(`  ${count} APIs criadas para Veiculos`);
  return count;
}

// Funcao legacy para compatibilidade
export async function seedCustomApis(tenantId: string, entityIdMap: Record<string, string>) {
  console.log('\n=== Iniciando seed de Custom APIs ===\n');
  const sinistrosCount = await seedSinistrosApis(tenantId, entityIdMap);
  const veiculosCount = await seedVeiculosApis(tenantId, entityIdMap);
  console.log(`\n=== Seed de Custom APIs concluido (${sinistrosCount + veiculosCount} APIs) ===\n`);
  return sinistrosCount + veiculosCount;
}

// ============================================================================
// EXECUCAO STANDALONE
// ============================================================================

async function main() {
  const demoTenant = await prisma.tenant.findUnique({ where: { slug: 'demo' } });
  if (!demoTenant) {
    console.error('Tenant "demo" nao encontrado.');
    process.exit(1);
  }

  const entities = await prisma.entity.findMany({
    where: { tenantId: demoTenant.id },
    select: { id: true, slug: true },
  });

  const entityIdMap: Record<string, string> = {};
  for (const e of entities) {
    entityIdMap[e.slug] = e.id;
  }

  await seedCustomApis(demoTenant.id, entityIdMap);
}

if (require.main === module) {
  main()
    .catch((e) => {
      console.error('Erro no seed:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
