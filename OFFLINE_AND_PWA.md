# Offline and PWA

`manifest.webmanifest` enables standalone installation. `sw.js` pre-caches the app shell, then runtime-caches same-origin build assets after the first successful load. IndexedDB stores completed runs without login.

The production service worker should later use generated revision hashes, explicit upgrade cleanup, an offline-update notice and automated offline browser tests. Google backup remains an optional adapter; it must never gate core play.
