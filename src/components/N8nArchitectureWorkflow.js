/**
 * N8nArchitectureWorkflow.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Clean, modern, spacious architecture & workflow viewer for n8n AI
 * Multi-Agent Proximity & Voice Dispatch System for large-scale Event Operations.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export class N8nArchitectureWorkflow {
  constructor(containerElement) {
    this.container = containerElement;
    this.activeTab = 'flow'; // 'flow' | 'simulator' | 'n8n-nodes' | 'roi'
    this.simRunning = false;
    this.simStep = 0;
    this.simTimer = null;
    this.render();
  }

  render() {
    this.container.innerHTML = `
      <div class="n8n-ops-wrapper">
        <!-- Hero Header -->
        <header class="n8n-ops-header">
          <div class="n8n-header-main">
            <div class="n8n-title-badge">
              <span class="badge-icon">⚡</span>
              <span>n8n AI Multi-Agent Operations</span>
            </div>
            <h2 class="n8n-main-title">AI Crew Dispatch & Proximity Engine Architecture</h2>
            <p class="n8n-main-subtitle">
              Hands-free voice & WhatsApp automated crew dispatch, real-time GPS proximity tracking, staggered parallel dialing, and AI photo proof-of-work verification.
            </p>
          </div>

          <!-- Key Metrics Pills -->
          <div class="n8n-metrics-row">
            <div class="metric-pill">
              <span class="m-icon">⏱️</span>
              <div class="m-data">
                <strong class="m-val">5 Seconds</strong>
                <span class="m-lbl">Avg Response Time</span>
              </div>
            </div>

            <div class="metric-pill">
              <span class="m-icon">📞</span>
              <div class="m-data">
                <strong class="m-val">Top 3 Parallel</strong>
                <span class="m-lbl">10s Staggered Dialing</span>
              </div>
            </div>

            <div class="metric-pill">
              <span class="m-icon">💰</span>
              <div class="m-data">
                <strong class="m-val">80% Saved</strong>
                <span class="m-lbl">Zero Middlemen Markup</span>
              </div>
            </div>

            <div class="metric-pill">
              <span class="m-icon">🖼️</span>
              <div class="m-data">
                <strong class="m-val">100% Photo AI</strong>
                <span class="m-lbl">Proof of Work Verified</span>
              </div>
            </div>
          </div>
        </header>

        <!-- Segmented Tab Navigation -->
        <nav class="n8n-tabs-nav">
          <button class="n8n-tab-btn ${this.activeTab === 'flow' ? 'active' : ''}" data-tab="flow">
            <span>🔄 Operation Flow (Type 1 & 2)</span>
          </button>
          <button class="n8n-tab-btn ${this.activeTab === 'simulator' ? 'active' : ''}" data-tab="simulator">
            <span>🎮 Live Call & Dispatch Simulator</span>
          </button>
          <button class="n8n-tab-btn ${this.activeTab === 'n8n-nodes' ? 'active' : ''}" data-tab="n8n-nodes">
            <span>⚡ Visual n8n Node Canvas</span>
          </button>
          <button class="n8n-tab-btn ${this.activeTab === 'roi' ? 'active' : ''}" data-tab="roi">
            <span>📊 ROI & Middleman Cost Comparison</span>
          </button>
        </nav>

        <!-- Tab Content Viewport -->
        <div class="n8n-tab-content">
          ${this.renderTabContent()}
        </div>
      </div>
    `;

    this.bindEvents();
  }

  renderTabContent() {
    switch (this.activeTab) {
      case 'flow':
        return this.renderFlowTab();
      case 'simulator':
        return this.renderSimulatorTab();
      case 'n8n-nodes':
        return this.renderN8nNodesTab();
      case 'roi':
        return this.renderRoiTab();
      default:
        return this.renderFlowTab();
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TAB 1: Detailed Operation Flow (Type 1 Voice & Type 2 WhatsApp)
  // ─────────────────────────────────────────────────────────────────────────
  renderFlowTab() {
    return `
      <div class="flow-tab-container">
        <!-- Dual Operation Types Header -->
        <div class="flow-grid-dual">
          <!-- TYPE 1: VOICE / SIRI FLOW -->
          <div class="flow-card type-1-card">
            <div class="flow-card-header">
              <span class="type-badge voice">🎙️ TYPE 1: VOICE / SIRI TRIGGER</span>
              <h3>"Hey Siri, find light people near Stage Right"</h3>
              <p>Hands-free natural spoken voice input translated to instant crew dispatch.</p>
            </div>

            <div class="flow-steps-timeline">
              <div class="timeline-step">
                <div class="step-num">1</div>
                <div class="step-body">
                  <h4>Voice Input & Domain Detection</h4>
                  <p>Manager speaks via iPhone/AirPods: <em>"Hey Siri, Stage B lights not working."</em> Voice Agent (Native/English NLP) detects domain: <strong>Lighting</strong> and location: <strong>Stage B</strong>.</p>
                </div>
              </div>

              <div class="timeline-step">
                <div class="step-num">2</div>
                <div class="step-body">
                  <h4>Google Sheets DB & Live Proximity Filter</h4>
                  <p>Agent checks DB (100+ crew list). Tracks live GPS (updated every 5s on WhatsApp/GPS). Identifies the <strong>Top 3 closest available workers</strong> (e.g., P1 at 45m, P2 at 60m, P3 at 75m).</p>
                </div>
              </div>

              <div class="timeline-step">
                <div class="step-num">3</div>
                <div class="step-body">
                  <h4>Parallel Staggered Dialing Protocol (10s Buffer)</h4>
                  <div class="call-stagger-box">
                    <div class="stagger-row"><span>t = 0s:</span> <strong>Dialing P1 (Rahul - Light Tech)</strong> [Ringing 20s]</div>
                    <div class="stagger-row"><span>t = 10s:</span> <strong>Dialing P2 (Vikram - Electrician)</strong> [10s buffer]</div>
                    <div class="stagger-row"><span>t = 20s:</span> <strong>Dialing P3 (Amit - Sound/Light)</strong> [10s buffer]</div>
                  </div>
                  <p class="stagger-note">⚡ <strong>Auto-Cancel:</strong> As soon as P1 answers and accepts, P2 and P3 calls drop immediately so they aren't disturbed!</p>
                  <p class="stagger-note">🔄 <strong>Cascade Retry:</strong> If P1, P2, P3 all reject/fail (~1m 20s window), system automatically dials P4, P5, P6 with the same 10s buffer!</p>
                </div>
              </div>

              <div class="timeline-step">
                <div class="step-num">4</div>
                <div class="step-body">
                  <h4>WhatsApp Map Pin & Real-Time Tracking</h4>
                  <p>Accepted worker (P1) receives Google Maps route link on WhatsApp. Live colored dot on venue map turns 🟡 En Route (tracked every 5s as they approach Stage B).</p>
                </div>
              </div>

              <div class="timeline-step">
                <div class="step-num">5</div>
                <div class="step-body">
                  <h4>Photo Proof & Manager Confirmation</h4>
                  <p>Worker completes job, takes a picture on WhatsApp. Vision AI verifies equipment is fixed. Manager gets instant WhatsApp confirmation & worker is approved for payout!</p>
                </div>
              </div>
            </div>
          </div>

          <!-- TYPE 2: WHATSAPP SLASH COMMAND FLOW -->
          <div class="flow-card type-2-card">
            <div class="flow-card-header">
              <span class="type-badge command">💬 TYPE 2: WHATSAPP COMMAND</span>
              <h3>"/light" or "/sound" Slash Commands</h3>
              <p>Instant text dispatch for busy managers using WhatsApp groups.</p>
            </div>

            <div class="flow-steps-timeline">
              <div class="timeline-step">
                <div class="step-num">1</div>
                <div class="step-body">
                  <h4>Quick Command Input</h4>
                  <p>Manager sends a message in WhatsApp group: <code>/light</code> or <code>/sound stage-left</code>.</p>
                </div>
              </div>

              <div class="timeline-step">
                <div class="step-num">2</div>
                <div class="step-body">
                  <h4>Automated Proximity Dispatch</h4>
                  <p>Webhook triggers n8n pipeline. Queries closest available technicians near manager's location or specified zone.</p>
                </div>
              </div>

              <div class="timeline-step">
                <div class="step-num">3</div>
                <div class="step-body">
                  <h4>Same Staggered Dialing & GPS Pipeline</h4>
                  <p>Executes identical 10s staggered parallel dialing, auto-cancelling backup calls once answered, and sending WhatsApp map directions.</p>
                </div>
              </div>

              <div class="timeline-step">
                <div class="step-num">4</div>
                <div class="step-body">
                  <h4>Complex Issue Handling</h4>
                  <p>If issue is flagged <strong>Complex</strong>: multiple workers are contacted simultaneously based on priority, or connected directly to Stage Manager.</p>
                </div>
              </div>

              <div class="timeline-step">
                <div class="step-num">5</div>
                <div class="step-body">
                  <h4>Work Done Verification Photo</h4>
                  <p>Photo uploaded via WhatsApp -> Vision AI checks -> Manager approved -> Automated payment log saved!</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TAB 2: Live Call & Dispatch Simulator
  // ─────────────────────────────────────────────────────────────────────────
  renderSimulatorTab() {
    return `
      <div class="simulator-tab-container">
        <div class="sim-panel-grid">
          <!-- Control Column -->
          <div class="sim-controls-card">
            <h3>🎮 Test AI Dispatch Simulation</h3>
            <p>Select a trigger prompt or command to observe the real-time n8n staggered call and dispatch engine.</p>

            <div class="form-group">
              <label>Select Trigger Scenario:</label>
              <select id="simScenarioSelect" class="sim-select">
                <option value="siri-light">🎙️ Siri: "Hey Siri, find light people near stage right"</option>
                <option value="siri-sound">🎙️ Siri: "Hey Siri, sound system on main lawn failing"</option>
                <option value="wa-light">💬 WhatsApp: "/light Stage B"</option>
                <option value="wa-electrician">💬 WhatsApp: "/electrician generator failure (Complex)"</option>
              </select>
            </div>

            <div class="form-group">
              <label>P1 Worker Behavior:</label>
              <select id="simP1Behavior" class="sim-select">
                <option value="accept-fast">⚡ P1 Accepts after 12s (Calls to P2/P3 canceled)</option>
                <option value="reject-all">❌ P1 & P2 & P3 Reject -> Cascade to P4, P5, P6</option>
              </select>
            </div>

            <button id="btnRunSimulation" class="btn-run-sim">
              <span>▶️ Run Live AI Dispatch Simulation</span>
            </button>

            <!-- Worker Map Status Box -->
            <div class="worker-status-box">
              <h4>📍 Live Crew GPS Status (Google Sheets DB)</h4>
              <div class="crew-list">
                <div class="crew-item"><span class="dot green">●</span> <strong>P1: Rahul (Light Tech)</strong> — 45m away (Free)</div>
                <div class="crew-item"><span class="dot green">●</span> <strong>P2: Vikram (Electrician)</strong> — 60m away (Free)</div>
                <div class="crew-item"><span class="dot green">●</span> <strong>P3: Amit (Lighting)</strong> — 75m away (Free)</div>
                <div class="crew-item"><span class="dot red">●</span> <strong>P4: Suresh (Light Sr)</strong> — 120m away (Busy)</div>
                <div class="crew-item"><span class="dot green">●</span> <strong>P5: Deepak (Technician)</strong> — 150m away (Free)</div>
              </div>
            </div>
          </div>

          <!-- Output Log Column -->
          <div class="sim-output-card">
            <div class="sim-log-header">
              <h3>📟 Real-Time Execution Log</h3>
              <span id="simStatusPill" class="sim-status-pill idle">IDLE</span>
            </div>

            <div id="simLogTerminal" class="sim-log-terminal">
              <div class="log-line text-muted">Ready to simulate. Click "Run Live AI Dispatch Simulation" to begin.</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TAB 3: Visual n8n Canvas Diagram & JSON Exporter
  // ─────────────────────────────────────────────────────────────────────────
  renderN8nNodesTab() {
    return `
      <div class="nodes-tab-container">
        <div class="nodes-header">
          <div class="nodes-title-group">
            <h3>⚡ Visual n8n Multi-Agent Workflow Nodes</h3>
            <p>Production node-based architecture for n8n cloud / self-hosted instance.</p>
          </div>
          <button id="btnDownloadN8nJson" class="btn-download-json">
            <span>📥 Download n8n Workflow JSON</span>
          </button>
        </div>

        <!-- Node Diagram Visual Grid -->
        <div class="n8n-canvas-visual">
          <div class="n8n-node-row">
            <div class="n8n-node trigger-node">
              <div class="node-icon">⚡</div>
              <div class="node-title">1. Webhook / Siri Trigger</div>
              <div class="node-sub">Twilio / WhatsApp API</div>
            </div>
            <div class="node-arrow">➔</div>

            <div class="n8n-node nlp-node">
              <div class="node-icon">🧠</div>
              <div class="node-title">2. Voice & NLP Agent</div>
              <div class="node-sub">OpenAI Whisper + GPT-4o</div>
            </div>
            <div class="node-arrow">➔</div>

            <div class="n8n-node db-node">
              <div class="node-icon">📊</div>
              <div class="node-title">3. Google Sheets DB</div>
              <div class="node-sub">Crew List & Live GPS</div>
            </div>
          </div>

          <div class="n8n-node-row">
            <div class="n8n-node geo-node">
              <div class="node-icon">📍</div>
              <div class="node-title">4. Proximity Filter</div>
              <div class="node-sub">Find Closest 3 Workers</div>
            </div>
            <div class="node-arrow">➔</div>

            <div class="n8n-node call-node">
              <div class="node-icon">📞</div>
              <div class="node-title">5. Staggered Call Router</div>
              <div class="node-sub">P1, P2, P3 (10s buffer)</div>
            </div>
            <div class="node-arrow">➔</div>

            <div class="n8n-node wa-node">
              <div class="node-icon">🗺️</div>
              <div class="node-title">6. WhatsApp Route Sender</div>
              <div class="node-sub">Google Maps Pin + Link</div>
            </div>
          </div>

          <div class="n8n-node-row">
            <div class="n8n-node gps-node">
              <div class="node-icon">🛰️</div>
              <div class="node-title">7. Live GPS Tracker</div>
              <div class="node-sub">5s Polling on Venue Map</div>
            </div>
            <div class="node-arrow">➔</div>

            <div class="n8n-node vision-node">
              <div class="node-icon">📸</div>
              <div class="node-title">8. Vision AI Photo Verifier</div>
              <div class="node-sub">Proof of Work Check</div>
            </div>
            <div class="node-arrow">➔</div>

            <div class="n8n-node payout-node">
              <div class="node-icon">🎉</div>
              <div class="node-title">9. Manager Alert & Payout</div>
              <div class="node-sub">Sheets Update + Payment</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TAB 4: ROI & Cost Comparison
  // ─────────────────────────────────────────────────────────────────────────
  renderRoiTab() {
    return `
      <div class="roi-tab-container">
        <div class="roi-header">
          <h3>📊 Middlemen vs AI Multi-Agent Cost & Efficiency Matrix</h3>
          <p>Direct comparison between legacy manual crew management and the automated n8n AI dispatch system.</p>
        </div>

        <div class="roi-grid-comparison">
          <!-- Traditional Column -->
          <div class="roi-card old-way">
            <div class="roi-card-header">
              <span class="roi-badge red">❌ TRADITIONAL EVENT SETUP</span>
              <h4>100 Middlemen & Phone Chains</h4>
              <div class="cost-stat">$275,000 Total Cost</div>
            </div>

            <ul class="roi-list">
              <li>⚠️ <strong>High Overhead:</strong> 1 Stage Manager ($200,000) + Team Leaders ($75,000) + 100 workers.</li>
              <li>⚠️ <strong>Slow Response:</strong> Takes 20+ minutes to find and direct a worker via phone calls.</li>
              <li>⚠️ <strong>Worker Overlapping:</strong> Multiple people blindly rush to do the exact same task.</li>
              <li>⚠️ <strong>Hallucination / Assumptions:</strong> Managers assume someone else already fixed the issue.</li>
              <li>⚠️ <strong>No Proof of Work:</strong> No visual verification whether job was actually completed.</li>
            </ul>
          </div>

          <!-- AI System Column -->
          <div class="roi-card new-way">
            <div class="roi-card-header">
              <span class="roi-badge green">⚡ HELME n8n AI DISPATCH SYSTEM</span>
              <h4>1 Manager + AI Multi-Agents</h4>
              <div class="cost-stat">$2,000 Meta API Cost (80% Savings!)</div>
            </div>

            <ul class="roi-list">
              <li>✅ <strong>Zero Middlemen Fee:</strong> Eliminates supervisor markup; direct automated dispatch to workers.</li>
              <li>✅ <strong>5-Second Response:</strong> Instant proximity lookup & automated staggered phone calls.</li>
              <li>✅ <strong>Zero Overlapping:</strong> Auto-cancels backup calls once P1 accepts.</li>
              <li>✅ <strong>Live Colored Dots on Maps:</strong> Real-time visual tracking of free (green) vs busy (red) crew.</li>
              <li>✅ <strong>Guaranteed Photo Proof:</strong> AI Vision verifies uploaded photo before approving payment.</li>
            </ul>
          </div>
        </div>
      </div>
    `;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Event Listeners & Simulation Runner
  // ─────────────────────────────────────────────────────────────────────────
  bindEvents() {
    // Tab switching
    this.container.querySelectorAll('.n8n-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.activeTab = btn.getAttribute('data-tab');
        this.render();
      });
    });

    // Run Simulation
    const btnSim = this.container.querySelector('#btnRunSimulation');
    if (btnSim) {
      btnSim.addEventListener('click', () => this.runSimulation());
    }

    // Download JSON
    const btnJson = this.container.querySelector('#btnDownloadN8nJson');
    if (btnJson) {
      btnJson.addEventListener('click', () => this.downloadN8nJson());
    }
  }

  runSimulation() {
    if (this.simRunning) return;
    this.simRunning = true;

    const logTerm = this.container.querySelector('#simLogTerminal');
    const statusPill = this.container.querySelector('#simStatusPill');
    const scenario = this.container.querySelector('#simScenarioSelect').value;
    const p1Behavior = this.container.querySelector('#simP1Behavior').value;

    if (logTerm) logTerm.innerHTML = '';
    if (statusPill) {
      statusPill.textContent = 'RUNNING...';
      statusPill.className = 'sim-status-pill running';
    }

    const addLog = (text, type = 'info') => {
      if (!logTerm) return;
      const div = document.createElement('div');
      div.className = `log-line log-${type}`;
      div.innerHTML = `<span class="log-time">[${new Date().toLocaleTimeString()}]</span> ${text}`;
      logTerm.appendChild(div);
      logTerm.scrollTop = logTerm.scrollHeight;
    };

    addLog(`Initiating n8n Webhook Trigger for scenario: <strong>${scenario}</strong>`, 'highlight');

    setTimeout(() => {
      addLog(`🧠 OpenAI NLP Agent parsed voice input -> Category: <strong>Lighting</strong>, Zone: <strong>Stage B</strong>`, 'info');
    }, 800);

    setTimeout(() => {
      addLog(`📊 Google Sheets DB Query -> Filtered 100 crew members by GPS location.`, 'info');
      addLog(`📍 Top 3 Closest Workers: <strong>P1 (Rahul 45m)</strong>, <strong>P2 (Vikram 60m)</strong>, <strong>P3 (Amit 75m)</strong>`, 'success');
    }, 1800);

    setTimeout(() => {
      addLog(`📞 <strong>[t=0s] Twilio Call Initiated to P1 (Rahul)</strong>... Ringing 20s window`, 'call');
    }, 2800);

    setTimeout(() => {
      addLog(`📞 <strong>[t=10s] Staggered Call Initiated to P2 (Vikram)</strong>... 10s buffer active`, 'call');
    }, 3800);

    if (p1Behavior === 'accept-fast') {
      setTimeout(() => {
        addLog(`✅ <strong>[t=12s] P1 (Rahul) ANSWERED & ACCEPTED THE TASK!</strong>`, 'success');
        addLog(`⚡ <strong>Auto-Cancelling P2 & P3 calls</strong> to avoid disturbing other workers!`, 'warning');
        addLog(`🗺️ Sending WhatsApp Google Maps route pin to Rahul...`, 'info');
      }, 5000);

      setTimeout(() => {
        addLog(`🛰️ <strong>[t=20s] Live GPS:</strong> Rahul is 20m away from Stage B (Dot: 🟡 En Route)`, 'info');
      }, 6500);

      setTimeout(() => {
        addLog(`📸 <strong>[t=35s] WhatsApp Photo Received!</strong> Vision AI analyzing...`, 'info');
        addLog(`✅ <strong>Vision AI Verification: 100% Confirmed Fixed!</strong>`, 'success');
        addLog(`🎉 Stage Manager notified. Payout of $150 logged for Rahul. Task COMPLETE.`, 'highlight');
        if (statusPill) {
          statusPill.textContent = 'SUCCESS ✅';
          statusPill.className = 'sim-status-pill success';
        }
        this.simRunning = false;
      }, 8000);
    } else {
      setTimeout(() => {
        addLog(`❌ [t=20s] P1, P2, P3 call timeout / rejected.`, 'error');
        addLog(`🔄 <strong>CASCADE RETRY:</strong> Dials Next 3 closest workers: P4 (Suresh 120m), P5 (Deepak 150m)...`, 'warning');
        addLog(`✅ P5 (Deepak) ACCEPTED at t=28s! Route sent.`, 'success');
        if (statusPill) {
          statusPill.textContent = 'CASCADE RESOLVED ✅';
          statusPill.className = 'sim-status-pill success';
        }
        this.simRunning = false;
      }, 5500);
    }
  }

  downloadN8nJson() {
    const n8nWorkflowData = {
      name: "Helme Events - AI Multi-Agent Proximity Crew Dispatch",
      nodes: [
        {
          name: "Siri / WhatsApp Webhook",
          type: "n8n-nodes-base.webhook",
          typeVersion: 1,
          position: [100, 300]
        },
        {
          name: "OpenAI Voice NLP Agent",
          type: "n8n-nodes-base.openAi",
          typeVersion: 1,
          position: [300, 300]
        },
        {
          name: "Google Sheets Crew DB",
          type: "n8n-nodes-base.googleSheets",
          typeVersion: 1,
          position: [500, 300]
        },
        {
          name: "Geospatial Proximity Filter",
          type: "n8n-nodes-base.code",
          typeVersion: 1,
          position: [700, 300]
        },
        {
          name: "Twilio Staggered Call Router",
          type: "n8n-nodes-base.twilio",
          typeVersion: 1,
          position: [900, 300]
        },
        {
          name: "WhatsApp Google Maps Route",
          type: "n8n-nodes-base.whatsApp",
          typeVersion: 1,
          position: [1100, 300]
        },
        {
          name: "Vision AI Photo Verifier",
          type: "n8n-nodes-base.openAi",
          typeVersion: 1,
          position: [1300, 300]
        }
      ],
      connections: {}
    };

    const blob = new Blob([JSON.stringify(n8nWorkflowData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'helme_events_n8n_crew_dispatch_workflow.json';
    a.click();
    URL.revokeObjectURL(url);
  }
}
