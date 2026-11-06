import { test, expect, type APIRequestContext } from '@playwright/test';
import { API, call, createPerson, createRole, createTenant, ownerStaff, type Tenant } from './helpers';

// Paginas para clientes: o formulario publico vira registro so com os campos da
// pagina, e o link de acompanhamento mostra so o que o bloco libera, so do registro
// do link e so na empresa certa.

const STATUS = [{ value: 'aberto', label: 'Aberto', color: '#2563eb' }, { value: 'indenizado', label: 'Indenizado', color: '#16a34a' }];

async function setupTables(request: APIRequestContext, t: Tenant) {
  const andamentos = await (await call(request, 'post', '/entities', t.owner, {
    expected: [200, 201],
    data: { name: 'Andamento', slug: 'andamentos', fields: [{ slug: 'descricao', name: 'descricao', label: 'Descrição', type: 'text' }] },
  })).json();
  const sinistros = await (await call(request, 'post', '/entities', t.owner, {
    expected: [200, 201],
    data: {
      name: 'Sinistro', slug: 'sinistros',
      settings: { titleField: 'numero', statusField: 'status' },
      fields: [
        { slug: 'numero', name: 'numero', label: 'Número', type: 'text', required: true },
        { slug: 'relato', name: 'relato', label: 'Relato', type: 'textarea', required: true },
        { slug: 'tipo', name: 'tipo', label: 'Tipo', type: 'select', options: [{ value: 'colisao', label: 'Colisão' }, { value: 'roubo', label: 'Roubo' }] },
        { slug: 'status', name: 'status', label: 'Situação', type: 'select', required: true, options: STATUS },
        { slug: 'interno', name: 'interno', label: 'Nota interna', type: 'text' },
        { slug: 'foto', name: 'foto', label: 'Foto', type: 'image' },
        { slug: 'andamentos', name: 'andamentos', label: 'Andamentos', type: 'sub-entity', subEntitySlug: 'andamentos', subEntityId: andamentos.id },
      ],
    },
  })).json();
  return { sinistros, andamentos };
}

