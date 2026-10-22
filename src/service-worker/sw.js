/// <reference lib="webworker" />
// Service worker of the installable app (PWA): caches the study's files so it also works offline.
// Built by vite-plugin-pwa (see vite.config.js); not needed to understand the study itself.
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

// self.__WB_MANIFEST is the default injection point
precacheAndRoute(self.__WB_MANIFEST);

// clean old assets
cleanupOutdatedCaches();

/** @type {RegExp[] | undefined} */
const allowlist = [/^\/$/]; // Same allowlist for both dev and prod modes

// To allow work offline
registerRoute(new NavigationRoute(createHandlerBoundToURL("index.html"), { allowlist }));

console.log("⚙️ Service Worker is running");
