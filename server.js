import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 3011;
const DB_PATH = path.join(__dirname, 'src', 'data', 'backend_db.json');

// Default initial state
const defaultDb = {
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

// Initialize DB file if not present
function loadDb() {
  try {
    if (fs.existsSync(DB_PATH)) {
      const raw = fs.readFileSync(DB_PATH, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('[Backend API] Error reading DB file, using default:', err.message);
  }
  saveDb(defaultDb);
  return defaultDb;
}

function saveDb(data) {
  try {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Backend API] Error writing DB file:', err.message);
  }
}

let db = loadDb();

const server = http.createServer((req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // Helper to parse JSON body
  const getBody = () => new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
  });

  // Helper JSON responder
  const sendJson = (statusCode, data) => {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  };

  console.log(`[Backend API] ${req.method} ${pathname}`);

  // Routes
  if (pathname === '/api/health') {
    return sendJson(200, {
      status: 'ok',
      service: 'Helme Events 360 Backend API',
      timestamp: new Date().toISOString(),
      activeZone: db.state.currentZoneId,
      totalSwaps: db.swapHistory.length
    });
  }

  if (pathname === '/api/state' && req.method === 'GET') {
    return sendJson(200, {
      success: true,
      data: db.state
    });
  }

  if (pathname === '/api/state' && req.method === 'POST') {
    getBody().then(body => {
      if (body.activeSelections) {
        db.state.activeSelections = { ...db.state.activeSelections, ...body.activeSelections };
      }
      if (body.currentZoneId) {
        db.state.currentZoneId = body.currentZoneId;
      }
      db.state.lastUpdated = new Date().toISOString();
      saveDb(db);
      return sendJson(200, {
        success: true,
        message: 'Backend environment state updated successfully',
        data: db.state
      });
    }).catch(err => sendJson(400, { success: false, error: 'Invalid JSON body' }));
    return;
  }

  if (pathname === '/api/swap' && req.method === 'POST') {
    getBody().then(body => {
      const { slotId, itemId, itemTitle, zoneId, category } = body;
      if (!slotId || !itemId) {
        return sendJson(400, { success: false, error: 'slotId and itemId are required' });
      }

      // Update state
      db.state.activeSelections[slotId] = itemId;
      if (zoneId) db.state.currentZoneId = zoneId;
      db.state.lastUpdated = new Date().toISOString();

      // Record swap entry in backend log
      const swapLog = {
        id: `swap_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        slotId,
        itemId,
        itemTitle: itemTitle || itemId,
        category: category || 'furniture',
        zoneId: zoneId || db.state.currentZoneId,
        timestamp: new Date().toISOString()
      };
      db.swapHistory.unshift(swapLog);
      if (db.swapHistory.length > 100) db.swapHistory = db.swapHistory.slice(0, 100);

      saveDb(db);
      console.log(`[Backend API] Item swapped in backend: ${slotId} -> ${itemId} (${itemTitle})`);

      return sendJson(200, {
        success: true,
        message: `Backend synced: ${itemTitle || itemId} activated for ${slotId}`,
        swap: swapLog,
        activeSelections: db.state.activeSelections
      });
    }).catch(err => sendJson(400, { success: false, error: err.message }));
    return;
  }

  if (pathname === '/api/activity' && req.method === 'GET') {
    return sendJson(200, {
      success: true,
      swaps: db.swapHistory,
      lastUpdated: db.state.lastUpdated
    });
  }

  if (pathname === '/api/proposals' && req.method === 'GET') {
    return sendJson(200, { success: true, proposals: db.proposals });
  }

  if (pathname === '/api/proposals' && req.method === 'POST') {
    getBody().then(body => {
      const proposal = {
        id: `prop_${Date.now()}`,
        clientName: body.clientName || 'Valued Client',
        title: body.title || 'Event Design Quote',
        totalPrice: body.totalPrice || 0,
        selections: body.selections || db.state.activeSelections,
        createdAt: new Date().toISOString()
      };
      db.proposals.unshift(proposal);
      saveDb(db);
      return sendJson(201, { success: true, proposal });
    }).catch(err => sendJson(400, { success: false, error: err.message }));
    return;
  }

  if (pathname === '/api/vendors' && req.method === 'GET') {
    return sendJson(200, { success: true, vendors: db.vendors });
  }

  if (pathname === '/api/bookings' && req.method === 'GET') {
    return sendJson(200, { success: true, bookings: db.bookings });
  }

  if (pathname === '/api/bookings' && req.method === 'POST') {
    getBody().then(body => {
      const booking = {
        id: `book_${Date.now()}`,
        eventName: body.eventName || '360 Event Booking',
        dates: body.dates || [],
        totalBudget: body.totalBudget || 0,
        status: 'confirmed',
        createdAt: new Date().toISOString()
      };
      db.bookings.push(booking);
      saveDb(db);
      return sendJson(201, { success: true, booking });
    }).catch(err => sendJson(400, { success: false, error: err.message }));
    return;
  }

  // 404 for unknown endpoints
  return sendJson(404, { success: false, error: 'API Endpoint Not Found' });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`🚀 Helme Events 360 Backend REST Server running at http://127.0.0.1:${PORT}`);
});
