import * as THREE from 'three';

export class ThreeDLiveSpaceEditor {
  constructor(containerElement, initialSelections = {}, onUpdateSelections = null) {
    this.container = containerElement;
    this.selections = { ...initialSelections };
    this.onUpdateSelections = onUpdateSelections;

    this.mode = 'editor3d';
    this.selectedMesh = null;
    this.isDragging = false;
    this.animating = false;
    this.customText = initialSelections.customText || 'HELM EVENTS 2026';

    // Three.js Core
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

    // Asset tracking
    this.placedObjects = [];

    // Swatches
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

  // 🎨 Offscreen Canvas Slogan Texture Generator
  createSloganCanvasTexture(textToPaint) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    // Background Gradient
    const grad = ctx.createLinearGradient(0, 0, 256, 64);
    grad.addColorStop(0, '#0f172a');
    grad.addColorStop(0.5, '#1e1b4b');
    grad.addColorStop(1, '#0f172a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 64);

    // Metallic Gold Border Frame
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 4;
    ctx.strokeRect(4, 4, 248, 56);

    // Text Styling
    ctx.font = '700 18px "SF Pro Display", -apple-system, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(217, 119, 6, 0.8)';
    ctx.shadowBlur = 8;

    const displayStr = (textToPaint || 'HELM EVENTS 2026').toUpperCase();
    ctx.fillText(displayStr.length > 22 ? displayStr.substring(0, 22) + '...' : displayStr, 128, 32);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
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
    this.camera.position.set(0, 14, 18);
    this.camera.lookAt(0, 0, 0);

    // Renderer & PCFSoftShadowMap
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    canvasHolder.innerHTML = '';
    canvasHolder.appendChild(this.renderer.domElement);

    // Lighting Pipeline
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xfffaed, 1.5);
    dirLight.position.set(12, 22, 16);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 60;
    dirLight.shadow.camera.left = -20;
    dirLight.shadow.camera.right = 20;
    dirLight.shadow.camera.top = 20;
    dirLight.shadow.camera.bottom = -20;
    this.scene.add(dirLight);

    const pointLight = new THREE.PointLight(0xd97706, 1.2, 35);
    pointLight.position.set(0, 8, 0);
    this.scene.add(pointLight);

    // Floor Grid & Ground
    this.buildFloorGrid();

    // Spawn Multi-Mesh Composites
    this.populateInitial3DAssets();

    // Event Listeners
    this.bindThreeEvents(canvasHolder);

    // Start Rendering Loop
    this.animating = true;
    this.animate();
  }

  buildFloorGrid() {
    const groundGeo = new THREE.PlaneGeometry(40, 30);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x12131a,
      roughness: 0.3,
      metalness: 0.4
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    const grid = new THREE.GridHelper(40, 40, 0x6366f1, 0x27272a);
    grid.position.y = 0.01;
    this.scene.add(grid);
  }

  populateInitial3DAssets() {
    // Clear and dispose old assets
    this.placedObjects.forEach(obj => {
      this.disposeObject(obj);
      this.scene.remove(obj);
    });
    this.placedObjects = [];

    // 1. LED Stage Platform
    this.addStageMesh(0, -6, 'Concert LED Stage');

    // 2. Glass Podium with Microphones & Slogan Plaque
    this.addPodiumMesh(0, -4.5, 'Executive Glass Podium');

    // 3. Line Array Sound Towers
    this.addSoundTowerMesh(-8, -6, 'Left Sound Tower');
    this.addSoundTowerMesh(8, -6, 'Right Sound Tower');

    // 4. Banquet Tables with Pedestals & Peripheral Chairs
    const tablePositions = [
      { x: -6, z: 2 }, { x: 0, z: 2 }, { x: 6, z: 2 },
      { x: -6, z: 8 }, { x: 0, z: 8 }, { x: 6, z: 8 }
    ];

    tablePositions.forEach((pos, idx) => {
      this.addTableMesh(pos.x, pos.z, `Banquet Table #${idx + 1}`);
    });

    this.updateStats();
  }

