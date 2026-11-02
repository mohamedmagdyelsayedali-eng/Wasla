// وصلة - Service Worker (network-first: التحديثات بتظهر على طول، وبيشتغل أوفلاين لو النت قطع)
// + استقبال الإشعارات (Web Push) لطلبات التوصيل الجديدة
const CACHE = 'wasla-v2';
const CORE = ['./', 'index.html', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  // مش بنلمس أي حاجة مش من موقعنا (زي Supabase) ولا الطلبات غير GET
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then((r) => r || caches.match('index.html')))
  );
});

// ===== الإشعارات =====
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { body: e.data ? e.data.text() : '' }; }
  const title = d.title || '🛵 طلب جديد';
  const opts = {
    body: d.body || 'فيه طلب توصيل جديد في منطقتك.',
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    tag: d.tag || 'wasla-order',
    renotify: true,
    dir: 'rtl',
    lang: 'ar',
    vibrate: [200, 100, 200, 100, 200],
    data: { url: d.url || './' }
  };
  e.waitUntil(self.registration.showNotification(title, opts));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const target = new URL((e.notification.data && e.notification.data.url) || './', self.location.origin + self.location.pathname.replace(/sw\.js$/, '')).href;
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) { c.navigate && c.navigate(target).catch(() => {}); return c.focus(); }
      }
      return self.clients.openWindow(target);
    })
  );
});
