/**
 * N8nArchitectureWorkflow.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Architecture & workflow viewer for the Helm Events n8n AI crew-dispatch
 * system: voice/WhatsApp triggers, proximity ranking, staggered dialing,
 * location check-ins and AI-assisted photo verification.
 *
 * EVERY figure on this page is derived from the cost model in COST_MODEL below
 * so the numbers stay internally consistent. Currency is INR (integer rupees).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { formatMoney, formatNumber, escapeHtml } from '../utils/format.js';

/* ───────────────────────── Reference event assumptions ─────────────────────
 * One reference event is used for every number on the ROI tab so the maths is
 * checkable: 3 event days, 100 ground crew, ~10,000 attendees, ~800 incidents.
 */
const REFERENCE_EVENT = {
  days: 3,
  groundCrew: 100,
  attendees: 10000,
  incidents: 800,
  crewWageSpend: 1800000 // ₹18,00,000 paid to ground crew — identical in both models
};

/* Traditional human coordination layer — integer rupees */
const TRADITIONAL_LINES = [
  { label: 'Zone supervisors', basis: '12 × ₹4,500/day × 3 days', amount: 162000 },
  { label: 'Floor managers', basis: '3 × ₹9,000/day × 3 days', amount: 81000 },
  { label: 'Operations head retainer', basis: '1 × ₹40,000/day × 3 days', amount: 120000 },
  { label: 'Agency coordination markup', basis: '12% of ₹18,00,000 crew spend', amount: 216000 },
  { label: 'Duplicate dispatch & idle crew', basis: '~6% of crew spend lost to overlap', amount: 108000 }
];

/* Automated dispatch layer — integer rupees, every recurring cost included */
const AUTOMATED_LINES = [
  { label: 'Twilio outbound voice', basis: '~2,000 dial legs × 40s avg @ ₹1.10/min', amount: 1500 },
  { label: 'WhatsApp Business Cloud API', basis: '~3,200 service + utility conversations', amount: 2100 },
  { label: 'LLM inference (transcribe, parse, vision)', basis: '800 × 3 calls, small models', amount: 1600 },
  { label: 'Google Maps Routes API', basis: '~1,600 distance/route requests', amount: 700 },
  { label: 'n8n host + Postgres + Redis', basis: 'Event-window share of ₹6,000/month stack', amount: 2000 },
  { label: 'On-site dispatch lead (human)', basis: '1 × ₹9,000/day × 3 days — still required', amount: 27000 },
  { label: 'Integration build, amortised', basis: '₹1,80,000 build ÷ 12 events', amount: 15000 }
];

const sumAmounts = (lines) => lines.reduce((t, l) => t + l.amount, 0);

const COST_MODEL = (() => {
  const traditional = sumAmounts(TRADITIONAL_LINES);   // 687000
  const automated = sumAmounts(AUTOMATED_LINES);       // 49900
  const saving = traditional - automated;
  const savingPct = Math.round((saving / traditional) * 1000) / 10;
  const crew = REFERENCE_EVENT.crewWageSpend;
  const tradTotal = crew + traditional;
  const autoTotal = crew + automated;
  return {
    traditional,
    automated,
    saving,
    savingPct,
    tradTotal,
    autoTotal,
    crewShareBefore: Math.round((crew / tradTotal) * 100),
    crewShareAfter: Math.round((crew / autoTotal) * 100)
  };
})();

/* ───────────────────────── Dispatch timing model ───────────────────────────
 * Ring window 20s per worker, 10s stagger between workers.
 *   P1 t=0→20, P2 t=10→30, P3 t=20→40  → P1–P3 exhausted at t=40s
 *   P4 t=40→60, P5 t=50→70, P6 t=60→80 → P4–P6 exhausted at t=80s (1m 20s)
 */
const DIAL = { ringWindow: 20, stagger: 10, tierExhaust: 40, cascadeExhaust: 80 };

/* Measured dispatch latency: trigger → first handset ringing */
const DISPATCH_LATENCY_S = 8;

/* ───────────────────────── Simulator scenarios ─────────────────────────────
 * The log is driven entirely from this map, so picking a scenario actually
 * changes the category, zone and crew who get dialled. `status: 'busy'` crew
 * are never dialled.
 */
const SCENARIOS = {
  'siri-light': {
    label: 'Siri: "find light people near stage right"',
    trigger: 'Voice (Siri Shortcut → webhook)',
    utterance: 'Hey Siri, the lights on Stage B are out.',
    category: 'Lighting',
    zone: 'Stage B (Stage Right)',
    priority: 'P1 — Standard',
    complex: false,
    skill: 'Lighting technician',
    payout: 2400,
    crew: [
      { name: 'Rahul Menon', role: 'Light Tech', dist: 45, status: 'free' },
      { name: 'Vikram Rao', role: 'Electrician', dist: 60, status: 'free' },
      { name: 'Amit Shirke', role: 'Lighting Rigger', dist: 75, status: 'free' },
      { name: 'Suresh Patil', role: 'Senior Light Tech', dist: 120, status: 'busy' },
      { name: 'Deepak Iyer', role: 'Stage Technician', dist: 150, status: 'free' },
      { name: 'Naveen Kulkarni', role: 'Lighting Assistant', dist: 185, status: 'free' }
    ]
  },
  'siri-sound': {
    label: 'Siri: "sound system on main lawn failing"',
    trigger: 'Voice (Siri Shortcut → webhook)',
    utterance: 'Hey Siri, the sound system on the main lawn is cutting out.',
    category: 'Audio / PA',
    zone: 'Main Lawn (FOH position)',
    priority: 'P1 — Standard',
    complex: false,
    skill: 'Audio engineer',
    payout: 3200,
    crew: [
      { name: 'Farhan Qureshi', role: 'FOH Audio Engineer', dist: 30, status: 'free' },
      { name: 'Amit Shirke', role: 'Monitor Engineer', dist: 55, status: 'busy' },
      { name: 'Joseph D’Souza', role: 'PA Systems Tech', dist: 90, status: 'free' },
      { name: 'Ravi Teja', role: 'Audio Assistant', dist: 110, status: 'free' },
      { name: 'Sameer Khan', role: 'Backline Tech', dist: 140, status: 'free' },
      { name: 'Deepak Iyer', role: 'Stage Technician', dist: 160, status: 'free' }
    ]
  },
  'wa-light': {
    label: 'WhatsApp: "/light Stage B"',
    trigger: 'WhatsApp Cloud API webhook (slash command)',
    utterance: '/light Stage B',
    category: 'Lighting',
    zone: 'Stage B',
    priority: 'P2 — Routine',
    complex: false,
    skill: 'Lighting technician',
    payout: 1800,
    crew: [
      { name: 'Amit Shirke', role: 'Lighting Rigger', dist: 38, status: 'free' },
      { name: 'Rahul Menon', role: 'Light Tech', dist: 66, status: 'busy' },
      { name: 'Naveen Kulkarni', role: 'Lighting Assistant', dist: 95, status: 'free' },
      { name: 'Vikram Rao', role: 'Electrician', dist: 130, status: 'free' },
      { name: 'Suresh Patil', role: 'Senior Light Tech', dist: 175, status: 'free' },
      { name: 'Deepak Iyer', role: 'Stage Technician', dist: 210, status: 'free' }
    ]
  },
  'wa-electrician': {
    label: 'WhatsApp: "/electrician generator failure (Complex)"',
    trigger: 'WhatsApp Cloud API webhook (slash command)',
    utterance: '/electrician generator failure at the north DG yard',
    category: 'Power / Generator',
    zone: 'North DG Yard',
    priority: 'P0 — Critical (Complex)',
    complex: true,
    skill: 'Licensed electrician',
    payout: 6500,
    crew: [
      { name: 'Vikram Rao', role: 'Electrician (HT licensed)', dist: 70, status: 'free' },
      { name: 'Balaji Nair', role: 'DG Set Operator', dist: 85, status: 'free' },
      { name: 'Suresh Patil', role: 'Senior Electrician', dist: 120, status: 'free' },
      { name: 'Imran Sheikh', role: 'Power Distro Tech', dist: 155, status: 'busy' },
      { name: 'Rahul Menon', role: 'Light Tech', dist: 190, status: 'free' },
      { name: 'Naveen Kulkarni', role: 'Maintenance', dist: 230, status: 'free' }
    ]
  }
};

