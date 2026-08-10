import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

// Embedded API plugin so /api endpoints work in Vite dev server without external dependencies
function apiDevPlugin() {
  const dbPath = path.resolve(__dirname, 'src', 'data', 'backend_db.json');

  const getDb = () => {
    try {
      if (fs.existsSync(dbPath)) {
        return JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
      }
    } catch (e) {}
    return {
      state: {
        activeSelections: {
          'slot-stage-main': 'stage-led-arch',
          'slot-table-banquet': 'table-round-standard',
          'slot-chair-banquet': 'chair-chiavari-gold',
          'slot-backdrop-photo': 'backdrop-marigold-garland',
          'slot-lighting-main': 'lighting-chandeliers',
          'slot-fountain-main': 'fountain-royal-marble',
          'slot-sofa-lounge': 'sofa-royal-maharani',
          'slot-podium-main': 'stage-digital-podium'
        },
        currentZoneId: 'zone-stage',
        lastUpdated: new Date().toISOString()
      },
      swapHistory: [],
      proposals: [],
      vendors: [],
      bookings: []
    };
  };

  const saveDb = (data) => {
    try {
      const dir = path.dirname(dbPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) {}
  };

  return {
    name: 'vite-plugin-helme-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url.startsWith('/api/')) return next();

        const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        const pathname = url.pathname;

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');

        const db = getDb();

        if (pathname === '/api/health') {
          res.end(JSON.stringify({ status: 'ok', service: 'Helme Events 360 Embedded API' }));
          return;
        }

        if (pathname === '/api/state' && req.method === 'GET') {
          res.end(JSON.stringify({ success: true, data: db.state }));
          return;
        }

        if (req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            let data = {};
            try { data = body ? JSON.parse(body) : {}; } catch (e) {}

            if (pathname === '/api/state') {
              if (data.activeSelections) db.state.activeSelections = { ...db.state.activeSelections, ...data.activeSelections };
              if (data.currentZoneId) db.state.currentZoneId = data.currentZoneId;
              db.state.lastUpdated = new Date().toISOString();
              saveDb(db);
              res.end(JSON.stringify({ success: true, data: db.state }));
              return;
            }

            if (pathname === '/api/swap') {
              const { slotId, itemId, itemTitle, zoneId, category } = data;
              if (slotId && itemId) {
                db.state.activeSelections[slotId] = itemId;
                if (zoneId) db.state.currentZoneId = zoneId;
                db.state.lastUpdated = new Date().toISOString();
                db.swapHistory.unshift({
                  id: `swap_${Date.now()}`,
                  slotId, itemId, itemTitle, category: category || 'furniture', zoneId: zoneId || db.state.currentZoneId, timestamp: new Date().toISOString()
                });
                saveDb(db);
                res.end(JSON.stringify({ success: true, message: `Backend updated: ${itemTitle || itemId}`, activeSelections: db.state.activeSelections }));
                return;
              }
            }

            if (pathname === '/api/proposals') {
              const prop = { id: `prop_${Date.now()}`, ...data, createdAt: new Date().toISOString() };
              db.proposals.unshift(prop);
              saveDb(db);
              res.end(JSON.stringify({ success: true, proposal: prop }));
              return;
            }

            if (pathname === '/api/bookings') {
              const booking = { id: `book_${Date.now()}`, ...data, status: 'confirmed', createdAt: new Date().toISOString() };
              db.bookings.push(booking);
              saveDb(db);
              res.end(JSON.stringify({ success: true, booking }));
              return;
            }

            res.end(JSON.stringify({ success: true, received: data }));
          });
          return;
        }

        if (pathname === '/api/activity' && req.method === 'GET') {
          res.end(JSON.stringify({ success: true, swaps: db.swapHistory }));
          return;
        }

        next();
      });
    }
  };
}

export default defineConfig({
  plugins: [apiDevPlugin()],
  server: {
    port: 3009,
    open: false,
    proxy: {
      '/api': {
        target: 'http://localhost:3011',
        changeOrigin: true,
        secure: false,
        ws: true
      }
    }
  },
  build: {
    target: 'esnext'
  }
});
