const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const DATA_FILE = path.join(ROOT, 'beta-signups.json');
const AUTH_USER = 'kxrr1';
const AUTH_PASS = 'Iamsuperman2021';

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
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    ...extraHeaders
  });
  res.end(JSON.stringify(body));
}

function readSignups() {
  if (!fs.existsSync(DATA_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function writeSignups(signups) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(signups, null, 2));
}

function collectBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > 1_000_000) {
        reject(new Error('Payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function isAuthorized(req) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Basic ')) return false;
  const decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf8');
  const [username, password] = decoded.split(':');
  return username === AUTH_USER && password === AUTH_PASS;
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

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'OPTIONS' && url.pathname.startsWith('/api/')) {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    return res.end();
  }

  if (req.method === 'POST' && url.pathname === '/api/signups') {
    try {
      const raw = await collectBody(req);
      const body = raw ? JSON.parse(raw) : {};
      const email = String(body.email || '').trim().toLowerCase();
      const name = String(body.name || 'Guest').trim().slice(0, 100) || 'Guest';

      if (!email || !email.includes('@')) {
        return sendJson(res, 400, { error: 'A valid email is required' });
      }

      const signups = readSignups();
      if (signups.some(item => item.email === email)) {
        return sendJson(res, 200, { ok: true, duplicate: true, message: 'Already signed up' });
      }

      signups.push({
        id: Date.now(),
        name,
        email,
        source: 'seller-tracker-ui',
        createdAt: new Date().toISOString()
      });
      writeSignups(signups);

      return sendJson(res, 201, { ok: true, message: 'Signup received' });
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON payload' });
    }
  }

  if (req.method === 'GET' && url.pathname === '/api/signups') {
    if (!isAuthorized(req)) {
      return sendJson(res, 401, { error: 'Authentication required' }, { 'WWW-Authenticate': 'Basic realm="Beta Signups"' });
    }

    const signups = readSignups();
    return sendJson(res, 200, { ok: true, total: signups.length, signups });
  }

  serveStatic(req, res, url.pathname);
});

server.listen(PORT, () => {
  console.log(`Seller Tracker running on http://localhost:${PORT}`);
});
