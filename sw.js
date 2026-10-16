// Service worker do Checklist de Obra
// Estratégia: tenta buscar a versão mais nova da internet (com limite de tempo);
// se estiver sem sinal ou lento, usa a cópia guardada. Assim o app abre offline em obra
// e, quando há internet, pega as atualizações sozinho.
const CACHE = 'checklist-obra-v1';
const ARQUIVOS = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];
const LIMITE_MS = 4000;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

function buscarComLimite(request) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('lento')), LIMITE_MS);
    fetch(request, { cache: 'no-cache' }).then(
      (resp) => { clearTimeout(timer); resolve(resp); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const resp = await buscarComLimite(req);
      if (resp && resp.ok) cache.put(req, resp.clone());
      return resp;
    } catch (e) {
      const guardado = await cache.match(req, { ignoreSearch: true });
      if (guardado) return guardado;
      if (req.mode === 'navigate') {
        const inicio = (await cache.match('./index.html')) || (await cache.match('./'));
        if (inicio) return inicio;
      }
      return new Response('Sem conexão e sem cópia guardada.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
  })());
});
