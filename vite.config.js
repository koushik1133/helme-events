import { defineConfig } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApiHandler } from './src/services/devApi.js';

// ESM has no __dirname. `"type": "module"` is set in package.json, so derive it.
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DB_PATH = path.resolve(__dirname, 'src', 'data', 'backend_db.json');

/**
 * Mounts the local API (src/services/devApi.js) as dev-server middleware.
 *
 * This is the ONLY /api implementation in dev — there is no proxy fall-through
 * any more, so unknown /api routes get a real 404 instead of a 500 from a
 * connection-refused proxy. `npm run api` mounts the exact same handler on its
 * own port for anyone who wants the API standalone.
 *
 * `configureServer` means none of this exists in the production build. The
 * deployed app is a pure static SPA and persists to localStorage.
 */
function helmApiPlugin() {
  const handleApi = createApiHandler({
    dbPath: DB_PATH,
    // Same-origin only. No wildcard CORS, ever.
    allowedOrigins: []
  });

  const mount = (server) => {
    server.middlewares.use((req, res, next) => {
      if (!req.url || !req.url.startsWith('/api/')) return next();
      handleApi(req, res).catch((err) => {
        console.error('[helm-api] Unhandled error:', err);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, error: 'Internal server error' }));
      });
    });
  };

  return {
    name: 'vite-plugin-helm-api',
    configureServer: mount,
    // `npm run preview` now behaves like `npm run dev` instead of having no API.
    configurePreviewServer: mount
  };
}

export default defineConfig({
  // Absolute base ('/'). Deliberately NOT './': the Vercel SPA rewrite serves
  // index.html for arbitrary paths, and relative asset URLs would resolve
  // against the fake path and 404. Set an explicit base only if hosting
  // genuinely moves to a subpath.
  base: '/',
  plugins: [helmApiPlugin()],

  server: {
    port: 3002,
    strictPort: true,
    open: false
  },

  preview: {
    port: 3002,
    strictPort: true
  },

  build: {
    // NOT 'esnext'. esnext emits syntax that white-screens on any Safari/iOS or
    // in-app browser a version behind — unacceptable for a demo opened on a
    // client's own iPad. es2020 covers every browser from 2020 onward.
    target: 'es2020',
    sourcemap: false,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // three.js is ~60% of the JS. Split it out so it is fetched only when
        // the 3D editor is dynamically imported, and cached independently of
        // app code.
        manualChunks: {
          three: ['three'],
          confetti: ['canvas-confetti']
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]'
      }
    }
  }
});
