// DISHA 20-20 — Service Worker Web Push Handler
// Handles background push events, system notification rendering, and click actions

self.addEventListener('push', function (event) {
  let payload = {};
  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      payload = {
        title: 'DISHA 20-20 — अभ्यास अलर्ट',
        body: event.data.text() || 'नया अध्ययन अपडेट उपलब्ध है।'
      };
    }
  } else {
    payload = {
      title: 'DISHA 20-20 (दिशा 20-20)',
      body: 'आज का दैनिक अभ्यास और आरपीएससी मॉक टेस्ट उपलब्ध है।'
    };
  }

  const title = payload.title || 'DISHA 20-20 — दिशा 20-20';
  const options = {
    body: payload.body || 'नया परीक्षा अपडेट या अध्ययन सामग्री तैयार है।',
    icon: payload.icon || '/pwa-192x192.png',
    badge: payload.badge || '/icon.svg',
    vibrate: [100, 50, 150],
    tag: payload.tag || 'disha-broadcast',
    renotify: true,
    data: {
      url: payload.url || '/',
      timestamp: Date.now(),
      category: payload.category || 'exam'
    },
    actions: payload.actions || [
      { action: 'open_app', title: '🚀 अभ्यास शुरू करें' },
      { action: 'dismiss', title: 'बाद में' }
    ]
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url && 'focus' in client) {
          if ('navigate' in client && targetUrl !== '/') {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