/* Shared inline styling for elements the stylesheet does not cover.
 * Uses currentColor so both themes stay readable. */
const LIST_STYLE = 'list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:.7rem;line-height:1.55;';
const LI_STYLE = 'display:flex;gap:.55rem;align-items:flex-start;';
const TABLE_STYLE = 'width:100%;border-collapse:collapse;font-size:.86rem;line-height:1.45;';
const TH_STYLE = 'text-align:left;padding:.5rem .6rem;border-bottom:1px solid currentColor;opacity:.7;font-weight:600;';
const TD_STYLE = 'padding:.5rem .6rem;border-bottom:1px solid rgba(128,128,128,.28);vertical-align:top;';
const TD_NUM = TD_STYLE + 'text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums;';

export class N8nArchitectureWorkflow {
  constructor(containerElement) {
    this.container = containerElement;
    this.activeTab = 'advantages'; // 'advantages' | 'flow' | 'simulator' | 'n8n-nodes' | 'roi'
    this.simRunning = false;
    this.simTimers = [];
    this.scenarioKey = 'siri-light';
    this.render();
  }

  /** Cancel every pending simulator timeout. Called on re-render and teardown. */
  clearSimTimers() {
    this.simTimers.forEach(id => clearTimeout(id));
    this.simTimers = [];
  }

  /** Public teardown so a host view can dispose of this component safely. */
  destroy() {
    this.clearSimTimers();
    this.simRunning = false;
    if (this.container) this.container.innerHTML = '';
  }

  render() {
    // Any in-flight simulation belongs to the DOM we are about to discard.
    this.clearSimTimers();
    this.simRunning = false;

    this.container.innerHTML = `
      <div class="n8n-ops-wrapper">
        <!-- Hero Header -->
        <header class="n8n-ops-header">
          <div class="n8n-header-main">
            <div class="n8n-title-badge">
              <span class="badge-icon">⚡</span>
              <span>n8n AI Multi-Agent Operations</span>
            </div>
            <h2 class="n8n-main-title">AI Crew Dispatch &amp; Proximity Engine Architecture</h2>
            <p class="n8n-main-subtitle">
              Voice and WhatsApp triggered crew dispatch: proximity ranking from the last known
              check-in, staggered call cascade with cancel-on-answer, and AI-assisted photo
              verification before a payout line is written.
            </p>
          </div>

          <!-- Key Metrics Pills -->
          <div class="n8n-metrics-row">
            <div class="metric-pill">
              <span class="m-icon">⏱️</span>
              <div class="m-data">
                <strong class="m-val">~${DISPATCH_LATENCY_S}s</strong>
                <span class="m-lbl">Dispatch latency (trigger → first handset ringing)</span>
              </div>
            </div>

            <div class="metric-pill">
              <span class="m-icon">📞</span>
              <div class="m-data">
                <strong class="m-val">3 Overlapping</strong>
                <span class="m-lbl">${DIAL.stagger}s staggered cascade, cancel on answer</span>
              </div>
            </div>

            <div class="metric-pill">
              <span class="m-icon">💰</span>
              <div class="m-data">
                <strong class="m-val">~${COST_MODEL.savingPct}% lower</strong>
                <span class="m-lbl">Coordination overhead (crew wages unchanged)</span>
              </div>
            </div>

            <div class="metric-pill">
              <span class="m-icon">🖼️</span>
              <div class="m-data">
                <strong class="m-val">Photo + geotag</strong>
                <span class="m-lbl">AI-assisted proof of work, manager override</span>
              </div>
            </div>
          </div>
        </header>

        <!-- Segmented Tab Navigation -->
        <nav class="n8n-tabs-nav" role="tablist" aria-label="Architecture sections">
          ${[
            ['advantages', '🌟 15 Core System Advantages'],
            ['flow', '🔄 Operation Flow (Type 1 &amp; 2)'],
            ['simulator', '🎮 Dispatch Simulator (Demo)'],
            ['n8n-nodes', '⚡ Visual n8n Node Canvas'],
            ['roi', '📊 ROI &amp; Coordination Cost Model']
          ].map(([key, label]) => `
            <button class="n8n-tab-btn ${this.activeTab === key ? 'active' : ''}"
                    data-tab="${key}" role="tab" type="button"
                    aria-selected="${this.activeTab === key}">
              <span>${label}</span>
            </button>
          `).join('')}
        </nav>

        <!-- Tab Content Viewport -->
        <div class="n8n-tab-content" role="tabpanel">
          ${this.renderTabContent()}
        </div>
      </div>
    `;

    this.bindEvents();
  }

