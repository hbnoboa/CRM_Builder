/*
 * Service worker do aplicativo instalavel (PWA). Leve de proposito:
 * - paginas: sempre da rede; sem conexao, mostra /offline.html;
 * - arquivos do build (/_next/static, com hash no nome): guardados depois da primeira vez;
 * - API, dados e o resto: nao passam por aqui (sem cache de dados);
 * - notificacoes (Web Push): mostra o aviso e, no toque, abre a tela dele.
 */
const VERSION = 'v1';
const SHELL = `shell-${VERSION}`;
const STATIC = `static-${VERSION}`;
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((cache) => cache.add(new Request(OFFLINE_URL, { cache: 'reload' }))));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== STATIC).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
    return;
  }
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.open(STATIC).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        const res = await fetch(request);
        if (res.ok) cache.put(request, res.clone());
        return res;
      }),
    );
  }
});

// Notificacao do sistema (Web Push): { title, body, url, icon, tag }
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { title: 'Aviso', body: event.data ? event.data.text() : '' }; }
  const title = data.title || 'Aviso';
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || '',
    icon: data.icon,
    badge: data.icon,
    tag: data.tag,
    renotify: !!data.tag,
    data: { url: data.url || '/' },
  }));
});

// Toque na notificacao: foca uma janela aberta do sistema e leva para a tela do aviso
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin);
  if (target.origin !== self.location.origin) return;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if (new URL(client.url).origin === self.location.origin && 'focus' in client) {
        await client.focus();
        if ('navigate' in client) return client.navigate(target.href);
        return;
      }
    }
    return self.clients.openWindow(target.href);
  })());
});
