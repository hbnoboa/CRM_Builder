import { test, expect, type APIRequestContext } from '@playwright/test';
import { API, call, createTenant, ownerStaff, type Tenant } from './helpers';

// Anexos no chat: imagem/arquivo vai para o armazenamento da empresa e vira
// mensagem "attachment"; tipo nao aceito e recusado; outra empresa nao envia.

// PNG 1x1 transparente
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

test.describe.serial('anexos no chat', () => {
  let tenant: Tenant;
  let other: Tenant;
  let channelId = '';

  test.beforeAll(async ({ request }) => {
    const staff = await ownerStaff(request);
    tenant = await createTenant(request, staff);
    other = await createTenant(request, staff);
    await call(request, 'post', '/entities', tenant.owner, {
      expected: [200, 201], data: { name: 'Pedido', slug: 'pedidos', fields: [{ slug: 'numero', name: 'Número', type: 'text' }] },
    });
    channelId = (await (await call(request, 'post', '/chat/channels/group/pedidos', tenant.owner, { expected: [200, 201] })).json()).id;
  });

  const send = (request: APIRequestContext, token: string, file: { name: string; mimeType: string; buffer: Buffer }, caption?: string) =>
    request.post(`${API}/chat/channels/${channelId}/attachments`, {
      headers: { Authorization: `Bearer ${token}` },
      multipart: { file, ...(caption ? { caption } : {}) },
    });

  test('imagem e PDF viram mensagens com o anexo', async ({ request }) => {
    const img = await send(request, tenant.owner.token, { name: 'foto do bolo.png', mimeType: 'image/png', buffer: PNG }, 'Olha o bolo de hoje');
    expect(img.status(), await img.text()).toBe(201);
    const msg = await img.json();
    expect(msg.type).toBe('attachment');
    expect(msg.content).toBe('Olha o bolo de hoje');
    expect(msg.meta.attachments[0]).toMatchObject({ name: 'foto do bolo.png', kind: 'image', mime: 'image/png' });
    expect(msg.meta.attachments[0].url).toContain(`${tenant.id}/chat/`);

    const pdf = await send(request, tenant.owner.token, { name: 'cardapio.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n%%EOF') });
    expect(pdf.status()).toBe(201);
    expect((await pdf.json()).content).toBe('📎 cardapio.pdf');

    const list = await (await call(request, 'get', `/chat/channels/${channelId}/messages`, tenant.owner, { expected: 200 })).json();
    const items = (list.data ?? list.messages ?? list) as Array<{ type: string }>;
    expect(items.filter((m) => m.type === 'attachment')).toHaveLength(2);
  });

  test('tipo nao aceito e outra empresa sao recusados', async ({ request }) => {
    const exe = await send(request, tenant.owner.token, { name: 'virus.exe', mimeType: 'application/x-msdownload', buffer: Buffer.from('MZ') });
    expect(exe.status()).toBe(400);
    const stranger = await send(request, other.owner.token, { name: 'x.png', mimeType: 'image/png', buffer: PNG });
    expect([403, 404]).toContain(stranger.status());
  });
});