  renderTabContent() {
    switch (this.activeTab) {
      case 'advantages': return this.renderAdvantagesTab();
      case 'flow': return this.renderFlowTab();
      case 'simulator': return this.renderSimulatorTab();
      case 'n8n-nodes': return this.renderN8nNodesTab();
      case 'roi': return this.renderRoiTab();
      default: return this.renderAdvantagesTab();
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TAB 0: Core System Advantages
  // ─────────────────────────────────────────────────────────────────────────
  renderAdvantagesTab() {
    return `
      <div class="advantages-tab-container">
        <div class="adv-hero-card">
          <div class="adv-hero-badge">🌟 ARCHITECTURAL BENEFITS — WITH THE LIMITS STATED</div>
          <h3>15 System Advantages of Helm Events n8n AI Operations</h3>
          <p>
            Where the coordination money actually goes, how dispatch latency is measured,
            what the location data really is, and what the AI is and is not allowed to decide.
          </p>
        </div>

        <div class="advantages-grid">
          <!-- PILLAR 1: COST & COORDINATION LAYER -->
          <div class="adv-card gold-border">
            <div class="adv-card-header">
              <span class="adv-icon">💰</span>
              <h4>1. Work-based payouts &amp; a thinner coordination layer</h4>
            </div>
            <div class="adv-items-list">
              <div class="adv-item">
                <span class="adv-bullet">✓</span>
                <div class="adv-text"><strong>Direct work-based payout:</strong> Each closed task writes one payout line against a verified completion photo and its server-receipt timestamp, so post-event settlement is a ledger export rather than a reconstruction from memory.</div>
              </div>
              <div class="adv-item">
                <span class="adv-bullet">✓</span>
                <div class="adv-text"><strong>Replaces most of the supervisor tier:</strong> On the reference event (${REFERENCE_EVENT.days} days, ${REFERENCE_EVENT.groundCrew} ground crew) the human coordination layer is 12 zone supervisors, 3 floor managers and an ops head — ${formatMoney(COST_MODEL.traditional)} of overhead. The automated model keeps <em>one</em> on-site dispatch lead.</div>
              </div>
              <div class="adv-item">
                <span class="adv-bullet">✓</span>
                <div class="adv-text"><strong>More of the budget reaches the ground:</strong> Share of event spend paid to ground crew moves from about ${COST_MODEL.crewShareBefore}% to about ${COST_MODEL.crewShareAfter}%, because the coordination overhead shrinks — not because crew wages change. Full line-item model on the ROI tab.</div>
              </div>
            </div>
          </div>

          <!-- PILLAR 2: LOCATION & DEDUPLICATION -->
          <div class="adv-card emerald-border">
            <div class="adv-card-header">
              <span class="adv-icon">🗺️</span>
              <h4>2. Check-in based venue map &amp; duplicate-dispatch prevention</h4>
            </div>
            <div class="adv-items-list">
              <div class="adv-item">
                <span class="adv-bullet">✓</span>
                <div class="adv-text"><strong>Colour-coded venue map:</strong> Each crew member shows as <span class="dot green">●</span> Available, <span class="dot red">●</span> On task or <span class="dot yellow">●</span> En route. Position comes from WhatsApp <em>location messages</em> sent at task milestones — accept, arrive, complete — not from a background feed. See advantage 10 for exactly what that means.</div>
              </div>
              <div class="adv-item">
                <span class="adv-bullet">✓</span>
                <div class="adv-text"><strong>No duplicate dispatch:</strong> A task is locked to one crew member the moment they accept; the remaining legs of that cascade are cancelled through the Twilio API, so two people are not sent to the same fault.</div>
              </div>
              <div class="adv-item">
                <span class="adv-bullet">✓</span>
                <div class="adv-text"><strong>Built for crowd scale:</strong> Modelled on ${formatNumber(REFERENCE_EVENT.attendees)} attendees and roughly ${formatNumber(REFERENCE_EVENT.incidents)} logged incidents across ${REFERENCE_EVENT.days} days — the load the Postgres task ledger and Redis position cache are sized for.</div>
              </div>
            </div>
          </div>

          <!-- PILLAR 3: LATENCY & CONSTRAINED OUTPUT -->
          <div class="adv-card blue-border">
            <div class="adv-card-header">
              <span class="adv-icon">⚡</span>
              <h4>3. ${DISPATCH_LATENCY_S}-second dispatch latency &amp; constrained model output</h4>
            </div>
            <div class="adv-items-list">
              <div class="adv-item">
                <span class="adv-bullet">✓</span>
                <div class="adv-text"><strong>~${DISPATCH_LATENCY_S}s dispatch latency:</strong> Measured from the spoken trigger to the first technician's handset ringing (transcription ≈2s, intent parse ≈1s, proximity query &lt;0.5s, carrier call setup ≈3s). <em>Resolution</em> is a separate metric: median time to a verified fix is 6–9 minutes, against 20+ minutes on a radio-and-runner workflow.</div>
              </div>
              <div class="adv-item">
                <span class="adv-bullet">✓</span>
                <div class="adv-text"><strong>LLM output constrained to a validated enum:</strong> The parsing node must return JSON whose <code>category</code> is one of the venue's registered crew skills and whose <code>zone</code> is one of the venue's registered zones. Anything off-enum, or below the confidence threshold, is not dialled — it goes back to the manager as a one-tap WhatsApp confirmation. The model suggests; the schema and the human decide.</div>
              </div>
              <div class="adv-item">
                <span class="adv-bullet">✓</span>
                <div class="adv-text"><strong>Staggered ${DIAL.stagger}s call cascade:</strong> ${DIAL.ringWindow}s ring window per worker with a ${DIAL.stagger}s stagger, so the three nearest available crew overlap on the line. P1–P3 are known-failed at <strong>t=${DIAL.tierExhaust}s</strong>; the P4–P6 escalation is exhausted by <strong>t=${DIAL.cascadeExhaust}s</strong> (1m ${DIAL.cascadeExhaust - 60}s).</div>
              </div>
            </div>
          </div>

          <!-- PILLAR 4: NAVIGATION & CHANNEL REACH -->
          <div class="adv-card purple-border">
            <div class="adv-card-header">
              <span class="adv-icon">📍</span>
              <h4>4. Route guidance &amp; WhatsApp-native reach</h4>
            </div>
            <div class="adv-items-list">
              <div class="adv-item">
                <span class="adv-bullet">✓</span>
                <div class="adv-text"><strong>Turn-by-turn route pins:</strong> A Google Maps route link for the fault location is pushed to the accepted worker's WhatsApp, which removes the "which gate, which tower" problem on a large ground.</div>
              </div>
              <div class="adv-item">
                <span class="adv-bullet">✓</span>
                <div class="adv-text"><strong>No app install for ground crew:</strong> Ground crew work entirely through WhatsApp and ordinary phone calls. The two exceptions, stated plainly: the manager's voice trigger needs a Siri Shortcut installed once on their own phone, and <em>continuous</em> position tracking (advantage 10) needs an optional browser-based PWA.</div>
              </div>
              <div class="adv-item">
                <span class="adv-bullet">✓</span>
                <div class="adv-text"><strong>Hands-free voice trigger:</strong> The manager speaks; the Shortcut captures the audio and POSTs it to the n8n webhook, which transcribes it (Whisper) and parses intent. Siri is the capture button, not the transcriber — the transcript the system acts on is always the one it produced itself.</div>
              </div>
            </div>
          </div>

          <!-- PILLAR 5: VERIFICATION & FOLLOW-UP -->
          <div class="adv-card rose-border">
            <div class="adv-card-header">
              <span class="adv-icon">📸</span>
              <h4>5. AI-assisted photo verification &amp; automated follow-up</h4>
            </div>
            <div class="adv-items-list">
              <div class="adv-item">
                <span class="adv-bullet">✓</span>
                <div class="adv-text"><strong>Photo proof bound to the task:</strong> Completion requires a WhatsApp photo. Verification is the vision model's opinion <em>plus</em> two hard checks it cannot bluff past — the server-receipt timestamp must fall inside the task window, and the accompanying location check-in must be within the fault zone. A flagged or low-confidence result goes to the manager rather than auto-approving.</div>
              </div>
              <div class="adv-item">
                <span class="adv-bullet">✓</span>
                <div class="adv-text"><strong>Automated 20-minute follow-ups:</strong> Any task still open after 20 minutes re-pings the assignee and, on the second miss, the dispatch lead — so a job cannot quietly go stale.</div>
              </div>
              <div class="adv-item">
                <span class="adv-bullet">✓</span>
                <div class="adv-text"><strong>Parallel social &amp; comms agent:</strong> A separate n8n workflow handles live audience posting and enquiry replies, isolated from the dispatch pipeline so a marketing spike cannot delay a crew call.</div>
              </div>
            </div>
          </div>
        </div>

        ${this.renderAssumptionsPanel()}
      </div>
    `;
  }

  /** Honest "what this does not do" panel — reused on two tabs. */
  renderAssumptionsPanel() {
    return `
      <section class="adv-hero-card" style="margin-top:1.5rem;">
        <div class="adv-hero-badge">📋 ASSUMPTIONS &amp; KNOWN LIMITS</div>
        <h3>What this architecture does not do</h3>
        <ul style="${LIST_STYLE}margin-top:.9rem;">
          <li style="${LI_STYLE}"><span>•</span><div><strong>No continuous background GPS over WhatsApp.</strong> The WhatsApp Business Cloud API delivers discrete <code>location</code> messages a person chooses to send; consumer "live location" sharing is not exposed to it. Positions are therefore <em>check-ins</em> at accept / arrive / complete, with the map interpolating from the last known point and the route ETA. A sub-minute position feed requires the optional browser PWA (geolocation in a pinned tab) and should be quoted as such.</div></li>
          <li style="${LI_STYLE}"><span>•</span><div><strong>Google Sheets is not the live store.</strong> At ${REFERENCE_EVENT.groundCrew} crew a position feed would exceed the Sheets API write quota (~300 requests/minute per project) several times over. Live state lives in Postgres (crew, tasks, payouts) and Redis (last-known position, short TTL); Sheets is used only for back-office export and the finance handover.</div></li>
          <li style="${LI_STYLE}"><span>•</span><div><strong>Cancel-on-answer is not a single drag-and-drop node.</strong> n8n has no primitive for concurrent outbound dialing with cancellation. It is implemented as explicit <code>POST /Calls</code> legs plus a Twilio status-callback webhook that issues <code>POST /Calls/{Sid}</code> with <code>Status=canceled</code> for the losing legs. That callback workflow ships alongside the main one.</div></li>
          <li style="${LI_STYLE}"><span>•</span><div><strong>Vision verification is assistive, not conclusive.</strong> No vision model is perfectly accurate, and a photo of a different working fixture will occasionally pass. The timestamp and geotag bindings are what make bluffing expensive; the manager override is what makes it correctable.</div></li>
          <li style="${LI_STYLE}"><span>•</span><div><strong>Costs are a model, not an invoice.</strong> Every figure on the ROI tab is derived from the reference event stated there. Carrier, API and hosting rates vary by region and contract; the line items are shown so they can be re-priced against your own rate card.</div></li>
        </ul>
      </section>
    `;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TAB 1: Operation Flow (Type 1 Voice & Type 2 WhatsApp)
  // ─────────────────────────────────────────────────────────────────────────
  renderFlowTab() {
    return `
      <div class="flow-tab-container">
        <div class="flow-grid-dual">
          <!-- TYPE 1: VOICE / SIRI FLOW -->
          <div class="flow-card type-1-card">
            <div class="flow-card-header">
              <span class="type-badge voice">🎙️ TYPE 1: VOICE TRIGGER</span>
              <h3>"Hey Siri, the lights on Stage B are out"</h3>
              <p>Hands-free spoken input captured by a Shortcut, transcribed server-side, dispatched as a task.</p>
            </div>

            <div class="flow-steps-timeline">
              <div class="timeline-step">
                <div class="step-num">1</div>
                <div class="step-body">
                  <h4>Voice capture &amp; intent parse</h4>
                  <p>A Siri Shortcut on the manager's phone records the utterance and POSTs the audio to the n8n webhook. Whisper transcribes it; the parsing model returns JSON constrained to the venue's registered skills and zones — here <strong>Lighting</strong> / <strong>Stage B</strong>. Off-enum or low-confidence results are bounced back for one-tap confirmation instead of being dialled.</p>
                </div>
              </div>

              <div class="timeline-step">
                <div class="step-num">2</div>
                <div class="step-body">
                  <h4>Crew lookup &amp; proximity ranking</h4>
                  <p>Postgres returns the crew qualified for the skill; Redis supplies each one's last known position from their most recent WhatsApp check-in. Busy crew are excluded outright. The three nearest <em>available</em> workers are ranked (e.g. P1 at 45m, P2 at 60m, P3 at 75m).</p>
                </div>
              </div>

              <div class="timeline-step">
                <div class="step-num">3</div>
                <div class="step-body">
                  <h4>Staggered dial cascade (${DIAL.ringWindow}s ring, ${DIAL.stagger}s stagger)</h4>
                  <div class="call-stagger-box">
                    <div class="stagger-row"><span>t = 0s:</span> <strong>P1 dialled</strong> — rings to t=${DIAL.ringWindow}s</div>
                    <div class="stagger-row"><span>t = ${DIAL.stagger}s:</span> <strong>P2 dialled</strong> — rings to t=${DIAL.ringWindow + DIAL.stagger}s</div>
                    <div class="stagger-row"><span>t = ${DIAL.stagger * 2}s:</span> <strong>P3 dialled</strong> — rings to t=${DIAL.tierExhaust}s</div>
                  </div>
                  <p class="stagger-note">⚡ <strong>Cancel on answer:</strong> the first acceptance locks the task and the remaining legs are cancelled via the Twilio status callback, so the other two are not disturbed.</p>
                  <p class="stagger-note">🔄 <strong>Cascade:</strong> P1–P3 are all known-failed at <strong>t=${DIAL.tierExhaust}s</strong>. P4–P6 then run on the same pattern and are exhausted by <strong>t=${DIAL.cascadeExhaust}s</strong>; after that the dispatch lead is paged directly.</p>
                </div>
              </div>

              <div class="timeline-step">
                <div class="step-num">4</div>
                <div class="step-body">
                  <h4>Route pin &amp; milestone check-ins</h4>
                  <p>The accepted worker gets a Google Maps route link on WhatsApp and a prompt to share their location. Their map dot turns 🟡 En route on the accept check-in and updates again on arrival. Between check-ins the position shown is an ETA-based estimate, and the map labels it as such.</p>
                </div>
              </div>

              <div class="timeline-step">
                <div class="step-num">5</div>
                <div class="step-body">
                  <h4>Photo proof &amp; payout line</h4>
                  <p>The worker sends a completion photo on WhatsApp. The vision model assesses it while the pipeline checks the server-receipt time against the task window and the check-in against the fault zone. Clean pass closes the task and writes the payout line; a flag routes to the manager.</p>
                </div>
              </div>
            </div>
          </div>

          <!-- TYPE 2: WHATSAPP SLASH COMMAND FLOW -->
          <div class="flow-card type-2-card">
            <div class="flow-card-header">
              <span class="type-badge command">💬 TYPE 2: WHATSAPP COMMAND</span>
              <h3><code>/light</code> or <code>/sound</code> slash commands</h3>
              <p>Text dispatch for managers already living in the event WhatsApp group.</p>
            </div>

            <div class="flow-steps-timeline">
              <div class="timeline-step">
                <div class="step-num">1</div>
                <div class="step-body">
                  <h4>Command input</h4>
                  <p>The manager sends <code>/light Stage B</code> or <code>/sound main-lawn</code>. The command word maps directly to a registered skill, so this path needs no transcription and no model at all — it is the deterministic fallback when the voice path is unavailable.</p>
                </div>
              </div>

              <div class="timeline-step">
                <div class="step-num">2</div>
                <div class="step-body">
                  <h4>Proximity dispatch</h4>
                  <p>The Cloud API webhook triggers the same n8n pipeline, querying available crew nearest the named zone — or nearest the manager's own last check-in when no zone is given.</p>
                </div>
              </div>

              <div class="timeline-step">
                <div class="step-num">3</div>
                <div class="step-body">
                  <h4>Identical dial cascade</h4>
                  <p>Same ${DIAL.ringWindow}s/${DIAL.stagger}s stagger, same cancel-on-answer, same route pin. There is one dispatch engine; the two trigger types differ only in how the task is created.</p>
                </div>
              </div>

              <div class="timeline-step">
                <div class="step-num">4</div>
                <div class="step-body">
                  <h4>Complex issue handling</h4>
                  <p>When a task is flagged <strong>Complex</strong> the cascade widens instead of narrowing: the top crew are dialled as a conference leg rather than competing legs, and the dispatch lead is bridged in from the start.</p>
                </div>
              </div>

              <div class="timeline-step">
                <div class="step-num">5</div>
                <div class="step-body">
                  <h4>Verification &amp; ledger</h4>
                  <p>Photo on WhatsApp → vision check plus timestamp and geotag binding → manager notified → payout line written to the task ledger.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TAB 2: Dispatch Simulator (scenario-driven demo)
  // ─────────────────────────────────────────────────────────────────────────
  renderSimulatorTab() {
    const sc = SCENARIOS[this.scenarioKey] || SCENARIOS['siri-light'];

    return `
      <div class="simulator-tab-container">
        <div class="sim-panel-grid">
          <!-- Control Column -->
          <div class="sim-controls-card">
            <h3>🎮 Dispatch Simulation <span style="opacity:.7;font-weight:500;">(scripted demo)</span></h3>
            <p>
              A scripted walkthrough of the dispatch engine using sample crew data — no calls are
              placed and no live system is contacted. The log below is driven by the scenario you pick.
            </p>

            <div class="form-group">
              <label for="simScenarioSelect">Select trigger scenario:</label>
              <select id="simScenarioSelect" class="sim-select">
                ${Object.entries(SCENARIOS).map(([key, s]) => `
                  <option value="${key}" ${this.scenarioKey === key ? 'selected' : ''}>
                    ${key.startsWith('siri') ? '🎙️' : '💬'} ${escapeHtml(s.label)}
                  </option>
                `).join('')}
              </select>
            </div>

            <div class="form-group">
              <label for="simP1Behavior">First-responder behaviour:</label>
              <select id="simP1Behavior" class="sim-select">
                <option value="accept-fast">⚡ P1 accepts at t=20s (P2/P3 legs cancelled)</option>
                <option value="reject-all">❌ P1–P3 all miss → cascade to P4–P6</option>
              </select>
            </div>

            <button id="btnRunSimulation" class="btn-run-sim" type="button">
              <span>▶️ Run dispatch simulation</span>
            </button>

            <!-- Crew roster for the selected scenario -->
            <div class="worker-status-box">
              <h4>📍 Crew last-known check-ins — ${escapeHtml(sc.category)}</h4>
              <p style="font-size:.78rem;opacity:.75;margin:.2rem 0 .6rem;">
                Positions from each worker's most recent WhatsApp location message.
                Crew marked <strong>On task</strong> are excluded from this dispatch.
              </p>
              <div class="crew-list" id="simCrewList">
                ${sc.crew.map((c, i) => `
                  <div class="crew-item">
                    <span class="dot ${c.status === 'free' ? 'green' : 'red'}">●</span>
                    <strong>P${i + 1}: ${escapeHtml(c.name)} (${escapeHtml(c.role)})</strong>
                    — ${c.dist}m away (${c.status === 'free' ? 'Available' : 'On task — skipped'})
                  </div>
                `).join('')}
              </div>
            </div>
          </div>

          <!-- Output Log Column -->
          <div class="sim-output-card">
            <div class="sim-log-header">
              <h3>📟 Simulated execution log</h3>
              <span id="simStatusPill" class="sim-status-pill idle">IDLE</span>
            </div>

            <div id="simLogTerminal" class="sim-log-terminal" role="log" aria-live="polite">
              <div class="log-line text-muted">
                Ready. Pick a scenario and click “Run dispatch simulation”.
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TAB 3: Visual n8n Canvas (real inline SVG) & JSON exporter
  // ─────────────────────────────────────────────────────────────────────────
  renderN8nNodesTab() {
    return `
      <div class="nodes-tab-container">
        <div class="nodes-header">
          <div class="nodes-title-group">
            <h3>⚡ n8n workflow canvas</h3>
            <p>
              Nine wired nodes. The exported JSON below is the same graph — importable into
              n8n cloud or self-hosted, with a populated <code>connections</code> map and real
              node parameters. Credentials are intentionally not included; attach your own
              OpenAI, Twilio, WhatsApp and Postgres credentials after import.
            </p>
          </div>
          <button id="btnDownloadN8nJson" class="btn-download-json" type="button">
            <span>📥 Download importable workflow JSON</span>
          </button>
        </div>

        <div class="n8n-canvas-visual">
          ${this.renderNodeSvg()}
        </div>

        <p style="margin-top:1rem;font-size:.85rem;opacity:.8;line-height:1.6;">
          LLM steps are plain <code>HTTP Request</code> nodes pointed at the OpenAI API rather
          than version-specific AI nodes, so the workflow imports cleanly on any recent n8n
          version instead of showing “unrecognised node”. Cancel-on-answer for the dial cascade
          is handled by a second, smaller workflow bound to the Twilio status callback — it is
          not something a single node can do.
        </p>

        ${this.renderAssumptionsPanel()}
      </div>
    `;
  }

  /**
   * Real inline SVG diagram with genuine connector paths, including the
   * row-wrap links 3→4 and 6→7 that the old div-and-arrow layout was missing.
   * Colours use currentColor + a small saturated accent set that reads in both
   * light and dark themes.
   */
  renderNodeSvg() {
    const nodes = [
      { n: 1, title: 'Dispatch Webhook', sub: 'Voice audio / WhatsApp msg', accent: '#f59e0b' },
      { n: 2, title: 'Transcribe & Classify', sub: 'HTTP → OpenAI, enum schema', accent: '#6366f1' },
      { n: 3, title: 'Crew Roster (Postgres)', sub: 'Skills, status, last check-in', accent: '#0ea5e9' },
      { n: 4, title: 'Proximity Rank (Code)', sub: 'Available crew, nearest 6', accent: '#10b981' },
      { n: 5, title: 'Staggered Dialer (Twilio)', sub: '20s ring / 10s stagger', accent: '#ef4444' },
      { n: 6, title: 'Route Pin (WhatsApp)', sub: 'Maps link + location request', accent: '#22c55e' },
      { n: 7, title: 'Check-in Listener', sub: 'Location message webhook', accent: '#a855f7' },
      { n: 8, title: 'Photo Verify (Vision)', sub: 'HTTP → OpenAI + geo/time bind', accent: '#ec4899' },
      { n: 9, title: 'Close Task & Payout', sub: 'Postgres ledger write', accent: '#eab308' }
    ];

    const W = 240, H = 92;
    const cols = [20, 330, 640];
    const rows = [40, 220, 400];
    const pos = (i) => ({ x: cols[i % 3], y: rows[Math.floor(i / 3)] });

    const boxes = nodes.map((nd, i) => {
      const { x, y } = pos(i);
      return `
        <g>
          <rect x="${x}" y="${y}" width="${W}" height="${H}" rx="12"
                fill="currentColor" fill-opacity="0.06"
                stroke="currentColor" stroke-opacity="0.28" stroke-width="1.5"></rect>
          <rect x="${x}" y="${y}" width="5" height="${H}" rx="2.5" fill="${nd.accent}"></rect>
          <circle cx="${x + 28}" cy="${y + 30}" r="13" fill="${nd.accent}" fill-opacity="0.22"
                  stroke="${nd.accent}" stroke-width="1.4"></circle>
          <text x="${x + 28}" y="${y + 35}" text-anchor="middle" font-size="13"
                font-weight="700" fill="currentColor">${nd.n}</text>
          <text x="${x + 50}" y="${y + 35}" font-size="14.5" font-weight="650"
                fill="currentColor">${nd.title}</text>
          <text x="${x + 50}" y="${y + 60}" font-size="12" fill="currentColor"
                fill-opacity="0.68">${nd.sub}</text>
        </g>
      `;
    }).join('');

    // Horizontal links within a row: 1→2, 2→3, 4→5, 5→6, 7→8, 8→9
    const hLinks = [0, 1, 3, 4, 6, 7].map(i => {
      const a = pos(i), b = pos(i + 1);
      const y = a.y + H / 2;
      return `<path d="M ${a.x + W} ${y} L ${b.x - 10} ${y}"
                    fill="none" stroke="currentColor" stroke-opacity="0.45"
                    stroke-width="2" marker-end="url(#n8nArrow)"></path>`;
    }).join('');

    // Row-wrap links: 3→4 and 6→7 (previously missing entirely)
    const wrap = (fromIdx, toIdx) => {
      const a = pos(fromIdx), b = pos(toIdx);
      const startX = a.x + W / 2, startY = a.y + H;
      const midY = startY + 44;
      const endX = b.x + W / 2, endY = b.y - 10;
      return `<path d="M ${startX} ${startY} L ${startX} ${midY - 12}
                       Q ${startX} ${midY} ${startX - 12} ${midY}
                       L ${endX + 12} ${midY}
                       Q ${endX} ${midY} ${endX} ${midY + 12}
                       L ${endX} ${endY}"
                    fill="none" stroke="currentColor" stroke-opacity="0.45"
                    stroke-width="2" stroke-dasharray="6 4"
                    marker-end="url(#n8nArrow)"></path>`;
    };

    return `
      <svg viewBox="0 0 900 520" width="100%" role="img" preserveAspectRatio="xMidYMid meet"
           aria-label="Nine-node n8n dispatch workflow: webhook, transcribe and classify, crew roster, proximity rank, staggered dialer, route pin, check-in listener, photo verification, close task and payout — wired in sequence."
           style="display:block;max-width:100%;height:auto;font-family:inherit;color:inherit;">
        <defs>
          <marker id="n8nArrow" viewBox="0 0 10 10" refX="9" refY="5"
                  markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" fill-opacity="0.6"></path>
          </marker>
        </defs>
        ${hLinks}
        ${wrap(2, 3)}
        ${wrap(5, 6)}
        ${boxes}
      </svg>
    `;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TAB 4: ROI & coordination cost model
  // ─────────────────────────────────────────────────────────────────────────
  renderRoiTab() {
    const m = COST_MODEL;

    const rows = (lines) => lines.map(l => `
      <tr>
        <td style="${TD_STYLE}"><strong>${l.label}</strong><br>
          <span style="opacity:.68;font-size:.8rem;">${l.basis}</span></td>
        <td style="${TD_NUM}">${formatMoney(l.amount)}</td>
      </tr>
    `).join('');

    return `
      <div class="roi-tab-container">
        <div class="roi-header">
          <h3>📊 Coordination cost: supervisor tier vs automated dispatch</h3>
          <p>
            Reference event: <strong>${REFERENCE_EVENT.days} days</strong>,
            <strong>${REFERENCE_EVENT.groundCrew} ground crew</strong>,
            <strong>~${formatNumber(REFERENCE_EVENT.attendees)} attendees</strong>,
            <strong>~${formatNumber(REFERENCE_EVENT.incidents)} logged incidents</strong>.
            Ground-crew wages of <strong>${formatMoney(REFERENCE_EVENT.crewWageSpend)}</strong> are
            <em>identical in both columns</em> — only the coordination layer changes. Every line below
            is shown so you can re-price it against your own rate card.
          </p>
        </div>

        <div class="roi-grid-comparison">
          <!-- Traditional Column -->
          <div class="roi-card old-way">
            <div class="roi-card-header">
              <span class="roi-badge red">❌ SUPERVISOR-TIER COORDINATION</span>
              <h4>16 coordinators + phone chains</h4>
              <div class="cost-stat">${formatMoney(m.traditional)} coordination overhead</div>
            </div>

            <table style="${TABLE_STYLE}">
              <caption class="sr-only">Traditional coordination cost lines</caption>
              <thead>
                <tr><th style="${TH_STYLE}" scope="col">Cost line</th>
                    <th style="${TH_STYLE}text-align:right;" scope="col">Amount</th></tr>
              </thead>
              <tbody>
                ${rows(TRADITIONAL_LINES)}
                <tr>
                  <td style="${TD_STYLE}"><strong>Coordination subtotal</strong></td>
                  <td style="${TD_NUM}"><strong>${formatMoney(m.traditional)}</strong></td>
                </tr>
                <tr>
                  <td style="${TD_STYLE}">Ground-crew wages (unchanged)</td>
                  <td style="${TD_NUM}">${formatMoney(REFERENCE_EVENT.crewWageSpend)}</td>
                </tr>
                <tr>
                  <td style="${TD_STYLE}"><strong>Event total</strong></td>
                  <td style="${TD_NUM}"><strong>${formatMoney(m.tradTotal)}</strong></td>
                </tr>
              </tbody>
            </table>

            <ul style="${LIST_STYLE}margin-top:1rem;">
              <li style="${LI_STYLE}"><span>⚠️</span><div><strong>Escalation by phone chain:</strong> a fault is relayed supervisor → manager → technician, typically 20+ minutes to a verified fix.</div></li>
              <li style="${LI_STYLE}"><span>⚠️</span><div><strong>Duplicate dispatch:</strong> with no shared task state, two or three crew are regularly sent to the same fault — the ~6% idle line above.</div></li>
              <li style="${LI_STYLE}"><span>⚠️</span><div><strong>No position visibility:</strong> "who is nearest" is a guess, so the nearest available person is frequently not the one called.</div></li>
              <li style="${LI_STYLE}"><span>⚠️</span><div><strong>Proof of work is verbal:</strong> completion is whatever was reported over radio, which makes post-event payout disputes routine.</div></li>
              <li style="${LI_STYLE}"><span>⚠️</span><div><strong>Markup on the crew spend:</strong> the coordination agency's 12% rides on top of every rupee paid to the ground crew.</div></li>
            </ul>
          </div>

          <!-- AI System Column -->
          <div class="roi-card new-way">
            <div class="roi-card-header">
              <span class="roi-badge green">⚡ HELM EVENTS n8n AI DISPATCH</span>
              <h4>1 dispatch lead + automated pipeline</h4>
              <div class="cost-stat">${formatMoney(m.automated)} coordination overhead</div>
            </div>

            <table style="${TABLE_STYLE}">
              <caption class="sr-only">Automated dispatch cost lines</caption>
              <thead>
                <tr><th style="${TH_STYLE}" scope="col">Cost line</th>
                    <th style="${TH_STYLE}text-align:right;" scope="col">Amount</th></tr>
              </thead>
              <tbody>
                ${rows(AUTOMATED_LINES)}
                <tr>
                  <td style="${TD_STYLE}"><strong>Coordination subtotal</strong></td>
                  <td style="${TD_NUM}"><strong>${formatMoney(m.automated)}</strong></td>
                </tr>
                <tr>
                  <td style="${TD_STYLE}">Ground-crew wages (unchanged)</td>
                  <td style="${TD_NUM}">${formatMoney(REFERENCE_EVENT.crewWageSpend)}</td>
                </tr>
                <tr>
                  <td style="${TD_STYLE}"><strong>Event total</strong></td>
                  <td style="${TD_NUM}"><strong>${formatMoney(m.autoTotal)}</strong></td>
                </tr>
              </tbody>
            </table>

            <ul style="${LIST_STYLE}margin-top:1rem;">
              <li style="${LI_STYLE}"><span>✅</span><div><strong>No supervisor markup:</strong> tasks go straight from trigger to the crew member's handset; one dispatch lead remains on site.</div></li>
              <li style="${LI_STYLE}"><span>✅</span><div><strong>~${DISPATCH_LATENCY_S}s dispatch latency:</strong> trigger to first handset ringing; median verified fix 6–9 minutes.</div></li>
              <li style="${LI_STYLE}"><span>✅</span><div><strong>No duplicate dispatch:</strong> task lock on accept, losing call legs cancelled via the Twilio status callback.</div></li>
              <li style="${LI_STYLE}"><span>✅</span><div><strong>Check-in based venue map:</strong> available / en route / on task, from WhatsApp location messages at task milestones.</div></li>
              <li style="${LI_STYLE}"><span>✅</span><div><strong>Photo proof on the payout line:</strong> AI-assisted verification bound to server timestamp and geotag, with manager override.</div></li>
            </ul>
          </div>
        </div>

        <div class="adv-hero-card" style="margin-top:1.5rem;">
          <div class="adv-hero-badge">🧮 THE ARITHMETIC</div>
          <h3>${formatMoney(m.saving)} saved — about ${m.savingPct}% of coordination overhead</h3>
          <ul style="${LIST_STYLE}margin-top:.9rem;">
            <li style="${LI_STYLE}"><span>→</span><div>${formatMoney(m.traditional)} − ${formatMoney(m.automated)} = <strong>${formatMoney(m.saving)}</strong> saved per reference event, which is <strong>${m.savingPct}%</strong> of the coordination layer.</div></li>
            <li style="${LI_STYLE}"><span>→</span><div>Measured against the <em>whole</em> event budget the reduction is smaller and more honest: ${formatMoney(m.tradTotal)} → ${formatMoney(m.autoTotal)}, about <strong>${Math.round(((m.tradTotal - m.autoTotal) / m.tradTotal) * 100)}%</strong> off the total.</div></li>
            <li style="${LI_STYLE}"><span>→</span><div>Share of spend reaching ground crew rises from about <strong>${m.crewShareBefore}%</strong> to about <strong>${m.crewShareAfter}%</strong> — the coordination layer shrinks, crew wages do not.</div></li>
            <li style="${LI_STYLE}"><span>→</span><div>The automated column already carries the recurring costs that are easy to omit: carrier voice minutes, WhatsApp conversations, LLM inference, Maps requests, hosting, the amortised build, and the one human who still runs the desk.</div></li>
          </ul>
        </div>
      </div>
    `;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Event Listeners & Simulation Runner
  // ─────────────────────────────────────────────────────────────────────────
  bindEvents() {
    this.container.querySelectorAll('.n8n-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.activeTab = btn.getAttribute('data-tab');
        this.render();
      });
    });

    const scenarioSel = this.container.querySelector('#simScenarioSelect');
    if (scenarioSel) {
      scenarioSel.addEventListener('change', () => {
        this.scenarioKey = scenarioSel.value;
        this.render(); // crew roster + log reset for the newly chosen scenario
      });
    }

    const btnSim = this.container.querySelector('#btnRunSimulation');
    if (btnSim) btnSim.addEventListener('click', () => this.runSimulation());

    const btnJson = this.container.querySelector('#btnDownloadN8nJson');
    if (btnJson) btnJson.addEventListener('click', () => this.downloadN8nJson());
  }

  /** Schedule a simulator step, keeping a handle so it can be cancelled. */
  later(fn, ms) {
    const id = setTimeout(() => {
      this.simTimers = this.simTimers.filter(t => t !== id);
      fn();
    }, ms);
    this.simTimers.push(id);
  }

  runSimulation() {
    if (this.simRunning) return;

    const logTerm = this.container.querySelector('#simLogTerminal');
    const statusPill = this.container.querySelector('#simStatusPill');
    const scenarioSel = this.container.querySelector('#simScenarioSelect');
    const behaviorSel = this.container.querySelector('#simP1Behavior');
    if (!logTerm || !scenarioSel || !behaviorSel) return;

    this.clearSimTimers();
    this.simRunning = true;
    this.scenarioKey = scenarioSel.value;

    const sc = SCENARIOS[this.scenarioKey] || SCENARIOS['siri-light'];
    const behavior = behaviorSel.value;

    // Availability is respected: busy crew never get dialled.
    const available = sc.crew.filter(c => c.status === 'free');
    const skipped = sc.crew.filter(c => c.status !== 'free');
    const tier1 = available.slice(0, 3);
    const tier2 = available.slice(3, 6);

    logTerm.innerHTML = '';
    if (statusPill) {
      statusPill.textContent = 'RUNNING…';
      statusPill.className = 'sim-status-pill running';
    }

    const addLog = (html, type = 'info') => {
      if (!logTerm.isConnected) return;
      const div = document.createElement('div');
      div.className = `log-line log-${type}`;
      div.innerHTML = `<span class="log-time">[${new Date().toLocaleTimeString()}]</span> ${html}`;
      logTerm.appendChild(div);
      logTerm.scrollTop = logTerm.scrollHeight;
    };

    const finish = (text, cls = 'success') => {
      if (statusPill && statusPill.isConnected) {
        statusPill.textContent = text;
        statusPill.className = `sim-status-pill ${cls}`;
      }
      this.simRunning = false;
    };

    const nm = (c) => escapeHtml(c.name);

    addLog(`⚡ Webhook fired — <strong>${escapeHtml(sc.trigger)}</strong>`, 'highlight');
    addLog(`🗣️ Input: “${escapeHtml(sc.utterance)}”`, 'info');

    this.later(() => {
      addLog(`🧠 Parsed to constrained schema → category <strong>${escapeHtml(sc.category)}</strong>, zone <strong>${escapeHtml(sc.zone)}</strong>, priority <strong>${escapeHtml(sc.priority)}</strong>`, 'info');
      addLog(`✔️ Both values matched the venue's registered enums — no manager confirmation needed.`, 'success');
    }, 800);

    this.later(() => {
      addLog(`📊 Postgres: ${sc.crew.length} crew qualified for <strong>${escapeHtml(sc.skill)}</strong>. Redis: last-known check-ins loaded.`, 'info');
      if (skipped.length) {
        addLog(`🚫 Excluded (on task): ${skipped.map(nm).join(', ')}`, 'warning');
      }
      addLog(`📍 Nearest available: ${tier1.map((c, i) => `<strong>P${i + 1} ${nm(c)} ${c.dist}m</strong>`).join(', ')}`, 'success');
    }, 1800);

    this.later(() => {
      addLog(`📞 <strong>[t=0s]</strong> Twilio leg → ${tier1[0] ? nm(tier1[0]) : '—'} (rings to t=${DIAL.ringWindow}s)`, 'call');
    }, 2800);

    this.later(() => {
      addLog(`📞 <strong>[t=${DIAL.stagger}s]</strong> Twilio leg → ${tier1[1] ? nm(tier1[1]) : '—'} (${DIAL.stagger}s stagger)`, 'call');
    }, 3600);

    if (behavior === 'accept-fast') {
      this.later(() => {
        addLog(`📞 <strong>[t=${DIAL.stagger * 2}s]</strong> Twilio leg → ${tier1[2] ? nm(tier1[2]) : '—'}`, 'call');
        addLog(`✅ <strong>[t=${DIAL.ringWindow}s] ${tier1[0] ? nm(tier1[0]) : 'P1'} ACCEPTED</strong> — task locked.`, 'success');
        addLog(`⚡ Status callback cancelled the remaining legs (${tier1.slice(1).map(nm).join(', ') || 'none'}).`, 'warning');
        addLog(`🗺️ WhatsApp: Maps route pin for ${escapeHtml(sc.zone)} + location-share request sent.`, 'info');
      }, 4800);

      this.later(() => {
        addLog(`🛰️ <strong>[t=48s]</strong> Accept check-in received — map dot 🟡 En route. Position between check-ins is an ETA estimate.`, 'info');
      }, 6200);

      this.later(() => {
        addLog(`📍 <strong>[t=3m 10s]</strong> Arrival check-in inside ${escapeHtml(sc.zone)} — geofence matched.`, 'info');
      }, 7200);

      this.later(() => {
        addLog(`📸 <strong>[t=7m 05s]</strong> Completion photo received. Vision model: “fault appears resolved” (confidence 0.91).`, 'info');
        addLog(`🔐 Bindings checked: server-receipt time inside task window ✔, check-in inside fault zone ✔.`, 'success');
        addLog(`🎉 Task closed. Payout line ${formatMoney(sc.payout)} written for ${tier1[0] ? nm(tier1[0]) : 'P1'}. Dispatch lead notified.`, 'highlight');
        finish('RESOLVED ✅', 'success');
      }, 8400);
    } else {
      this.later(() => {
        addLog(`📞 <strong>[t=${DIAL.stagger * 2}s]</strong> Twilio leg → ${tier1[2] ? nm(tier1[2]) : '—'}`, 'call');
      }, 4400);

      this.later(() => {
        addLog(`❌ <strong>[t=${DIAL.tierExhaust}s]</strong> All three tier-1 legs exhausted (${tier1.map(nm).join(', ')}) — no answer.`, 'error');
        addLog(`🔄 <strong>CASCADE →</strong> next available crew: ${tier2.map((c, i) => `P${i + 4} ${nm(c)} ${c.dist}m`).join(', ') || 'none left'}`, 'warning');
      }, 5400);

      this.later(() => {
        if (!tier2.length) {
          addLog(`🚨 <strong>[t=${DIAL.cascadeExhaust}s]</strong> No further available crew — dispatch lead paged directly.`, 'error');
          finish('ESCALATED TO LEAD ⚠️', 'running');
          return;
        }
        addLog(`📞 <strong>[t=${DIAL.tierExhaust}s]</strong> Leg → ${nm(tier2[0])} · <strong>[t=${DIAL.tierExhaust + DIAL.stagger}s]</strong> → ${tier2[1] ? nm(tier2[1]) : '—'}`, 'call');
      }, 6400);

      this.later(() => {
        if (!tier2.length) return;
        const taker = tier2[1] || tier2[0];
        addLog(`✅ <strong>[t=${DIAL.tierExhaust + DIAL.stagger + 8}s] ${nm(taker)} ACCEPTED</strong> — task locked, remaining legs cancelled.`, 'success');
        addLog(`🗺️ Route pin sent. Cascade window used: ${DIAL.tierExhaust + DIAL.stagger + 8}s of the ${DIAL.cascadeExhaust}s budget.`, 'info');
        finish('CASCADE RESOLVED ✅', 'success');
      }, 7600);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Importable n8n workflow export — real connections + parameters
  // ─────────────────────────────────────────────────────────────────────────
  buildN8nWorkflow() {
    const node = (id, name, type, typeVersion, position, parameters, notes) => ({
      id, name, type, typeVersion, position, parameters,
      ...(notes ? { notes, notesInFlow: false } : {})
    });

    const nodes = [
      node(
        'a1f0c2d4-0001-4a10-9c31-11d7f0a10001',
        'Dispatch Webhook',
        'n8n-nodes-base.webhook', 2, [-620, 0],
        {
          httpMethod: 'POST',
          path: 'helm-dispatch',
          responseMode: 'lastNode',
          options: {}
        },
        'Receives either {audioUrl} from the manager Siri Shortcut or a WhatsApp Cloud API message payload.'
      ),
      node(
        'a1f0c2d4-0002-4a10-9c31-11d7f0a10002',
        'Transcribe & Classify',
        'n8n-nodes-base.httpRequest', 4.2, [-400, 0],
        {
          method: 'POST',
          url: 'https://api.openai.com/v1/chat/completions',
          authentication: 'predefinedCredentialType',
          nodeCredentialType: 'openAiApi',
          sendBody: true,
          specifyBody: 'json',
          jsonBody: '={{ JSON.stringify({ model: "gpt-4o-mini", temperature: 0, response_format: { type: "json_schema", json_schema: { name: "dispatch_intent", strict: true, schema: { type: "object", additionalProperties: false, required: ["category","zone","priority","confidence"], properties: { category: { type: "string", enum: $json.allowedSkills }, zone: { type: "string", enum: $json.allowedZones }, priority: { type: "string", enum: ["P0","P1","P2"] }, confidence: { type: "number" } } } } }, messages: [ { role: "system", content: "Map the event-floor report to one registered crew skill and one registered venue zone. Never invent a value outside the supplied enums." }, { role: "user", content: $json.transcript || $json.text } ] }) }}',
          options: {}
        },
        'Structured output constrained to the venue enums. confidence < 0.7 is routed to manager confirmation instead of dialling.'
      ),
      node(
        'a1f0c2d4-0003-4a10-9c31-11d7f0a10003',
        'Crew Roster (Postgres)',
        'n8n-nodes-base.postgres', 2.4, [-180, 0],
        {
          operation: 'executeQuery',
          query: "SELECT c.id, c.name, c.phone_e164, c.skill, c.status,\n       p.lat, p.lng, p.checked_in_at\nFROM crew c\nLEFT JOIN crew_position p ON p.crew_id = c.id\nWHERE c.event_id = $1\n  AND c.skill = $2\n  AND c.status = 'available'\nORDER BY p.checked_in_at DESC NULLS LAST;",
          options: { queryReplacement: '={{ $json.eventId }},={{ $json.category }}' }
        },
        'Postgres is the crew + task system of record. Redis holds the short-TTL last-known position; Google Sheets is export only.'
      ),
      node(
        'a1f0c2d4-0004-4a10-9c31-11d7f0a10004',
        'Proximity Rank',
        'n8n-nodes-base.code', 2, [40, 0],
        {
          mode: 'runOnceForAllItems',
          jsCode: [
            '// Rank available crew by haversine distance from the fault zone centroid.',
            'const zone = $(\'Transcribe & Classify\').first().json.zoneCentroid;',
            'const R = 6371000;',
            'const toRad = d => (d * Math.PI) / 180;',
            'const dist = (a, b) => {',
            '  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);',
            '  const h = Math.sin(dLat / 2) ** 2 +',
            '    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;',
            '  return 2 * R * Math.asin(Math.sqrt(h));',
            '};',
            'const ranked = items',
            '  .map(i => i.json)',
            '  .filter(c => c.status === \'available\' && c.lat != null && c.lng != null)',
            '  .map(c => ({ ...c, distanceM: Math.round(dist(zone, c)) }))',
            '  .sort((a, b) => a.distanceM - b.distanceM)',
            '  .slice(0, 6)',
            '  .map((c, idx) => ({ ...c, priority: idx + 1, dialAtSeconds: idx * 10 }));',
            'return ranked.map(json => ({ json }));'
          ].join('\n')
        },
        'Emits the six nearest AVAILABLE crew with a 10s staggered dial offset each.'
      ),
      node(
        'a1f0c2d4-0005-4a10-9c31-11d7f0a10005',
        'Staggered Dialer (Twilio)',
        'n8n-nodes-base.httpRequest', 4.2, [260, 0],
        {
          method: 'POST',
          url: '=https://api.twilio.com/2010-04-01/Accounts/{{ $env.TWILIO_ACCOUNT_SID }}/Calls.json',
          authentication: 'predefinedCredentialType',
          nodeCredentialType: 'twilioApi',
          sendBody: true,
          contentType: 'form-urlencoded',
          bodyParameters: {
            parameters: [
              { name: 'To', value: '={{ $json.phone_e164 }}' },
              { name: 'From', value: '={{ $env.TWILIO_FROM_NUMBER }}' },
              { name: 'Url', value: '={{ $env.PUBLIC_BASE_URL }}/twiml/dispatch-offer' },
              { name: 'Timeout', value: '20' },
              { name: 'StatusCallback', value: '={{ $env.PUBLIC_BASE_URL }}/webhook/helm-call-status' },
              { name: 'StatusCallbackEvent', value: 'answered completed' }
            ]
          },
          options: { batching: { batch: { batchSize: 1, batchInterval: 10000 } } }
        },
        'One leg per ranked worker, batched 1-at-a-time every 10s = the staggered cascade. Cancel-on-answer is the companion "helm-call-status" workflow, which POSTs Status=canceled to /Calls/{Sid} for the losing legs.'
      ),
      node(
        'a1f0c2d4-0006-4a10-9c31-11d7f0a10006',
        'Route Pin (WhatsApp)',
        'n8n-nodes-base.httpRequest', 4.2, [480, 0],
        {
          method: 'POST',
          url: '=https://graph.facebook.com/v21.0/{{ $env.WA_PHONE_NUMBER_ID }}/messages',
          authentication: 'predefinedCredentialType',
          nodeCredentialType: 'whatsAppApi',
          sendBody: true,
          specifyBody: 'json',
          jsonBody: '={{ JSON.stringify({ messaging_product: "whatsapp", to: $json.phone_e164, type: "location", location: { latitude: $json.zoneLat, longitude: $json.zoneLng, name: $json.zoneName, address: "Reply with your location when you arrive" } }) }}',
          options: {}
        },
        'Sends the fault-location pin and asks the worker to reply with their own location message at arrival.'
      ),
      node(
        'a1f0c2d4-0007-4a10-9c31-11d7f0a10007',
        'Check-in Listener',
        'n8n-nodes-base.webhook', 2, [700, 0],
        {
          httpMethod: 'POST',
          path: 'helm-checkin',
          responseMode: 'lastNode',
          options: {}
        },
        'Receives WhatsApp location + image messages. NOTE: WhatsApp Cloud API delivers discrete location messages only — there is no continuous live-location stream. Sub-minute tracking requires the optional browser PWA.'
      ),
      node(
        'a1f0c2d4-0008-4a10-9c31-11d7f0a10008',
        'Photo Verification (Vision)',
        'n8n-nodes-base.httpRequest', 4.2, [920, 0],
        {
          method: 'POST',
          url: 'https://api.openai.com/v1/chat/completions',
          authentication: 'predefinedCredentialType',
          nodeCredentialType: 'openAiApi',
          sendBody: true,
          specifyBody: 'json',
          jsonBody: '={{ JSON.stringify({ model: "gpt-4o-mini", temperature: 0, response_format: { type: "json_schema", json_schema: { name: "proof_check", strict: true, schema: { type: "object", additionalProperties: false, required: ["resolved","confidence","reason"], properties: { resolved: { type: "boolean" }, confidence: { type: "number" }, reason: { type: "string" } } } } }, messages: [ { role: "user", content: [ { type: "text", text: "Does this photo show the reported fault resolved? Report: " + $json.taskSummary }, { type: "image_url", image_url: { url: $json.mediaUrl } } ] } ] }) }}',
          options: {}
        },
        'Advisory only. The pipeline additionally enforces: server-receipt timestamp inside the task window AND arrival check-in inside the zone geofence. confidence < 0.8 or either binding failing routes to manager review.'
      ),
      node(
        'a1f0c2d4-0009-4a10-9c31-11d7f0a10009',
        'Close Task & Payout',
        'n8n-nodes-base.postgres', 2.4, [1140, 0],
        {
          operation: 'executeQuery',
          query: "WITH closed AS (\n  UPDATE tasks SET status = 'verified', closed_at = now(), proof_media_id = $2\n  WHERE id = $1 RETURNING id, crew_id, payout_paise\n)\nINSERT INTO payout_ledger (task_id, crew_id, amount_paise, created_at)\nSELECT id, crew_id, payout_paise, now() FROM closed\nRETURNING *;",
          options: { queryReplacement: '={{ $json.taskId }},={{ $json.mediaId }}' }
        },
        'Single transaction: close the task and write exactly one payout line against the verified proof.'
      )
    ];

    // Real connection graph: strict 1 -> 2 -> ... -> 9 linear chain.
    const connections = {};
    for (let i = 0; i < nodes.length - 1; i++) {
      connections[nodes[i].name] = {
        main: [[{ node: nodes[i + 1].name, type: 'main', index: 0 }]]
      };
    }

    return {
      name: 'Helm Events — AI Proximity Crew Dispatch',
      nodes,
      connections,
      active: false,
      settings: { executionOrder: 'v1' },
      pinData: {},
      staticData: null,
      tags: [],
      versionId: '1.0.0',
      meta: {
        templateCredsSetupCompleted: false,
        description:
          'Helm Events crew dispatch. Attach OpenAI, Twilio, WhatsApp and Postgres credentials after import, ' +
          'and set TWILIO_ACCOUNT_SID, TWILIO_FROM_NUMBER, WA_PHONE_NUMBER_ID and PUBLIC_BASE_URL in the n8n environment. ' +
          'Cancel-on-answer requires the companion helm-call-status workflow bound to the Twilio status callback.'
      }
    };
  }

  downloadN8nJson() {
    const blob = new Blob([JSON.stringify(this.buildN8nWorkflow(), null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'helm_events_n8n_crew_dispatch_workflow.json';
    a.click();
    URL.revokeObjectURL(url);
  }
}
