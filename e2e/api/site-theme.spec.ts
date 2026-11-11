import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect } from '@playwright/test';
import { API, call, createTenant, ownerStaff, type Tenant } from './helpers';

// Tema do site (cores, fontes, estilos de texto, botoes, fundo), texto formatado
// estilo Word, fontes enviadas pela empresa e fundos de secao. O servidor so aceita
// o que esta nas listas: nada de CSS/HTML livre e nenhum link perigoso.

const FONT_FILE = join(__dirname, '../../apps/web-admin/public/fonts/site/lora-normal-400-latin.woff2');

test.describe.serial('tema, texto formatado e fontes das paginas', () => {
  let tenant: Tenant;
  let pageId = '';
  let pageSlug = '';
  let fontId = '';

  test.beforeAll(async ({ request }) => {
    tenant = await createTenant(request, await ownerStaff(request));
    const page = await (await call(request, 'post', '/site-pages', tenant.owner, { expected: [200, 201], data: { title: 'Início', template: 'blank' } })).json();
    pageId = page.id;
    pageSlug = page.slug;
  });

  test('tema: valores fora da lista saem, estilos de texto sao conferidos', async ({ request }) => {
    const saved = await (await call(request, 'patch', `/site-pages/${pageId}`, tenant.owner, {
      expected: 200,
      data: {
        settings: {
          ownLook: true, style: 'classic',
          theme: {
            preset: 'Elegante!!', colors: { bg: '#FAF7F2', text: 'red', accent2: '#123456', hacker: '#000000' },
            fonts: { heading: 'cormorant-garamond', body: 'comic-sans' },
            text: { h1: { size: 500, bold: false, color: '#AA0000', spacing: 99, font: 'custom:abcdefghijkl' }, body: { size: 16, line: 10 } },
            buttons: { shape: 'pill', fill: 'neon' }, radius: 'xl', shadow: 'strong', spacing: 'airy',
            bgImage: 'javascript:alert(1)', bgVideo: 'https://example.com/fundo.mp4', bgDim: 300,
          },
        },
      },
    })).json();
    expect(saved.settings.theme).toEqual({
      preset: 'elegante',
      colors: { bg: '#faf7f2', accent2: '#123456' },
      fonts: { heading: 'cormorant-garamond' },
      text: { h1: { font: 'custom:abcdefghijkl', size: 120, bold: false, color: '#aa0000', spacing: 40 }, body: { size: 16, line: 90 } },
      buttons: { shape: 'pill' }, radius: 'xl', shadow: 'strong', spacing: 'airy',
      bgVideo: 'https://example.com/fundo.mp4', bgDim: 80,
    });
  });

  test('texto formatado: so tipos e marcas permitidos, link perigoso sai e o texto puro acompanha', async ({ request }) => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 9, textAlign: 'center' }, content: [{ type: 'text', text: 'Bem-vindo' }] },
        {
          type: 'paragraph', attrs: { textAlign: 'evil' },
          content: [
            { type: 'text', text: 'Café ', marks: [{ type: 'bold' }, { type: 'textStyle', attrs: { color: '#FF0000', fontSize: '300px', fontFamily: 'lora', evil: 'x' } }] },
            { type: 'text', text: 'perigoso', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }, { type: 'script' }] },
            { type: 'hardBreak' },
            { type: 'text', text: '<img src=x onerror=alert(1)>', marks: [{ type: 'highlight', attrs: { color: '#FFFF00' } }] },
          ],
        },
        { type: 'script', content: [{ type: 'text', text: 'alert(1)' }] },
        { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'item' }] }] }] },
      ],
    };
    const saved = await (await call(request, 'patch', `/site-pages/${pageId}`, tenant.owner, {
      expected: 200, data: { blocks: [{ id: 'txt', type: 'text', text: 'ignorado', doc }] },
    })).json();
    const block = saved.blocks[0];
    expect(block.doc.content[0]).toEqual({ type: 'heading', attrs: { level: 3, textAlign: 'center' }, content: [{ type: 'text', text: 'Bem-vindo' }] });
    const para = block.doc.content[1];
    expect(para.attrs).toBeUndefined();
    expect(para.content[0].marks).toEqual([{ type: 'bold' }, { type: 'textStyle', attrs: { color: '#ff0000', fontFamily: 'lora', fontSize: '120px' } }]);
    expect(para.content[1].marks).toBeUndefined();
    expect(para.content[3]).toEqual({ type: 'text', text: '<img src=x onerror=alert(1)>', marks: [{ type: 'highlight', attrs: { color: '#ffff00' } }] });
    expect(block.doc.content.map((n: { type: string }) => n.type)).toEqual(['heading', 'paragraph', 'bulletList']);
    expect(block.text).toContain('Bem-vindo');
    expect(block.text).toContain('item');
  });

  test('fontes enviadas: confere o arquivo, serve para o site e aparece na pagina', async ({ request }) => {
    const bad = await request.post(`${API}/site-pages/fonts`, {
      headers: { Authorization: `Bearer ${tenant.owner.token}`, 'X-Tenant-Slug': tenant.owner.slug },
      multipart: { file: { name: 'fonte.ttf', mimeType: 'font/ttf', buffer: Buffer.from('nao sou fonte de verdade') } },
    });
    expect(bad.status()).toBe(400);

    const ok = await request.post(`${API}/site-pages/fonts`, {
      headers: { Authorization: `Bearer ${tenant.owner.token}`, 'X-Tenant-Slug': tenant.owner.slug },
      multipart: { file: { name: 'Minha Lora.woff2', mimeType: 'application/octet-stream', buffer: readFileSync(FONT_FILE) }, name: 'Letra da Casa' },
    });
    expect(ok.status(), await ok.text()).toBe(201);
    const font = await ok.json();
    fontId = font.id;
    expect(font.name).toBe('Letra da Casa');

    const list = await (await call(request, 'get', '/site-pages/fonts', tenant.owner, { expected: 200 })).json();
    expect(list.map((f: { id: string }) => f.id)).toEqual([fontId]);

    const file = await request.get(`${API}/site/fonts/${fontId}`);
    expect(file.status()).toBe(200);
    expect(file.headers()['content-type']).toContain('font/woff2');
    expect(file.headers()['access-control-allow-origin']).toBe('*');
    expect((await file.body()).subarray(0, 4).toString('latin1')).toBe('wOF2');

    await call(request, 'patch', `/site-pages/${pageId}`, tenant.owner, { expected: 200, data: { settings: { ownLook: true, theme: { fonts: { heading: `custom:${fontId}` } } } } });
    await call(request, 'post', `/site-pages/${pageId}/publish`, tenant.owner, { expected: [200, 201], data: { publish: true } });
    const pub = await (await request.get(`${API}/site/${tenant.slug}/${pageSlug}`)).json();
    expect(pub.fonts).toEqual([{ id: fontId, name: 'Letra da Casa' }]);
    expect(pub.page.settings.theme.fonts.heading).toBe(`custom:${fontId}`);
  });

  test('outra empresa nao apaga a fonte', async ({ request }) => {
    const other = await createTenant(request, await ownerStaff(request));
    await call(request, 'delete', `/site-pages/fonts/${fontId}`, other.owner, { expected: 404 });
    await call(request, 'delete', `/site-pages/fonts/${fontId}`, tenant.owner, { expected: 200 });
    await call(request, 'get', `/site/fonts/${fontId}`, null, { expected: 404 });
  });

  test('fundo da secao: variacao do tema, degrade, padrao e video', async ({ request }) => {
    const current = await (await call(request, 'get', `/site-pages/${pageId}`, tenant.owner)).json();
    const saved = await (await call(request, 'patch', `/site-pages/${pageId}`, tenant.owner, {
      expected: 200,
      data: {
        layout: { sections: [{
          id: 's1', width: 'normal', padding: 'lg', tone: 'accent', pattern: 'hearts', parallax: true,
          gradient: { from: '#112233', to: '#AABBCC', angle: 999, kind: 'conic' }, bgVideo: 'https://example.com/v.mp4',
          items: current.layout.sections[0].items,
        }, { id: 's2', width: 'normal', padding: 'md', tone: 'neon', gradient: { from: 'red', to: '#ffffff' }, pattern: 'plain', items: [] }] },
      },
    })).json();
    const [s1, s2] = saved.layout.sections;
    expect(s1).toMatchObject({ tone: 'accent', pattern: 'hearts', parallax: true, bgVideo: 'https://example.com/v.mp4', gradient: { from: '#112233', to: '#aabbcc', angle: 360, kind: 'linear' } });
    expect(s2.tone).toBeUndefined();
    expect(s2.gradient).toBeUndefined();
    expect(s2.pattern).toBeUndefined();
  });

  test('meus temas ficam guardados no site', async ({ request }) => {
    const site = await (await call(request, 'put', '/site-pages/site', tenant.owner, {
      expected: 200,
      data: { look: {}, menu: [], footer: {}, savedThemes: [{ name: 'Natal', look: { style: 'scrapbook', accent: '#C62828', ownLook: true, theme: { radius: 'xl', x: 1 } } }, { name: '', look: {} }] },
    })).json();
    expect(site.config.savedThemes).toEqual([{ name: 'Natal', look: { style: 'scrapbook', background: 'dots', accent: '#c62828', theme: { radius: 'xl' } } }]);
  });
});
