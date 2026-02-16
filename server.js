const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const os = require('os');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const ROOT = __dirname;

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function sendJson(res, status, body, extraHeaders = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    ...extraHeaders
  });
  res.end(JSON.stringify(body));
}

function serveStatic(req, res, pathname) {
  const requestedPath = pathname === '/' ? '/index.html' : pathname;
  const safePath = path.normalize(requestedPath).replace(/^([.]{2}[/\\])+/, '');
  const fullPath = path.join(ROOT, safePath);

  if (!fullPath.startsWith(ROOT)) {
    return sendJson(res, 403, { error: 'Forbidden' });
  }

  if (!fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory()) {
    return sendJson(res, 404, { error: 'Not found' });
  }

  const ext = path.extname(fullPath).toLowerCase();
  const mime = mimeTypes[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': mime, 'Access-Control-Allow-Origin': '*' });
  fs.createReadStream(fullPath).pipe(res);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  if (req.method === 'GET' && url.pathname === '/api/health') {
    return sendJson(res, 200, { ok: true, service: 'seller-tracker-static-server' });
  }

  serveStatic(req, res, url.pathname);
});

function getLanIp() {
  const nets = os.networkInterfaces();
  for (const iface of Object.values(nets)) {
    if (!iface) continue;
    for (const net of iface) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return null;
}

server.listen(PORT, HOST, () => {
  const lanIp = getLanIp();
  console.log(`Seller Tracker running on http://localhost:${PORT}`);
  if (lanIp) {
    console.log(`App page (same network): http://${lanIp}:${PORT}/index.html`);
  }
});
