const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = process.env.PORT || 8080;
const RISH_PATH = '/data/data/com.termux/files/home/shizuku_tools/rish';
const PUBLIC_DIR = path.join(__dirname, 'public');

let lastStatus = { authorized: false, checkedAt: 0, uid: '', error: 'Checking...' };
let isRequesting = false;

function checkShizukuStatus(callback) {
  const now = Date.now();
  if (now - lastStatus.checkedAt < 1200) {
    return callback(null, lastStatus);
  }

  exec(`timeout 3s ${RISH_PATH} -c "id" 2>&1`, (err, stdout, stderr) => {
    const output = ((stdout || '') + (stderr || '')).trim();
    if (output.includes('uid=2000(shell)') || output.includes('shell')) {
      lastStatus = {
        authorized: true,
        checkedAt: Date.now(),
        uid: output,
        user: 'shell (uid=2000)',
        error: null
      };
      callback(null, lastStatus);
    } else {
      let isDenied = output.includes('Permission denied');
      lastStatus = {
        authorized: false,
        checkedAt: Date.now(),
        uid: null,
        isDenied: isDenied,
        error: output || 'Waiting for Shizuku authorization...'
      };
      callback(null, lastStatus);
    }
  });
}

function parseJsonBody(req, callback) {
  let body = '';
  req.on('data', chunk => {
    body += chunk;
    if (body.length > 1e6) req.destroy();
  });
  req.on('end', () => {
    try {
      const data = body ? JSON.parse(body) : {};
      callback(null, data);
    } catch (e) {
      callback(e, null);
    }
  });
}

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  // Full CORS Headers for cross-origin web access (Cloudflare / GitHub Pages / localhost)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // GET /api/status
  if (pathname === '/api/status' && req.method === 'GET') {
    checkShizukuStatus((err, status) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        status: status,
        isRequesting: isRequesting
      }));
    });
    return;
  }

  // POST /api/request-permission
  if (pathname === '/api/request-permission' && req.method === 'POST') {
    isRequesting = true;
    exec('am start -n moe.shizuku.privileged.api/moe.shizuku.manager.MainActivity 2>/dev/null || true');

    // Run rish in background to trigger binder handshake
    exec(`timeout 20s ${RISH_PATH} -c "id" 2>&1`, (err, stdout, stderr) => {
      isRequesting = false;
      const out = ((stdout || '') + (stderr || '')).trim();
      if (out.includes('uid=2000(shell)') || out.includes('shell')) {
        lastStatus = {
          authorized: true,
          checkedAt: Date.now(),
          uid: out,
          user: 'shell (uid=2000)',
          error: null
        };
      }
    });

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      message: 'Permission trigger sent! Please open Shizuku > "Authorized Applications" and toggle Termux ON.'
    }));
    return;
  }

  // POST /api/exec
  if (pathname === '/api/exec' && req.method === 'POST') {
    parseJsonBody(req, (err, body) => {
      if (err || !body || !body.command) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Command is required' }));
        return;
      }

      const rawCommand = body.command.trim();
      const startTime = Date.now();
      const escapedCmd = rawCommand.replace(/'/g, "'\\''");
      const shellCmd = `${RISH_PATH} -c '${escapedCmd}'`;

      exec(shellCmd, { maxBuffer: 1024 * 1024 * 5, timeout: 30000 }, (error, stdout, stderr) => {
        const timeMs = Date.now() - startTime;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: !error || error.code === 0,
          command: rawCommand,
          stdout: stdout || '',
          stderr: stderr || '',
          exitCode: error ? (error.code || 1) : 0,
          timeMs: timeMs
        }));
      });
    });
    return;
  }

  // Static files fallback
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      filePath = path.join(PUBLIC_DIR, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.json': 'application/json; charset=utf-8'
    };
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(500);
        res.end('Server error');
        return;
      }
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    });
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`⚡ Shizuku ADB Web Terminal Bridge running at http://0.0.0.0:${PORT}`);
});