test.describe.serial('paginas para clientes', () => {
  let tenant: Tenant;
  let other: Tenant;
  let sinistrosId: string;
  let formPage: { id: string; slug: string; blocks: Array<{ id: string; type: string; fields?: string[] }> };
  let trackPage: { id: string; slug: string; blocks: Array<Record<string, unknown>> };
  let trackingPath = '';
  let recordId = '';

  test.beforeAll(async ({ request }) => {
    const staff = await ownerStaff(request);
    tenant = await createTenant(request, staff);
    other = await createTenant(request, staff);
    sinistrosId = (await setupTables(request, tenant)).sinistros.id;
    await setupTables(request, other);
  });

  test('paginas montadas a partir da tabela; formulario exige os obrigatorios', async ({ request }) => {
    formPage = await (await call(request, 'post', '/site-pages', tenant.owner, {
      expected: [200, 201], data: { title: 'Avise seu sinistro', template: 'form', entitySlug: 'sinistros' },
    })).json();
    expect(formPage.slug).toBe('avise-seu-sinistro');
    const form = formPage.blocks.find((b) => b.type === 'form')!;
    expect(form.fields).toEqual(expect.arrayContaining(['numero', 'relato']));
    // Situacao fica de fora: comeca na primeira opcao
    expect(form.fields).not.toContain('status');

    const missing = await call(request, 'patch', `/site-pages/${formPage.id}`, tenant.owner, {
      expected: 400, data: { blocks: [{ type: 'form', entitySlug: 'sinistros', fields: ['numero'] }] },
    });
    expect(await missing.text()).toContain('Relato');
    // So os campos certos: tirar "interno" e deixar numero, relato, tipo, foto
    formPage = await (await call(request, 'patch', `/site-pages/${formPage.id}`, tenant.owner, {
      expected: 200,
      data: { blocks: [{ type: 'heading', text: 'Avise' }, { id: 'f1', type: 'form', entitySlug: 'sinistros', fields: ['numero', 'relato', 'tipo', 'foto', 'nao_existe'] }] },
    })).json();
    expect(formPage.blocks[1].fields).toEqual(['numero', 'relato', 'tipo', 'foto']);

    trackPage = await (await call(request, 'post', '/site-pages', tenant.owner, {
      expected: [200, 201], data: { title: 'Acompanhe seu sinistro', template: 'tracking', entitySlug: 'sinistros' },
    })).json();
    trackPage = await (await call(request, 'patch', `/site-pages/${trackPage.id}`, tenant.owner, {
      expected: 200,
      data: { blocks: [{ type: 'tracking', entitySlug: 'sinistros', fields: ['numero', 'status', 'tipo'], timelineField: 'andamentos', uploadFields: ['foto', 'interno'] }] },
    })).json();
    expect(trackPage.blocks[0]).toMatchObject({ timelineField: 'andamentos', uploadFields: ['foto'] });
  });

  test('nao publicada nao abre; publicada mostra so a definicao dos campos', async ({ request }) => {
    await call(request, 'get', `/site/${tenant.slug}/${formPage.slug}`, null, { expected: 404 });
    await call(request, 'post', `/site-pages/${formPage.id}/publish`, tenant.owner, { expected: 200, data: { publish: true } });
    await call(request, 'post', `/site-pages/${trackPage.id}/publish`, tenant.owner, { expected: 200, data: { publish: true } });
    const page = await (await call(request, 'get', `/site/${tenant.slug}/${formPage.slug}`, null, { expected: 200 })).json();
    const form = page.blocks.find((b: { type: string }) => b.type === 'form');
    expect(form.fieldDefs.map((f: { slug: string }) => f.slug)).toEqual(['numero', 'relato', 'tipo', 'foto']);
    expect(page.record).toBeNull();
    // Mesma pagina em outra empresa nao existe
    await call(request, 'get', `/site/${other.slug}/${formPage.slug}`, null, { expected: 404 });
  });

  test('formulario publico vira registro so com os campos da pagina', async ({ request }) => {
    const res = await (await call(request, 'post', `/site/${tenant.slug}/${formPage.slug}/forms/f1`, null, {
      expected: 200,
      data: { data: { numero: 'SIN-9001', relato: 'Bati o carro', tipo: 'colisao', interno: 'invasao', status: 'indenizado', foto: 'https://evil.example/x.png' } },
    })).json();
    expect(res.ok).toBe(true);
    expect(res.trackingUrl).toMatch(new RegExp(`^/p/${tenant.slug}/acompanhe-seu-sinistro\\?c=`));
    trackingPath = res.trackingUrl;

    const list = await (await call(request, 'get', '/data/sinistros?limit=10', tenant.owner, { expected: 200 })).json();
    const rec = list.data.find((r: { data: { numero: string } }) => r.data.numero === 'SIN-9001');
    recordId = rec.id;
    expect(rec.data).toMatchObject({ numero: 'SIN-9001', relato: 'Bati o carro', tipo: 'colisao', status: 'aberto' });
    expect(rec.data.interno).toBeUndefined();
    expect(rec.data.foto).toBeUndefined(); // URL de fora nao entra

    // Robo (campo escondido preenchido): responde ok e nao grava
    await call(request, 'post', `/site/${tenant.slug}/${formPage.slug}/forms/f1`, null, {
      expected: 200, data: { data: { numero: 'SIN-ROBO', relato: 'x' }, website: 'http://spam' },
    });
    const after = await (await call(request, 'get', '/data/sinistros?limit=50', tenant.owner)).json();
    expect(after.data.some((r: { data: { numero: string } }) => r.data.numero === 'SIN-ROBO')).toBe(false);
    // Faltou obrigatorio
    await call(request, 'post', `/site/${tenant.slug}/${formPage.slug}/forms/f1`, null, { expected: 400, data: { data: { numero: 'SIN-9002' } } });
  });

  test('link de acompanhamento mostra so o registro do link e so os campos liberados', async ({ request }) => {
    await call(request, 'patch', `/data/sinistros/${recordId}`, tenant.owner, { expected: 200, data: { data: { interno: 'segredo da empresa' } } });
    await call(request, 'post', '/data/andamentos', tenant.owner, { expected: [200, 201], data: { data: { descricao: 'Documentos recebidos' }, parentRecordId: recordId } });

    const token = trackingPath.split('c=')[1];
    const page = await (await call(request, 'get', `/site/${tenant.slug}/acompanhe-seu-sinistro?c=${token}`, null, { expected: 200 })).json();
    expect(page.record.title).toBe('SIN-9001');
    expect(page.record.status).toEqual({ label: 'Aberto', color: '#2563eb' });
    // Numero vai no titulo e situacao no destaque: nao se repetem na lista
    expect(page.record.fields.map((f: { slug: string }) => f.slug)).toEqual(['tipo']);
    expect(page.record.fields[0].value).toBe('Colisão');
    expect(page.record.timeline.rows).toEqual([{ descricao: 'Documentos recebidos' }]);
    expect(JSON.stringify(page)).not.toContain('segredo da empresa');

    const bad = await (await call(request, 'get', `/site/${tenant.slug}/acompanhe-seu-sinistro?c=naoexiste123`, null, { expected: 200 })).json();
    expect(bad.record).toBeNull();
    expect(bad.trackingError).toBeTruthy();

    // Token de uma empresa nao abre registro na pagina igual de outra empresa
    const otherTrack = await (await call(request, 'post', '/site-pages', other.owner, {
      expected: [200, 201], data: { title: 'Acompanhe seu sinistro', template: 'tracking', entitySlug: 'sinistros' },
    })).json();
    await call(request, 'post', `/site-pages/${otherTrack.id}/publish`, other.owner, { expected: 200, data: { publish: true } });
    const cross = await (await call(request, 'get', `/site/${other.slug}/acompanhe-seu-sinistro?c=${token}`, null, { expected: 200 })).json();
    expect(cross.record).toBeNull();
  });

  test('cliente envia foto pelo link; campo nao liberado e recusado', async ({ request }) => {
    const token = trackingPath.split('c=')[1];
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/akm7mQAAAAASUVORK5CYII=', 'base64');
    const ok = await request.post(`${API}/site/${tenant.slug}/acompanhe-seu-sinistro/track/${token}/files?field=foto`, {
      multipart: { file: { name: 'dano.png', mimeType: 'image/png', buffer: png } },
    });
    expect(ok.status(), await ok.text()).toBe(200);
    const rec = await (await call(request, 'get', `/data/sinistros/${recordId}`, tenant.owner, { expected: 200 })).json();
    expect(String(rec.data.foto)).toContain(`/${tenant.id}/site/`);

    const denied = await request.post(`${API}/site/${tenant.slug}/acompanhe-seu-sinistro/track/${token}/files?field=interno`, {
      multipart: { file: { name: 'x.png', mimeType: 'image/png', buffer: png } },
    });
    expect(denied.status()).toBe(400);
  });

  test('PDF pelo link e link gerado pela empresa', async ({ request }) => {
    const tpl = await (await call(request, 'post', '/pdf-templates', tenant.owner, {
      expected: [200, 201],
      data: { name: 'Relatório', slug: 'relatorio', sourceEntityId: sinistrosId, templateType: 'single', content: { body: [{ id: 't', type: 'text', content: 'Sinistro {{numero}}' }] } },
    })).json();
    await call(request, 'post', `/pdf-templates/${tpl.id}/publish`, tenant.owner, { expected: [200, 201] });
    await call(request, 'patch', `/site-pages/${trackPage.id}`, tenant.owner, {
      expected: 200, data: { blocks: [{ type: 'tracking', entitySlug: 'sinistros', fields: ['numero'], pdfTemplateId: tpl.id }] },
    });
    const token = trackingPath.split('c=')[1];
    const pdf = await call(request, 'get', `/site/${tenant.slug}/acompanhe-seu-sinistro/track/${token}/pdf`, null, { expected: 200 });
    expect((await pdf.body()).subarray(0, 4).toString()).toBe('%PDF');

    // A empresa pede o link de um registro: sempre o mesmo link
    const link = await (await call(request, 'post', '/record-tracking/link', tenant.owner, { expected: 200, data: { entitySlug: 'sinistros', recordId } })).json();
    expect(link.url).toBe(trackingPath);
    // Outra empresa nao consegue link de registro alheio
    await call(request, 'post', '/record-tracking/link', other.owner, { expected: 404, data: { entitySlug: 'sinistros', recordId } });
  });

  test('so quem gerencia links publicos mexe nas paginas', async ({ request }) => {
    const roleId = await createRole(request, tenant.owner, {
      name: 'Só registros', permissions: [{ entitySlug: '*', canRead: true, canCreate: true, canUpdate: true, canDelete: false, scope: 'all' }],
      modulePermissions: {},
    });
    const person = await createPerson(request, tenant.owner, tenant.slug, 'Operador', roleId);
    await call(request, 'get', '/site-pages', person, { expected: 403 });
    await call(request, 'post', '/site-pages', person, { expected: 403, data: { title: 'x' } });
    // Mas quem ve o registro pode mandar o link ao cliente
    const link = await (await call(request, 'post', '/record-tracking/link', person, { expected: 200, data: { entitySlug: 'sinistros', recordId } })).json();
    expect(link.url).toBe(trackingPath);
  });
});

