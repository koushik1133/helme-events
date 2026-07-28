import * as THREE from 'three';

export class ThreeDLiveSpaceEditor {
  constructor(containerElement, initialSelections = {}, onUpdateSelections = null) {
    this.container = containerElement;
    this.selections = { ...initialSelections };
    this.onUpdateSelections = onUpdateSelections;

    this.mode = 'editor3d'; // 'viewer360' or 'editor3d'
    this.selectedMesh = null;
    this.isDragging = false;

    // Three.js Core
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); // Floor plane Y=0

    // 3D Objects in Scene
    this.placedObjects = [];
    this.panoramaMesh = null;

    // Material Color Swatches
    this.swatches = [
      { name: 'Royal Gold', hex: 0xd97706, text: '#d97706' },
      { name: 'Midnight Navy', hex: 0x1e3a8a, text: '#1e3a8a' },
      { name: 'Crimson Rose', hex: 0xbe123c, text: '#be123c' },
      { name: 'Platinum Silver', hex: 0xe2e8f0, text: '#e2e8f0' },
      { name: 'Emerald Green', hex: 0x047857, text: '#047857' },
      { name: 'Obsidian Dark', hex: 0x18181b, text: '#18181b' }
    ];

    this.activeSwatch = this.swatches[0];
  }

  initThreeScene() {
    const canvasHolder = this.container.querySelector('#threeCanvasHolder');
    if (!canvasHolder) return;

    const width = canvasHolder.clientWidth || 800;
    const height = canvasHolder.clientHeight || 550;

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x090a0f);

    // Camera
    this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    this.camera.position.set(0, 12, 18);
    this.camera.lookAt(0, 0, 0);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    canvasHolder.innerHTML = '';
    canvasHolder.appendChild(this.renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xfffaed, 1.4);
    dirLight.position.set(10, 20, 15);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    this.scene.add(dirLight);

    const pointLight = new THREE.PointLight(0xd97706, 1, 30);
    pointLight.position.set(0, 6, 0);
    this.scene.add(pointLight);

    // Floor Grid & Ground
    this.buildFloorGrid();

    // Initial 3D Assets
    this.populateInitial3DAssets();

    // Event Listeners
    this.bindThreeEvents(canvasHolder);

    // Animation Loop
    this.animate();
  }

  buildFloorGrid() {
    // Ground Mesh
    const groundGeo = new THREE.PlaneGeometry(40, 30);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x12131a,
      roughness: 0.4,
      metalness: 0.2
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Grid Helper
    const grid = new THREE.GridHelper(40, 40, 0x6366f1, 0x27272a);
    grid.position.y = 0.01;
    this.scene.add(grid);
  }

  populateInitial3DAssets() {
    // Clear existing
    this.placedObjects.forEach(obj => this.scene.remove(obj.mesh));
    this.placedObjects = [];

    // Main Stage
    this.addStageMesh(0, -6, 'Main Stage Platform');

    // Podium on Stage
    this.addPodiumMesh(0, -5, 'Executive Podium');

    // Sound Towers
    this.addSoundTowerMesh(-8, -6, 'Left Sound Tower');
    this.addSoundTowerMesh(8, -6, 'Right Sound Tower');

    // Round Banquet Tables with Chairs
    const tablePositions = [
      { x: -6, z: 2 }, { x: 0, z: 2 }, { x: 6, z: 2 },
      { x: -6, z: 8 }, { x: 0, z: 8 }, { x: 6, z: 8 }
    ];

    tablePositions.forEach((pos, idx) => {
      this.addTableMesh(pos.x, pos.z, `Banquet Table #${idx + 1}`);
    });

    this.updateStats();
  }

  addTableMesh(x, z, name = 'Table') {
    const group = new THREE.Group();

    // Tabletop
    const topGeo = new THREE.CylinderGeometry(1.4, 1.4, 0.15, 32);
    const topMat = new THREE.MeshStandardMaterial({
      color: this.activeSwatch.hex,
      roughness: 0.3,
      metalness: 0.4
    });
    const top = new THREE.Mesh(topGeo, topMat);
    top.position.y = 1.3;
    top.castShadow = true;
    top.receiveShadow = true;
    group.add(top);

    // Leg
    const legGeo = new THREE.CylinderGeometry(0.15, 0.3, 1.3, 16);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x27272a, metalness: 0.8 });
    const leg = new THREE.Mesh(legGeo, legMat);
    leg.position.y = 0.65;
    leg.castShadow = true;
    group.add(leg);

    // 4 Chairs around table
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2;
      const chairGeo = new THREE.BoxGeometry(0.5, 0.8, 0.5);
      const chairMat = new THREE.MeshStandardMaterial({ color: 0x3f3f46, roughness: 0.5 });
      const chair = new THREE.Mesh(chairGeo, chairMat);
      chair.position.set(Math.cos(angle) * 2, 0.4, Math.sin(angle) * 2);
      chair.castShadow = true;
      group.add(chair);
    }

    group.position.set(x, 0, z);
    group.userData = { id: Date.now() + Math.random(), name, type: 'table', cost: 450, mainMesh: top };
    this.scene.add(group);
    this.placedObjects.push(group);
    return group;
  }

  addStageMesh(x, z, name = 'Main Stage') {
    const group = new THREE.Group();

    // Platform
    const platformGeo = new THREE.BoxGeometry(12, 0.8, 4);
    const platformMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.2, metalness: 0.8 });
    const platform = new THREE.Mesh(platformGeo, platformMat);
    platform.position.y = 0.4;
    platform.castShadow = true;
    platform.receiveShadow = true;
    group.add(platform);

    // LED Trim
    const trimGeo = new THREE.BoxGeometry(12.2, 0.1, 4.2);
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x6366f1, emissive: 0x6366f1, emissiveIntensity: 0.6 });
    const trim = new THREE.Mesh(trimGeo, trimMat);
    trim.position.y = 0.05;
    group.add(trim);

    group.position.set(x, 0, z);
    group.userData = { id: Date.now(), name, type: 'stage', cost: 1800, mainMesh: platform };
    this.scene.add(group);
    this.placedObjects.push(group);
    return group;
  }

  addPodiumMesh(x, z, name = 'Podium') {
    const group = new THREE.Group();

    const podGeo = new THREE.BoxGeometry(0.8, 1.4, 0.6);
    const podMat = new THREE.MeshStandardMaterial({ color: 0x3f3f46, roughness: 0.1, metalness: 0.9, transparent: true, opacity: 0.85 });
    const pod = new THREE.Mesh(podGeo, podMat);
    pod.position.y = 1.1;
    pod.castShadow = true;
    group.add(pod);

    // Mic
    const micGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.5);
    const micMat = new THREE.MeshStandardMaterial({ color: 0x000000, metalness: 1 });
    const mic = new THREE.Mesh(micGeo, micMat);
    mic.position.set(0, 1.9, -0.1);
    group.add(mic);

    group.position.set(x, 0, z);
    group.userData = { id: Date.now(), name, type: 'podium', cost: 350, mainMesh: pod };
    this.scene.add(group);
    this.placedObjects.push(group);
    return group;
  }

  addSoundTowerMesh(x, z, name = 'Sound Tower') {
    const group = new THREE.Group();

    const towerGeo = new THREE.BoxGeometry(0.8, 4.5, 0.8);
    const towerMat = new THREE.MeshStandardMaterial({ color: 0x090a0f, roughness: 0.8 });
    const tower = new THREE.Mesh(towerGeo, towerMat);
    tower.position.y = 2.25;
    tower.castShadow = true;
    group.add(tower);

    // Speaker Cones
    for (let i = 0; i < 3; i++) {
      const coneGeo = new THREE.CylinderGeometry(0.3, 0.2, 0.8, 16);
      const coneMat = new THREE.MeshStandardMaterial({ color: 0x27272a, metalness: 0.6 });
      const cone = new THREE.Mesh(coneGeo, coneMat);
      cone.rotation.x = Math.PI / 2;
      cone.position.set(0, 1.2 + (i * 1.1), 0.3);
      group.add(cone);
    }

    group.position.set(x, 0, z);
    group.userData = { id: Date.now(), name, type: 'sound', cost: 650, mainMesh: tower };
    this.scene.add(group);
    this.placedObjects.push(group);
    return group;
  }

  bindThreeEvents(canvasHolder) {
    canvasHolder.addEventListener('mousedown', (e) => this.onMouseDown(e, canvasHolder));
    canvasHolder.addEventListener('mousemove', (e) => this.onMouseMove(e, canvasHolder));
    canvasHolder.addEventListener('mouseup', () => this.onMouseUp());
  }

  onMouseDown(e, canvasHolder) {
    const rect = canvasHolder.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.scene.children, true);

    if (intersects.length > 0) {
      let topGroup = intersects[0].object;
      while (topGroup.parent && topGroup.parent !== this.scene) {
        topGroup = topGroup.parent;
      }

      if (topGroup && topGroup.userData && topGroup.userData.type) {
        this.selectedMesh = topGroup;
        this.isDragging = true;
        this.highlightSelectedObject();
        this.updateInspectorUI();
      } else {
        this.selectedMesh = null;
        this.updateInspectorUI();
      }
    } else {
      this.selectedMesh = null;
      this.updateInspectorUI();
    }
  }

  onMouseMove(e, canvasHolder) {
    if (!this.isDragging || !this.selectedMesh) return;

    const rect = canvasHolder.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersectionPoint = new THREE.Vector3();
    this.raycaster.ray.intersectPlane(this.plane, intersectionPoint);

    if (intersectionPoint) {
      this.selectedMesh.position.x = Math.max(-18, Math.min(18, intersectionPoint.x));
      this.selectedMesh.position.z = Math.max(-12, Math.min(12, intersectionPoint.z));
    }
  }

  onMouseUp() {
    this.isDragging = false;
  }

  highlightSelectedObject() {
    this.placedObjects.forEach(obj => {
      const main = obj.userData.mainMesh;
      if (main && main.material) {
        if (obj === this.selectedMesh) {
          main.material.emissive = new THREE.Color(0x6366f1);
          main.material.emissiveIntensity = 0.4;
        } else {
          main.material.emissive = new THREE.Color(0x000000);
          main.material.emissiveIntensity = 0;
        }
      }
    });
  }

  applySwatchToSelected(swatch) {
    this.activeSwatch = swatch;
    if (this.selectedMesh && this.selectedMesh.userData.mainMesh) {
      const main = this.selectedMesh.userData.mainMesh;
      if (main.material) {
        main.material.color.setHex(swatch.hex);
      }
    }
    this.renderSwatches();
  }

  deleteSelectedMesh() {
    if (!this.selectedMesh) return;
    this.scene.remove(this.selectedMesh);
    this.placedObjects = this.placedObjects.filter(o => o !== this.selectedMesh);
    this.selectedMesh = null;
    this.updateInspectorUI();
    this.updateStats();
  }

  duplicateSelectedMesh() {
    if (!this.selectedMesh) return;
    const type = this.selectedMesh.userData.type;
    const x = this.selectedMesh.position.x + 2;
    const z = this.selectedMesh.position.z + 2;

    if (type === 'table') this.addTableMesh(x, z, 'Cloned Table');
    if (type === 'stage') this.addStageMesh(x, z, 'Cloned Stage');
    if (type === 'podium') this.addPodiumMesh(x, z, 'Cloned Podium');
    if (type === 'sound') this.addSoundTowerMesh(x, z, 'Cloned Sound Tower');

    this.updateStats();
  }

  updateStats() {
    const totalCost = this.placedObjects.reduce((acc, obj) => acc + (obj.userData.cost || 0), 0);
    const countEl = this.container.querySelector('#assetCountVal');
    const costEl = this.container.querySelector('#assetCostVal');
    if (countEl) countEl.textContent = `${this.placedObjects.length} Assets`;
    if (costEl) costEl.textContent = `$${totalCost.toLocaleString()}`;
  }

  updateInspectorUI() {
    const inspectorBox = this.container.querySelector('#objectInspectorBox');
    if (!inspectorBox) return;

    if (this.selectedMesh) {
      const data = this.selectedMesh.userData;
      inspectorBox.innerHTML = `
        <div class="inspector-card">
          <div class="inspector-head">
            <h4>📦 ${data.name}</h4>
            <span class="type-badge">${data.type.toUpperCase()}</span>
          </div>
          <p class="inspector-pos">X: ${Math.round(this.selectedMesh.position.x)} | Z: ${Math.round(this.selectedMesh.position.z)}</p>
          
          <div class="inspector-swatches-title">Material Color Swatches</div>
          <div class="swatch-row">
            ${this.swatches.map(s => `
              <button class="swatch-btn ${this.activeSwatch.hex === s.hex ? 'active' : ''}" style="background-color: ${s.text}" data-hex="${s.hex}" title="${s.name}"></button>
            `).join('')}
          </div>

          <div class="inspector-actions">
            <button class="btn-insp btn-dup" id="btnDupMesh">📋 Duplicate</button>
            <button class="btn-insp btn-del" id="btnDelMesh">🗑️ Delete</button>
          </div>
        </div>
      `;

      // Bind swatch clicks
      const swatchBtns = inspectorBox.querySelectorAll('.swatch-btn');
      swatchBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const hexVal = Number(btn.getAttribute('data-hex'));
          const found = this.swatches.find(s => s.hex === hexVal);
          if (found) this.applySwatchToSelected(found);
        });
      });

      const btnDup = inspectorBox.querySelector('#btnDupMesh');
      if (btnDup) btnDup.addEventListener('click', () => this.duplicateSelectedMesh());

      const btnDel = inspectorBox.querySelector('#btnDelMesh');
      if (btnDel) btnDel.addEventListener('click', () => this.deleteSelectedMesh());
    } else {
      inspectorBox.innerHTML = `
        <div class="inspector-placeholder">
          <span>👆 Click any 3D asset in the room to edit color, texture, duplicate, or drag across floor.</span>
        </div>
      `;
    }
  }

  renderSwatches() {
    this.updateInspectorUI();
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    // Slow rotation of lights for dynamic reflections
    const time = Date.now() * 0.0005;
    const pointLight = this.scene.children.find(c => c.isPointLight);
    if (pointLight) {
      pointLight.position.x = Math.sin(time) * 8;
      pointLight.position.z = Math.cos(time) * 8;
    }

    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  open() {
    this.render();
    setTimeout(() => this.initThreeScene(), 50);
  }

  close() {
    this.container.innerHTML = '';
  }

  bindEvents() {
    // Add Asset Library Buttons
    const btnAddTable = this.container.querySelector('#btnAddTable');
    if (btnAddTable) btnAddTable.addEventListener('click', () => this.addTableMesh(0, 0, 'New Banquet Table'));

    const btnAddStage = this.container.querySelector('#btnAddStage');
    if (btnAddStage) btnAddStage.addEventListener('click', () => this.addStageMesh(0, 0, 'New LED Stage'));

    const btnAddPodium = this.container.querySelector('#btnAddPodium');
    if (btnAddPodium) btnAddPodium.addEventListener('click', () => this.addPodiumMesh(0, 0, 'New Podium'));

    const btnAddSound = this.container.querySelector('#btnAddSound');
    if (btnAddSound) btnAddSound.addEventListener('click', () => this.addSoundTowerMesh(0, 0, 'New Sound Tower'));

    // Camera Presets
    const btnCamTop = this.container.querySelector('#btnCamTop');
    if (btnCamTop) btnCamTop.addEventListener('click', () => {
      this.camera.position.set(0, 25, 0.1);
      this.camera.lookAt(0, 0, 0);
    });

    const btnCam3D = this.container.querySelector('#btnCam3D');
    if (btnCam3D) btnCam3D.addEventListener('click', () => {
      this.camera.position.set(0, 12, 18);
      this.camera.lookAt(0, 0, 0);
    });

    const btnClose = this.container.querySelector('#btnClose3DEditor');
    if (btnClose) btnClose.addEventListener('click', () => this.close());
  }

  render() {
    this.container.innerHTML = `
      <div class="three-editor-modal-overlay">
        <div class="three-editor-card">
          <!-- Header -->
          <div class="three-editor-header">
            <div class="header-left">
              <h2>🎮 Interactive 3D Real-Time Event Space Editor</h2>
              <span class="editor-sub">Drag assets on 3D floor, change fabrics & customize room setup live</span>
            </div>
            <div class="header-right">
              <div class="stats-pill">
                <span id="assetCountVal">0 Assets</span> | <span id="assetCostVal" class="text-gold">$0</span>
              </div>
              <button class="btn-close-editor" id="btnClose3DEditor">✕</button>
            </div>
          </div>

          <!-- Main Layout (Sidebar + 3D Canvas + Inspector) -->
          <div class="three-editor-workspace">
            <!-- Sidebar Asset Library -->
            <div class="asset-library-sidebar">
              <h3>📦 3D Asset Library</h3>
              <p>Click item to spawn on 3D floor:</p>

              <div class="asset-buttons-grid">
                <button class="asset-spawn-btn" id="btnAddTable">
                  <span class="icon">🍽️</span>
                  <span>Banquet Table & Chairs</span>
                </button>

                <button class="asset-spawn-btn" id="btnAddStage">
                  <span class="icon">🎭</span>
                  <span>LED Stage Platform</span>
                </button>

                <button class="asset-spawn-btn" id="btnAddPodium">
                  <span class="icon">🎤</span>
                  <span>Glass Podium & Mic</span>
                </button>

                <button class="asset-spawn-btn" id="btnAddSound">
                  <span class="icon">🔊</span>
                  <span>Line Array Sound Tower</span>
                </button>
              </div>

              <div class="camera-views-box mt-3">
                <h4>🎥 Camera Angles</h4>
                <div class="cam-btns-row">
                  <button class="cam-btn" id="btnCam3D">Perspective 3D</button>
                  <button class="cam-btn" id="btnCamTop">Top 2D View</button>
                </div>
              </div>
            </div>

            <!-- Central 3D Canvas -->
            <div class="three-canvas-container">
              <div id="threeCanvasHolder" class="three-canvas-holder"></div>
              <div class="canvas-help-hint">
                💡 Drag mouse on objects to move across floor plane. Click any object to customize fabric color.
              </div>
            </div>

            <!-- Right Inspector Sidebar -->
            <div class="object-inspector-sidebar" id="objectInspectorBox">
              <div class="inspector-placeholder">
                <span>👆 Click any 3D asset in the room to edit color, texture, duplicate, or drag across floor.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }
}
