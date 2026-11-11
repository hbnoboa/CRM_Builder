import { test, expect } from '@playwright/test';
import { API, PASSWORD, call, createTenant, listRoles, ownerStaff, type Session, type Tenant } from './helpers';

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

  test('login no dominio da empresa: so as contas dela entram, e o token so vale para ela', async ({ request }) => {
    const host = `entrar${suffix}.ok.test`;
    await call(request, 'post', '/site-domains', tenant.owner, { expected: [200, 201], data: { hostname: host } });

    const brand = await (await request.get(`${API}/public/domains/resolve?host=${host}`)).json();
    expect(brand).toMatchObject({ tenant: tenant.slug, name: tenant.name });

    // Dono desta empresa entra pelo dominio dela
    const ok = await request.post(`${API}/auth/login`, { headers: { Host: host }, data: { email: tenant.ownerEmail, password: PASSWORD } });
    expect(ok.status(), await ok.text()).toBe(200);
    const body = await ok.json();
    expect(body.user.tenant.slug).toBe(tenant.slug);

    // Conta de outra empresa: recusada no dominio desta
    const denied = await request.post(`${API}/auth/login`, { headers: { Host: host }, data: { email: other.ownerEmail, password: PASSWORD } });
    expect(denied.status()).toBe(401);
    expect(await denied.text()).toContain('não é desta empresa');

    // Token de outra empresa nao serve no dominio desta (nem com o cabecalho da empresa dele)
    const me = await request.get(`${API}/auth/me`, { headers: { Host: host, Authorization: `Bearer ${other.owner.token}`, 'X-Tenant-Slug': other.slug } });
    expect(me.status()).toBe(401);
    // E o token desta empresa continua valendo no endereco normal
    expect((await request.get(`${API}/auth/me`, { headers: { Authorization: `Bearer ${body.accessToken}` } })).status()).toBe(200);
  });

  test('pedir acesso pelo dominio: so entra depois de aprovado, com o cargo escolhido', async ({ request }) => {
    const host = `acesso${suffix}.ok.test`;
    await call(request, 'post', '/site-domains', tenant.owner, { expected: [200, 201], data: { hostname: host } });
    const ask = (data: Record<string, string>, h = host) => request.post(`${API}/public/access-requests`, { headers: { Host: h }, data });
    const email = `novo.${suffix}@example.com`;

    // Fora do dominio da empresa nao existe; senha fraca e recusada
    expect((await ask({ name: 'Ana Teste', email, password: PASSWORD }, '127.0.0.1')).status()).toBe(400);
    expect((await ask({ name: 'Ana Teste', email, password: 'fraca123' })).status()).toBe(400);

    const sent = await ask({ name: 'Ana Teste', email, password: PASSWORD });
    expect(sent.status(), await sent.text()).toBe(201);
    expect((await sent.json()).message).toContain('Pedido enviado');
    // Antes de aprovar, nao entra
    expect((await request.post(`${API}/auth/login`, { headers: { Host: host }, data: { email, password: PASSWORD } })).status()).toBe(401);

    const pending = await (await call(request, 'get', '/access-requests', tenant.owner, { expected: 200 })).json();
    const mine = pending.find((r: { email: string }) => r.email === email);
    expect(mine).toBeTruthy();
    // Outra empresa nao ve os pedidos desta
    expect((await (await call(request, 'get', '/access-requests', other.owner, { expected: 200 })).json()).some((r: { email: string }) => r.email === email)).toBe(false);

    const roles = await listRoles(request, tenant.owner);
    const operador = roles.find((r) => /operador/i.test(r.name)) ?? roles[roles.length - 1];
    await call(request, 'post', `/access-requests/${mine.id}/approve`, tenant.owner, { expected: 200, data: { customRoleId: operador.id } });

    const login = await request.post(`${API}/auth/login`, { headers: { Host: host }, data: { email, password: PASSWORD } });
    expect(login.status(), await login.text()).toBe(200);
    expect((await login.json()).user.tenant.slug).toBe(tenant.slug);

    // Recusado: continua sem acesso
    const email2 = `recusado.${suffix}@example.com`;
    await ask({ name: 'Bruno Teste', email: email2, password: PASSWORD });
    const list2 = await (await call(request, 'get', '/access-requests', tenant.owner, { expected: 200 })).json();
    await call(request, 'post', `/access-requests/${list2.find((r: { email: string }) => r.email === email2).id}/reject`, tenant.owner, { expected: 200 });
    expect((await request.post(`${API}/auth/login`, { headers: { Host: host }, data: { email: email2, password: PASSWORD } })).status()).toBe(401);

    // Quem ja tem conta em outra empresa: aprovado, entra com a senha que ja usa
    await ask({ name: 'Dono da outra', email: other.ownerEmail, password: 'OutraSenha@99' });
    const list3 = await (await call(request, 'get', '/access-requests', tenant.owner, { expected: 200 })).json();
    const approved = await (await call(request, 'post', `/access-requests/${list3.find((r: { email: string }) => r.email === other.ownerEmail).id}/approve`, tenant.owner, { expected: 200, data: { customRoleId: operador.id } })).json();
    expect(approved.existingAccount).toBe(true);
    const both = await request.post(`${API}/auth/login`, { headers: { Host: host }, data: { email: other.ownerEmail, password: PASSWORD } });
    expect(both.status()).toBe(200);
    expect((await both.json()).user.tenant.slug).toBe(tenant.slug);
  });
});
