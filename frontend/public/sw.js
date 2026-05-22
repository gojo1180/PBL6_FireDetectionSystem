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
        icon: '/window.svg',
        badge: '/window.svg',
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