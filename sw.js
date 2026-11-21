/* =====================================================================
 * Service Worker · 医学学习平台
 * 策略：
 *   1) 安装阶段预缓存核心外壳（index.html / manifest / 图标 / CSS / JS / 数据）
 *   2) 静态资源（css、js、png、data）→ cache-first
 *   3) 页面导航（HTML 请求）→ network-first，失败回退缓存
 *   4) B 站播放器等跨域请求 → 直接放行，不缓存（离线时视频不可用，其余功能不受影响）
 *   5) 数据本身存放在 localStorage，离线时全部核心功能可用
 * 更新：sw 检测到新版本时通过 postMessage(SKIP_WAITING) 立即切换，
 *      页面顶部提示"有新版本，点击更新"，由用户主动刷新（不强制刷新以免打断答题）。
 * ===================================================================== */

const VERSION = 'v2.4.0';
const CACHE_STATIC = 'med-static-' + VERSION;
const CACHE_PAGE = 'med-page-' + VERSION;

/* 预缓存清单（相对路径，部署到任意子目录均可用） */
const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './assets/app.css',
  './assets/app.js',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/icon-180.png',
  './assets/icon-maskable-512.png',
  './assets/favicon.png',
  './data/pharm-outline.js',
  './data/content-diag.js',
  './data/content-diag-2.js',
  './data/content-diag-3.js',
  './data/content-pharm.js',
  './data/content-pharm-2.js',
  './data/content-pharm-3.js',
  './data/content-diag-4.js',
  './data/content-diag-5.js',
  './data/content-pharm-4.js',
  './data/content-pharm-5.js',
  './data/content-extra-final.js',
  './data/content-final-2.js',
  './data/content.js',
  './data/questions-diag-1.js',
  './data/questions-diag-2.js',
  './data/questions-pharm-1.js',
  './data/questions-pharm-2.js',
  './data/videos.js',
  './data/mech.js',
  './data/mech-2.js',
  './data/mech-links.js'
];

/* ---------- install：预缓存 ---------- */
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_STATIC);
      // 逐个添加，单个失败不影响整体（例如某文件暂时缺失）
      await Promise.all(
        PRECACHE.map((url) =>
          cache.add(new Request(url, { cache: 'reload' })).catch(() => null)
        )
      );
      // 不自动 skipWaiting：等页面提示用户后主动更新
    })()
  );
});

/* ---------- activate：清理旧版本缓存 ---------- */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k !== CACHE_STATIC && k !== CACHE_PAGE)
          .map((k) => caches.delete(k))
      );
      if (self.registration.navigationPreload) {
        try { await self.registration.navigationPreload.disable(); } catch (e) {}
      }
      await self.clients.claim();
    })()
  );
});

/* ---------- 消息：页面点击"更新"后立即接管 ---------- */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

/* ---------- 判断是否同源 ---------- */
function isSameOrigin(url) {
  try {
    return new URL(url, self.location.href).origin === self.location.origin;
  } catch (e) {
    return false;
  }
}

function isStaticAsset(url) {
  return /\.(css|js|png|jpg|jpeg|svg|webp|ico|woff2?|ttf|json)(\?|$)/i.test(url);
}

/* ---------- fetch 拦截 ---------- */
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // 只处理 GET，且同源（B 站 iframe 等跨域请求直接放行）
  if (req.method !== 'GET') return;
  if (!isSameOrigin(req.url)) return;

  const url = req.url;

  // 页面导航：network-first，回退缓存，再回退离线页
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(CACHE_PAGE);
          cache.put(req, fresh.clone());
          return fresh;
        } catch (e) {
          const cache = await caches.open(CACHE_PAGE);
          const cached = await cache.match(req);
          if (cached) return cached;
          const staticCache = await caches.open(CACHE_STATIC);
          const shell = await staticCache.match('./index.html');
          if (shell) return shell;
          return new Response('离线且无缓存', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
          });
        }
      })()
    );
    return;
  }

  // 静态资源：cache-first
  if (isStaticAsset(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_STATIC);
        const cached = await cache.match(req, { ignoreSearch: true });
        if (cached) {
          // 后台静默更新（stale-while-revalidate）
          fetch(req)
            .then((res) => { if (res && res.ok) cache.put(req, res.clone()); })
            .catch(() => {});
          return cached;
        }
        try {
          const fresh = await fetch(req);
          if (fresh && fresh.ok) cache.put(req, fresh.clone());
          return fresh;
        } catch (e) {
          // 兜底：index 中引用的资源若缺失，返回空脚本避免整页崩溃
          if (/\.js(\?|$)/i.test(url)) {
            return new Response('/* offline: resource unavailable */', {
              headers: { 'Content-Type': 'application/javascript; charset=utf-8' }
            });
          }
          if (/\.css(\?|$)/i.test(url)) {
            return new Response('/* offline: resource unavailable */', {
              headers: { 'Content-Type': 'text/css; charset=utf-8' }
            });
          }
          return new Response('', { status: 504 });
        }
      })()
    );
    return;
  }

  // 其余同源请求：走缓存优先 + 网络兜底
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_STATIC);
      const cached = await cache.match(req);
      if (cached) return cached;
      try {
        return await fetch(req);
      } catch (e) {
        return new Response('', { status: 504 });
      }
    })()
  );
});
