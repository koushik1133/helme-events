import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { formatMoney, escapeHtml } from '../utils/format.js';

/**
 * Arena = the physical floor. Ground plane, grid helper and the drag clamp all
 * derive from this single constant so they can never disagree again.
 */
const ARENA = { x: 20, z: 15 };
const GRID_SNAP = 0.5;
const DRAG_THRESHOLD_PX = 4;

/** Reusable colour scratch objects (no per-frame / per-click allocation). */
const COLOR_HIGHLIGHT = new THREE.Color(0x6366f1);
const COLOR_BLACK = new THREE.Color(0x000000);

/**
 * Geometries and non-tinted materials shared across every instance of an asset.
 * Created once per page, never disposed per-object (see SHARED_RESOURCES guard).
 * Cuts a 6-table scene from ~160 unique geometries to ~10.
 */
let SHARED = null;
const SHARED_RESOURCES = new Set();

function sharedAssets() {
  if (SHARED) return SHARED;

  SHARED = {
    // Table
    pedestalBaseGeo: new THREE.CylinderGeometry(0.5, 0.6, 0.08, 32),
    pedestalStemGeo: new THREE.CylinderGeometry(0.12, 0.12, 1.2, 24),
    tableTopGeo: new THREE.CylinderGeometry(1.5, 1.5, 0.08, 32),
    // Chair
    cushionGeo: new THREE.BoxGeometry(0.48, 0.08, 0.48),
    chairBackGeo: new THREE.BoxGeometry(0.48, 0.45, 0.06),
    chairLegGeo: new THREE.CylinderGeometry(0.025, 0.025, 0.45, 12),
    // Stage
    stagePlatformGeo: new THREE.BoxGeometry(12, 0.8, 4.5),
    stageStripGeo: new THREE.BoxGeometry(12.2, 0.12, 4.7),
    stageBannerGeo: new THREE.PlaneGeometry(8, 0.7),
    // Podium
    podiumBaseGeo: new THREE.CylinderGeometry(0.45, 0.5, 0.1, 32),
    podiumStemGeo: new THREE.CylinderGeometry(0.08, 0.08, 1.2, 24),
    podiumGlassGeo: new THREE.BoxGeometry(0.75, 0.04, 0.55),
    micStemGeo: new THREE.CylinderGeometry(0.015, 0.015, 0.45, 12),
    micHeadGeo: new THREE.SphereGeometry(0.035, 16, 16),
    plaqueGeo: new THREE.PlaneGeometry(0.5, 0.25),
    // Sound tower
    towerBaseGeo: new THREE.BoxGeometry(1.2, 0.2, 1.2),
    towerSpineGeo: new THREE.BoxGeometry(0.3, 4.8, 0.3),
    speakerGeo: new THREE.BoxGeometry(0.9, 0.55, 0.6),

    // Materials that are never tinted or highlighted per-instance.
    chromeMat: new THREE.MeshPhysicalMaterial({
      color: 0xe2e8f0,
      metalness: 0.95,
      roughness: 0.12,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05
    }),
    brassMat: new THREE.MeshPhysicalMaterial({
      color: 0xd97706,
      metalness: 0.9,
      roughness: 0.22,
      clearcoat: 1.0,
      clearcoatRoughness: 0.12
    }),
    upholsteryMat: new THREE.MeshStandardMaterial({ color: 0x3f3f46, roughness: 0.65, metalness: 0.05 }),
    darkMetalMat: new THREE.MeshStandardMaterial({ color: 0x18181b, metalness: 0.8, roughness: 0.3 }),
    speakerMat: new THREE.MeshStandardMaterial({ color: 0x0b0c11, roughness: 0.8, metalness: 0.1 }),
    micMat: new THREE.MeshStandardMaterial({ color: 0x090a0f, metalness: 0.9, roughness: 0.35 })
  };

  Object.values(SHARED).forEach(res => SHARED_RESOURCES.add(res));
  return SHARED;
}

/** Asset catalogue. Costs are INTEGER RUPEES (per the money contract). */
const ASSET_SPEC = {
  table: { label: 'Banquet Table', cost: 3500 },
  stage: { label: 'LED Stage', cost: 145000 },
  podium: { label: 'Glass Podium', cost: 12000 },
  sound: { label: 'Line Array Tower', cost: 38000 }
};

let UID = 0;
const nextId = () => `a3d_${Date.now().toString(36)}_${(UID++).toString(36)}`;

