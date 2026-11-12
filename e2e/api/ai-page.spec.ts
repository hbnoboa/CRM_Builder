import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect } from '@playwright/test';
import { API, createTenant, ownerStaff, type Tenant } from './helpers';

// Assistente de paginas com IA (provedor de teste): a pagina vem conferida (secoes,
// grade, elementos, tema, topo, rodape) e as imagens enviadas ficam guardadas.
// Precisa da API com AI_BUILDER_PROVIDER=mock.

const IMAGE = join(__dirname, '../../apps/web-admin/public/brand/ios-logo.png');

test.describe('pagina com IA', () => {
  let tenant: Tenant;
  test.beforeAll(async ({ request }) => {
    tenant = await createTenant(request, await ownerStaff(request));
  });

  const headers = () => ({ Authorization: `Bearer ${tenant.owner.token}`, 'X-Tenant-Slug': tenant.owner.slug });
  const payload = (messages: Array<{ role: string; content: string }>, extra: Record<string, unknown> = {}) =>
    JSON.stringify({ messages, ...extra });

  test('monta a pagina com imagem de modelo e devolve tudo conferido', async ({ request }) => {
    const res = await request.post(`${API}/ai-builder/pages/propose`, {
      headers: headers(),
      multipart: {
        payload: payload([{ role: 'user', content: 'site da minha confeitaria, igual a esta imagem' }]),
        images: { name: 'modelo.png', mimeType: 'image/png', buffer: readFileSync(IMAGE) },
      },
    });
    expect(res.status(), await res.text()).toBe(200);
    const body = await res.json();
    expect(body.reply).toContain('1 imagem');
    expect(body.images).toHaveLength(1);
    expect(body.page.title).toBe('Início');
    const types = body.page.blocks.map((b: { type: string }) => b.type);
    expect(types).toEqual(expect.arrayContaining(['hero', 'heading', 'icons', 'text', 'map']));
    // Grade: texto e mapa lado a lado na terceira secao
    const third = body.page.layout.sections[2].items;
    expect(third.map((i: { x: number; w: number }) => [i.x, i.w])).toEqual([[0, 6], [6, 6]]);
    expect(body.page.layout.sections[2].tone).toBe('surface');
    // Foto + titulo, depois texto e botao em linhas: vao para a coluna ao lado da foto
    const beside = body.page.layout.sections[3].items.map((i: { x: number; y: number; w: number; h: number }) => [i.x, i.y, i.w, i.h]);
    expect(beside).toEqual([[0, 0, 6, 3], [6, 0, 6, 1], [6, 1, 6, 1], [6, 2, 6, 1]]);
    // Faixa com foto de fundo vem escurecida e com letra clara (texto legivel)
    expect(body.page.layout.sections[4]).toMatchObject({ bgImage: 'https://example.com/fundo.jpg', overlay: true, light: true });
    expect(body.page.settings.theme).toMatchObject({ fonts: { heading: 'playfair-display', body: 'lato' }, animation: 'rise' });
    expect(body.page.settings.accent).toBe('#0f766e');
    expect(body.header).toMatchObject({ layout: 'inline', cta: { label: 'Fale com a gente' } });
    expect(body.footerStyle).toEqual({ layout: 'columns', tone: 'dark' });

    // Pedido de mudanca parte da proposta atual
    const again = await request.post(`${API}/ai-builder/pages/propose`, {
      headers: headers(),
      multipart: {
        payload: payload([
          { role: 'user', content: 'site da minha confeitaria' }, { role: 'assistant', content: body.reply },
          { role: 'user', content: 'deixe mais elegante' },
        ], { currentProposal: body.proposal }),
      },
    });
    expect(again.status()).toBe(200);
    expect((await again.json()).images).toEqual([]);
  });

  test('recusa arquivo que nao e imagem e pedido mal formado', async ({ request }) => {
    const notImage = await request.post(`${API}/ai-builder/pages/propose`, {
      headers: headers(),
      multipart: {
        payload: payload([{ role: 'user', content: 'oi' }]),
        images: { name: 'x.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4') },
      },
    });
    expect(notImage.status()).toBe(400);
    const bad = await request.post(`${API}/ai-builder/pages/propose`, { headers: headers(), multipart: { payload: '{"messages":[]}' } });
    expect(bad.status()).toBe(400);
    const noLogin = await request.post(`${API}/ai-builder/pages/propose`, { multipart: { payload: payload([{ role: 'user', content: 'oi' }]) } });
    expect(noLogin.status()).toBe(401);
  });
});
