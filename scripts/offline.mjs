// Add a same-origin static shell to the production build. Voice requests
// and browser storage are handled by the page, outside this cache.
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';

const dist = new URL('../dist/', import.meta.url);
const pages = ['index.html', 'counter.html', 'dashboard.html', 'settings.html', 'privacy.html'];
const assets = (await readdir(new URL('assets/', dist))).sort().map((name) => `assets/${name}`);
const routes = [...pages, ...assets, 'theme-init.js', 'manifest.webmanifest', 'mark.svg', 'mark-192.png', 'mark-512.png'];
const stamp = createHash('sha256');
for (const route of routes) stamp.update(await readFile(new URL(route, dist)));

const worker = `
const scope = new URL(self.registration.scope);
const prefix = 'kirana-shell:' + scope.pathname + ':';
const name = prefix + '${stamp.digest('hex').slice(0, 16)}';
const routes = ${JSON.stringify(routes)};
const cachedUrls = new Set(routes.map((path) => new URL(path, scope).href));

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(name).then((cache) => cache.addAll([...cachedUrls])));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) =>
    Promise.all(keys.filter((key) => key.startsWith(prefix) && key !== name).map((key) => caches.delete(key)))
  ).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
  if (request.mode === 'navigate') {
    const route = url.pathname === scope.pathname ? new URL('index.html', scope).href : url.origin + url.pathname;
    if (!cachedUrls.has(route)) return;
    event.respondWith(fetch(request).catch(async () => (await caches.open(name)).match(route, { ignoreVary: true })));
  } else if (cachedUrls.has(url.href)) {
    event.respondWith(caches.open(name).then(async (cache) => (await cache.match(request, { ignoreVary: true })) || fetch(request)));
  }
});
`;
await writeFile(new URL('sw.js', dist), worker);

const fontFiles = new URL('../assets/fonts/', import.meta.url);
const licenseDir = new URL('fonts-licenses/', dist);
await mkdir(licenseDir, { recursive: true });
for (const file of await readdir(fontFiles)) {
  if (file.endsWith('-OFL.txt')) {
    await copyFile(new URL(file, fontFiles), new URL(file, licenseDir));
  }
}
