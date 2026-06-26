const CACHE_NAME = 'islamic-calendar-v7';
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

// ── Scheduled notification timers ───────────────────────────────────────
// Stored so we can cancel and reschedule when new times arrive
const _timers = [];

function clearAllTimers() {
  _timers.forEach(id => clearTimeout(id));
  _timers.length = 0;
}

function scheduleAt(ms, title, body, tag) {
  if (ms <= 0) return; // already passed
  const id = setTimeout(() => {
    self.registration.showNotification(title, {
      body,
      icon:      'icon-192.png',
      badge:     'icon-192.png',
      tag,                        // prevents duplicate banners for same event
      renotify:  true,
      vibrate:   [200, 100, 200]
    });
  }, ms);
  _timers.push(id);
}

// ── Message handler — receives prayer times from the HTML page ───────────
self.addEventListener('message', e => {
  if (!e.data || e.data.type !== 'SCHEDULE_NOTIFICATIONS') return;

  const { fajr, sunrise, maghrib, isha, isFastingDay } = e.data;
  if (!fajr || !maghrib) return;

  const now        = Date.now();
  const fajrMs     = new Date(fajr).getTime();
  const sunriseMs  = new Date(sunrise).getTime();
  const maghribMs  = new Date(maghrib).getTime();
  const ishaMs     = isha ? new Date(isha).getTime() : null;

  // Cancel any previously scheduled timers before rescheduling
  clearAllTimers();

  if (isFastingDay) {
    scheduleAt(fajrMs - 30 * 60000 - now, '🍽️ Suhoor time',             `Fajr is at ${formatTime(fajrMs)}. Eat and make your intention.`,    'suhoor-30');
    scheduleAt(fajrMs - 2  * 60000 - now, '⏰ Suhoor ending in 2 minutes', `Fajr at ${formatTime(fajrMs)}. Stop eating now.`,                   'suhoor-2');
    scheduleAt(fajrMs - now,               '🌄 Fajr time',                 `It is Fajr. Your fast has begun. May Allah accept it.`,             'fajr');
    scheduleAt(maghribMs - now,            '🌙 Iftar time!',               `Maghrib at ${formatTime(maghribMs)}. Break your fast. Allahu Akbar!`, 'iftar');
  } else {
    scheduleAt(maghribMs - now, '🕌 Maghrib prayer time', `Maghrib is at ${formatTime(maghribMs)}.`, 'maghrib');
  }

  // Ishraq — 25 min after sunrise, every day
  if (sunrise) scheduleAt(sunriseMs + 25 * 60000 - now, '🌅 Time to pray Ishraq', '25 minutes have passed since sunrise. Pray 2 rakats of Ishraq.', 'ishraq');

  // Isha — every day
  if (ishaMs) scheduleAt(ishaMs - now, '🌙 Isha prayer time', `Isha is at ${formatTime(ishaMs)}.`, 'isha');

  e.source && e.source.postMessage({ type: 'SCHEDULED_OK', timers: _timers.length });
});

// ── Helper: format a timestamp as "H:MM AM/PM" ──────────────────────────
function formatTime(ts) {
  const d    = new Date(ts);
  let h      = d.getHours();
  const m    = String(d.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h          = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}
