/* 離線快取（Service Worker）
 * 策略：安裝時預先快取所有程式檔；之後
 *  - 頁面導覽：網路優先，失敗時用快取（離線也能開）
 *  - 其他同源檔案：先回快取、背景更新（下次開啟就是新版）
 *  - 跨網域（例如 Supabase）：不攔截，一律走網路
 * 更新程式後，把 VERSION 改一個新值，舊快取會在啟用時清掉。
 */
var VERSION = "meihua-v5";
var ASSETS = [
  "./", "index.html", "manifest.webmanifest", "css/style.css",
  "js/config.js", "js/data-zhouyi.js", "js/data-meihua.js", "js/data-guaying.js", "js/data-zi.js", "js/core.js", "js/app.js",
  "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png", "icons/apple-touch-icon.png", "icons/favicon.svg"
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(VERSION).then(function (c) {
      return Promise.all(ASSETS.map(function (u) { return c.add(new Request(u, { cache: "reload" })); }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // 不攔截跨網域

  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(VERSION).then(function (c) { c.put("index.html", copy); });
        return res;
      }).catch(function () {
        return caches.match("index.html").then(function (r) { return r || caches.match("./"); });
      })
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(function (cached) {
      var net = fetch(req).then(function (res) {
        if (res && res.ok) { var copy = res.clone(); caches.open(VERSION).then(function (c) { c.put(req, copy); }); }
        return res;
      }).catch(function () { return cached; });
      return cached || net;
    })
  );
});
