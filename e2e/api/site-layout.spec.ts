import { test, expect } from '@playwright/test';
import { API, call, createTenant, ownerStaff, type Tenant } from './helpers';

// Editor visual: a pagina fica em secoes com grade de 12 colunas (computador) e
// os blocos guardados na ordem de leitura (a do celular). O servidor confere as
// secoes contra os blocos: cada bloco uma vez, nada de bloco inventado, valores
// fora da lista saem.

type Item = { id: string; x: number; y: number; w: number; h: number; hide?: string; style?: Record<string, unknown>; order?: number; minH?: number };
type Section = { id: string; width: string; padding: string; bg?: string; bgImage?: string; light?: boolean; items: Item[] };

test.describe.serial('paginas em secoes e grade', () => {
  let tenant: Tenant;
  let pageId = '';
  let pageSlug = '';

  test.beforeAll(async ({ request }) => {
    tenant = await createTenant(request, await ownerStaff(request));
  });

  test('pagina antiga vira uma secao estreita com os blocos em sequencia', async ({ request }) => {
    const page = await (await call(request, 'post', '/site-pages', tenant.owner, { expected: [200, 201], data: { title: 'Sobre nós', template: 'blank' } })).json();
    pageId = page.id;
    pageSlug = page.slug;
    const saved = await (await call(request, 'patch', `/site-pages/${pageId}`, tenant.owner, {
      expected: 200,
      data: { blocks: [{ id: 'titulo', type: 'heading', text: 'Olá' }, { id: 'texto', type: 'text', text: 'Somos um café.' }] },
    })).json();
    const sections = saved.layout.sections as Section[];
    expect(sections).toHaveLength(1);
    expect(sections[0].width).toBe('narrow');
    expect(sections[0].items.map((i) => [i.id, i.x, i.w])).toEqual([['titulo', 0, 12], ['texto', 0, 12]]);
    expect(sections[0].items[1].y).toBeGreaterThan(sections[0].items[0].y);
  });

  test('secoes e grade sao validadas e os blocos ficam na ordem de leitura', async ({ request }) => {
    const saved = await (await call(request, 'patch', `/site-pages/${pageId}`, tenant.owner, {
      expected: 200,
      data: {
        blocks: [
          { id: 'titulo', type: 'heading', text: 'Olá' },
          { id: 'texto', type: 'text', text: 'Somos um café.' },
          { id: 'foto', type: 'image', url: 'https://example.com/a.jpg' },
          { id: 'botao', type: 'button', label: 'WhatsApp', url: 'https://wa.me/5511999990000' },
        ],
        layout: {
          sections: [
            {
              id: 'topo', width: 'gigante', padding: 'lg', bg: '#1E293B', bgImage: 'javascript:alert(1)', light: true, hide: 'tv',
              items: [
                // foto a direita, texto a esquerda: no celular o texto vem primeiro
                { id: 'foto', x: 6, y: 0, w: 6, h: 20, style: { align: 'center', bg: 'red', padding: 'md', radius: 'lg', shadow: true, extra: 1 } },
                { id: 'texto', x: 0, y: 0, w: 6, h: 10, hide: 'mobile' },
                { id: 'nao-existe', x: 0, y: 30, w: 12, h: 2 },
                { id: 'foto', x: 0, y: 40, w: 12, h: 2 },
                { id: 'botao', x: 11, y: 22, w: 4, h: 3 },
              ],
            },
            { id: 'topo', width: 'full', padding: 'none', items: [{ id: 'titulo', x: -5, y: -1, w: 99, h: 0 }] },
          ],
        },
      },
    })).json();
    const sections = saved.layout.sections as Section[];
    expect(sections.map((s) => s.id)).toEqual(['topo', 'topo-2']);
    const [top, second] = sections;
    expect(top.width).toBe('normal');
    expect(top.bg).toBe('#1e293b');
    expect(top.bgImage).toBeUndefined();
    expect(top.light).toBe(true);
    expect(top).not.toHaveProperty('hide');
    expect(top.items.map((i) => i.id)).toEqual(['foto', 'texto', 'botao']);
    expect(top.items[0].style).toEqual({ align: 'center', padding: 'md', radius: 'lg', shadow: true });
    expect(top.items[1].hide).toBe('mobile');
    expect(top.items[2]).toMatchObject({ x: 8, w: 4, y: 20 }); // nao passa da 12a coluna e encosta na foto
    expect(second.items[0]).toMatchObject({ id: 'titulo', x: 0, y: 0, w: 12, h: 1 });
    // ordem de leitura: secao, linha, coluna
    expect(saved.blocks.map((b: { id: string }) => b.id)).toEqual(['texto', 'foto', 'botao', 'titulo']);
  });

  test('bloco fora das secoes vai para o fim da ultima e bloco removido sai da grade', async ({ request }) => {
    const current = await (await call(request, 'get', `/site-pages/${pageId}`, tenant.owner)).json();
    const saved = await (await call(request, 'patch', `/site-pages/${pageId}`, tenant.owner, {
      expected: 200,
      data: {
        blocks: [...current.blocks.filter((b: { id: string }) => b.id !== 'foto'), { id: 'citacao', type: 'quote', text: 'O melhor café' }],
        layout: current.layout,
      },
    })).json();
    const sections = saved.layout.sections as Section[];
    expect(sections[0].items.map((i) => i.id)).toEqual(['texto', 'botao']);
    expect(sections[0].items[1].y).toBe(0); // sem a foto, o botao sobe (sem buraco)
    const last = sections[sections.length - 1].items;
    expect(last.map((i) => i.id)).toEqual(['titulo', 'citacao']);
    expect(last[1].y).toBeGreaterThanOrEqual(last[0].y + last[0].h);
  });

  test('pagina publicada entrega as secoes e a previa aceita a grade do editor', async ({ request }) => {
    await call(request, 'post', `/site-pages/${pageId}/publish`, tenant.owner, { expected: [200, 201], data: { publish: true } });
    const pub = await (await request.get(`${API}/site/${tenant.slug}/${pageSlug}`)).json();
    expect(pub.layout.sections.map((s: Section) => s.id)).toEqual(['topo', 'topo-2']);
    expect(pub.blocks.map((b: { id: string }) => b.id)).toEqual(['texto', 'botao', 'titulo', 'citacao']);

    const preview = await (await call(request, 'post', '/site-pages/preview', tenant.owner, {
      expected: [200, 201],
      data: {
        title: 'Prévia',
        blocks: [{ id: 'a', type: 'heading', text: 'A' }, { id: 'b', type: 'text', text: '' }],
        layout: { sections: [{ id: 's1', width: 'normal', padding: 'md', items: [{ id: 'a', x: 3, y: 0, w: 6, h: 4 }, { id: 'b', x: 0, y: 4, w: 12, h: 4 }] }] },
      },
    })).json();
    // texto vazio nao entra na pagina; a grade segue so com o que ficou
    expect(preview.layout.sections[0].items).toEqual([{ id: 'a', x: 3, y: 0, w: 6, h: 4 }]);
  });

  test('ordem no celular e altura escolhida sao guardadas e conferidas', async ({ request }) => {
    const saved = await (await call(request, 'patch', `/site-pages/${pageId}`, tenant.owner, {
      expected: 200,
      data: {
        blocks: [{ id: 'a', type: 'heading', text: 'A' }, { id: 'b', type: 'text', text: 'B' }],
        layout: { sections: [{ id: 's1', width: 'normal', padding: 'md', items: [
          { id: 'a', x: 0, y: 0, w: 6, h: 3, order: 1, minH: 12 },
          { id: 'b', x: 6, y: 0, w: 6, h: 3, order: -4, minH: 'x' },
        ] }] },
      },
    })).json();
    const [a, b] = saved.layout.sections[0].items as Item[];
    expect(a).toMatchObject({ order: 1, minH: 12, h: 12 }); // altura nunca menor que a escolhida
    expect(b).toMatchObject({ order: 0, minH: 1 });
  });

  test('rascunho (sem texto, foto ou link) fica guardado, mas nao aparece na pagina', async ({ request }) => {
    const saved = await (await call(request, 'patch', `/site-pages/${pageId}`, tenant.owner, {
      expected: 200,
      data: {
        blocks: [
          { id: 'foto', type: 'image', url: '' },
          { id: 'botao', type: 'button', label: 'WhatsApp', url: '' },
          { id: 'galeria', type: 'gallery', images: [] },
          { id: 'texto', type: 'text', text: 'Fica' },
        ],
        layout: { sections: [{ id: 's1', width: 'normal', padding: 'md', items: [
          { id: 'foto', x: 0, y: 0, w: 12, h: 10 },
          { id: 'botao', x: 0, y: 10, w: 4, h: 3 },
          { id: 'galeria', x: 0, y: 13, w: 12, h: 10 },
          { id: 'texto', x: 0, y: 23, w: 12, h: 3 },
        ] }] },
      },
    })).json();
    expect(saved.blocks.map((b: { id: string }) => b.id)).toEqual(['foto', 'botao', 'galeria', 'texto']);
    const pub = await (await request.get(`${API}/site/${tenant.slug}/${pageSlug}`)).json();
    expect(pub.blocks.map((b: { id: string }) => b.id)).toEqual(['texto']);
    // sem buraco onde estavam os rascunhos
    expect(pub.layout.sections[0].items).toEqual([{ id: 'texto', x: 0, y: 0, w: 12, h: 3 }]);
  });
});