// Formulario de tabela "de dentro" (sinistro dentro do segurado): o cliente preenche
// os dois; o segurado e reaproveitado pelo CPF e nada fica pela metade.
test.describe.serial('formulario que cria o registro de cima junto', () => {
  let tenant: Tenant;
  let pageSlug = '';
  let blockId = '';

  test.beforeAll(async ({ request }) => {
    tenant = await createTenant(request, await ownerStaff(request));
    const avisos = await (await call(request, 'post', '/entities', tenant.owner, {
      expected: [200, 201],
      data: {
        name: 'Aviso', slug: 'avisos', settings: { titleField: 'relato' },
        fields: [{ slug: 'relato', name: 'relato', label: 'Relato', type: 'textarea', required: true }, { slug: 'foto', name: 'foto', label: 'Foto', type: 'image' }],
      },
    })).json();
    await call(request, 'post', '/entities', tenant.owner, {
      expected: [200, 201],
      data: {
        name: 'Segurado', slug: 'segurados', settings: { titleField: 'nome' },
        fields: [
          { slug: 'nome', name: 'nome', label: 'Nome', type: 'text', required: true },
          { slug: 'documento', name: 'documento', label: 'CPF / CNPJ', type: 'text' },
          { slug: 'apolice', name: 'apolice', label: 'Apólice', type: 'text' },
          { slug: 'avisos', name: 'avisos', label: 'Avisos', type: 'sub-entity', subEntitySlug: 'avisos', subEntityId: avisos.id },
        ],
      },
    });
  });

  test('pagina nova ja vem com os dados de cima e o CPF para reaproveitar', async ({ request }) => {
    const page = await (await call(request, 'post', '/site-pages', tenant.owner, {
      expected: [200, 201], data: { title: 'Avise seu sinistro', template: 'form', entitySlug: 'avisos' },
    })).json();
    const form = page.blocks.find((b: { type: string }) => b.type === 'form');
    expect(form.parent).toMatchObject({ entitySlug: 'segurados', matchField: 'documento' });
    expect(form.parent.fields).toEqual(expect.arrayContaining(['nome', 'documento']));
    // Obrigatorio de cima nao pode sair
    await call(request, 'patch', `/site-pages/${page.id}`, tenant.owner, {
      expected: 400, data: { blocks: [{ type: 'form', entitySlug: 'avisos', fields: ['relato'], parent: { fields: ['documento'] } }] },
    });
    await call(request, 'patch', `/site-pages/${page.id}`, tenant.owner, {
      expected: 200, data: { blocks: [{ id: 'f1', type: 'form', entitySlug: 'avisos', fields: ['relato'], parent: { fields: ['nome', 'documento'], matchField: 'documento' } }] },
    });
    await call(request, 'post', `/site-pages/${page.id}/publish`, tenant.owner, { expected: 200, data: { publish: true } });
    pageSlug = page.slug;
    blockId = 'f1';
    const pub = await (await call(request, 'get', `/site/${tenant.slug}/${pageSlug}`, null, { expected: 200 })).json();
    const block = pub.blocks.find((b: { type: string }) => b.type === 'form');
    expect(block.parent.name).toBe('Segurado');
    expect(block.parent.fieldDefs.map((f: { slug: string }) => f.slug)).toEqual(['nome', 'documento']);
  });

  test('cria o segurado e o aviso dentro dele; mesmo CPF reaproveita; erro nao deixa segurado solto', async ({ request }) => {
    const send = (data: Record<string, unknown>, parentData: Record<string, unknown>, expected: number) =>
      call(request, 'post', `/site/${tenant.slug}/${pageSlug}/forms/${blockId}`, null, { expected, data: { data, parentData } });

    await send({ relato: 'Bati o carro' }, { nome: 'Maria Souza', documento: '123.456.789-09', apolice: 'nao-liberado' }, 200);
    await send({ relato: 'Vidro quebrado' }, { nome: 'Maria S.', documento: '12345678909' }, 200);
    await send({}, { nome: 'Joao', documento: '98765432100' }, 400);

    const segurados = (await (await call(request, 'get', '/data/segurados?limit=50', tenant.owner, { expected: 200 })).json()).data;
    expect(segurados).toHaveLength(1);
    expect(segurados[0].data).toMatchObject({ nome: 'Maria Souza', documento: '123.456.789-09' });
    expect(segurados[0].data.apolice).toBeUndefined();
    const avisos = (await (await call(request, 'get', `/data/avisos?limit=50&parentRecordId=${segurados[0].id}`, tenant.owner, { expected: 200 })).json()).data;
    expect(avisos.map((a: { data: { relato: string } }) => a.data.relato).sort()).toEqual(['Bati o carro', 'Vidro quebrado']);
  });
});
