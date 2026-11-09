import { test, expect } from '@playwright/test';
import { API, call, createTenant, ownerStaff, type Tenant } from './helpers';

// Paginas elaboradas: aparencia (estilo, fundo, cor, capa) e blocos de vitrine.
// A vitrine mostra registros de uma tabela para quem nao tem login: so os campos
// escolhidos e so os registros marcados no campo "mostrar".

const CATEGORIAS = [{ value: 'bebidas', label: 'Bebidas' }, { value: 'doces', label: 'Doces' }];

test.describe.serial('paginas com vitrine e aparencia', () => {
  let tenant: Tenant;
  let pageId = '';
  let pageSlug = '';

  test.beforeAll(async ({ request }) => {
    tenant = await createTenant(request, await ownerStaff(request));
    await call(request, 'post', '/entities', tenant.owner, {
      expected: [200, 201],
      data: {
        name: 'Item do cardápio', namePlural: 'Cardápio', slug: 'cardapio',
        settings: { titleField: 'nome' },
        fields: [
          { slug: 'nome', name: 'nome', label: 'Nome', type: 'text', required: true },
          { slug: 'categoria', name: 'categoria', label: 'Categoria', type: 'select', options: CATEGORIAS },
          { slug: 'preco', name: 'preco', label: 'Preço', type: 'currency' },
          { slug: 'custo', name: 'custo', label: 'Custo interno', type: 'currency' },
          { slug: 'disponivel', name: 'disponivel', label: 'Disponível', type: 'boolean' },
          { slug: 'descricao', name: 'descricao', label: 'Descrição', type: 'textarea' },
        ],
      },
    });
    const items = [
      { nome: 'Bolo de morango', categoria: 'doces', preco: 18, custo: 4.37, disponivel: true, descricao: 'Fatia generosa' },
      { nome: 'Latte de coração', categoria: 'bebidas', preco: 14.5, custo: 3.91, disponivel: true },
      { nome: 'Item esgotado', categoria: 'doces', preco: 9, custo: 2.13, disponivel: false },
      { nome: 'Chá gelado', categoria: 'bebidas', preco: 11, custo: 1.77, disponivel: true },
    ];
    for (const data of items) await call(request, 'post', '/data/cardapio', tenant.owner, { expected: [200, 201], data: { data } });
  });

  test('blocos novos sao validados e links perigosos saem', async ({ request }) => {
    const page = await (await call(request, 'post', '/site-pages', tenant.owner, { expected: [200, 201], data: { title: 'Nosso café', template: 'blank' } })).json();
    pageId = page.id;
    pageSlug = page.slug;

    const bad = await call(request, 'patch', `/site-pages/${pageId}`, tenant.owner, { expected: 400, data: { blocks: [{ type: 'catalog', entitySlug: 'nao-existe' }] } });
    expect(await bad.text()).toContain('Vitrine');

    const saved = await (await call(request, 'patch', `/site-pages/${pageId}`, tenant.owner, {
      expected: 200,
      data: {
        settings: { style: 'scrapbook', background: 'hearts', accent: '#E90CC0', coverUrl: 'javascript:alert(1)', tagline: 'o cantinho mais fofo', extra: 'x' },
        blocks: [
          { type: 'hero', title: 'Bem-vindo!', imageUrl: 'https://example.com/capa.jpg', buttonLabel: 'Reservar', buttonUrl: 'https://wa.me/5511999990000' },
          { type: 'gallery', layout: 'nao-existe', images: [{ url: 'https://example.com/a.jpg', caption: 'latte' }, { url: 'javascript:alert(1)' }, { url: '' }] },
          { type: 'cards', columns: 7, items: [{ title: 'Chá da tarde', badge: 'Novo!' }, { text: 'sem título' }] },
          { type: 'quote', text: 'O melhor café da cidade', author: 'Cliente feliz' },
          { type: 'catalog', entitySlug: 'cardapio', titleField: 'nome', priceField: 'preco', descriptionField: 'descricao', groupField: 'categoria', onlyField: 'disponivel', imageField: 'preco' },
        ],
      },
    })).json();

    expect(saved.settings).toEqual({ style: 'scrapbook', background: 'hearts', accent: '#e90cc0', tagline: 'o cantinho mais fofo' });
    const [hero, gallery, cards, quote, catalog] = saved.blocks;
    expect(hero).toMatchObject({ type: 'hero', buttonLabel: 'Reservar', imageUrl: 'https://example.com/capa.jpg' });
    expect(gallery.layout).toBe('polaroid');
    expect(gallery.images).toEqual([{ url: 'https://example.com/a.jpg', caption: 'latte' }]);
    expect(cards.items).toHaveLength(1);
    expect(cards.columns).toBe(1);
    expect(quote.author).toBe('Cliente feliz');
    // Foto apontando para um campo que nao e imagem e descartada
    expect(catalog.imageField).toBeUndefined();
    expect(catalog).toMatchObject({ titleField: 'nome', priceField: 'preco', groupField: 'categoria', onlyField: 'disponivel' });
  });

  test('vitrine publica: so os marcados, so os campos escolhidos, na ordem das categorias', async ({ request }) => {
    await call(request, 'post', `/site-pages/${pageId}/publish`, tenant.owner, { expected: [200, 201], data: { publish: true } });
    const res = await request.get(`${API}/site/${tenant.slug}/${pageSlug}`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.page.settings.style).toBe('scrapbook');
    const catalog = body.blocks.find((b: { type: string }) => b.type === 'catalog');
    expect(catalog.items.map((i: { title: string }) => i.title)).toEqual(['Latte de coração', 'Chá gelado', 'Bolo de morango']);
    expect(catalog.items[0]).toMatchObject({ group: 'Bebidas', price: 14.5 });
    expect(catalog.items[2].description).toBe('Fatia generosa');
    // Custo interno e itens nao marcados nao saem
    const text = JSON.stringify(body);
    for (const leak of ['4.37', '3.91', '1.77', 'Item esgotado', 'custo']) expect(text).not.toContain(leak);
  });
});
