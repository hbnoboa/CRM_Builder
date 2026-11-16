import { test, expect } from '@playwright/test';
import { call, createPerson, createTenant, listRoles, ownerStaff, type Session, type Tenant } from './helpers';

// Estatisticas calculadas no banco: regra unica dos numeros (a mesma do navegador) e o
// mesmo recorte do pipeline central (escopo do cargo).
test.describe.configure({ mode: 'serial' });

let tenant: Tenant;
let ana: Session;

const FIELDS = [
  { slug: 'nome', name: 'Nome', type: 'text' },
  { slug: 'cor', name: 'Cor', type: 'text' },
  { slug: 'valor', name: 'Valor', type: 'text' },
  { slug: 'tags', name: 'Tags', type: 'text' },
];

const get = async (request: Parameters<typeof call>[0], session: Session, path: string) =>
  (await call(request, 'get', `/stats/entity/itens/${path}`, session, { expected: 200 })).json();

test.beforeAll(async ({ request }) => {
  test.setTimeout(120_000);
  const staff = await ownerStaff(request);
  tenant = await createTenant(request, staff);
  await call(request, 'post', '/entities', tenant.owner, { expected: [200, 201], data: { name: 'Itens', slug: 'itens', fields: FIELDS } });
  const roles = await listRoles(request, tenant.owner);
  const ownRole = await (await call(request, 'post', '/custom-roles', tenant.owner, {
    expected: [200, 201],
    data: {
      name: 'QA Stats Proprios',
      modulePermissions: { data: { canRead: true, canCreate: true, canUpdate: true, canDelete: false }, dashboard: { canRead: true } },
      permissions: [{ entitySlug: 'itens', canRead: true, canCreate: true, canUpdate: true, canDelete: false, scope: 'own' }],
    },
  })).json();
  expect(roles.length).toBeGreaterThan(0);
  ana = await createPerson(request, tenant.owner, tenant.slug, 'AnaStats', ownRole.id);

  const criar = (s: Session, data: Record<string, unknown>) =>
    call(request, 'post', '/data/itens', s, { expected: [200, 201], data: { data } });
  // Dono: 4 registros com valores variados
  await criar(tenant.owner, { nome: 'a', cor: 'azul', valor: '10', tags: ['x', 'y'] });
  await criar(tenant.owner, { nome: 'b', cor: { value: 'vm', label: 'Vermelho' }, valor: 2.5, tags: ['x', 'y'] });
  await criar(tenant.owner, { nome: 'c', valor: '7abc' });
  await criar(tenant.owner, { nome: 'd', cor: 'azul', valor: 'sem numero', tags: [] });
  // Ana (escopo "so os proprios"): 1 registro
  await criar(ana, { nome: 'e', cor: 'verde', valor: '100' });
});

test('distribuicao: vazio nao conta, objeto pelo rotulo, lista item a item, "Outros" acima do limite', async ({ request }) => {
  const cores = await get(request, tenant.owner, 'field-distribution?fieldSlug=cor');
  const porValor = Object.fromEntries(cores.map((c: { value: string; label: string; count: number }) => [c.value, c]));
  expect(porValor.azul.count).toBe(2);
  expect(porValor.Vermelho.count).toBe(1); // objeto {value,label} vale pelo rotulo
  expect(porValor.verde.count).toBe(1);
  expect(porValor['(vazio)']).toBeUndefined();
  expect(porValor['']).toBeUndefined();

  const tags = await get(request, tenant.owner, 'field-distribution?fieldSlug=tags');
  expect(Object.fromEntries(tags.map((t: { value: string; count: number }) => [t.value, t.count]))).toEqual({ x: 2, y: 2 });

  const top1 = await get(request, tenant.owner, 'field-distribution?fieldSlug=cor&limit=1');
  expect(top1).toEqual([
    expect.objectContaining({ value: 'azul', count: 2 }),
    expect.objectContaining({ value: '__others__', label: 'Outros', count: 2 }),
  ]);
});

test('soma/media pela regra do parseFloat ("7abc" conta 7; texto sem numero nao conta)', async ({ request }) => {
  const agg = await get(request, tenant.owner, 'field-aggregation?fieldSlug=valor');
  expect(agg.count).toBe(4); // 10, 2.5, 7, 100
  expect(agg.sum).toBeCloseTo(119.5, 6);
  expect(agg.min).toBeCloseTo(2.5, 6);
  expect(agg.max).toBeCloseTo(100, 6);

  const grupos = await get(request, tenant.owner, `grouped-data?groupBy=cor&limit=50&aggregations=${encodeURIComponent(JSON.stringify([
    { type: 'count', alias: 'n' }, { type: 'sum', fieldSlug: 'valor', alias: 'soma' }, { type: 'distinctCount', distinctFields: ['tags'], alias: 'tiposTag' },
  ]))}`);
  const azul = grupos.find((g: { cor: string }) => g.cor === 'azul');
  expect(azul).toMatchObject({ n: 2, soma: 10, tiposTag: 2 });
});

