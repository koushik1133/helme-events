#!/usr/bin/env node
/**
 * Helm Events 360° — standalone local API server.
 *
 *     npm run api            # http://127.0.0.1:3011
 *     PORT=4000 npm run api
 *
 * You do NOT need this for normal development: `npm run dev` mounts the exact
 * same handler as Vite middleware on port 3002. Use this only when you want the
 * API without the dev server (e.g. driving it from curl, or pointing a second
 * front end at it).
 *
 * All routing, validation, body-size limiting and persistence live in
 * src/services/devApi.js — this file is only process plumbing. There is no
 * second copy of the routes.
 *
 * This is a LOCAL DEVELOPMENT tool. It binds to loopback only, has no
 * authentication, and is never deployed. Vercel's filesystem is read-only, so
 * a file-backed store cannot run there; production is a static SPA that
 * persists to localStorage.
 */

import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApiHandler } from './src/services/devApi.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = Number(process.env.PORT) || 3011;
// Loopback only. Never 0.0.0.0 — this server has no auth.
const HOST = '127.0.0.1';
const DB_PATH = path.join(__dirname, 'src', 'data', 'backend_db.json');

/**
 * Explicit origin allow-list instead of `Access-Control-Allow-Origin: *`.
 * Defaults to the Vite dev origins; override with a comma-separated
 * HELM_API_ALLOWED_ORIGINS.
 */
const allowedOrigins = (process.env.HELM_API_ALLOWED_ORIGINS ||
  'http://localhost:3002,http://127.0.0.1:3002')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const handleApi = createApiHandler({ dbPath: DB_PATH, allowedOrigins });

const server = http.createServer((req, res) => {
  // Every route is wrapped: a throw inside a handler returns 500, it does not
  // take the process down.
  handleApi(req, res)
    .then((handled) => {
      if (handled) return;
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({
        success: false,
        error: 'Not found. This server only serves /api/*; the UI is served by `npm run dev`.'
      }));
    })
    .catch((err) => {
      console.error('[helm-api] Unhandled error:', err);
      if (res.headersSent) { res.destroy(); return; }
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: false, error: 'Internal server error' }));
    });
});

// Reject slow-loris style connections and cap header size.
server.headersTimeout = 10_000;
server.requestTimeout = 30_000;
server.maxHeadersCount = 64;

server.on('clientError', (err, socket) => {
  if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[helm-api] Port ${PORT} is already in use. Set PORT=<other> and retry.`);
  } else {
    console.error('[helm-api] Server error:', err);
  }
  process.exit(1);
});

const shutdown = (signal) => () => {
  console.log(`\n[helm-api] ${signal} received, shutting down.`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000).unref();
};
process.on('SIGINT', shutdown('SIGINT'));
process.on('SIGTERM', shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => {
  console.error('[helm-api] Unhandled rejection:', reason);
});

server.listen(PORT, HOST, () => {
  console.log(`[helm-api] Helm Events 360° local API on http://${HOST}:${PORT}`);
  console.log(`[helm-api] Store: ${DB_PATH}`);
  console.log(`[helm-api] CORS allow-list: ${allowedOrigins.join(', ') || '(same-origin only)'}`);
});
