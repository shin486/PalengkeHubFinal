// Local static server for PalengkeHub.
// Serves:
//   - landing page  (landingpage-website/)              at /
//   - React admin   (web/dist/)                          at /admin/
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const LANDING_DIR = path.join(ROOT, 'PalengkeHubFinal-main', 'landingpage-website');
const ADMIN_DIR = path.join(ROOT, 'web', 'dist');
const PORT = process.env.PORT || 5173;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.apk': 'application/vnd.android.package-archive',
  '.txt': 'text/plain; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

function resolve(baseDir, urlPath) {
  // Decode and strip query string
  const clean = urlPath.split('?')[0];
  let decoded;
  try {
    decoded = decodeURIComponent(clean);
  } catch {
    decoded = clean;
  }
  // Prevent path traversal
  let rel = decoded.replace(/^\/+/, '');
  const filePath = path.normalize(path.join(baseDir, rel));
  if (!filePath.startsWith(baseDir)) return null;
  return filePath;
}

function sendFile(res, filePath) {
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found: ' + filePath);
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  const url = req.url || '/';

  // --- Admin app under /admin/ (SPA) ---
  // Only match /admin, /admin/, and /admin/<subpath>.
  // Does NOT match /admin-login.html or /admin.html (those are static landing pages).
  if (url === '/admin' || url.startsWith('/admin/')) {
    const rel = url.slice('/admin'.length) || '/';
    const filePath = resolve(ADMIN_DIR, rel);
    if (filePath) {
      fs.stat(filePath, (err, stat) => {
        if (!err && stat.isFile()) {
          sendFile(res, filePath);
        } else {
          // SPA fallback -> serve admin index.html
          sendFile(res, path.join(ADMIN_DIR, 'index.html'));
        }
      });
    } else {
      sendFile(res, path.join(ADMIN_DIR, 'index.html'));
    }
    return;
  }

  // --- Old static admin pages: redirect to the single React login/dashboard ---
  // Removed the static login; these URLs now go to the React login page.
  if (url === '/admin-login.html' || url === '/admin.html') {
    res.writeHead(302, { Location: '/admin/admin-login' });
    res.end();
    return;
  }

  // --- Landing page at root ---
  let filePath = resolve(LANDING_DIR, url);
  if (!filePath) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found');
    return;
  }
  fs.stat(filePath, (err, stat) => {
    if (!err && stat.isFile()) {
      sendFile(res, filePath);
    } else if (!err && stat.isDirectory()) {
      sendFile(res, path.join(filePath, 'index.html'));
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found: ' + url);
    }
  });
});

server.listen(PORT, () => {
  console.log(`PalengkeHub local server running:`);
  console.log(`  Landing page : http://localhost:${PORT}/`);
  console.log(`  Admin login  : http://localhost:${PORT}/admin-login.html`);
  console.log(`  Admin app    : http://localhost:${PORT}/admin/`);
});