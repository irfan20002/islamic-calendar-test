const CACHE_NAME = 'islamic-calendar-v9';
const ASSETS = ['islamic_fasting_calendar.html', 'manifest.json'];

// ── Install & cache ──────────────────────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// ── Activate & clean old caches ──────────────────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch (offline fallback) ─────────────────────────────────────────────
self.addEventListener('fetch', e => {
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});

// ── Notification click ───────────────────────────────────────────────────
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window' }).then(list => {
      if (list.length) return list[0].focus();
      return clients.openWindow('islamic_fasting_calendar.html');
    })
  );
});

// ── Push (from a push server, if ever added) ────────────────────────────
self.addEventListener('push', e => {
  const data = e.data ? e.data.json() : {};
  e.waitUntil(
    self.registration.showNotification(data.title || 'Islamic Fasting Calendar', {
      body: data.body || '',
      icon: 'icon-192.png',
      badge: 'icon-192.png',
      vibrate: [200, 100, 200]
    })
  );
});

// Notifications arrive via the 'push' handler above, sent by the server-side
// cron in islamic-fasting-push-server/server.js, which re-checks real
// wall-clock time every minute. The setTimeout-based scheduling that used to
// live here was removed: iOS suspends long-running setTimeout calls in the
// background and fires them late using stale data once the app resumes,
// which produced notifications (Suhoor, Maghrib, etc.) arriving hours after
// the event they were meant to announce.