export class ThreeDLiveSpaceEditor {
  constructor(containerElement, initialSelections = {}, onUpdateSelections = null) {
    this.container = containerElement;
    this.selections = { ...initialSelections };
    this.onUpdateSelections = onUpdateSelections;

    /**
     * Layout change hook. NOT wired to the quote yet — see
     * scratchpad/requests/f4-3d-editor.md for the exact signature the
     * orchestrator should bind in main.js.
     * @type {null | ((layout: {items: Array, totalCost: number, seats: number}) => void)}
     */
    this.onLayoutChange = null;

    this.selectedMesh = null;
    this.isDragging = false;
    this.pendingDrag = null;
    this.animating = false;
    this.rafHandle = null;

    this.customText =
      initialSelections['custom_text_slot-election-podium'] ||
      initialSelections.customText ||
      'HELM EVENTS 2026';

    // Three.js core
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.pmrem = null;
    this.envTexture = null;
    this.dirLight = null;
    this.pointLight = null;
    this.resizeObserver = null;
    this.canvasHolder = null;

    this.raycaster = new THREE.Raycaster();
    this.pointerNdc = new THREE.Vector2();
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this._hitPoint = new THREE.Vector3();
    this._box = new THREE.Box3();

    this.placedObjects = [];

    this.swatches = [
      { name: 'Royal Gold', hex: 0xd97706, text: '#d97706' },
      { name: 'Midnight Navy', hex: 0x1e3a8a, text: '#1e3a8a' },
      { name: 'Crimson Rose', hex: 0xbe123c, text: '#be123c' },
      { name: 'Platinum Silver', hex: 0xe2e8f0, text: '#e2e8f0' },
      { name: 'Emerald Green', hex: 0x047857, text: '#047857' },
      { name: 'Obsidian Dark', hex: 0x18181b, text: '#18181b' }
    ];
    this.activeSwatch = this.swatches[0];

    // Bound once so listeners can be removed and no closure is allocated per frame.
    this.animate = this.animate.bind(this);
    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);
    this.handleResize = this.handleResize.bind(this);
  }

  // ---------------------------------------------------------------- textures

  createSloganCanvasTexture(textToPaint) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    const grad = ctx.createLinearGradient(0, 0, 512, 128);
    grad.addColorStop(0, '#0f172a');
    grad.addColorStop(0.5, '#1e1b4b');
    grad.addColorStop(1, '#0f172a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 128);

    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 8;
    ctx.strokeRect(8, 8, 496, 112);

    ctx.font = '700 36px "SF Pro Display", -apple-system, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(217, 119, 6, 0.85)';
    ctx.shadowBlur = 16;

    const displayStr = String(textToPaint || 'HELM EVENTS 2026').toUpperCase();
    ctx.fillText(displayStr.length > 22 ? `${displayStr.substring(0, 22)}...` : displayStr, 256, 64);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    texture.needsUpdate = true;
    return texture;
  }

  // ------------------------------------------------------------------- scene

  initThreeScene() {
    const canvasHolder = this.container.querySelector('#threeCanvasHolder');
    if (!canvasHolder) return;
    this.canvasHolder = canvasHolder;

    const width = canvasHolder.clientWidth || 800;
    const height = canvasHolder.clientHeight || 550;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0b0d14);

    this.camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 500);
    this.camera.position.set(0, 14, 18);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(width, height, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.style.touchAction = 'none';
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';

    canvasHolder.innerHTML = '';
    canvasHolder.appendChild(this.renderer.domElement);

    // Image-based lighting — without this every metal surface renders black.
    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    this.pmrem.compileEquirectangularShader();
    const roomScene = new RoomEnvironment();
    this.envTexture = this.pmrem.fromScene(roomScene, 0.04).texture;
    this.scene.environment = this.envTexture;
    this.scene.environmentIntensity = 0.85;
    roomScene.traverse(child => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    });

    // Direct lighting sits on top of the IBL, so it is much softer than before.
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.18));

    this.dirLight = new THREE.DirectionalLight(0xfff3dd, 1.6);
    this.dirLight.position.set(12, 22, 16);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.set(2048, 2048);
    this.dirLight.shadow.camera.near = 0.5;
    this.dirLight.shadow.camera.far = 70;
    this.dirLight.shadow.camera.left = -ARENA.x - 2;
    this.dirLight.shadow.camera.right = ARENA.x + 2;
    this.dirLight.shadow.camera.top = ARENA.z + 8;
    this.dirLight.shadow.camera.bottom = -ARENA.z - 8;
    this.dirLight.shadow.bias = -0.0006;
    // Static light: only re-render the shadow map when the layout actually changes.
    this.dirLight.shadow.autoUpdate = false;
    this.dirLight.shadow.needsUpdate = true;
    this.scene.add(this.dirLight);

    this.pointLight = new THREE.PointLight(0xd97706, 60, 40, 2);
    this.pointLight.position.set(0, 8, 0);
    this.scene.add(this.pointLight);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 1, 0);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.07;
    this.controls.minDistance = 6;
    this.controls.maxDistance = 70;
    // Never let the camera drop under the floor.
    this.controls.minPolarAngle = 0.05;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.04;
    this.controls.update();

    this.buildFloorGrid();
    this.populateInitial3DAssets();
    this.bindThreeEvents();

    this.resizeObserver = new ResizeObserver(this.handleResize);
    this.resizeObserver.observe(canvasHolder);
    this.handleResize();

    this.animating = true;
    this.animate();
  }

  handleResize() {
    if (!this.renderer || !this.camera || !this.canvasHolder) return;
    const width = this.canvasHolder.clientWidth;
    const height = this.canvasHolder.clientHeight;
    if (width < 1 || height < 1) return;

    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  buildFloorGrid() {
    const groundGeo = new THREE.PlaneGeometry(ARENA.x * 2, ARENA.z * 2);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x14161f,
      roughness: 0.45,
      metalness: 0.25
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // GridHelper is square, so draw it at the smaller axis and scale X to match
    // the ground exactly — no more 5 units of grid floating past the floor.
    const grid = new THREE.GridHelper(ARENA.z * 2, ARENA.z * 2, 0x6366f1, 0x27272a);
    grid.scale.x = ARENA.x / ARENA.z;
    grid.position.y = 0.012;
    grid.material.opacity = 0.45;
    grid.material.transparent = true;
    // Keep the grid out of raycasts entirely.
    grid.raycast = () => {};
    ground.raycast = () => {};
    this.scene.add(grid);

    this.floorObjects = [ground, grid];
  }

  populateInitial3DAssets() {
    this.clearPlacedObjects();

    this.addStageMesh(0, -9, 'Concert LED Stage');
    this.addPodiumMesh(0, -5.5, 'Executive Glass Podium');
    this.addSoundTowerMesh(-8, -9, 'Left Sound Tower');
    this.addSoundTowerMesh(8, -9, 'Right Sound Tower');

    [
      { x: -6, z: 2 }, { x: 0, z: 2 }, { x: 6, z: 2 },
      { x: -6, z: 8 }, { x: 0, z: 8 }, { x: 6, z: 8 }
    ].forEach((pos, idx) => this.addTableMesh(pos.x, pos.z, `Banquet Table #${idx + 1}`));

    this.updateStats();
  }

  clearPlacedObjects() {
    this.placedObjects.forEach(obj => {
      if (this.scene) this.scene.remove(obj);
      this.disposeObject(obj);
    });
    this.placedObjects = [];
    this.selectedMesh = null;
  }

  /**
   * Finalise a freshly built group: measure its footprint, clamp it inside the
   * arena, register it, and mark the shadow map dirty.
   */
  finalizeGroup(group, x, z, spec) {
    group.position.set(0, 0, 0);
    group.updateMatrixWorld(true);
    this._box.setFromObject(group);
    const halfX = Math.max(0.25, (this._box.max.x - this._box.min.x) / 2);
    const halfZ = Math.max(0.25, (this._box.max.z - this._box.min.z) / 2);
    group.userData.halfX = halfX;
    group.userData.halfZ = halfZ;
    Object.assign(group.userData, spec);

    const clamped = this.clampToArena(x, z, halfX, halfZ);
    group.position.set(clamped.x, 0, clamped.z);

    this.scene.add(group);
    this.placedObjects.push(group);
    this.markShadowsDirty();
    return group;
  }

  clampToArena(x, z, halfX, halfZ) {
    const limX = Math.max(0, ARENA.x - halfX);
    const limZ = Math.max(0, ARENA.z - halfZ);
    return {
      x: Math.max(-limX, Math.min(limX, x)),
      z: Math.max(-limZ, Math.min(limZ, z))
    };
  }

  /**
   * Spiral outward from a preferred spot until the asset's bounding box stops
   * overlapping anything already on the floor. Stops spawning pile-ups at (0,0).
   */
  findFreeSpot(group, preferX = 0, preferZ = 0) {
    const halfX = group.userData.halfX;
    const halfZ = group.userData.halfZ;
    const overlaps = (x, z) => this.placedObjects.some(other => {
      if (other === group) return false;
      const gapX = Math.abs(x - other.position.x) - (halfX + other.userData.halfX);
      const gapZ = Math.abs(z - other.position.z) - (halfZ + other.userData.halfZ);
      return gapX < 0.35 && gapZ < 0.35;
    });

    const step = 1.5;
    for (let ring = 0; ring < 18; ring++) {
      const candidates = ring === 0 ? [[0, 0]] : [];
      if (ring > 0) {
        for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * Math.PI * 2 + ring * 0.4;
          candidates.push([Math.cos(angle) * ring * step, Math.sin(angle) * ring * step]);
        }
      }
      for (const [dx, dz] of candidates) {
        const c = this.clampToArena(
          Math.round((preferX + dx) / GRID_SNAP) * GRID_SNAP,
          Math.round((preferZ + dz) / GRID_SNAP) * GRID_SNAP,
          halfX, halfZ
        );
        if (!overlaps(c.x, c.z)) return c;
      }
    }
    return this.clampToArena(preferX, preferZ, halfX, halfZ);
  }

  /** Spawn from the asset library: free spot + auto-select. */
  spawnAsset(type) {
    if (!this.scene) return null;
    const factories = {
      table: () => this.addTableMesh(0, 0, 'New Banquet Table'),
      stage: () => this.addStageMesh(0, 0, 'New LED Stage'),
      podium: () => this.addPodiumMesh(0, 0, 'New Glass Podium'),
      sound: () => this.addSoundTowerMesh(0, 0, 'New Sound Tower')
    };
    const factory = factories[type];
    if (!factory) return null;

    const group = factory();
    const spot = this.findFreeSpot(group, 0, type === 'table' ? 6 : 0);
    group.position.set(spot.x, 0, spot.z);

    this.selectedMesh = group;
    this.highlightSelectedObject();
    this.updateInspectorUI();
    this.markShadowsDirty();
    this.emitLayoutChange();
    return group;
  }

  // ------------------------------------------------------------------ assets

  addTableMesh(x, z, name = 'Banquet Table') {
    const S = sharedAssets();
    const group = new THREE.Group();

    const base = new THREE.Mesh(S.pedestalBaseGeo, S.chromeMat);
    base.position.y = 0.04;
    base.castShadow = true;
    group.add(base);

    const stem = new THREE.Mesh(S.pedestalStemGeo, S.chromeMat);
    stem.position.y = 0.65;
    stem.castShadow = true;
    group.add(stem);

    // Per-instance so swatches and the selection highlight do not bleed across tables.
    const topMat = new THREE.MeshPhysicalMaterial({
      color: this.activeSwatch.hex,
      metalness: 0.1,
      roughness: 0.45,
      clearcoat: 0.8,
      clearcoatRoughness: 0.25
    });
    const top = new THREE.Mesh(S.tableTopGeo, topMat);
    top.position.y = 1.29;
    top.castShadow = true;
    top.receiveShadow = true;
    group.add(top);

    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2;
      const chairGroup = new THREE.Group();

      const cushion = new THREE.Mesh(S.cushionGeo, S.upholsteryMat);
      cushion.position.y = 0.45;
      cushion.castShadow = true;
      chairGroup.add(cushion);

      const back = new THREE.Mesh(S.chairBackGeo, S.upholsteryMat);
      back.position.set(0, 0.7, -0.22);
      back.castShadow = true;
      chairGroup.add(back);

      [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]].forEach(([lx, lz]) => {
        const leg = new THREE.Mesh(S.chairLegGeo, S.chromeMat);
        leg.position.set(lx, 0.225, lz);
        chairGroup.add(leg);
      });

      chairGroup.position.set(Math.cos(angle) * 2.1, 0, Math.sin(angle) * 2.1);
      chairGroup.rotation.y = -angle + Math.PI / 2;
      group.add(chairGroup);
    }

    return this.finalizeGroup(group, x, z, {
      id: nextId(),
      name,
      type: 'table',
      cost: ASSET_SPEC.table.cost,
      seats: 4,
      mainMesh: top
    });
  }

  addStageMesh(x, z, name = 'LED Stage Platform') {
    const S = sharedAssets();
    const group = new THREE.Group();

    const platformMat = new THREE.MeshPhysicalMaterial({
      color: 0x14161c,
      roughness: 0.4,
      metalness: 0.35,
      clearcoat: 0.6,
      clearcoatRoughness: 0.3
    });
    const platform = new THREE.Mesh(S.stagePlatformGeo, platformMat);
    platform.position.y = 0.4;
    platform.castShadow = true;
    platform.receiveShadow = true;
    group.add(platform);

    const stripMat = new THREE.MeshStandardMaterial({
      color: 0x6366f1,
      emissive: 0x6366f1,
      emissiveIntensity: 1.4,
      roughness: 0.4
    });
    const strip = new THREE.Mesh(S.stageStripGeo, stripMat);
    strip.position.y = 0.06;
    group.add(strip);

    const bannerMat = new THREE.MeshStandardMaterial({
      map: this.createSloganCanvasTexture(this.customText),
      roughness: 0.5,
      metalness: 0.0,
      emissiveIntensity: 0.0,
      side: THREE.DoubleSide
    });
    const banner = new THREE.Mesh(S.stageBannerGeo, bannerMat);
    banner.position.set(0, 0.45, 2.26);
    group.add(banner);

    return this.finalizeGroup(group, x, z, {
      id: nextId(),
      name,
      type: 'stage',
      cost: ASSET_SPEC.stage.cost,
      seats: 0,
      mainMesh: platform,
      bannerMesh: banner
    });
  }

  addPodiumMesh(x, z, name = 'Glass Podium') {
    const S = sharedAssets();
    const group = new THREE.Group();

    // Per-instance clone: this is the highlight / swatch target, so it must not
    // be the shared brass material (that would tint every podium at once).
    const base = new THREE.Mesh(S.podiumBaseGeo, S.brassMat.clone());
    base.position.y = 0.05;
    base.castShadow = true;
    group.add(base);

    const stem = new THREE.Mesh(S.podiumStemGeo, S.chromeMat);
    stem.position.y = 0.65;
    stem.castShadow = true;
    group.add(stem);

    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x9fd8f5,
      transparent: true,
      opacity: 0.55,
      metalness: 0.0,
      roughness: 0.05,
      transmission: 0.6,
      ior: 1.5,
      clearcoat: 1.0,
      clearcoatRoughness: 0.03
    });
    const glass = new THREE.Mesh(S.podiumGlassGeo, glassMat);
    glass.position.set(0, 1.28, -0.05);
    glass.rotation.x = 0.25;
    group.add(glass);

    const micStem = new THREE.Mesh(S.micStemGeo, S.micMat);
    micStem.position.set(-0.15, 1.48, -0.15);
    group.add(micStem);

    const micHead = new THREE.Mesh(S.micHeadGeo, S.micMat);
    micHead.position.set(-0.15, 1.7, -0.15);
    group.add(micHead);

    const plaqueMat = new THREE.MeshStandardMaterial({
      map: this.createSloganCanvasTexture(this.customText),
      roughness: 0.55,
      side: THREE.DoubleSide
    });
    const plaque = new THREE.Mesh(S.plaqueGeo, plaqueMat);
    plaque.position.set(0, 0.8, 0.1);
    group.add(plaque);

    return this.finalizeGroup(group, x, z, {
      id: nextId(),
      name,
      type: 'podium',
      cost: ASSET_SPEC.podium.cost,
      seats: 0,
      // Highlight/swatch target is the brass base, not the near-invisible glass.
      mainMesh: base,
      bannerMesh: plaque
    });
  }

  addSoundTowerMesh(x, z, name = 'Sound Tower') {
    const S = sharedAssets();
    const group = new THREE.Group();

    const base = new THREE.Mesh(S.towerBaseGeo, S.darkMetalMat);
    base.position.y = 0.1;
    base.castShadow = true;
    group.add(base);

    // Per-instance material: this is the highlight / swatch target.
    const spineMat = new THREE.MeshStandardMaterial({ color: 0x2a2a31, metalness: 0.75, roughness: 0.35 });
    const spine = new THREE.Mesh(S.towerSpineGeo, spineMat);
    spine.position.y = 2.5;
    spine.castShadow = true;
    group.add(spine);

    for (let i = 0; i < 3; i++) {
      const spk = new THREE.Mesh(S.speakerGeo, S.speakerMat);
      spk.rotation.x = 0.15 + i * 0.08;
      spk.position.set(0, 1.8 + i * 0.9, 0.35);
      spk.castShadow = true;
      group.add(spk);
    }

    return this.finalizeGroup(group, x, z, {
      id: nextId(),
      name,
      type: 'sound',
      cost: ASSET_SPEC.sound.cost,
      seats: 0,
      mainMesh: spine
    });
  }

  // ------------------------------------------------------------------ slogan

  updateSloganText(newText) {
    const next = String(newText ?? '');
    if (next === this.customText) return;
    this.customText = next;
    if (!this.scene) return;

    const newTex = this.createSloganCanvasTexture(next);
    let used = false;
    this.placedObjects.forEach(group => {
      const banner = group.userData && group.userData.bannerMesh;
      if (!banner || !banner.material) return;
      // Each banner owns its own material; give each its own texture clone-free
      // by disposing the old map first, then sharing one new texture instance.
      if (banner.material.map && banner.material.map !== newTex) {
        banner.material.map.dispose();
      }
      banner.material.map = newTex;
      banner.material.needsUpdate = true;
      used = true;
    });
    if (!used) newTex.dispose();
  }

  // ------------------------------------------------------- pointer / picking

  bindThreeEvents() {
    const el = this.renderer.domElement;
    el.addEventListener('pointerdown', this.onPointerDown);
    el.addEventListener('pointermove', this.onPointerMove);
    // Bound on window so a release anywhere ends the drag — no sticky drags.
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);
  }

  unbindThreeEvents() {
    if (this.renderer && this.renderer.domElement) {
      this.renderer.domElement.removeEventListener('pointerdown', this.onPointerDown);
      this.renderer.domElement.removeEventListener('pointermove', this.onPointerMove);
    }
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerUp);
  }

  updatePointerNdc(e) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (!rect.width || !rect.height) return false;
    this.pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    return true;
  }

  /** Ray/ground intersection. Returns null when the ray misses the floor plane. */
  rayToGround() {
    return this.raycaster.ray.intersectPlane(this.groundPlane, this._hitPoint);
  }

  onPointerDown(e) {
    if (!this.camera || !this.renderer) return;
    if (e.button !== undefined && e.button !== 0) return;
    if (!this.updatePointerNdc(e)) return;

    this.raycaster.setFromCamera(this.pointerNdc, this.camera);
    // Only placed assets are pickable — the grid and ground opt out via raycast().
    const intersects = this.raycaster.intersectObjects(this.placedObjects, true);

    let hitGroup = null;
    for (const hit of intersects) {
      let node = hit.object;
      while (node && node.parent && node.parent !== this.scene) node = node.parent;
      if (node && node.userData && node.userData.type) { hitGroup = node; break; }
    }

    if (!hitGroup) {
      this.selectedMesh = null;
      this.highlightSelectedObject();
      this.updateInspectorUI();
      return;
    }

    this.selectedMesh = hitGroup;
    this.highlightSelectedObject();
    this.updateInspectorUI();

    // Record the grab offset so the asset never teleports under the cursor.
    const ground = this.rayToGround();
    this.pendingDrag = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      offsetX: ground ? hitGroup.position.x - ground.x : 0,
      offsetZ: ground ? hitGroup.position.z - ground.z : 0
    };

    // Orbiting must not fight object dragging.
    if (this.controls) this.controls.enabled = false;
    try { this.renderer.domElement.setPointerCapture(e.pointerId); } catch { /* no capture available */ }
  }

  onPointerMove(e) {
    if (!this.pendingDrag || !this.selectedMesh || !this.camera) return;
    if (e.pointerId !== this.pendingDrag.pointerId) return;

    if (!this.isDragging) {
      const dx = e.clientX - this.pendingDrag.startX;
      const dy = e.clientY - this.pendingDrag.startY;
      // Below the threshold this is still a click, not a drag.
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
      this.isDragging = true;
    }

    if (!this.updatePointerNdc(e)) return;
    this.raycaster.setFromCamera(this.pointerNdc, this.camera);
    const ground = this.rayToGround();
    if (!ground) return; // ray parallel to / above the floor — do not teleport to origin

    const data = this.selectedMesh.userData;
    const snappedX = Math.round((ground.x + this.pendingDrag.offsetX) / GRID_SNAP) * GRID_SNAP;
    const snappedZ = Math.round((ground.z + this.pendingDrag.offsetZ) / GRID_SNAP) * GRID_SNAP;
    // Clamp the bounding box, not the origin, so nothing hangs off the floor.
    const clamped = this.clampToArena(snappedX, snappedZ, data.halfX, data.halfZ);

    this.selectedMesh.position.x = clamped.x;
    this.selectedMesh.position.z = clamped.z;
    this.updateInspectorPosition();
  }

  onPointerUp(e) {
    if (this.pendingDrag && this.renderer && this.renderer.domElement) {
      try { this.renderer.domElement.releasePointerCapture(this.pendingDrag.pointerId); } catch { /* already released */ }
    }
    const wasDragging = this.isDragging;
    this.pendingDrag = null;
    this.isDragging = false;
    if (this.controls) this.controls.enabled = true;
    if (wasDragging) {
      this.markShadowsDirty();
      this.emitLayoutChange();
    }
  }

  markShadowsDirty() {
    if (this.dirLight) this.dirLight.shadow.needsUpdate = true;
  }

  // -------------------------------------------------------------- selection

  highlightSelectedObject() {
    this.placedObjects.forEach(obj => {
      const main = obj.userData.mainMesh;
      if (!main || !main.material || !main.material.emissive) return;
      const on = obj === this.selectedMesh;
      main.material.emissive.copy(on ? COLOR_HIGHLIGHT : COLOR_BLACK);
      main.material.emissiveIntensity = on ? 0.55 : 0;
    });
  }

  applySwatchToSelected(swatch) {
    if (!this.selectedMesh) return;
    // Swatch is per-selection now; it no longer hijacks every future spawn.
    this.selectedMesh.userData.swatchHex = swatch.hex;
    const main = this.selectedMesh.userData.mainMesh;
    if (main && main.material && main.material.color) {
      main.material.color.setHex(swatch.hex);
    }
    this.updateInspectorUI();
    this.emitLayoutChange();
  }

  deleteSelectedMesh() {
    if (!this.selectedMesh) return;
    const target = this.selectedMesh;
    this.scene.remove(target);
    this.disposeObject(target);
    this.placedObjects = this.placedObjects.filter(o => o !== target);
    this.selectedMesh = null;
    this.pendingDrag = null;
    this.isDragging = false;
    this.highlightSelectedObject();
    this.updateInspectorUI();
    this.markShadowsDirty();
    this.emitLayoutChange();
  }

  duplicateSelectedMesh() {
    if (!this.selectedMesh) return;
    const src = this.selectedMesh;
    const type = src.userData.type;

    const factories = {
      table: () => this.addTableMesh(0, 0, `${src.userData.name} (copy)`),
      stage: () => this.addStageMesh(0, 0, `${src.userData.name} (copy)`),
      podium: () => this.addPodiumMesh(0, 0, `${src.userData.name} (copy)`),
      sound: () => this.addSoundTowerMesh(0, 0, `${src.userData.name} (copy)`)
    };
    const factory = factories[type];
    if (!factory) return;

    const clone = factory();
    // Carry the source's colour across so a duplicate actually looks like a duplicate.
    if (src.userData.swatchHex !== undefined) {
      clone.userData.swatchHex = src.userData.swatchHex;
      const main = clone.userData.mainMesh;
      if (main && main.material && main.material.color) main.material.color.setHex(src.userData.swatchHex);
    }

    const spot = this.findFreeSpot(clone, src.position.x + 2, src.position.z + 2);
    clone.position.set(spot.x, 0, spot.z);

    this.selectedMesh = clone;
    this.highlightSelectedObject();
    this.updateInspectorUI();
    this.markShadowsDirty();
    this.emitLayoutChange();
  }

  // ------------------------------------------------------------- disposal

  disposeObject(obj, seen = new Set()) {
    if (!obj) return;
    obj.traverse(child => {
      if (child.geometry && !SHARED_RESOURCES.has(child.geometry) && !seen.has(child.geometry)) {
        seen.add(child.geometry);
        child.geometry.dispose();
      }
      const mats = Array.isArray(child.material) ? child.material : (child.material ? [child.material] : []);
      mats.forEach(mat => {
        if (SHARED_RESOURCES.has(mat) || seen.has(mat)) return;
        seen.add(mat);
        ['map', 'emissiveMap', 'normalMap', 'roughnessMap', 'metalnessMap', 'alphaMap'].forEach(key => {
          const tex = mat[key];
          if (tex && !seen.has(tex)) { seen.add(tex); tex.dispose(); }
        });
        mat.dispose();
      });
    });
  }

  // ------------------------------------------------------------------- data

  /** Serialisable snapshot of everything on the floor. */
  getLayout() {
    const items = this.placedObjects.map(obj => ({
      id: obj.userData.id,
      type: obj.userData.type,
      name: obj.userData.name,
      unitPrice: obj.userData.cost,
      quantity: 1,
      seats: obj.userData.seats || 0,
      x: Number(obj.position.x.toFixed(2)),
      z: Number(obj.position.z.toFixed(2)),
      colorHex: obj.userData.swatchHex ?? null
    }));
    return {
      items,
      totalCost: items.reduce((sum, i) => sum + Math.round(i.unitPrice * i.quantity), 0),
      seats: items.reduce((sum, i) => sum + i.seats, 0)
    };
  }

  /**
   * Notify the host app that the floor changed. Deliberately NOT wired into
   * activeSelections here — activeSelections is a flat slotId -> itemId string
   * map owned by main.js and must not be polluted from this component.
   */
  emitLayoutChange() {
    this.updateStats();
    if (typeof this.onLayoutChange === 'function') {
      try { this.onLayoutChange(this.getLayout()); } catch { /* host handler failed; keep the editor alive */ }
    }
  }

  updateStats() {
    const layout = this.getLayout();
    const countEl = this.container.querySelector('#assetCountVal');
    const costEl = this.container.querySelector('#assetCostVal');
    const seatEl = this.container.querySelector('#assetSeatVal');
    if (countEl) countEl.textContent = `${layout.items.length} Assets`;
    if (costEl) costEl.textContent = formatMoney(layout.totalCost);
    if (seatEl) seatEl.textContent = `${layout.seats} seats`;
  }

  updateInspectorPosition() {
    const el = this.container.querySelector('.inspector-pos');
    if (el && this.selectedMesh) {
      el.textContent = `Position: X ${this.selectedMesh.position.x.toFixed(1)} | Z ${this.selectedMesh.position.z.toFixed(1)} (0.5 grid snapped)`;
    }
  }

  updateInspectorUI() {
    const inspectorBox = this.container.querySelector('#objectInspectorBox');
    if (!inspectorBox) return;

    if (!this.selectedMesh) {
      inspectorBox.innerHTML = `
        <div class="inspector-placeholder">
          <span>👆 Select any 3D asset in the room to recolour, duplicate, delete or drag it across the 0.5-unit floor grid.</span>
        </div>
      `;
      return;
    }

    const data = this.selectedMesh.userData;
    const activeHex = data.swatchHex;
    inspectorBox.innerHTML = `
      <div class="inspector-card">
        <div class="inspector-head">
          <h4>📦 ${escapeHtml(data.name)}</h4>
          <span class="type-badge">${escapeHtml(String(data.type).toUpperCase())}</span>
        </div>
        <p class="inspector-pos">Position: X ${this.selectedMesh.position.x.toFixed(1)} | Z ${this.selectedMesh.position.z.toFixed(1)} (0.5 grid snapped)</p>
        <p class="inspector-cost">Indicative rental: <strong>${formatMoney(data.cost)}</strong></p>

        <div class="inspector-swatches-title" id="swatchGroupLabel">Material &amp; fabric colour</div>
        <div class="swatch-row" role="group" aria-labelledby="swatchGroupLabel">
          ${this.swatches.map(s => `
            <button type="button" class="swatch-btn ${activeHex === s.hex ? 'active' : ''}" style="background-color: ${s.text}" data-hex="${s.hex}" title="${escapeHtml(s.name)}" aria-label="Apply ${escapeHtml(s.name)}" aria-pressed="${activeHex === s.hex}"></button>
          `).join('')}
        </div>

        <div class="inspector-actions">
          <button type="button" class="btn-insp btn-dup" id="btnDupMesh">📋 Duplicate</button>
          <button type="button" class="btn-insp btn-del" id="btnDelMesh">🗑️ Delete</button>
        </div>
      </div>
    `;

    inspectorBox.querySelectorAll('.swatch-btn').forEach(btn => {
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
  }

  // ------------------------------------------------------------- loop / life

  animate() {
    if (!this.animating) return;
    this.rafHandle = requestAnimationFrame(this.animate);

    if (this.pointLight) {
      const t = Date.now() * 0.0005;
      this.pointLight.position.x = Math.sin(t) * 8;
      this.pointLight.position.z = Math.cos(t) * 8;
    }
    if (this.controls) this.controls.update();
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  open() {
    // Idempotent: a second open() while already open must not start a second loop.
    if (this.renderer) return;
    this.render();

    // Initialise synchronously. render() applies innerHTML synchronously, so the
    // canvas holder already exists; the ResizeObserver corrects the camera aspect
    // and drawing-buffer size once layout settles.
    //
    // This used to be deferred to requestAnimationFrame, which does not fire while
    // the tab is hidden or backgrounded — the panel rendered and the 3D scene
    // silently never initialised, leaving a blank canvas until the editor was
    // closed and reopened.
    this.initThreeScene();
    this.updateStats();
  }

  close() {
    this.animating = false;
    if (this.rafHandle !== null) {
      cancelAnimationFrame(this.rafHandle);
      this.rafHandle = null;
    }

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    this.unbindThreeEvents();

    if (this.controls) {
      this.controls.dispose();
      this.controls = null;
    }

    if (this.scene) {
      const seen = new Set();
      this.disposeObject(this.scene, seen);
      this.scene.environment = null;
      this.scene.clear();
    }

    if (this.envTexture) { this.envTexture.dispose(); this.envTexture = null; }
    if (this.pmrem) { this.pmrem.dispose(); this.pmrem = null; }

    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.forceContextLoss();
      this.renderer.domElement = null;
      this.renderer = null;
    }

    this.placedObjects = [];
    this.floorObjects = [];
    this.selectedMesh = null;
    this.pendingDrag = null;
    this.isDragging = false;
    this.scene = null;
    this.camera = null;
    this.dirLight = null;
    this.pointLight = null;
    this.canvasHolder = null;
    this.container.innerHTML = '';
  }

  // ------------------------------------------------------------------- view

  bindEvents() {
    const spawn = (id, type) => {
      const btn = this.container.querySelector(id);
      if (btn) btn.addEventListener('click', () => this.spawnAsset(type));
    };
    spawn('#btnAddTable', 'table');
    spawn('#btnAddStage', 'stage');
    spawn('#btnAddPodium', 'podium');
    spawn('#btnAddSound', 'sound');

    const setCamera = (pos, target) => {
      if (!this.camera) return; // scene may not be initialised yet
      this.camera.position.set(pos[0], pos[1], pos[2]);
      if (this.controls) {
        this.controls.target.set(target[0], target[1], target[2]);
        this.controls.update();
      } else {
        this.camera.lookAt(target[0], target[1], target[2]);
      }
    };

    const btnCamTop = this.container.querySelector('#btnCamTop');
    if (btnCamTop) btnCamTop.addEventListener('click', () => setCamera([0, 30, 0.1], [0, 0, 0]));

    const btnCam3D = this.container.querySelector('#btnCam3D');
    if (btnCam3D) btnCam3D.addEventListener('click', () => setCamera([0, 14, 18], [0, 1, 0]));

    const btnCamGuest = this.container.querySelector('#btnCamGuest');
    if (btnCamGuest) btnCamGuest.addEventListener('click', () => setCamera([0, 3.2, 13], [0, 1.6, -8]));

    const btnClose = this.container.querySelector('#btnClose3DEditor');
    if (btnClose) btnClose.addEventListener('click', () => this.close());
  }

  render() {
    this.container.innerHTML = `
      <div class="three-editor-modal-overlay">
        <div class="three-editor-card" role="dialog" aria-modal="true" aria-label="3D event space editor">
          <div class="three-editor-header">
            <div class="header-left">
              <h2>🎮 Interactive 3D Event Space Editor</h2>
              <span class="editor-sub">Orbit &amp; zoom • drag to reposition • 0.5-unit snap grid • live slogan textures</span>
            </div>
            <div class="header-right">
              <div class="stats-pill" title="Indicative rental for the assets currently on the floor">
                <span id="assetCountVal">0 Assets</span> |
                <span id="assetSeatVal">0 seats</span> |
                <span id="assetCostVal" class="text-gold">${formatMoney(0)}</span>
              </div>
              <button type="button" class="btn-close-editor" id="btnClose3DEditor" aria-label="Close 3D editor">✕</button>
            </div>
          </div>

          <div class="three-editor-workspace">
            <div class="asset-library-sidebar">
              <h3>📦 3D Asset Library</h3>
              <p>Click an item to place it on a free spot:</p>

              <div class="asset-buttons-grid">
                <button type="button" class="asset-spawn-btn" id="btnAddTable">
                  <span class="icon" aria-hidden="true">🍽️</span>
                  <span>Banquet Table &amp; Chairs</span>
                </button>
                <button type="button" class="asset-spawn-btn" id="btnAddStage">
                  <span class="icon" aria-hidden="true">🎭</span>
                  <span>LED Stage &amp; Slogan Banner</span>
                </button>
                <button type="button" class="asset-spawn-btn" id="btnAddPodium">
                  <span class="icon" aria-hidden="true">🎤</span>
                  <span>Glass Podium &amp; Microphones</span>
                </button>
                <button type="button" class="asset-spawn-btn" id="btnAddSound">
                  <span class="icon" aria-hidden="true">🔊</span>
                  <span>Line Array Sound Tower</span>
                </button>
              </div>

              <div class="camera-views-box mt-3">
                <h4>🎥 Camera Angles</h4>
                <div class="cam-btns-row">
                  <button type="button" class="cam-btn" id="btnCam3D">Perspective</button>
                  <button type="button" class="cam-btn" id="btnCamTop">Top View</button>
                  <button type="button" class="cam-btn" id="btnCamGuest">Guest Eye</button>
                </div>
              </div>
            </div>

            <div class="three-canvas-container">
              <div id="threeCanvasHolder" class="three-canvas-holder"></div>
              <div class="canvas-help-hint">
                💡 Drag empty space to orbit, scroll to zoom. Tap or click an asset to select it, then drag to move it on the 0.5-unit grid.
              </div>
            </div>

            <div class="object-inspector-sidebar" id="objectInspectorBox">
              <div class="inspector-placeholder">
                <span>👆 Select any 3D asset in the room to recolour, duplicate, delete or drag it across the floor.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }
}
