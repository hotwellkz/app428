const CACHE_NAME = 'hotwell-cache-v7'; // v7: не перехватываем API — без ложного 503 от SW
const SETTINGS_CACHE_NAME = 'hotwell-settings-v1';

const CACHED_URLS = [
  '/',
  '/client-files',
  '/index.html',
  '/manifest.json',
  '/vite.svg'
];

// Функция для проверки свежести кэша
const isResponseFresh = (response) => {
  if (!response) return false;
  const fetchDate = response.headers.get('date');
  if (!fetchDate) return false;
  
  const date = new Date(fetchDate);
  const age = (new Date().getTime() - date.getTime()) / 1000;
  // Считаем кэш устаревшим после 1 часа
  return age < 3600;
};

// Функция для проверки поддерживаемых схем
const isSupportedScheme = (url) => {
  try {
    const urlObj = new URL(url);
    // Поддерживаем только http, https и относительные пути
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:' || urlObj.protocol === '';
  } catch (error) {
    return false;
  }
};

// Функция для создания корректного Response объекта при ошибках
const createErrorResponse = (status = 500) => {
  return new Response('Service Worker Error', {
    status: status,
    statusText: 'Service Worker Error',
    headers: new Headers({
      'Content-Type': 'text/plain'
    })
  });
};

// При установке Service Worker
self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker installing...');
  // Немедленно активируем новый Service Worker
  self.skipWaiting();
  
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_NAME)
        .then((cache) => {
          console.log('📦 Caching initial resources...');
          return cache.addAll(CACHED_URLS);
        }),
      caches.open(SETTINGS_CACHE_NAME)
    ]).then(() => {
      console.log('✅ Service Worker installed successfully');
    }).catch((error) => {
      console.error('❌ Service Worker installation failed:', error);
    })
  );
});

// При активации нового Service Worker
self.addEventListener('activate', (event) => {
  console.log('🚀 Service Worker activating...');
  // Немедленно начинаем контролировать все страницы
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      // Удаляем старые версии кэша
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            // Очищаем все кэши, кроме актуальных
            if (cacheName !== CACHE_NAME && cacheName !== SETTINGS_CACHE_NAME) {
              console.log('🗑️ Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }

            // Дополнительно чистим возможные старые записи для /calculator
            return caches.open(cacheName).then((cache) =>
              cache.keys().then((requests) =>
                Promise.all(
                  requests.map((request) => {
                    try {
                      const url = new URL(request.url);
                      if (url.pathname === '/calculator' || url.pathname.startsWith('/calculator/')) {
                        console.log('🗑️ Deleting cached /calculator entry:', request.url);
                        return cache.delete(request);
                      }
                    } catch (e) {
                      // игнорируем ошибки парсинга URL
                    }
                    return Promise.resolve(false);
                  })
                )
              )
            );
          })
        );
      })
    ]).then(() => {
      console.log('✅ Service Worker activated successfully');
    }).catch((error) => {
      console.error('❌ Service Worker activation failed:', error);
    })
  );
});

