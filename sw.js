/* Service Worker v52.
   - Mã ứng dụng (cùng nguồn): MẠNG TRƯỚC, cache dự phòng khi mất mạng → người dùng luôn nhận bản mới nhất khi có mạng.
   - Thư viện CDN (đã ghim đúng phiên bản): cache trước.
   - Bản mới KHÔNG tự thay thế giữa chừng khi đang nhập liệu: chờ người dùng bấm "Tải lại" trên thanh thông báo. */
const V = 'mes-v54-bo-ma-don'; // đổi tên khi có bản mới để trình duyệt/TV tải lại toàn bộ mã
const CDN = [
  'https://cdn.jsdelivr.net/npm/react@18.2.0/umd/react.production.min.js',
  'https://cdn.jsdelivr.net/npm/react-dom@18.2.0/umd/react-dom.production.min.js',
  'https://cdn.jsdelivr.net/npm/prop-types@15.8.1/prop-types.min.js',
  'https://cdn.jsdelivr.net/npm/recharts@2.8.0/umd/Recharts.min.js',
  'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
];
const APP = [
  './',
  './index.html',
  './manifest.json',
  './assets/images.js',
  './core/runtime.js',
  './ui/icons.js',
  './ui/icons_extra.js',
  './ui/tokens.js',
  './domain/constants.js',
  './data/seed.js',
  './core/security.js',
  './core/collections.js',
  './core/policy.js',
  './core/guard.js',
  './core/concurrency.js',
  './core/validate.js',
  './core/backup.js',
  './data/defaults.js',
  './core/format.js',
  './domain/stages.js',
  './domain/alerts.js',
  './domain/kpi.js',
  './domain/flow.js',
  './domain/executive.js',
  './domain/search.js',
  './domain/opslive.js',
  './data/useAppData.js',
  './data/useExtraData.js',
  './data/flowdata.js',
  './modules/auth/login.js',
  './ui/layout.js',
  './modules/dashboard/roleoverview.js',
  './modules/dashboard/dashboard.js',
  './modules/orders/orders.js',
  './modules/orders/orderdetail.js',
  './modules/orders/ordersboard.js',
  './modules/orders/completed.js',
  './modules/machines/machines.js',
  './modules/plan/plan_modals.js',
  './modules/plan/plan.js',
  './modules/downtime/downtime.js',
  './modules/quality/quality.js',
  './modules/hr/hr.js',
  './modules/reports/reports.js',
  './modules/reports/reports_plus.js',
  './modules/keotrung/keotrung.js',
  './modules/admin/userform.js',
  './modules/documents/documents.js',
  './modules/admin/backupcard.js',
  './modules/admin/accounts.js',
  './modules/admin/admin.js',
  './modules/admin/permissions.js',
  './modules/app/appinner.js',
  './ui/grid.js',
  './ui/globalstyle.js',
  './ui/components.js',
  './ui/recordkit.js',
  './modules/records/section.js',
  './modules/records/pages_kho_qc.js',
  './modules/records/pages_ops_maint.js',
  './modules/ops/opsboard.js',
  './modules/records/pages_hr_docs.js',
  './modules/records/trace.js',
  './ui/dialog.js',
  './core/errorboundary.js',
  './core/boot.js'
];

self.addEventListener('install', e => e.waitUntil(
  caches.open(V).then(c => Promise.allSettled([
    ...CDN.map(u => c.add(u).catch(() => {})),
    ...APP.map(u => c.add(u + (u.endsWith('.js') ? '?v=54' : '')).catch(() => {})),
  ]))
));
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k))))
    .then(() => self.clients.claim())
));
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (u.hostname.includes('googleapis.com') || u.pathname.includes('/listen/')) return;
  // Realtime Database (REST + luồng SSE): KHÔNG được cache/can thiệp, nếu không sẽ đọc phải dữ liệu cũ hoặc treo luồng
  if (u.hostname.endsWith('firebasedatabase.app') || u.hostname.endsWith('firebaseio.com')) return;
  const sameOrigin = u.origin === self.location.origin;
  if (sameOrigin) {
    // mạng trước, cache dự phòng
    e.respondWith(
      fetch(req).then(r => {
        if (r && r.ok) { const copy = r.clone(); caches.open(V).then(c => c.put(req, copy)).catch(() => {}); }
        return r;
      }).catch(() => caches.match(req).then(c => c || new Response('', { status: 503 })))
    );
  } else {
    // thư viện CDN: cache trước
    e.respondWith(
      caches.match(req).then(c => c || fetch(req).then(r => {
        if (r && r.ok) { const copy = r.clone(); caches.open(V).then(cc => cc.put(req, copy)).catch(() => {}); }
        return r;
      }).catch(() => new Response('', { status: 503 })))
    );
  }
});
