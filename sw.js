// Service worker do Segundo Cérebro: guarda a "casca" do app e recebe notificações push.
const CACHE = 'cerebro-v14';
const V = '?v=14';
const SHELL = ['./', './index.html', './app.js' + V, './style.css' + V, './manifest.webmanifest', './icon-180.png', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

// Casca: rede primeiro (para pegar atualizações), cache se estiver sem internet. A API nunca é cacheada.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith(
    // no-cache: sempre confere com o servidor, para nunca misturar arquivos velhos e novos.
    fetch(url.href, { cache: 'no-cache', credentials: 'same-origin' })
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('./index.html'))),
  );
});

self.addEventListener('push', (e) => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch { data = { title: 'Segundo Cérebro', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(
    self.registration.showNotification(data.title || 'Segundo Cérebro', {
      body: data.body || '',
      icon: './icon-192.png',
      badge: './icon-192.png',
      tag: data.id || undefined,
      requireInteraction: !!data.urgente,
      renotify: !!data.urgente,
      vibrate: data.urgente ? [400, 200, 400, 200, 400] : undefined,
      data: { url: data.url || './#avisos' },
    }),
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const target = new URL(e.notification.data?.url || './', self.registration.scope).href;
  // Links de fora (ex.: rota no Waze) abrem fora do app.
  if (new URL(target).origin !== self.location.origin) { e.waitUntil(self.clients.openWindow(target)); return; }
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) { c.navigate(target).catch(() => {}); return c.focus(); }
      }
      return self.clients.openWindow(target);
    }),
  );
});
