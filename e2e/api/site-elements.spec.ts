import { test, expect } from '@playwright/test';
import { API, call, createTenant, ownerStaff, type Tenant } from './helpers';

// Elementos a mais (video, mapa, perguntas, icones, redes, espaco, numeros, precos,
// depoimentos, logos), formatos de topo/rodape e animacoes. O servidor so aceita o
// que esta nas listas e transforma contato em link seguro (mailto:, tel:, wa.me).

test.describe.serial('elementos, topo/rodape e animacoes das paginas', () => {
  let tenant: Tenant;
  let pageId = '';
  let pageSlug = '';

  test.beforeAll(async ({ request }) => {
    tenant = await createTenant(request, await ownerStaff(request));
    const page = await (await call(request, 'post', '/site-pages', tenant.owner, { expected: [200, 201], data: { title: 'Início', template: 'blank' } })).json();
    pageId = page.id;
    pageSlug = page.slug;
  });

  test('elementos novos sao conferidos e links viram links seguros', async ({ request }) => {
    const saved = await (await call(request, 'patch', `/site-pages/${pageId}`, tenant.owner, {
      expected: 200,
      data: {
        blocks: [
          { id: 'v1', type: 'video', url: 'https://youtu.be/dQw4w9WgXcQ', caption: 'Nosso café' },
          { id: 'v2', type: 'video', url: 'javascript:alert(1)' },
          { id: 'm', type: 'map', address: 'Av. Paulista, 1000', zoom: 99, height: 5 },
          { id: 'f', type: 'faq', title: 'Dúvidas', items: [{ q: 'Abre domingo?', a: 'Sim' }, { q: '', a: 'sem pergunta' }] },
          { id: 'i', type: 'icons', columns: 9, layout: 'weird', items: [{ icon: 'skull', title: 'Rápido' }, { icon: 'heart', title: '' }] },
          {
            id: 's', type: 'social', style: 'labels', links: [
              { network: 'email', url: 'oi@cafe.com.br' }, { network: 'phone', url: '(11) 3333-0000' },
              { network: 'whatsapp', url: '(11) 99999-0000' }, { network: 'instagram', url: 'instagram.com/cafe' },
              { network: 'site', url: 'javascript:alert(1)' }, { network: 'orkut', url: 'https://orkut.com' },
            ],
          },
          { id: 'sp', type: 'spacer', height: 9999 },
          { id: 'st', type: 'stats', items: [{ value: '+500', label: 'clientes' }, { value: '', label: 'vazio' }] },
          { id: 'p', type: 'pricing', plans: [{ name: 'Básico', price: 'R$ 49', features: 'um\ndois\n\n', buttonLabel: 'Quero', buttonUrl: 'javascript:x', highlight: true }] },
          { id: 't', type: 'testimonials', items: [{ text: 'Amei!', author: 'Ana', photo: 'javascript:alert(1)' }] },
          { id: 'l', type: 'logos', gray: false, images: [{ url: 'https://example.com/logo.png', alt: 'Marca' }, { url: 'ftp://x' }] },
        ],
      },
    })).json();
    const by = Object.fromEntries(saved.blocks.map((b: { id: string }) => [b.id, b]));
    expect(by.v1).toEqual({ id: 'v1', type: 'video', url: 'https://youtu.be/dQw4w9WgXcQ', caption: 'Nosso café' });
    expect(by.v2.url).toBe('');
    expect(by.m).toMatchObject({ address: 'Av. Paulista, 1000', zoom: 20, height: 160 });
    expect(by.f.items).toEqual([{ q: 'Abre domingo?', a: 'Sim' }]);
    expect(by.i).toMatchObject({ columns: 3, layout: 'top', items: [{ icon: 'star', title: 'Rápido' }] });
    expect(by.s.links).toEqual([
      { network: 'email', url: 'mailto:oi@cafe.com.br' }, { network: 'phone', url: 'tel:1133330000' },
      { network: 'whatsapp', url: 'https://wa.me/11999990000' }, { network: 'instagram', url: 'https://instagram.com/cafe' },
    ]);
    expect(by.sp.height).toBe(400);
    expect(by.st.items).toEqual([{ value: '+500', label: 'clientes' }]);
    expect(by.p.plans).toEqual([{ name: 'Básico', price: 'R$ 49', features: ['um', 'dois'], highlight: true }]);
    expect(by.t.items).toEqual([{ text: 'Amei!', author: 'Ana' }]);
    expect(by.l).toMatchObject({ gray: false, images: [{ url: 'https://example.com/logo.png', alt: 'Marca' }] });
  });

  test('elemento sem o principal fica de rascunho e nao aparece na pagina', async ({ request }) => {
    await call(request, 'post', `/site-pages/${pageId}/publish`, tenant.owner, { expected: [200, 201], data: { publish: true } });
    const pub = await (await request.get(`${API}/site/${tenant.slug}/${pageSlug}`)).json();
    const ids = pub.blocks.map((b: { id: string }) => b.id);
    expect(ids).toContain('v1');
    expect(ids).not.toContain('v2');
    expect(ids).toEqual(expect.arrayContaining(['m', 'f', 'i', 's', 'sp', 'st', 'p', 't', 'l']));
  });

  test('animacao: do tema e por elemento', async ({ request }) => {
    const current = await (await call(request, 'get', `/site-pages/${pageId}`, tenant.owner)).json();
    const items = current.layout.sections[0].items.map((it: { id: string }, i: number) => (i === 0 ? { ...it, style: { anim: 'zoom' } } : i === 1 ? { ...it, style: { anim: 'explode' } } : it));
    const saved = await (await call(request, 'patch', `/site-pages/${pageId}`, tenant.owner, {
      expected: 200,
      data: { settings: { ownLook: true, theme: { animation: 'rise' } }, layout: { sections: [{ ...current.layout.sections[0], items }] } },
    })).json();
    expect(saved.settings.theme.animation).toBe('rise');
    expect(saved.layout.sections[0].items[0].style).toEqual({ anim: 'zoom' });
    expect(saved.layout.sections[0].items[1].style).toBeUndefined();
  });

  test('topo e rodape: formato, menu, botao de destaque e redes', async ({ request }) => {
    const site = await (await call(request, 'put', '/site-pages/site', tenant.owner, {
      expected: 200,
      data: {
        look: {}, menu: [],
        footer: { facebook: 'facebook.com/cafe', youtube: 'javascript:alert(1)', linkedin: 'https://linkedin.com/company/cafe' },
        header: { layout: 'inline', menuStyle: 'underline', sticky: true, hideLogo: true, logoSize: 'xl', cta: { label: 'Reservar', url: 'https://wa.me/5511999990000' }, extra: 1 },
        footerStyle: { layout: 'columns', tone: 'neon' },
      },
    })).json();
    expect(site.config.header).toEqual({ layout: 'inline', menuStyle: 'underline', sticky: true, hideLogo: true, cta: { label: 'Reservar', url: 'https://wa.me/5511999990000' } });
    expect(site.config.footerStyle).toEqual({ layout: 'columns' });
    expect(site.config.footer).toEqual({ facebook: 'https://facebook.com/cafe', linkedin: 'https://linkedin.com/company/cafe' });

    const noCta = await (await call(request, 'put', '/site-pages/site', tenant.owner, {
      expected: 200, data: { look: {}, menu: [], footer: {}, header: { layout: 'bogus', cta: { label: 'Sem link', url: '' } } },
    })).json();
    expect(noCta.config.header).toBeUndefined();

    await call(request, 'put', '/site-pages/site', tenant.owner, { expected: 200, data: { look: {}, menu: [], footer: {}, header: { layout: 'centered' }, footerStyle: { layout: 'minimal', tone: 'dark' } } });
    const pub = await (await request.get(`${API}/site/${tenant.slug}/${pageSlug}`)).json();
    expect(pub.site.header).toEqual({ layout: 'centered' });
    expect(pub.site.footerStyle).toEqual({ layout: 'minimal', tone: 'dark' });
    expect(pub.site.teamLink).toBe(false);
  });

  test('link "Area da equipe" no rodape: so quando a empresa liga', async ({ request }) => {
    const on = await (await call(request, 'put', '/site-pages/site', tenant.owner, { expected: 200, data: { look: {}, menu: [], footer: {}, teamLink: true } })).json();
    expect(on.config.teamLink).toBe(true);
    expect((await (await request.get(`${API}/site/${tenant.slug}/${pageSlug}`)).json()).site.teamLink).toBe(true);
    const off = await (await call(request, 'put', '/site-pages/site', tenant.owner, { expected: 200, data: { look: {}, menu: [], footer: {} } })).json();
    expect(off.config.teamLink).toBeUndefined();
  });
});
