// 缓存名称 - 在更新时修改此版本以清除旧缓存
const CACHE_NAME = 'code-map-cache-v1.0.0';

// 需要缓存的资源列表
const urlsToCache = [
  '/code-map/',
  '/code-map/index.html',
  '/code-map/style.css',
  '/code-map/script.js',
  // 添加需要缓存的CDN资源
  'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.7.0/highlight.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.7.0/styles/github.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.7.0/languages/php.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.7.0/languages/typescript.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.7.0/languages/javascript.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.7.0/languages/java.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.7.0/languages/csharp.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.7.0/languages/python.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.7.0/languages/go.min.js'
];

// 安装Service Worker并缓存所有资源
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker 正在缓存资源');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting()) // 确保新安装的Service Worker立即激活
  );
});

// 激活时清除旧缓存
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker 正在删除旧缓存: ' + cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim()) // 控制所有打开的客户端
  );
});

// 拦截网络请求优先使用缓存
self.addEventListener('fetch', event => {
  // 对于跨域CDN资源，确保正确处理
  if (event.request.url.includes('cdnjs.cloudflare.com')) {
    event.respondWith(
      caches.match(event.request)
        .then(response => {
          // 如果在缓存中找到了响应，则返回缓存的版本
          if (response) {
            return response;
          }
          
          // 复制请求以进行网络获取
          return fetch(event.request.clone()).then(
            response => {
              // 检查是否是有效响应
              if (!response || response.status !== 200 || response.type !== 'basic' && response.type !== 'cors') {
                return response;
              }
              
              // 将响应复制到缓存中
              let responseToCache = response.clone();
              caches.open(CACHE_NAME)
                .then(cache => {
                  cache.put(event.request, responseToCache);
                });
                
              return response;
            }
          );
        })
    );
  } else {
    // 非CDN资源的标准处理
    event.respondWith(
      caches.match(event.request)
        .then(response => {
          // 缓存优先策略
          if (response) {
            return response;
          }
          
          // 如果缓存中没有，则从网络获取
          return fetch(event.request);
        })
    );
  }
});

// 当网站离线时，将显示离线页面
self.addEventListener('fetch', event => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match('/code-map/index.html');
      })
    );
  }
}); 