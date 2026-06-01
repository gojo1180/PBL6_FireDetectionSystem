// ============================================================
// PWA Offline Caching — v1.0
// ============================================================

const CACHE_NAME = 'pbl6-cache-v2';

const urlsToCache = [
  '/',
  '/dashboard',
  '/cctv',
  '/settings',
  '/globals.css',
];

// ---------- INSTALL: pre-cache critical assets ----------
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Pre-caching app shell');
      return cache.addAll(urlsToCache);
    })
  );
  // Activate new SW immediately without waiting for old tabs to close
  self.skipWaiting();
});

// ---------- ACTIVATE: purge stale caches ----------
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      )
    )
  );
  // Take control of all open tabs immediately
  self.clients.claim();
});

// ---------- FETCH: Network First, fallback to Cache ----------
self.addEventListener('fetch', (event) => {
  // Only intercept same-origin GET requests
  if (event.request.method !== 'GET') return;

  // Navigation requests (HTML pages) → Network First
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          // Stash a fresh copy in cache for next offline visit
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return networkResponse;
        })
        .catch(() => {
          // Network unavailable → serve cached version
          return caches.match(event.request).then((cached) => cached || caches.match('/'));
        })
    );
    return;
  }

  // Sub-resources (CSS, JS, images) → Cache First, revalidate in background
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return networkResponse;
        })
        .catch(() => cached);

      return cached || fetchPromise;
    })
  );
});

// ============================================================
// Push Notifications
// ============================================================

// v1.1 - Added requireInteraction
self.addEventListener('push', function (event) {
  // Data cadangan jika backend gagal mengirim JSON yang benar
  let data = {
    title: "🔥 Peringatan Sistem",
    body: "Ada pesan baru dari sistem PBL6.",
    url: "/dashboard"
  };

  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (err) {
    console.error("[SW] Gagal memproses data push:", err);
    // Kita biarkan pakai data cadangan agar Chrome tidak marah (tidak silent fail)
  }

  // Gunakan timestamp sebagai tag agar Chrome melihat ini sebagai notifikasi yang benar-benar baru
  const uniqueTag = 'pbl6-fire-alert-' + Date.now();

  const options = {
    body: data.body,
    icon: '/img/logo.png',
    badge: '/img/logo.png',
    vibrate: [200, 100, 200, 100, 200],
    tag: uniqueTag,
    requireInteraction: true,
    data: {
      url: data.url || '/'
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});