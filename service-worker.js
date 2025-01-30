const CACHE_NAME = 'onchain-survivor-cache-v1';
const urlsToCache = [
  '/',
  'index.html',
  'style.css',
  'Media/Classes/Onchain Survivor/MSURVIVOR.png',
  'app.js',
  'https://cdn.jsdelivr.net/npm/dat.gui/build/dat.gui.min.js',
  'https://cdn.jsdelivr.net/npm/web3@latest/dist/web3.min.js',
  'https://cdn.jsdelivr.net/npm/three@0.145.0/build/three.min.js',
  'https://cdn.jsdelivr.net/npm/three@0.145.0/examples/js/postprocessing/EffectComposer.js',
  'https://cdn.jsdelivr.net/npm/three@0.145.0/examples/js/postprocessing/RenderPass.js',
  'https://cdn.jsdelivr.net/npm/three@0.145.0/examples/js/postprocessing/ShaderPass.js',
  'https://cdn.jsdelivr.net/npm/three@0.145.0/examples/js/shaders/CopyShader.js',
  'https://cdn.jsdelivr.net/npm/three@0.145.0/examples/js/shaders/LuminosityHighPassShader.js',
  'https://cdn.jsdelivr.net/npm/three@0.145.0/examples/js/postprocessing/UnrealBloomPass.js',
  'https://cdn.jsdelivr.net/npm/three@0.145.0/examples/js/loaders/RGBELoader.js',
  'https://cdn.jsdelivr.net/npm/stats.js@0.17.0/build/stats.min.js'
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});
self.addEventListener('fetch', function(event) {
    event.respondWith(
      fetch(event.request)
        .then(function(response) {
          if (response.type === 'opaqueredirect') {
            return response;
          }
  
          let responseClone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, responseClone);
          });
  
          return response;
        })
        .catch(function() {
          return caches.match(event.request)
            .then(function(response) {
              return response || new Response('Offline content not available', {
                status: 404,
                statusText: 'Offline content not available'
              });
            });
        })
    );
  });
  

self.addEventListener('activate', function(event) {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
