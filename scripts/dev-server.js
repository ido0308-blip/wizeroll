// Local preview: serves the site and runs api/advise.js on one port.
// Run from the project root: node scripts/dev-server.js

import { existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, resolve, sep } from 'node:path';
import handler from '../api/advise.js';

const PORT = Number(process.env.PORT) || 8000;
const ROOT = resolve('.');
const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

if (existsSync('.env')) process.loadEnvFile('.env');

function addResponseHelpers(res) {
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(body));
  };
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  try {
    return JSON.parse(Buffer.concat(chunks).toString() || '{}');
  } catch {
    return {};
  }
}

function serveStatic(pathname, res) {
  const relative = pathname === '/' ? 'index.html' : decodeURIComponent(pathname).slice(1);
  const file = resolve(join(ROOT, relative));
  const contentType = CONTENT_TYPES[extname(file).toLowerCase()];
  const allowed = file.startsWith(ROOT + sep) && contentType && existsSync(file) && statSync(file).isFile();
  if (!allowed) {
    res.statusCode = 404;
    return res.end('Not found');
  }
  res.setHeader('Content-Type', contentType);
  return res.end(readFileSync(file));
}

createServer(async (req, res) => {
  const { pathname } = new URL(req.url, `http://localhost:${PORT}`);
  if (pathname === '/api/advise') {
    addResponseHelpers(res);
    req.body = req.method === 'POST' ? await readJsonBody(req) : undefined;
    return handler(req, res);
  }
  return serveStatic(pathname, res);
}).listen(PORT, '127.0.0.1', () => {
  console.log(`WIZEROLL preview: http://localhost:${PORT}`);
  console.log(`Gemini key: ${process.env.GEMINI_API_KEY ? 'loaded' : 'missing, add it to .env'}`);
});
