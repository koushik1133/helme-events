import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { formatMoney, escapeHtml, readJSON, writeJSON } from '../utils/format.js';
import { injectStudio3DStyles } from './studio3d/studio3dStyles.js';

/**
 * Arena = the physical floor. Ground plane, grid helper and the drag clamp all
 * derive from this single constant so they can never disagree again.
 */
const ARENA = { x: 20, z: 15 };
const GRID_SNAP = 0.5;
const DRAG_THRESHOLD_PX = 4;

/** A client's arrangement must survive a reload. */
const LAYOUT_KEY = 'helm_3d_layout_v1';

/** Brand brass. The single accent in the 3D scene, matching the product chrome. */
const ACCENT = 0xd9a406;

/**
 * The two looks. "studio" is a warm dark showroom; "blueprint" is a pale
 * technical read for printing and for clients who want the plan, not the mood.
 */
const LOOKS = {
  studio: {
    label: 'Studio',
    background: 0x0d0f14,
    fogColor: 0x0d0f14,
    floorInner: '#2b2f3d',
    floorMid: '#191c26',
    floorOuter: '#0f1118',
    gridColor: 0x8d9ac4,
    gridOpacity: 0.32,
    exposure: 0.95,
    envIntensity: 0.42,
    ambient: 0.12,
    keyIntensity: 2.2,
    tint: null
  },
  blueprint: {
    label: 'Blueprint',
    background: 0xdfe6f2,
    fogColor: 0xdfe6f2,
    floorInner: '#ffffff',
    floorMid: '#eef2fa',
    floorOuter: '#dbe3f1',
    gridColor: 0x2f5fa8,
    gridOpacity: 0.5,
    exposure: 1.15,
    envIntensity: 0.5,
    ambient: 0.85,
    keyIntensity: 0.9,
    // Every tinted surface is pushed towards drafting-ink blue-grey.
    tint: 0x8fa6c9
  }
};

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
  constructor(containerElement, initialSelections = {}, onUpdateSelections = null, options = {}) {
    this.container = containerElement;
    this.selections = { ...initialSelections };
    this.onUpdateSelections = onUpdateSelections;

    /**
     * Presentation options. `modal` is a LEGACY shim for the old full-screen
     * pop-up and defaults to false: this component is an embedded studio view.
     */
    this.options = { modal: false, mode: 'view', look: 'studio', ...options };

    /** True between mount() and unmount(). */
    this.isMounted = false;
    this.mode = this.options.mode === 'edit' ? 'edit' : 'view';
    this.look = LOOKS[this.options.look] ? this.options.look : 'studio';

    /** Camera preset tween state (null when the camera is at rest). */
    this.camTween = null;
    this.selectionRing = null;
    this.selectionEdges = null;
    this._scrim = null;
    this._rootEl = null;

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
    this.resize = this.handleResize;
    this.onCanvasKeyDown = this.onCanvasKeyDown.bind(this);
  }

  // ---------------------------------------------------------------- textures

  createSloganCanvasTexture(textToPaint) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    const grad = ctx.createLinearGradient(0, 0, 512, 128);
    grad.addColorStop(0, '#101219');
    grad.addColorStop(0.5, '#191c25');
    grad.addColorStop(1, '#101219');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 128);

    ctx.strokeStyle = 'rgba(217, 164, 6, 0.9)';
    ctx.lineWidth = 2;
    ctx.strokeRect(14, 14, 484, 100);

    ctx.font = '600 34px "SF Pro Display", -apple-system, sans-serif';
    ctx.fillStyle = '#f4f1ea';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.letterSpacing = '4px';

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
    const canvasHolder = this.container.querySelector('.h3d-canvas');
    if (!canvasHolder) return;
    this.canvasHolder = canvasHolder;

    const width = canvasHolder.clientWidth || 800;
    const height = canvasHolder.clientHeight || 550;

    const look = LOOKS[this.look];

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(look.background);
    // Aerial fog dissolves the floor edge into the backdrop instead of ending it
    // on a hard rectangle, which is what made the old scene read as a demo.
    this.scene.fog = new THREE.Fog(look.fogColor, 34, 104);

    this.camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 500);
    this.camera.position.set(19, 15.5, 27);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(width, height, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = look.exposure;
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
    // environmentIntensity is a Scene property in three >= r163. Guard anyway so
    // a version bump cannot silently drop the IBL back to full blast.
    if ('environmentIntensity' in this.scene) this.scene.environmentIntensity = look.envIntensity;
    roomScene.traverse(child => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    });

    // Direct lighting sits on top of the IBL, so it is much softer than before.
    this.ambientLight = new THREE.AmbientLight(0xffffff, look.ambient);
    this.scene.add(this.ambientLight);

    this.dirLight = new THREE.DirectionalLight(0xfff3dd, look.keyIntensity);
    this.dirLight.position.set(14, 24, 14);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.set(2048, 2048);
    this.dirLight.shadow.radius = 2.5;
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

    // Static warm key-fill. This used to orbit the room every frame, which read
    // as a disco light rather than a venue and made screenshots inconsistent.
    this.pointLight = new THREE.PointLight(0xffd9a0, 38, 46, 2);
    this.pointLight.position.set(0, 9, 2);
    this.scene.add(this.pointLight);

    // Cool rim from behind the stage so dark assets separate from the floor.
    this.rimLight = new THREE.DirectionalLight(0x9fb4ff, 0.6);
    this.rimLight.position.set(-16, 10, -20);
    this.scene.add(this.rimLight);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 1.1, -1.5);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.07;
    this.controls.minDistance = 6;
    this.controls.maxDistance = 70;
    // Never let the camera drop under the floor.
    this.controls.minPolarAngle = 0.05;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.04;
    this.controls.update();

    this.buildFloorGrid();
    this.buildSelectionIndicator();
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

  /**
   * Floor albedo. A soft radial falloff with a faint sheen band, so the floor
   * reads as a polished surface receding into the fog rather than flat card.
   */
  createFloorTexture() {
    const look = LOOKS[this.look];
    const c = document.createElement('canvas');
    c.width = c.height = 1024;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(512, 512, 30, 512, 512, 620);
    g.addColorStop(0, look.floorInner);
    g.addColorStop(0.5, look.floorMid);
    g.addColorStop(1, look.floorOuter);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1024, 1024);

    // Very light grain. Without it the gradient bands visibly on wide screens.
    const img = ctx.getImageData(0, 0, 1024, 1024);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (Math.random() - 0.5) * 7;
      d[i] += n; d[i + 1] += n; d[i + 2] += n;
    }
    ctx.putImageData(img, 0, 0);

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }

  /**
   * Grid lines that fade out with distance from the centre of the arena.
   * A uniform grid shouts across the whole floor; this one recedes, which is
   * what makes it read as a drawing rather than graph paper.
   */
  fadeGridMaterial(material) {
    return this.fadeEdgeMaterial(material, 0.35, 1.0);
  }

  /** Shared radial alpha falloff, in arena-normalised units. */
  fadeEdgeMaterial(material, inner, outer) {
    material.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace('void main() {', 'varying vec3 vGridPos;\nvoid main() {')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\n  vGridPos = (modelMatrix * vec4(position, 1.0)).xyz;');
      shader.fragmentShader = shader.fragmentShader
        .replace('void main() {', 'varying vec3 vGridPos;\nvoid main() {')
        .replace(
          '#include <opaque_fragment>',
          `  float gd = length(vGridPos.xz / vec2(${ARENA.x.toFixed(1)}, ${ARENA.z.toFixed(1)}));\n  diffuseColor.a *= 1.0 - smoothstep(${inner.toFixed(3)}, ${outer.toFixed(3)}, gd);\n#include <opaque_fragment>`
        );
    };
    material.needsUpdate = true;
    return material;
  }

  buildFloorGrid() {
    const look = LOOKS[this.look];
    this.floorTexture = this.createFloorTexture();
    const groundGeo = new THREE.PlaneGeometry(ARENA.x * 2, ARENA.z * 2);
    const groundMat = new THREE.MeshPhysicalMaterial({
      map: this.floorTexture,
      roughness: 0.62,
      metalness: 0.0,
      clearcoat: 0.18,
      clearcoatRoughness: 0.4,
      transparent: true
    });
    // Dissolve the floor's edge into the backdrop. A hard rectangle edge is the
    // single biggest thing that made this read as a three.js sample.
    this.fadeEdgeMaterial(groundMat, 1.02, 1.38);
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Two grids: a fine 1 m mesh that is barely there, and a 5 m structural one.
    // GridHelper is square, so draw it at the smaller axis and scale X to match
    // the ground exactly — no grid floating past the floor.
    const fine = new THREE.GridHelper(ARENA.z * 2, ARENA.z * 2, look.gridColor, look.gridColor);
    fine.scale.x = ARENA.x / ARENA.z;
    fine.position.y = 0.012;
    fine.material.opacity = look.gridOpacity * 0.45;
    fine.material.transparent = true;
    fine.material.depthWrite = false;
    this.fadeGridMaterial(fine.material);
    fine.raycast = () => {};
    this.scene.add(fine);

    const major = new THREE.GridHelper(ARENA.z * 2, 6, look.gridColor, look.gridColor);
    major.scale.x = ARENA.x / ARENA.z;
    major.position.y = 0.014;
    major.material.opacity = look.gridOpacity;
    major.material.transparent = true;
    major.material.depthWrite = false;
    this.fadeGridMaterial(major.material);
    major.raycast = () => {};
    this.scene.add(major);

    ground.raycast = () => {};
    this.floorObjects = [ground, fine, major];
  }

  /**
   * Selection feedback: a brass ring on the floor plus the asset's bounding box
   * picked out in the same brass. Replaces the old lurid emissive flood, which
   * destroyed the material read of whatever you had just selected.
   */
  buildSelectionIndicator() {
    const ringGeo = new THREE.RingGeometry(0.86, 1, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      color: ACCENT,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    this.selectionRing = new THREE.Mesh(ringGeo, ringMat);
    this.selectionRing.rotation.x = -Math.PI / 2;
    this.selectionRing.position.y = 0.03;
    this.selectionRing.renderOrder = 2;
    this.selectionRing.visible = false;
    this.selectionRing.raycast = () => {};
    this.scene.add(this.selectionRing);

    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    const edges = new THREE.EdgesGeometry(boxGeo);
    boxGeo.dispose();
    this.selectionEdges = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.55, depthWrite: false })
    );
    this.selectionEdges.visible = false;
    this.selectionEdges.renderOrder = 2;
    this.selectionEdges.raycast = () => {};
    this.scene.add(this.selectionEdges);
  }

  /**
   * Fake contact shadow: a soft dark disc laid just above the floor under every
   * asset. The single directional shadow map cannot resolve small contact
   * darkening at this arena size, and without it everything looks like it floats.
   */
  contactShadowTexture() {
    if (this._contactTex) return this._contactTex;
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(64, 64, 2, 64, 64, 62);
    g.addColorStop(0, 'rgba(0,0,0,0.55)');
    g.addColorStop(0.6, 'rgba(0,0,0,0.22)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    this._contactTex = new THREE.CanvasTexture(c);
    SHARED_RESOURCES.add(this._contactTex);
    return this._contactTex;
  }

  addContactShadow(group, halfX, halfZ) {
    const geo = new THREE.PlaneGeometry(halfX * 2.5, halfZ * 2.5);
    const mat = new THREE.MeshBasicMaterial({
      map: this.contactShadowTexture(),
      transparent: true,
      depthWrite: false,
      opacity: 0.85
    });
    const disc = new THREE.Mesh(geo, mat);
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 0.02;
    disc.renderOrder = -1;
    disc.raycast = () => {};
    group.add(disc);
  }

  /** Factory table shared by spawn, duplicate and restore. */
  factoryFor(type) {
    return {
      table: (x, z, name) => this.addTableMesh(x, z, name || 'Banquet Table'),
      stage: (x, z, name) => this.addStageMesh(x, z, name || 'LED Stage'),
      podium: (x, z, name) => this.addPodiumMesh(x, z, name || 'Glass Podium'),
      sound: (x, z, name) => this.addSoundTowerMesh(x, z, name || 'Sound Tower')
    }[type] || null;
  }

  /** Persist the arrangement so a client's layout survives a reload. */
  saveLayout() {
    if (this._restoring) return;
    const layout = this.getLayout();
    writeJSON(LAYOUT_KEY, { v: 1, items: layout.items });
  }

  /**
   * Rebuild a persisted arrangement. Returns false when there is nothing valid
   * stored, so the caller can fall back to the demo layout.
   */
  restoreLayout() {
    const raw = readJSON(LAYOUT_KEY, null);
    const items = raw && Array.isArray(raw.items) ? raw.items : null;
    if (!items || !items.length) return false;

    this._restoring = true;
    let placed = 0;
    try {
      items.forEach(item => {
        const factory = this.factoryFor(item && item.type);
        if (!factory) return;
        const x = Number(item.x);
        const z = Number(item.z);
        const group = factory(
          Number.isFinite(x) ? x : 0,
          Number.isFinite(z) ? z : 0,
          typeof item.name === 'string' ? item.name : undefined
        );
        if (Number.isFinite(item.colorHex)) {
          group.userData.swatchHex = item.colorHex;
          const main = group.userData.mainMesh;
          if (main && main.material && main.material.color) main.material.color.setHex(item.colorHex);
        }
        placed++;
      });
    } finally {
      this._restoring = false;
    }
    return placed > 0;
  }

  /** Discard the saved arrangement and rebuild the reference floor. */
  resetLayout() {
    writeJSON(LAYOUT_KEY, { v: 1, items: [] });
    this.buildReferenceLayout();
    this.selectedMesh = null;
    this.highlightSelectedObject();
    this.updateInspectorUI();
    this.markShadowsDirty();
    this.emitLayoutChange();
  }

  populateInitial3DAssets() {
    this.clearPlacedObjects();
    if (this.restoreLayout()) {
      this.updateStats();
      return;
    }
    this.buildReferenceLayout();
    this.updateStats();
  }

  buildReferenceLayout() {
    this.clearPlacedObjects();

    this.addStageMesh(0, -9, 'Concert LED Stage');
    this.addPodiumMesh(0, -5.5, 'Executive Glass Podium');
    this.addSoundTowerMesh(-8, -9, 'Left Sound Tower');
    this.addSoundTowerMesh(8, -9, 'Right Sound Tower');

    [
      { x: -6, z: 2 }, { x: 0, z: 2 }, { x: 6, z: 2 },
      { x: -6, z: 8 }, { x: 0, z: 8 }, { x: 6, z: 8 }
    ].forEach((pos, idx) => this.addTableMesh(pos.x, pos.z, `Banquet Table #${idx + 1}`));
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
    this.addContactShadow(group, halfX, halfZ);

    const clamped = this.clampToArena(x, z, halfX, halfZ);
    group.position.set(clamped.x, 0, clamped.z);

    this.scene.add(group);
    this.placedObjects.push(group);
    if (LOOKS[this.look].tint !== null) this.applyLookTint();
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
    const factory = this.factoryFor(type);
    if (!factory) return null;

    const labels = {
      table: 'New Banquet Table', stage: 'New LED Stage',
      podium: 'New Glass Podium', sound: 'New Sound Tower'
    };
    const group = factory(0, 0, labels[type]);
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
    // Default is an ivory linen cloth, not the brand accent: a floor of six
    // identical brass discs is what made the old scene read as a toy.
    const topMat = new THREE.MeshPhysicalMaterial({
      color: 0xe7e0d2,
      metalness: 0.0,
      roughness: 0.82,
      sheen: 0.6,
      sheenRoughness: 0.7,
      sheenColor: new THREE.Color(0xfff4e0)
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
      color: 0x1c1f28,
      roughness: 0.45,
      metalness: 0.3,
      clearcoat: 0.6,
      clearcoatRoughness: 0.3
    });
    const platform = new THREE.Mesh(S.stagePlatformGeo, platformMat);
    platform.position.y = 0.4;
    platform.castShadow = true;
    platform.receiveShadow = true;
    group.add(platform);

    const stripMat = new THREE.MeshStandardMaterial({
      color: ACCENT,
      emissive: ACCENT,
      emissiveIntensity: 1.1,
      roughness: 0.4
    });
    stripMat.userData.h3dNoTint = true;
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
    if (this.canvasHolder) this.canvasHolder.addEventListener('keydown', this.onCanvasKeyDown);
  }

  /**
   * Keyboard parity for the mouse-only operations. Without this the floor is a
   * dead zone for anyone not using a pointer.
   */
  onCanvasKeyDown(e) {
    const key = e.key;

    if (key === 'Delete' || key === 'Backspace') {
      if (!this.selectedMesh) return;
      e.preventDefault();
      this.deleteSelectedMesh();
      return;
    }
    if (key === 'Escape') {
      // Only swallow Escape when it has something to do here; otherwise let the
      // host close the editor.
      if (!this.selectedMesh) return;
      e.preventDefault();
      e.stopPropagation();
      this.selectedMesh = null;
      this.highlightSelectedObject();
      this.updateInspectorUI();
      return;
    }
    if (key === 'Enter' || key === ' ' || key === 'Spacebar') {
      e.preventDefault();
      this.cycleSelection(e.shiftKey ? -1 : 1);
      return;
    }

    const nudges = {
      ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1]
    };
    const nudge = nudges[key];
    if (!nudge || !this.selectedMesh) return;
    e.preventDefault();
    const step = e.shiftKey ? GRID_SNAP * 4 : GRID_SNAP;
    const data = this.selectedMesh.userData;
    const clamped = this.clampToArena(
      this.selectedMesh.position.x + nudge[0] * step,
      this.selectedMesh.position.z + nudge[1] * step,
      data.halfX, data.halfZ
    );
    this.selectedMesh.position.x = clamped.x;
    this.selectedMesh.position.z = clamped.z;
    this.syncSelectionIndicator();
    this.updateInspectorPosition();
    this.markShadowsDirty();
    this.emitLayoutChange();
  }

  /** Step the selection through the placed assets (keyboard route to selecting). */
  cycleSelection(dir = 1) {
    if (!this.placedObjects.length) {
      this.selectedMesh = null;
      this.highlightSelectedObject();
      this.updateInspectorUI();
      return;
    }
    const idx = this.placedObjects.indexOf(this.selectedMesh);
    const next = idx === -1
      ? (dir > 0 ? 0 : this.placedObjects.length - 1)
      : (idx + dir + this.placedObjects.length) % this.placedObjects.length;
    this.selectedMesh = this.placedObjects[next];
    this.highlightSelectedObject();
    this.updateInspectorUI();
  }

  unbindThreeEvents() {
    if (this.renderer && this.renderer.domElement) {
      this.renderer.domElement.removeEventListener('pointerdown', this.onPointerDown);
      this.renderer.domElement.removeEventListener('pointermove', this.onPointerMove);
    }
    if (this.canvasHolder) this.canvasHolder.removeEventListener('keydown', this.onCanvasKeyDown);
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
    this.camTween = null;
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
    this.syncSelectionIndicator();
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
    const target = this.selectedMesh;
    const shown = Boolean(target) && this.placedObjects.includes(target);

    if (this.selectionRing) {
      this.selectionRing.visible = shown;
      if (shown) {
        const r = Math.max(target.userData.halfX, target.userData.halfZ) * 1.16;
        this.selectionRing.scale.set(r, r, 1);
        this.selectionRing.position.set(target.position.x, 0.03, target.position.z);
      }
    }

    if (this.selectionEdges) {
      this.selectionEdges.visible = shown;
      if (shown) {
        this._box.setFromObject(target);
        const size = this._box.getSize(new THREE.Vector3());
        const centre = this._box.getCenter(new THREE.Vector3());
        this.selectionEdges.scale.set(
          Math.max(size.x, 0.1) * 1.04,
          Math.max(size.y, 0.1) * 1.04,
          Math.max(size.z, 0.1) * 1.04
        );
        this.selectionEdges.position.copy(centre);
      }
    }
  }

  /** Keep the brass ring under an asset while it is being dragged or nudged. */
  syncSelectionIndicator() {
    this.highlightSelectedObject();
  }

  // ----------------------------------------------------------------- camera

  /**
   * Every preset goes through here, so presets ease rather than cut. The tween
   * is stepped in animate() and cancelled the moment the user grabs the orbit
   * controls, so it can never fight a drag.
   */
  flyCameraTo(pos, target, ms = 620) {
    if (!this.camera || !this.controls) return;
    const reduce = typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;
    const to = { pos: new THREE.Vector3(...pos), target: new THREE.Vector3(...target) };

    if (reduce || ms <= 0) {
      this.camTween = null;
      this.camera.position.copy(to.pos);
      this.controls.target.copy(to.target);
      this.controls.update();
      return;
    }
    this.camTween = {
      fromPos: this.camera.position.clone(),
      fromTarget: this.controls.target.clone(),
      toPos: to.pos,
      toTarget: to.target,
      start: performance.now(),
      ms
    };
  }

  stepCameraTween() {
    const t = this.camTween;
    if (!t) return;
    const raw = Math.min(1, (performance.now() - t.start) / t.ms);
    // easeInOutCubic
    const e = raw < 0.5 ? 4 * raw * raw * raw : 1 - Math.pow(-2 * raw + 2, 3) / 2;
    this.camera.position.lerpVectors(t.fromPos, t.toPos, e);
    this.controls.target.lerpVectors(t.fromTarget, t.toTarget, e);
    if (raw >= 1) this.camTween = null;
  }

  cameraPreset(name) {
    const presets = {
      perspective: [[19, 15.5, 27], [0, 0.9, -1.2]],
      plan: [[0, 38, 0.001], [0, 0, -1]],
      guest: [[0, 3.1, 12.5], [0, 1.7, -7.5]],
      stage: [[0, 5.5, -17], [0, 1.8, 2]]
    };
    const p = presets[name] || presets.perspective;
    this.activeCamPreset = presets[name] ? name : 'perspective';
    this.flyCameraTo(p[0], p[1]);
    this.container.querySelectorAll('[data-cam]').forEach(btn => {
      btn.setAttribute('aria-pressed', String(btn.getAttribute('data-cam') === this.activeCamPreset));
    });
  }

  // ------------------------------------------------------------------- look

  /**
   * Swap between the warm studio render and the pale blueprint read. Original
   * material colours are stashed on first tint so the swap is reversible.
   */
  setLook(name) {
    const look = LOOKS[name];
    if (!look || name === this.look) return;
    this.look = name;
    if (!this.scene) return;

    this.scene.background = new THREE.Color(look.background);
    if (this.scene.fog) this.scene.fog.color.setHex(look.fogColor);
    if (this.renderer) this.renderer.toneMappingExposure = look.exposure;
    if ('environmentIntensity' in this.scene) this.scene.environmentIntensity = look.envIntensity;
    if (this.ambientLight) this.ambientLight.intensity = look.ambient;
    if (this.dirLight) this.dirLight.intensity = look.keyIntensity;
    if (this.pointLight) this.pointLight.intensity = name === 'blueprint' ? 6 : 38;
    if (this.rimLight) this.rimLight.intensity = name === 'blueprint' ? 0.15 : 0.6;

    // Floor + grids are cheap to rebuild and own their textures, so redo them.
    (this.floorObjects || []).forEach(obj => {
      this.scene.remove(obj);
      this.disposeObject(obj);
    });
    if (this.floorTexture) { this.floorTexture.dispose(); this.floorTexture = null; }
    this.buildFloorGrid();

    this.applyLookTint();
    this.markShadowsDirty();
    this.syncLookButtons();
  }

  applyLookTint() {
    const tint = LOOKS[this.look].tint;
    this.placedObjects.forEach(group => {
      group.traverse(child => {
        const mats = Array.isArray(child.material) ? child.material : (child.material ? [child.material] : []);
        mats.forEach(mat => {
          if (!mat.color || mat.userData.h3dNoTint) return;
          if (mat.userData.h3dOrigColor === undefined) mat.userData.h3dOrigColor = mat.color.getHex();
          if (mat.userData.h3dOrigMetal === undefined) mat.userData.h3dOrigMetal = mat.metalness ?? null;
          if (tint === null) {
            mat.color.setHex(mat.userData.h3dOrigColor);
            if (mat.userData.h3dOrigMetal !== null) mat.metalness = mat.userData.h3dOrigMetal;
          } else {
            // Desaturate towards ink rather than replacing outright, so an asset
            // recoloured by the client is still distinguishable in blueprint.
            mat.color.setHex(mat.userData.h3dOrigColor).lerp(new THREE.Color(tint), 0.72);
            if (mat.userData.h3dOrigMetal !== null) mat.metalness = Math.min(mat.userData.h3dOrigMetal, 0.15);
          }
        });
      });
    });
  }

  syncLookButtons() {
    this.container.querySelectorAll('[data-look]').forEach(btn => {
      btn.setAttribute('aria-pressed', String(btn.getAttribute('data-look') === this.look));
    });
  }

  applySwatchToSelected(swatch) {
    if (!this.selectedMesh) return;
    // Swatch is per-selection now; it no longer hijacks every future spawn.
    this.selectedMesh.userData.swatchHex = swatch.hex;
    const main = this.selectedMesh.userData.mainMesh;
    if (main && main.material && main.material.color) {
      main.material.color.setHex(swatch.hex);
      // Keep the blueprint tint reversible: the swatch is the new "original".
      main.material.userData.h3dOrigColor = swatch.hex;
      if (LOOKS[this.look].tint !== null) this.applyLookTint();
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

    const factory = this.factoryFor(type);
    if (!factory) return;

    const clone = factory(0, 0, `${src.userData.name} (copy)`);
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
          // Shared textures (e.g. the contact-shadow disc) are reused by every
          // asset — disposing one on delete would blank them all.
          if (tex && !SHARED_RESOURCES.has(tex) && !seen.has(tex)) { seen.add(tex); tex.dispose(); }
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
    this.saveLayout();
    if (typeof this.onLayoutChange === 'function') {
      try { this.onLayoutChange(this.getLayout()); } catch { /* host handler failed; keep the editor alive */ }
    }
  }

  updateStats() {
    const layout = this.getLayout();
    const set = (sel, value) => {
      const el = this.container.querySelector(sel);
      if (el) el.textContent = value;
    };
    set('[data-stat="count"]', String(layout.items.length));
    set('[data-stat="seats"]', String(layout.seats));
    set('[data-stat="cost"]', formatMoney(layout.totalCost));
  }

  updateInspectorPosition() {
    const el = this.container.querySelector('[data-insp="pos"]');
    if (el && this.selectedMesh) {
      el.textContent = `X ${this.selectedMesh.position.x.toFixed(1)} · Z ${this.selectedMesh.position.z.toFixed(1)} · snapped to ${GRID_SNAP} m`;
    }
  }

  updateInspectorUI() {
    const box = this.container.querySelector('#h3dInspector');
    if (!box) return;

    if (!this.selectedMesh) {
      box.innerHTML = this.placedObjects.length
        ? `<p class="h3d-empty">Nothing selected. Click an asset on the floor — or focus the plan and press <kbd>Enter</kbd> — to recolour, duplicate, move or remove it.</p>`
        : `<p class="h3d-empty">The floor is empty. Place an asset above, or restore the reference layout.</p>`;
      return;
    }

    const data = this.selectedMesh.userData;
    const activeHex = data.swatchHex;
    box.innerHTML = `
      <div class="h3d-card">
        <div class="h3d-card-head">
          <h5>${escapeHtml(data.name)}</h5>
          <span class="h3d-badge">${escapeHtml(String(data.type))}</span>
        </div>
        <p class="h3d-meta" data-insp="pos">X ${this.selectedMesh.position.x.toFixed(1)} · Z ${this.selectedMesh.position.z.toFixed(1)} · snapped to ${GRID_SNAP} m</p>
        <p class="h3d-meta">Indicative rental <strong>${formatMoney(data.cost)}</strong></p>

        <div class="h3d-swatches" role="group" aria-label="Finish colour">
          ${this.swatches.map(sw => `
            <button type="button" class="h3d-swatch" style="background-color:${sw.text}" data-hex="${sw.hex}"
                    title="${escapeHtml(sw.name)}" aria-label="Apply ${escapeHtml(sw.name)}"
                    aria-pressed="${activeHex === sw.hex}"></button>
          `).join('')}
        </div>

        <div class="h3d-row">
          <button type="button" class="h3d-btn" data-act="duplicate">Duplicate</button>
          <button type="button" class="h3d-btn h3d-btn--danger" data-act="delete">Remove</button>
        </div>
      </div>
    `;

    box.querySelectorAll('.h3d-swatch').forEach(btn => {
      btn.addEventListener('click', () => {
        const hexVal = Number(btn.getAttribute('data-hex'));
        const found = this.swatches.find(sw => sw.hex === hexVal);
        if (found) this.applySwatchToSelected(found);
      });
    });
    const dup = box.querySelector('[data-act="duplicate"]');
    if (dup) dup.addEventListener('click', () => this.duplicateSelectedMesh());
    const del = box.querySelector('[data-act="delete"]');
    if (del) del.addEventListener('click', () => this.deleteSelectedMesh());
  }

  // ------------------------------------------------------------- loop / life

  animate() {
    if (!this.animating) return;
    this.rafHandle = requestAnimationFrame(this.animate);

    this.stepCameraTween();
    if (this.controls) this.controls.update();
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  /**
   * Mount as an ordinary studio view inside a container the shell sizes.
   *
   * This is the entry point. There is no overlay, no backdrop, no fixed
   * positioning and no z-index unless `{ modal: true }` is passed, which exists
   * only as a shim for callers that have not been converted yet.
   */
  mount(container = this.container, opts = {}) {
    if (this.isMounted) return this;
    if (container) this.container = container;
    if (!this.container) return this;

    injectStudio3DStyles();
    if (opts.modal !== undefined) this.options.modal = Boolean(opts.modal);
    if (opts.mode) this.mode = opts.mode === 'edit' ? 'edit' : 'view';
    if (opts.look && LOOKS[opts.look]) this.look = opts.look;

    this.render();
    this.initThreeScene();
    this.cameraPreset('perspective');
    this.camTween = null;   // land on the default framing immediately, do not fly in
    this.syncLookButtons();
    this.updateStats();
    this.updateInspectorUI();
    this.isMounted = true;
    return this;
  }

  /**
   * Tear down completely: rAF loop, resize observer, listeners, GPU resources
   * and the WebGL context itself. Must leave nothing behind — mount/unmount is
   * expected to cycle many times as the shell switches studio tabs.
   */
  unmount() {
    if (!this.isMounted && !this.renderer) {
      if (this.container) this.container.innerHTML = '';
      return;
    }

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

    if (this._contactTex) {
      SHARED_RESOURCES.delete(this._contactTex);
      this._contactTex.dispose();
      this._contactTex = null;
    }
    if (this.floorTexture) { this.floorTexture.dispose(); this.floorTexture = null; }
    if (this.envTexture) { this.envTexture.dispose(); this.envTexture = null; }
    if (this.pmrem) { this.pmrem.dispose(); this.pmrem = null; }

    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.forceContextLoss();
      this.renderer.domElement = null;
      this.renderer = null;
    }

    if (this._scrim && this._scrim.parentNode) this._scrim.parentNode.removeChild(this._scrim);
    this._scrim = null;

    this.placedObjects = [];
    this.floorObjects = [];
    this.selectionRing = null;
    this.selectionEdges = null;
    this.selectedMesh = null;
    this.pendingDrag = null;
    this.isDragging = false;
    this.camTween = null;
    this.scene = null;
    this.camera = null;
    this.dirLight = null;
    this.pointLight = null;
    this.rimLight = null;
    this.ambientLight = null;
    this.canvasHolder = null;
    this._rootEl = null;
    this.isMounted = false;
    if (this.container) this.container.innerHTML = '';
  }

  /**
   * Switch between the cinematic view and the docked edit panel. The panel is a
   * grid column, so entering edit mode SHRINKS the canvas — it never covers it.
   */
  setMode(mode) {
    const next = mode === 'edit' ? 'edit' : 'view';
    this.mode = next;
    if (this._rootEl) this._rootEl.setAttribute('data-mode', next);

    const toggle = this.container.querySelector('#h3dModeToggle');
    if (toggle) {
      toggle.textContent = next === 'edit' ? 'Done' : 'Edit';
      toggle.className = next === 'edit' ? 'h3d-btn' : 'h3d-btn h3d-btn--primary';
      toggle.setAttribute('aria-expanded', String(next === 'edit'));
    }

    if (next === 'view') {
      this.selectedMesh = null;
      this.highlightSelectedObject();
      this.updateInspectorUI();
    }
    // The canvas has just changed width; correct the aspect on the next frame
    // as well as now, so it is right both during and after the CSS transition.
    this.handleResize();
    requestAnimationFrame(() => this.handleResize());
    setTimeout(() => this.handleResize(), 300);
    return this.mode;
  }

  // ------------------------------------------- legacy modal entry points

  /** @deprecated Use mount(). Kept so unconverted callers still work. */
  open() {
    if (this.isMounted) return;
    this.mount(this.container, { modal: true });
  }

  /** @deprecated Use unmount(). */
  close() {
    this.unmount();
  }

  // ------------------------------------------------------------------- view

  bindEvents() {
    const on = (sel, fn, evt = 'click') => {
      const el = this.container.querySelector(sel);
      if (el) el.addEventListener(evt, fn);
      return el;
    };

    this.container.querySelectorAll('[data-spawn]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (this.mode !== 'edit') this.setMode('edit');
        this.spawnAsset(btn.getAttribute('data-spawn'));
      });
    });

    this.container.querySelectorAll('[data-cam]').forEach(btn => {
      btn.addEventListener('click', () => this.cameraPreset(btn.getAttribute('data-cam')));
    });

    this.container.querySelectorAll('[data-look]').forEach(btn => {
      btn.addEventListener('click', () => this.setLook(btn.getAttribute('data-look')));
    });

    on('#h3dModeToggle', () => this.setMode(this.mode === 'edit' ? 'view' : 'edit'));
    on('[data-act="cycle"]', () => {
      this.cycleSelection(1);
      if (this.canvasHolder) this.canvasHolder.focus();
    });
    on('[data-act="reset"]', () => this.resetLayout());
    on('#h3dClose', () => this.unmount());
  }

  render() {
    injectStudio3DStyles();
    const modal = Boolean(this.options.modal);

    if (modal && !this._scrim) {
      this._scrim = document.createElement('div');
      this._scrim.className = 'h3d-scrim';
      this._scrim.addEventListener('click', () => this.unmount());
      document.body.appendChild(this._scrim);
    }

    const assets = [
      ['table', 'Banquet table & chairs', ASSET_SPEC.table.cost],
      ['stage', 'LED stage & banner', ASSET_SPEC.stage.cost],
      ['podium', 'Glass podium', ASSET_SPEC.podium.cost],
      ['sound', 'Line array tower', ASSET_SPEC.sound.cost]
    ];

    this.container.innerHTML = `
      <div class="h3d-root${modal ? ' h3d-root--modal' : ''}" data-mode="${this.mode}"
           role="${modal ? 'dialog' : 'region'}" ${modal ? 'aria-modal="true"' : ''} aria-label="3D floor plan">
        <div class="h3d-bar">
          <div>
            <p class="h3d-title">Floor plan</p>
            <p class="h3d-sub">Massing model — layout and seat count, not finishes</p>
          </div>
          <span class="h3d-bar-spacer"></span>
          <div class="h3d-stats" title="Indicative rental value of the assets on the floor. Not added to the venue quote.">
            <span><b data-stat="count">0</b> assets</span>
            <span><b data-stat="seats">0</b> seats</span>
            <span class="h3d-cost" data-stat="cost">${formatMoney(0)}</span>
          </div>
          <button type="button" class="h3d-btn h3d-btn--primary" id="h3dModeToggle"
                  aria-expanded="false" aria-controls="h3dPanel">Edit</button>
          ${modal ? '<button type="button" class="h3d-btn" id="h3dClose" aria-label="Close 3D floor plan">Close</button>' : ''}
        </div>

        <div class="h3d-stage">
          <div class="h3d-canvas" tabindex="0" role="application"
               aria-label="3D floor plan. Enter selects the next asset, arrow keys move it on the half-metre grid, Delete removes it."></div>
          <p class="h3d-hint">Drag the floor to orbit, scroll to zoom, drag an asset to move it.
             <kbd>Enter</kbd> cycles selection, <kbd>↑↓←→</kbd> nudge, <kbd>Delete</kbd> removes.</p>
        </div>

        <aside class="h3d-panel" id="h3dPanel" aria-label="Floor plan editor">
          <div class="h3d-group">
            <h4>Place</h4>
            <div class="h3d-list">
              ${assets.map(([type, label, cost]) => `
                <button type="button" class="h3d-btn h3d-asset" data-spawn="${type}">
                  <span>${escapeHtml(label)}</span>
                  <span class="h3d-price">${formatMoney(cost)}</span>
                </button>
              `).join('')}
            </div>
          </div>

          <div class="h3d-group">
            <h4>Selection</h4>
            <div id="h3dInspector"></div>
            <div class="h3d-row">
              <button type="button" class="h3d-btn" data-act="cycle">Select next</button>
              <button type="button" class="h3d-btn" data-act="reset">Reset floor</button>
            </div>
          </div>

          <div class="h3d-group">
            <h4>Camera</h4>
            <div class="h3d-row">
              <button type="button" class="h3d-btn" data-cam="perspective" aria-pressed="true">Perspective</button>
              <button type="button" class="h3d-btn" data-cam="plan" aria-pressed="false">Plan</button>
              <button type="button" class="h3d-btn" data-cam="guest" aria-pressed="false">Guest eye</button>
              <button type="button" class="h3d-btn" data-cam="stage" aria-pressed="false">From stage</button>
            </div>
          </div>

          <div class="h3d-group">
            <h4>Render</h4>
            <div class="h3d-row">
              <button type="button" class="h3d-btn" data-look="studio" aria-pressed="true">Studio</button>
              <button type="button" class="h3d-btn" data-look="blueprint" aria-pressed="false">Blueprint</button>
            </div>
            <p class="h3d-note">The rental figure is indicative and is not added to the venue quote — the zone catalogue already prices tables, chairs and staging.</p>
          </div>
        </aside>
      </div>
    `;

    this._rootEl = this.container.querySelector('.h3d-root');
    this.bindEvents();
  }
}