  // 🍽️ Composite Multi-Mesh Banquet Table & Chairs
  addTableMesh(x, z, name = 'Banquet Table') {
    const group = new THREE.Group();

    // 1. Metal Chrome Pedestal Base
    const baseGeo = new THREE.CylinderGeometry(0.5, 0.6, 0.08, 32);
    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.9,
      roughness: 0.1,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05
    });
    const base = new THREE.Mesh(baseGeo, chromeMat);
    base.position.y = 0.04;
    base.castShadow = true;
    group.add(base);

    // 2. Pedestal Column Stem
    const stemGeo = new THREE.CylinderGeometry(0.12, 0.12, 1.2, 24);
    const stem = new THREE.Mesh(stemGeo, chromeMat);
    stem.position.y = 0.65;
    stem.castShadow = true;
    group.add(stem);

    // 3. Marble / Cloth Tabletop Disc
    const topGeo = new THREE.CylinderGeometry(1.5, 1.5, 0.08, 32);
    const topMat = new THREE.MeshStandardMaterial({
      color: this.activeSwatch.hex,
      metalness: 0.25,
      roughness: 0.2,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1
    });
    const top = new THREE.Mesh(topGeo, topMat);
    top.position.y = 1.29;
    top.castShadow = true;
    top.receiveShadow = true;
    group.add(top);

    // 4. Surround Peripheral Chairs
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2;
      const chairGroup = new THREE.Group();

      // Seat Cushion
      const cushionGeo = new THREE.BoxGeometry(0.48, 0.08, 0.48);
      const cushionMat = new THREE.MeshStandardMaterial({ color: 0x3f3f46, roughness: 0.4 });
      const cushion = new THREE.Mesh(cushionGeo, cushionMat);
      cushion.position.y = 0.45;
      cushion.castShadow = true;
      chairGroup.add(cushion);

      // Backrest
      const backGeo = new THREE.BoxGeometry(0.48, 0.45, 0.06);
      const back = new THREE.Mesh(backGeo, cushionMat);
      back.position.set(0, 0.7, -0.22);
      back.castShadow = true;
      chairGroup.add(back);

      // Chrome Legs
      const legGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.45, 12);
      const leg1 = new THREE.Mesh(legGeo, chromeMat);
      leg1.position.set(-0.2, 0.225, -0.2);
      chairGroup.add(leg1);

      const leg2 = leg1.clone(); leg2.position.set(0.2, 0.225, -0.2); chairGroup.add(leg2);
      const leg3 = leg1.clone(); leg3.position.set(-0.2, 0.225, 0.2); chairGroup.add(leg3);
      const leg4 = leg1.clone(); leg4.position.set(0.2, 0.225, 0.2); chairGroup.add(leg4);

      chairGroup.position.set(Math.cos(angle) * 2.1, 0, Math.sin(angle) * 2.1);
      chairGroup.rotation.y = -angle + Math.PI / 2;
      group.add(chairGroup);
    }

    group.position.set(x, 0, z);
    group.userData = { id: Date.now() + Math.random(), name, type: 'table', cost: 450, mainMesh: top };
    this.scene.add(group);
    this.placedObjects.push(group);
    return group;
  }

  // 🎭 Composite LED Stage Platform & Slogan Banner
  addStageMesh(x, z, name = 'LED Stage Platform') {
    const group = new THREE.Group();

    // Matte Black Platform Base
    const platformGeo = new THREE.BoxGeometry(12, 0.8, 4.5);
    const platformMat = new THREE.MeshStandardMaterial({
      color: 0x111318,
      roughness: 0.35,
      metalness: 0.6
    });
    const platform = new THREE.Mesh(platformGeo, platformMat);
    platform.position.y = 0.4;
    platform.castShadow = true;
    platform.receiveShadow = true;
    group.add(platform);

    // Emissive Glowing Border Strip
    const stripGeo = new THREE.BoxGeometry(12.2, 0.12, 4.7);
    const stripMat = new THREE.MeshStandardMaterial({
      color: 0x6366f1,
      emissive: 0x6366f1,
      emissiveIntensity: 0.8
    });
    const strip = new THREE.Mesh(stripGeo, stripMat);
    strip.position.y = 0.06;
    group.add(strip);

    // Live Front Slogan Banner Mesh with CanvasTexture
    const bannerGeo = new THREE.PlaneGeometry(8, 0.7);
    const sloganTex = this.createSloganCanvasTexture(this.customText);
    const bannerMat = new THREE.MeshStandardMaterial({
      map: sloganTex,
      roughness: 0.2,
      metalness: 0.1,
      side: THREE.DoubleSide
    });
    const banner = new THREE.Mesh(bannerGeo, bannerMat);
    banner.position.set(0, 0.45, 2.26);
    group.add(banner);

    group.position.set(x, 0, z);
    group.userData = { id: Date.now(), name, type: 'stage', cost: 1800, mainMesh: platform, bannerMesh: banner };
    this.scene.add(group);
    this.placedObjects.push(group);
    return group;
  }

  // 🎤 Composite Brushed Brass Glass Podium & Microphones
  addPodiumMesh(x, z, name = 'Glass Podium') {
    const group = new THREE.Group();

    // Brushed Brass Base Cylinder
    const baseGeo = new THREE.CylinderGeometry(0.45, 0.5, 0.1, 32);
    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      metalness: 0.85,
      roughness: 0.15,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1
    });
    const base = new THREE.Mesh(baseGeo, brassMat);
    base.position.y = 0.05;
    base.castShadow = true;
    group.add(base);

    // Slender Translucent Stem
    const stemGeo = new THREE.CylinderGeometry(0.08, 0.08, 1.2, 24);
    const stemMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.9,
      roughness: 0.1
    });
    const stem = new THREE.Mesh(stemGeo, stemMat);
    stem.position.y = 0.65;
    stem.castShadow = true;
    group.add(stem);

    // Angled Glass Top Panel
    const glassGeo = new THREE.BoxGeometry(0.75, 0.04, 0.55);
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.75,
      metalness: 0.1,
      roughness: 0.05,
      clearcoat: 1.0
    });
    const glass = new THREE.Mesh(glassGeo, glassMat);
    glass.position.set(0, 1.28, -0.05);
    glass.rotation.x = 0.25;
    glass.castShadow = true;
    group.add(glass);

    // Micro Cylindrical Microphone
    const micStemGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.45, 12);
    const micMat = new THREE.MeshStandardMaterial({ color: 0x090a0f, metalness: 0.9 });
    const micStem = new THREE.Mesh(micStemGeo, micMat);
    micStem.position.set(-0.15, 1.48, -0.15);
    group.add(micStem);

    const micHeadGeo = new THREE.SphereGeometry(0.035, 16, 16);
    const micHead = new THREE.Mesh(micHeadGeo, micMat);
    micHead.position.set(-0.15, 1.7, -0.15);
    group.add(micHead);

    // Front Plaque Mesh with CanvasTexture
    const plaqueGeo = new THREE.PlaneGeometry(0.5, 0.25);
    const sloganTex = this.createSloganCanvasTexture(this.customText);
    const plaqueMat = new THREE.MeshStandardMaterial({ map: sloganTex, side: THREE.DoubleSide });
    const plaque = new THREE.Mesh(plaqueGeo, plaqueMat);
    plaque.position.set(0, 0.8, 0.1);
    group.add(plaque);

    group.position.set(x, 0, z);
    group.userData = { id: Date.now(), name, type: 'podium', cost: 450, mainMesh: glass, bannerMesh: plaque };
    this.scene.add(group);
    this.placedObjects.push(group);
    return group;
  }

  // 🔊 Composite Line Array Sound Tower
  addSoundTowerMesh(x, z, name = 'Sound Tower') {
    const group = new THREE.Group();

    // Heavy Metal Base
    const baseGeo = new THREE.BoxGeometry(1.2, 0.2, 1.2);
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x18181b, metalness: 0.8, roughness: 0.2 });
    const base = new THREE.Mesh(baseGeo, metalMat);
    base.position.y = 0.1;
    base.castShadow = true;
    group.add(base);

    // Vertical Truss Spine
    const spineGeo = new THREE.BoxGeometry(0.3, 4.8, 0.3);
    const spine = new THREE.Mesh(spineGeo, metalMat);
    spine.position.y = 2.5;
    spine.castShadow = true;
    group.add(spine);

    // 3 Curved Speaker Modules
    for (let i = 0; i < 3; i++) {
      const spkGeo = new THREE.BoxGeometry(0.9, 0.55, 0.6);
      const spkMat = new THREE.MeshStandardMaterial({ color: 0x090a0f, roughness: 0.7 });
      const spk = new THREE.Mesh(spkGeo, spkMat);
      spk.rotation.x = 0.15 + (i * 0.08);
      spk.position.set(0, 1.8 + (i * 0.9), 0.35);
      spk.castShadow = true;
      group.add(spk);
    }

    group.position.set(x, 0, z);
    group.userData = { id: Date.now(), name, type: 'sound', cost: 650, mainMesh: spine };
    this.scene.add(group);
    this.placedObjects.push(group);
    return group;
  }

  // 🎯 Dynamic Slogan Refresh Across All Scene Meshes
  updateSloganText(newText) {
    this.customText = newText;
    const newTex = this.createSloganCanvasTexture(newText);

    this.placedObjects.forEach(group => {
      if (group.userData && group.userData.bannerMesh) {
        group.userData.bannerMesh.material.map = newTex;
        group.userData.bannerMesh.material.needsUpdate = true;
      }
    });
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

  // 🎯 0.5-Unit Grid Snapping & Arena Boundary Clamping
  onMouseMove(e, canvasHolder) {
    if (!this.isDragging || !this.selectedMesh) return;

    const rect = canvasHolder.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersectionPoint = new THREE.Vector3();
    this.raycaster.ray.intersectPlane(this.plane, intersectionPoint);

    if (intersectionPoint) {
      // 1. Clamp to Floor Grid Arena [-18, 18] X & [-12, 12] Z
      const clampedX = Math.max(-18, Math.min(18, intersectionPoint.x));
      const clampedZ = Math.max(-12, Math.min(12, intersectionPoint.z));

      // 2. Snap to 0.5-unit incremental grid
      this.selectedMesh.position.x = Math.round(clampedX / 0.5) * 0.5;
      this.selectedMesh.position.z = Math.round(clampedZ / 0.5) * 0.5;
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
          main.material.emissiveIntensity = 0.5;
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
    this.disposeObject(this.selectedMesh);
    this.scene.remove(this.selectedMesh);
    this.placedObjects = this.placedObjects.filter(o => o !== this.selectedMesh);
    this.selectedMesh = null;
    this.updateInspectorUI();
    this.updateStats();
  }

  duplicateSelectedMesh() {
    if (!this.selectedMesh) return;
    const type = this.selectedMesh.userData.type;
    const x = Math.min(18, this.selectedMesh.position.x + 2);
    const z = Math.min(12, this.selectedMesh.position.z + 2);

    if (type === 'table') this.addTableMesh(x, z, 'Cloned Table');
    if (type === 'stage') this.addStageMesh(x, z, 'Cloned Stage');
    if (type === 'podium') this.addPodiumMesh(x, z, 'Cloned Podium');
    if (type === 'sound') this.addSoundTowerMesh(x, z, 'Cloned Sound Tower');

    this.updateStats();
  }

  // 🧹 Strict Memory Garbage Collection Disposal Helper
  disposeObject(obj) {
    if (!obj) return;
    obj.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach((mat) => {
            if (mat.map) mat.map.dispose();
            mat.dispose();
          });
        } else {
          if (child.material.map) child.material.map.dispose();
          child.material.dispose();
        }
      }
    });
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
          <p class="inspector-pos">Position: X ${this.selectedMesh.position.x.toFixed(1)} | Z ${this.selectedMesh.position.z.toFixed(1)} (0.5 Grid Snapped)</p>
          
          <div class="inspector-swatches-title">Material & Fabric Color Swatches</div>
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
          <span>👆 Click any 3D asset in the room to edit color, texture, duplicate, or drag across 0.5-unit floor grid.</span>
        </div>
      `;
    }
  }

  renderSwatches() {
    this.updateInspectorUI();
  }

  // ⏸️ WebGL Loop Control & Garbage Collection Safety
  animate() {
    if (!this.animating) return;

    requestAnimationFrame(() => this.animate());

    const time = Date.now() * 0.0005;
    const pointLight = this.scene ? this.scene.children.find(c => c.isPointLight) : null;
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
    this.animating = false; // Pause WebGL loop immediately
    if (this.placedObjects) {
      this.placedObjects.forEach(obj => this.disposeObject(obj));
    }
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer = null;
    }
    this.container.innerHTML = '';
  }

  bindEvents() {
    const btnAddTable = this.container.querySelector('#btnAddTable');
    if (btnAddTable) btnAddTable.addEventListener('click', () => this.addTableMesh(0, 0, 'New Banquet Table'));

    const btnAddStage = this.container.querySelector('#btnAddStage');
    if (btnAddStage) btnAddStage.addEventListener('click', () => this.addStageMesh(0, 0, 'New LED Stage'));

    const btnAddPodium = this.container.querySelector('#btnAddPodium');
    if (btnAddPodium) btnAddPodium.addEventListener('click', () => this.addPodiumMesh(0, 0, 'New Glass Podium'));

    const btnAddSound = this.container.querySelector('#btnAddSound');
    if (btnAddSound) btnAddSound.addEventListener('click', () => this.addSoundTowerMesh(0, 0, 'New Sound Tower'));

    const btnCamTop = this.container.querySelector('#btnCamTop');
    if (btnCamTop) btnCamTop.addEventListener('click', () => {
      this.camera.position.set(0, 25, 0.1);
      this.camera.lookAt(0, 0, 0);
    });

    const btnCam3D = this.container.querySelector('#btnCam3D');
    if (btnCam3D) btnCam3D.addEventListener('click', () => {
      this.camera.position.set(0, 14, 18);
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
              <span class="editor-sub">Multi-mesh composites • 0.5-Unit Snap Grid • Live Text CanvasTextures</span>
            </div>
            <div class="header-right">
              <div class="stats-pill">
                <span id="assetCountVal">0 Assets</span> | <span id="assetCostVal" class="text-gold">$0</span>
              </div>
              <button class="btn-close-editor" id="btnClose3DEditor">✕</button>
            </div>
          </div>

          <!-- Main Layout -->
          <div class="three-editor-workspace">
            <div class="asset-library-sidebar">
              <h3>📦 3D Asset Library</h3>
              <p>Click item to spawn on 3D floor:</p>

              <div class="asset-buttons-grid">
                <button class="asset-spawn-btn" id="btnAddTable">
                  <span class="icon">🍽️</span>
                  <span>Banquet Table & Surround Chairs</span>
                </button>

                <button class="asset-spawn-btn" id="btnAddStage">
                  <span class="icon">🎭</span>
                  <span>LED Stage & Slogan Banner</span>
                </button>

                <button class="asset-spawn-btn" id="btnAddPodium">
                  <span class="icon">🎤</span>
                  <span>Glass Podium & Microphones</span>
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
                💡 Drag mouse on objects to move across 0.5-unit floor grid. Click any object to edit material swatches.
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