self.addEventListener('fetch', (event) => {
  // ВАЖНО: Игнорируем неподдерживаемые схемы
  if (!isSupportedScheme(event.request.url)) {
    console.log('⚠️ Ignoring unsupported scheme:', event.request.url);
    return; // Не обрабатываем запрос, пусть браузер сам решает
  }

  const url = new URL(event.request.url);

  // Не перехватываем запросы к другим доменам (CORS): картинки/ресурсы с hotwell.kz и т.д. загружаются браузером без fetch()
  try {
    const appOrigin = self.registration.scope ? new URL(self.registration.scope).origin : (self.location && self.location.origin);
    if (appOrigin && url.origin !== appOrigin) {
      return;
    }
  } catch (e) {
    // при ошибке не перехватываем cross-origin
  }

  // Полностью отключаем кэширование для маршрута /calculator
  if (url.pathname === '/calculator' || url.pathname.startsWith('/calculator/')) {
    event.respondWith(fetch(event.request).catch(() => createErrorResponse(503)));
    return;
  }

  // Netlify Functions и /api/* (редиректы на функции) — НЕ перехватываем.
  // Иначе при сбое fetch() в SW Chrome показывает «503 (Service Worker Error)», хотя
  // прямой запрос от страницы мог бы пройти. Без respondWith() сработает обычная сеть.
  if (url.pathname.startsWith('/.netlify/functions') || url.pathname.startsWith('/api/')) {
    return;
  }

  // Игнорируем запросы к расширениям браузера
  if (url.protocol === 'chrome-extension:' ||
      url.protocol === 'moz-extension:' ||
      url.protocol === 'safari-extension:') {
    return;
  }

  // Для запросов к настройкам используем отдельный кэш
  if (url.pathname.startsWith('/settings/')) {
    event.respondWith(
      caches.match(event.request)
        .then((response) => {
          if (response) {
            return response;
          }
          return fetch(event.request).catch(() => {
            return createErrorResponse(404);
          });
        })
        .catch((error) => {
          console.error('❌ Settings cache error:', error);
          return createErrorResponse(500);
        })
    );
    return;
  }

  // Другие API-подобные запросы (не перехватываем)
  const isNonGetRequest = event.request.method !== 'GET';
  if (isNonGetRequest) return;

  // Для HTML запросов используем Network First (только GET)
  if (url.pathname === '/' || 
      url.pathname.endsWith('.html') ||
      url.pathname.startsWith('/transactions') ||
      url.pathname.startsWith('/client-files')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Проверяем валидность ответа
          if (!response || !response.ok) {
            return response || createErrorResponse(500);
          }

          // Кэшируем только GET запросы для HTML
          try {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                if (isSupportedScheme(event.request.url) && event.request.method === 'GET') {
                  cache.put(event.request, responseToCache).catch((error) => {
                    console.warn('⚠️ Failed to cache response:', error);
                  });
                }
              })
              .catch((error) => {
                console.warn('⚠️ Failed to open cache:', error);
              });
          } catch (error) {
            console.warn('⚠️ Failed to clone response for caching:', error);
          }
          
          return response;
        })
        .catch((error) => {
          console.warn('🌐 Network request failed, trying cache:', error);
          // При ошибке сети возвращаем из кэша (только для GET)
          return caches.match(event.request)
            .then(response => {
              if (response) {
                // Если кэш устарел, показываем уведомление
                if (!isResponseFresh(response)) {
                  // Отправляем сообщение клиенту о том, что контент может быть устаревшим
                  try {
                    self.clients.matchAll().then(clients => {
                      clients.forEach(client => {
                        client.postMessage({
                          type: 'CACHE_OUTDATED',
                          url: event.request.url
                        });
                      });
                    }).catch((error) => {
                      console.warn('⚠️ Failed to notify clients:', error);
                    });
                  } catch (error) {
                    console.warn('⚠️ Failed to match clients:', error);
                  }
                }
                return response;
              }
              // Если нет в кэше, возвращаем страницу ошибки или создаем Response
              return caches.match('/offline.html').then(offlineResponse => {
                return offlineResponse || createErrorResponse(503);
              });
            })
            .catch((cacheError) => {
              console.error('❌ Cache lookup failed:', cacheError);
              return createErrorResponse(503);
            });
        })
    );
    return;
  }

  // Vite dev: чанки и @vite/client меняются каждую секунду — не кэшировать (иначе бесконечные reload)
  if (
    url.pathname.includes('@vite') ||
    url.pathname.includes('/node_modules/') ||
    url.pathname.includes('/src/') ||
    url.searchParams.has('t') ||
    url.searchParams.has('v')
  ) {
    event.respondWith(fetch(event.request).catch(() => createErrorResponse(503)));
    return;
  }

  // Для остальных ресурсов используем Cache First
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Если ресурс найден в кэше и свежий, возвращаем его
        if (response && isResponseFresh(response)) {
          return response;
        }

        // Иначе делаем запрос к сети
        return fetch(event.request).then(
          (response) => {
            // Проверяем валидность ответа
            if (!response || response.status !== 200) {
              return response || createErrorResponse(404);
            }

            // Кэшируем статику (именованные чанки в prod с хешем; dev не идёт сюда — см. bypass выше)
            try {
              const responseToCache = response.clone();
              caches.open(CACHE_NAME)
                .then((cache) => {
                  const url = event.request.url;
                  if (isSupportedScheme(url) && (
                    url.endsWith('.pdf') ||
                    url.endsWith('.jpg') ||
                    url.endsWith('.jpeg') ||
                    url.endsWith('.png') ||
                    url.endsWith('.gif') ||
                    url.endsWith('.doc') ||
                    url.endsWith('.docx') ||
                    url.endsWith('.xls') ||
                    url.endsWith('.xlsx') ||
                    url.endsWith('.js') ||
                    url.endsWith('.css')
                  )) {
                    cache.put(event.request, responseToCache).catch((cacheError) => {
                      console.warn('⚠️ Failed to cache static resource:', cacheError);
                    });
                  }
                })
                .catch((error) => {
                  console.warn('⚠️ Failed to open cache for static resources:', error);
                });
            } catch (error) {
              console.warn('⚠️ Failed to clone response for static caching:', error);
            }

            return response;
          }
        ).catch((fetchError) => {
          console.warn('🌐 Static resource fetch failed:', fetchError);
          // Если есть в кэше, возвращаем даже устаревший контент
          if (response) {
            return response;
          }
          return createErrorResponse(404);
        });
      })
      .catch((cacheError) => {
        console.error('❌ Cache lookup failed for static resource:', cacheError);
        return createErrorResponse(500);
      })
  );
});

// Обработчик сообщений от клиентов
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Обработчик ошибок
self.addEventListener('error', (event) => {
  console.error('❌ Service Worker error:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('❌ Service Worker unhandled rejection:', event.reason);
  event.preventDefault();
});
