import { test, expect } from '@playwright/test';
import { API, call, createTenant, ownerStaff, type Session, type Tenant } from './helpers';

// Dominio proprio do site. A API de teste roda com DOMAIN_DNS_CHECK=mock (conta como
// apontado o endereco terminado em ".ok.test") e DOMAIN_REGISTRAR=mock (registrador de
// teste: "ocupado" no nome = indisponivel, "falha" = o registro falha).

const CPF_VALIDO = '529.982.247-25';
const TITULAR = { name: 'Maria Teste', document: CPF_VALIDO, email: 'maria.teste@example.com', phone: '(11) 99999-0000' };

test.describe.serial('dominio proprio do site', () => {
  let tenant: Tenant;
  let other: Tenant;
  let staff: Session;
  let suffix = '';

  test.beforeAll(async ({ request }) => {
    staff = await ownerStaff(request);
    tenant = await createTenant(request, staff);
    other = await createTenant(request, staff);
    suffix = tenant.slug.replace(/[^a-z0-9]/g, '').slice(-8);
    const page = await (await call(request, 'post', '/site-pages', tenant.owner, { expected: [200, 201], data: { title: 'Início', template: 'blank' } })).json();
    await call(request, 'patch', `/site-pages/${page.id}`, tenant.owner, { expected: 200, data: { slug: 'inicio', blocks: [{ type: 'heading', text: 'Olá' }] } });
    await call(request, 'post', `/site-pages/${page.id}/publish`, tenant.owner, { expected: [200, 201], data: { publish: true } });
  });

  test('ligar dominio: valida o endereco, confere o DNS e vira o principal', async ({ request }) => {
    expect(await (await call(request, 'post', '/site-domains', tenant.owner, { expected: 400, data: { hostname: 'nao e dominio' } })).text()).toContain('endereço válido');
    expect(await (await call(request, 'post', '/site-domains', tenant.owner, { expected: 400, data: { hostname: 'loja.iossystem.com.br' } })).text()).toContain('plataforma');

    const pending = await (await call(request, 'post', '/site-domains', tenant.owner, { expected: [200, 201], data: { hostname: `https://www.pendente${suffix}.test/qualquer` } })).json();
    expect(pending).toMatchObject({ hostname: `www.pendente${suffix}.test`, status: 'pending_dns', isPrimary: false });
    expect(pending.lastError).toBeTruthy();

    const ok = await (await call(request, 'post', '/site-domains', tenant.owner, { expected: [200, 201], data: { hostname: `www.cafe${suffix}.ok.test` } })).json();
    expect(ok).toMatchObject({ status: 'active', isPrimary: true });

    // Mesmo endereco em outra empresa: recusado
    expect(await (await call(request, 'post', '/site-domains', other.owner, { expected: 409, data: { hostname: `www.cafe${suffix}.ok.test` } })).text()).toContain('outra empresa');
    // Pendente nao pode ser principal
    await call(request, 'patch', `/site-domains/${pending.id}`, tenant.owner, { expected: 400, data: { isPrimary: true } });

    const overview = await (await call(request, 'get', '/site-domains', tenant.owner, { expected: 200 })).json();
    expect(overview.dns.cname).toBeTruthy();
    expect(overview.domains).toHaveLength(2);
    // Outra empresa nao ve os dominios desta
    expect((await (await call(request, 'get', '/site-domains', other.owner, { expected: 200 })).json()).domains).toHaveLength(0);
  });

  test('o site responde no dominio: resolucao publica, certificado e links das paginas', async ({ request }) => {
    const resolved = await request.get(`${API}/public/domains/resolve?host=www.cafe${suffix}.ok.test`);
    expect(resolved.status()).toBe(200);
    expect((await resolved.json()).tenant).toBe(tenant.slug);
    // Pendente ainda nao abre o site, mas ja pode receber certificado
    expect((await request.get(`${API}/public/domains/resolve?host=www.pendente${suffix}.test`)).status()).toBe(404);
    expect((await request.get(`${API}/public/domains/tls?domain=www.pendente${suffix}.test`)).status()).toBe(200);
    expect((await request.get(`${API}/public/domains/tls?domain=qualquer-coisa${suffix}.com`)).status()).toBe(404);

    const pages = await (await call(request, 'get', '/site-pages', tenant.owner, { expected: 200 })).json();
    expect(pages[0].url).toBe(`https://www.cafe${suffix}.ok.test/inicio`);
  });

  test('comprar dominio: busca, pedido, pagamento marcado no console e ligacao automatica', async ({ request }) => {
    const search = await (await call(request, 'get', `/site-domains/search?q=${encodeURIComponent(`Meu Café ${suffix}`)}`, tenant.owner, { expected: 200 })).json();
    expect(search.testMode).toBe(true);
    const wanted = `meucafe${suffix}.com.br`;
    expect(search.results.find((r: { hostname: string }) => r.hostname === wanted)).toMatchObject({ available: true, priceCents: 4000 });
    const busy = await (await call(request, 'get', '/site-domains/search?q=ocupado', tenant.owner, { expected: 200 })).json();
    expect(busy.results.every((r: { available: boolean }) => !r.available)).toBe(true);

    expect(await (await call(request, 'post', '/site-domains/orders', tenant.owner, { expected: 400, data: { hostname: wanted, registrant: { ...TITULAR, document: '111.111.111-11' } } })).text()).toContain('CPF ou CNPJ');

    const order = await (await call(request, 'post', '/site-domains/orders', tenant.owner, { expected: [200, 201], data: { hostname: wanted, years: 2, registrant: TITULAR } })).json();
    expect(order).toMatchObject({ status: 'awaiting_payment', years: 2, priceCents: 8000, provider: 'mock' });
    // Ja pedido: nao pode pedir de novo
    await call(request, 'post', '/site-domains/orders', other.owner, { expected: 409, data: { hostname: wanted, registrant: TITULAR } });

    // Empresa nao entra no console
    expect([401, 403]).toContain((await call(request, 'get', '/platform/domain-orders', tenant.owner)).status());

    const list = await (await call(request, 'get', '/platform/domain-orders?status=awaiting_payment', staff, { expected: 200 })).json();
    expect(list.find((o: { id: string }) => o.id === order.id)?.tenant?.slug).toBe(tenant.slug);

    const paid = await (await call(request, 'post', `/platform/domain-orders/${order.id}/mark-paid`, staff, { expected: 200, data: { notes: 'Pix recebido (teste)' } })).json();
    expect(paid).toMatchObject({ status: 'registered', paidByStaff: expect.any(String) });
    expect(paid.expiresAt).toBeTruthy();

    const overview = await (await call(request, 'get', '/site-domains', tenant.owner, { expected: 200 })).json();
    expect(overview.domains.find((d: { hostname: string }) => d.hostname === wanted)).toMatchObject({ kind: 'purchased', status: 'active' });
    expect((await request.get(`${API}/public/domains/resolve?host=${wanted}`)).status()).toBe(200);
  });

  test('pedido que falha no registrador e cancelamento', async ({ request }) => {
    const bad = await (await call(request, 'post', '/site-domains/orders', tenant.owner, { expected: [200, 201], data: { hostname: `falha${suffix}.com`, registrant: TITULAR } })).json();
    const failed = await (await call(request, 'post', `/platform/domain-orders/${bad.id}/mark-paid`, staff, { expected: 200 })).json();
    expect(failed.status).toBe('failed');
    expect(failed.lastError).toContain('recusou');
    await call(request, 'post', `/platform/domain-orders/${bad.id}/cancel`, staff, { expected: 200 });

    const mine = await (await call(request, 'post', '/site-domains/orders', tenant.owner, { expected: [200, 201], data: { hostname: `outro${suffix}.net`, registrant: TITULAR } })).json();
    expect((await (await call(request, 'post', `/site-domains/orders/${mine.id}/cancel`, tenant.owner, { expected: 200 })).json()).status).toBe('cancelled');
    // Cancelado nao volta a aguardar pagamento
    await call(request, 'post', `/platform/domain-orders/${mine.id}/mark-paid`, staff, { expected: 400 });
  });

  test('desligar o principal passa o posto para outro dominio ativo', async ({ request }) => {
    const second = await (await call(request, 'post', '/site-domains', tenant.owner, { expected: [200, 201], data: { hostname: `loja${suffix}.ok.test` } })).json();
    expect(second.status).toBe('active');
    const overview = await (await call(request, 'get', '/site-domains', tenant.owner, { expected: 200 })).json();
    const primary = overview.domains.find((d: { isPrimary: boolean }) => d.isPrimary);
    await call(request, 'delete', `/site-domains/${primary.id}`, tenant.owner, { expected: 200 });
    const after = await (await call(request, 'get', '/site-domains', tenant.owner, { expected: 200 })).json();
    expect(after.domains.filter((d: { isPrimary: boolean }) => d.isPrimary)).toHaveLength(1);
    expect(after.domains.find((d: { id: string }) => d.id === primary.id)).toBeUndefined();
  });
});
