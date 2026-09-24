// Service worker for /ops push notifications (outreach cockpit).
// Scope /ops only: it touches nothing else on the site and caches nothing.
// Payload shape comes from supabase/functions/_shared/opsPush.ts:
//   { title, body, url, tag }

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = { title: 'Cairnly outreach', body: 'Something needs you in /ops.', url: '/ops', tag: 'outreach' };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch (_) {
    // A non-JSON payload still shows the default.
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      tag: data.tag,
      renotify: true,
      icon: '/logos/apple-touch-icon.png',
      data: { url: data.url },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/ops';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const c of clients) {
        if (new URL(c.url).pathname.startsWith('/ops') && 'focus' in c) {
          c.navigate(target).catch(() => undefined);
          return c.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
