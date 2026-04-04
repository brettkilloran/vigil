/* heartgarden — minimal service worker (install + claim only). No asset cache yet — see docs/FOLLOW_UP.md (PWA / offline). */
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