test('contagem distinta (com filtro, "total" e o filtrado) e lista dos primeiros por campo', async ({ request }) => {
  const dist = await get(request, tenant.owner, 'distinct-count?fields=cor');
  expect(dist.total).toBe(4); // azul, Vermelho, vazio, verde
  const azuis = await get(request, tenant.owner, 'distinct-count?fields=nome&filterField=cor&filterValue=AZUL');
  expect(azuis).toMatchObject({ total: 2, totalDistinct: 5, filteredDistinct: 2 });

  const top = await get(request, tenant.owner, 'top-records?limit=3&sortBy=nome&sortOrder=asc&fields=nome');
  expect(top.map((r: { data: { nome: string } }) => r.data.nome)).toEqual(['a', 'b', 'c']);
});

test('escopo do cargo vale nas estatisticas (Ana so conta o que ela criou)', async ({ request }) => {
  const cores = await get(request, ana, 'field-distribution?fieldSlug=cor&limit=50');
  expect(cores).toEqual([expect.objectContaining({ value: 'verde', count: 1 })]);
  const agg = await get(request, ana, 'field-aggregation?fieldSlug=valor');
  expect(agg).toMatchObject({ count: 1, sum: 100 });
  const dist = await get(request, ana, 'distinct-count?fields=cor');
  expect(dist.total).toBe(1);
});

test('cache curto: gravar um registro atualiza a estatistica na hora', async ({ request }) => {
  const contar = async () => {
    const cores = await get(request, tenant.owner, 'field-distribution?fieldSlug=cor');
    return cores.find((c: { value: string }) => c.value === 'roxo')?.count ?? 0;
  };
  expect(await contar()).toBe(0);
  expect(await contar()).toBe(0); // segunda leitura vem do cache
  await call(request, 'post', '/data/itens', tenant.owner, { expected: [200, 201], data: { data: { nome: 'f', cor: 'roxo' } } });
  expect(await contar()).toBe(1);
});

test('listagem com periodo do painel (dateStart/dateEnd)', async ({ request }) => {
  const hoje = new Date().toISOString().slice(0, 10);
  const dentro = await (await call(request, 'get', `/data/itens?dateStart=${hoje}`, tenant.owner, { expected: 200 })).json();
  const fora = await (await call(request, 'get', '/data/itens?dateStart=2000-01-01&dateEnd=2000-01-02', tenant.owner, { expected: 200 })).json();
  expect(dentro.meta.total).toBeGreaterThan(0);
  expect(fora.meta.total).toBe(0);
});

test('registros ligados: conta filhos e netos de cada grupo (operacao -> veiculos -> avarias)', async ({ request }) => {
  const post = async (path: string, data: unknown) => (await call(request, 'post', path, tenant.owner, { expected: [200, 201], data })).json();
  const danos = await post('/entities', { name: 'Danos', slug: 'danos', fields: [{ slug: 'peca', name: 'peca', label: 'Peca', type: 'text' }] });
  const carros = await post('/entities', {
    name: 'Carros', slug: 'carros', fields: [
      { slug: 'chassi', name: 'chassi', label: 'Chassi', type: 'text' },
      { slug: 'danos', name: 'danos', label: 'Danos', type: 'sub-entity', subEntitySlug: 'danos', subEntityId: danos.id },
    ],
  });
  await post('/entities', {
    name: 'Ops', slug: 'ops', fields: [
      { slug: 'navio', name: 'navio', label: 'Navio', type: 'text' },
      { slug: 'carros', name: 'carros', label: 'Carros', type: 'sub-entity', subEntitySlug: 'carros', subEntityId: carros.id },
    ],
  });
  const op = async (navio: string) => (await post('/data/ops', { data: { navio } })).id as string;
  const carro = async (pai: string) => (await post('/data/carros', { data: { chassi: 'c' }, parentRecordId: pai })).id as string;
  const dano = (pai: string) => post('/data/danos', { data: { peca: 'porta' }, parentRecordId: pai });
  const [a, b, c] = [await op('Alfa'), await op('Alfa'), await op('Beta')];
  const a1 = await carro(a);
  await carro(a);
  await carro(b);
  const c1 = await carro(c);
  await dano(a1);
  await dano(a1);
  await dano(c1);

  const aggs = [
    { type: 'count', alias: 'ops' },
    { type: 'relatedCount', entitySlug: 'carros', alias: 'carros' },
    { type: 'relatedCount', entitySlug: 'danos', alias: 'avarias' },
  ];
  const linhas = await (await call(request, 'get',
    `/stats/entity/ops/grouped-data?groupBy=navio&aggregations=${encodeURIComponent(JSON.stringify(aggs))}&sortBy=navio&sortOrder=asc`,
    tenant.owner, { expected: 200 })).json();
  expect(linhas).toEqual([
    { navio: 'Alfa', ops: 2, carros: 3, avarias: 2 },
    { navio: 'Beta', ops: 1, carros: 1, avarias: 1 },
  ]);
});
