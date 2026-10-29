'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');
const { generateQuery, validateSelect, QueryError, MAX_ROWS } = require('./src/query-engine');

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DEFAULT_DB_PATH = path.join(ROOT, 'employee_management.db');
const DB_PATH = path.resolve(process.env.INSIGHTSQL_DB || DEFAULT_DB_PATH);
const HOST = '127.0.0.1';
const PORT = Number(process.env.PORT || 3000);
const MAX_BODY_BYTES = 8 * 1024;
const MAX_RESULT_ROWS = MAX_ROWS;
const HISTORY_LIMIT = 20;
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60_000;
const rateBuckets = new Map();

if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535.');
}
if (!fs.existsSync(DB_PATH)) {
  console.error(`Database not found: ${DB_PATH}`);
  console.error('Set INSIGHTSQL_DB to the path of an existing SQLite database, or restore employee_management.db.');
  process.exit(1);
}

let db;
try {
  db = new Database(DB_PATH, { readonly: true, fileMustExist: true, timeout: 5000 });
  db.pragma('query_only = ON');
  db.pragma('trusted_schema = OFF');
  assertDatabaseSchema();
} catch (error) {
  console.error('Could not open the database in read-only mode:', error.message);
  process.exit(1);
}

function assertDatabaseSchema() {
  const required = ['departments', 'employees', 'projects', 'employee_projects'];
  const rows = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all();
  const present = new Set(rows.map((row) => row.name));
  const missing = required.filter((table) => !present.has(table));
  if (missing.length) throw new Error(`Missing required tables: ${missing.join(', ')}`);
}

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml'
};

function setSecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'");
  res.setHeader('Cache-Control', 'no-store');
}

function sendJson(res, statusCode, body) {
  setSecurityHeaders(res);
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function requestIsLocal(req) {
  const remote = req.socket.remoteAddress || '';
  return remote === '127.0.0.1' || remote === '::1' || remote === '::ffff:127.0.0.1';
}

function validHostHeader(req) {
  const host = String(req.headers.host || '').toLowerCase();
  return host === `localhost:${PORT}` || host === `127.0.0.1:${PORT}` || host === 'localhost' || host === '127.0.0.1';
}

function consumeRateLimit(req) {
  const key = req.socket.remoteAddress || 'local';
  const now = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    rateBuckets.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (bucket.count >= RATE_LIMIT) return false;
  bucket.count += 1;
  return true;
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let tooLarge = false;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        tooLarge = true;
        chunks.length = 0;
        return;
      }
      if (!tooLarge) chunks.push(chunk);
    });
    req.on('end', () => {
      if (tooLarge) {
        reject(new QueryError('The request is too large. Shorten the question and try again.', 'REQUEST_TOO_LARGE'));
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new QueryError('The request body was not valid JSON.', 'INVALID_REQUEST'));
      }
    });
    req.on('error', reject);
  });
}

function runQuery(question) {
  const startedAt = performance.now();
  const generated = generateQuery(question);
  validateSelect(generated.sql);
  const statement = db.prepare(generated.sql);
  if (!statement.reader) throw new QueryError('This request was blocked because it is not read-only.', 'SQL_BLOCKED');
  const columns = statement.columns().map((column) => column.name);
  const allRows = statement.all(...generated.params);
  const rows = allRows.slice(0, MAX_RESULT_ROWS);
  return {
    question: generated.question,
    explanation: generated.explanation,
    sql: generated.sql,
    parameters: generated.params,
    columns,
    rows,
    rowCount: rows.length,
    truncated: allRows.length > MAX_RESULT_ROWS,
    durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
    executedAt: new Date().toISOString()
  };
}

async function handleRequest(req, res) {
  setSecurityHeaders(res);
  if (!requestIsLocal(req) || !validHostHeader(req)) {
    return sendJson(res, 403, { error: { code: 'LOCAL_ONLY', message: 'InsightSQL only accepts requests from this computer.' } });
  }

  let url;
  try {
    url = new URL(req.url, `http://${HOST}:${PORT}`);
  } catch {
    return sendJson(res, 400, { error: { code: 'INVALID_URL', message: 'That request URL is not valid.' } });
  }

  if (req.method === 'GET' && url.pathname === '/api/health') {
    return sendJson(res, 200, { status: 'ok', database: path.basename(DB_PATH), mode: 'read-only' });
  }

  if (req.method === 'POST' && url.pathname === '/api/query') {
    if (req.headers['content-type']?.split(';')[0].trim() !== 'application/json') {
      return sendJson(res, 415, { error: { code: 'JSON_REQUIRED', message: 'Send the question as JSON.' } });
    }
    if (!consumeRateLimit(req)) {
      return sendJson(res, 429, { error: { code: 'RATE_LIMIT', message: 'A few too many questions in a short time. Wait a moment and try again.' } });
    }
    const contentLength = Number(req.headers['content-length'] || 0);
    if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
      return sendJson(res, 413, { error: { code: 'REQUEST_TOO_LARGE', message: 'The request is too large. Shorten the question and try again.' } });
    }
    try {
      const body = await readJson(req);
      return sendJson(res, 200, { data: runQuery(body.question) });
    } catch (error) {
      if (error instanceof QueryError) {
        const status = error.code === 'QUESTION_NOT_SUPPORTED' || error.code === 'READ_ONLY_ONLY' ? 400
          : error.code === 'REQUEST_TOO_LARGE' ? 413 : 400;
        return sendJson(res, status, { error: { code: error.code, message: error.message } });
      }
      console.error('Query failed:', error.message);
      return sendJson(res, 422, { error: { code: 'QUERY_FAILED', message: 'I could not run that question against the database. Try a simpler question or choose one of the examples.' } });
    }
  }

  if (req.method === 'GET' && url.pathname.startsWith('/api/')) {
    return sendJson(res, 404, { error: { code: 'NOT_FOUND', message: 'That API route was not found.' } });
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return sendJson(res, 405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'This route only supports read requests.' } });
  }

  const requested = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
  const allowed = new Set(['index.html', 'app.js', 'styles.css']);
  if (!allowed.has(requested)) return sendJson(res, 404, { error: { code: 'NOT_FOUND', message: 'That page was not found.' } });

  const filePath = path.join(PUBLIC_DIR, requested);
  try {
    const content = await fs.promises.readFile(filePath);
    setSecurityHeaders(res);
    res.writeHead(200, { 'Content-Type': mimeTypes[path.extname(filePath)] || 'application/octet-stream' });
    res.end(req.method === 'HEAD' ? undefined : content);
  } catch {
    sendJson(res, 500, { error: { code: 'APP_FILE_MISSING', message: 'The InsightSQL interface could not be loaded.' } });
  }
}

const server = http.createServer((req, res) => {
  handleRequest(req, res).catch((error) => {
    console.error('Request failed:', error.message);
    if (!res.headersSent) sendJson(res, 500, { error: { code: 'SERVER_ERROR', message: 'Something went wrong. Refresh the page and try again.' } });
    else res.destroy();
  });
});

server.listen(PORT, HOST, () => {
  console.log(`InsightSQL is running at http://${HOST}:${PORT}`);
  console.log(`Database: ${DB_PATH} (read-only)`);
});

function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
