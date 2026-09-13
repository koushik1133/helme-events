/**
 * EquirectViewer — a small three.js equirectangular panorama viewer.
 *
 * WHY THIS REPLACED PANNELLUM
 * ---------------------------
 * Pannellum 2.5 has no `setPanorama()`. Changing the picture means
 * `destroy()` + reconstruct + a full texture upload, which is a visible flash
 * on every decor swap and forces pitch/yaw/hfov to be saved and restored by
 * hand. It also owns its own canvas, so nothing else can draw into the
 * panorama — which is exactly what live decor compositing needs to do.
 *
 * Here the sphere is textured from a CANVAS we own. A swap is
 * `texture.needsUpdate = true`. No reload, no flash, no CDN.
 *
 * Deliberately the same surface Pannellum exposed (getYaw/setYaw/…,
 * startAutoRotate, on('load'|'error'), destroy) so Viewer360 — and therefore
 * main.js — did not have to change shape.
 *
 * Conventions match panoProjection.js: yaw 0 straight ahead and +ve to the
 * right, pitch 0 at the horizon and +ve up, both in degrees.
 */

const DEG = Math.PI / 180;

export class EquirectViewer {
  /**
   * @param {HTMLElement} container
   * @param {*} THREE  the three.js module namespace (imported by the caller so
   *                   the 3D bundle stays lazy)
   * @param {object} opts
   */
  constructor(container, THREE, opts = {}) {
    this.container = container;
    this.THREE = THREE;
    this.destroyed = false;

    this._yaw = opts.yaw ?? 0;
    this._pitch = opts.pitch ?? 0;
    this._hfov = opts.hfov ?? 100;
    this.minHfov = opts.minHfov ?? 50;
    this.maxHfov = opts.maxHfov ?? 130;
    this.minPitch = opts.minPitch ?? -85;
    this.maxPitch = opts.maxPitch ?? 85;
    this._autoRotateSpeed = 0;
    this._listeners = { load: [], error: [] };
    this._anim = null;                 // in-flight setYaw/setPitch tween
    this._raf = null;
    this._last = performance.now();

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.canvas = this.renderer.domElement;
    this.canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;cursor:grab;';
    this.canvas.setAttribute('role', 'application');
    this.canvas.setAttribute('tabindex', '0');
    this.canvas.setAttribute('aria-label',
      opts.label || '360 degree venue view. Drag or use the arrow keys to look around, plus and minus to zoom.');
    container.appendChild(this.canvas);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1100);

    const geo = new THREE.SphereGeometry(500, 64, 40);
    geo.scale(-1, 1, 1);               // view it from the inside
    this.material = new THREE.MeshBasicMaterial({ map: null });
    this.mesh = new THREE.Mesh(geo, this.material);
    this.scene.add(this.mesh);

    this._bindInput();
    this._resize();
    this._ro = typeof ResizeObserver === 'function'
      ? new ResizeObserver(() => this._resize()) : null;
    this._ro?.observe(container);
    this._onWinResize = () => this._resize();
    window.addEventListener('resize', this._onWinResize);

    this._loop();
  }

  on(event, fn) { (this._listeners[event] ||= []).push(fn); return this; }
  _emit(event, arg) { (this._listeners[event] || []).forEach(f => { try { f(arg); } catch (e) {} }); }

  /**
   * Texture the sphere from a canvas the caller keeps drawing into.
   * Call `markTextureDirty()` after every redraw — that is the whole swap.
   */
  setSourceCanvas(canvasEl) {
    const T = this.THREE;
    if (this.texture) this.texture.dispose();
    this.texture = new T.CanvasTexture(canvasEl);
    this.texture.colorSpace = T.SRGBColorSpace;
    this.texture.minFilter = T.LinearFilter;
    this.texture.magFilter = T.LinearFilter;
    this.texture.generateMipmaps = false;
    this.texture.wrapS = T.RepeatWrapping;
    this.material.map = this.texture;
    this.material.needsUpdate = true;
    this._emit('load');
  }

  markTextureDirty() { if (this.texture) this.texture.needsUpdate = true; }

  // ---- Pannellum-compatible camera surface -------------------------------
  getYaw()   { return this._yaw; }
  getPitch() { return this._pitch; }
  getHfov()  { return this._hfov; }

  setYaw(v, ms = 0)   { return this._set('_yaw', v, ms); }
  setPitch(v, ms = 0) { return this._set('_pitch', this._clampPitch(v), ms); }
  setHfov(v, ms = 0)  { return this._set('_hfov', this._clampHfov(v), ms); }

  _clampPitch(v) { return Math.max(this.minPitch, Math.min(this.maxPitch, v)); }
  _clampHfov(v)  { return Math.max(this.minHfov, Math.min(this.maxHfov, v)); }

  _set(prop, target, ms) {
    if (!ms) { this[prop] = target; return target; }
    const from = this[prop], t0 = performance.now();
    // One tween per property, so a second call simply replaces the first.
    (this._tweens ||= {})[prop] = { from, to: target, t0, ms };
    return target;
  }

  startAutoRotate(speed = -2) { this._autoRotateSpeed = speed; }
  stopAutoRotate() { this._autoRotateSpeed = 0; }

  // ---- Input --------------------------------------------------------------
  _bindInput() {
    const el = this.canvas;
    let dragging = false, lastX = 0, lastY = 0, moved = 0;

    const down = e => {
      if (e.button != null && e.button !== 0) return;
      dragging = true; moved = 0;
      lastX = e.clientX; lastY = e.clientY;
      el.style.cursor = 'grabbing';
      el.setPointerCapture?.(e.pointerId);
    };
    const move = e => {
      if (!dragging) return;
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      moved += Math.abs(dx) + Math.abs(dy);
      // Degrees per pixel straight from the current zoom, so dragging always
      // moves the scenery under the cursor at 1:1 regardless of hfov.
      const perPx = this._hfov / (el.clientWidth || 1);
      this._yaw -= dx * perPx;
      this._pitch = this._clampPitch(this._pitch + dy * perPx);
      this._autoRotateSpeed = 0;
      this._tweens = null;
    };
    const up = e => {
      dragging = false;
      el.style.cursor = 'grab';
      el.releasePointerCapture?.(e.pointerId);
    };

    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', up);

    // Pinch zoom. Pointer events give us the two contacts; track them directly.
    const pts = new Map();
    let pinchStart = 0, pinchHfov = 0;
    el.addEventListener('pointerdown', e => { if (e.pointerType === 'touch') pts.set(e.pointerId, e); });
    el.addEventListener('pointermove', e => {
      if (e.pointerType !== 'touch' || !pts.has(e.pointerId)) return;
      pts.set(e.pointerId, e);
      if (pts.size !== 2) return;
      dragging = false;
      const [a, b] = [...pts.values()];
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      if (!pinchStart) { pinchStart = dist; pinchHfov = this._hfov; return; }
      this.setHfov(pinchHfov * (pinchStart / Math.max(1, dist)));
    });
    const clearTouch = e => { pts.delete(e.pointerId); if (pts.size < 2) pinchStart = 0; };
    el.addEventListener('pointerup', clearTouch);
    el.addEventListener('pointercancel', clearTouch);

    this._onWheel = e => {
      e.preventDefault();
      this.setHfov(this._hfov + Math.sign(e.deltaY) * Math.max(2, this._hfov * 0.06));
      this._autoRotateSpeed = 0;
    };
    el.addEventListener('wheel', this._onWheel, { passive: false });

    // Keyboard parity, so the view is reachable without a pointer.
    el.addEventListener('keydown', e => {
      const step = this._hfov / 12;
      const map = {
        ArrowLeft:  () => { this._yaw -= step; },
        ArrowRight: () => { this._yaw += step; },
        ArrowUp:    () => { this._pitch = this._clampPitch(this._pitch + step); },
        ArrowDown:  () => { this._pitch = this._clampPitch(this._pitch - step); },
        '+':        () => this.setHfov(this._hfov - 6),
        '=':        () => this.setHfov(this._hfov - 6),
        '-':        () => this.setHfov(this._hfov + 6)
      };
      if (map[e.key]) { e.preventDefault(); this._autoRotateSpeed = 0; this._tweens = null; map[e.key](); }
    });
  }

  _resize() {
    if (this.destroyed) return;
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this._applyFov();
  }

  /** hfov is the horizontal field; three.js wants the vertical one. */
  _applyFov() {
    const a = this.camera.aspect || 1;
    const vfov = 2 * Math.atan(Math.tan((this._hfov * DEG) / 2) / a) / DEG;
    this.camera.fov = Math.max(1, Math.min(179, vfov));
    this.camera.updateProjectionMatrix();
  }

  _loop() {
    if (this.destroyed) return;
    const now = performance.now();
    const dt = Math.min(0.1, (now - this._last) / 1000);
    this._last = now;

    if (this._tweens) {
      let live = false;
      for (const k of Object.keys(this._tweens)) {
        const t = this._tweens[k];
        const p = Math.min(1, (now - t.t0) / t.ms);
        const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
        this[k] = t.from + (t.to - t.from) * e;
        if (p < 1) live = true;
      }
      if (!live) this._tweens = null;
    }
    if (this._autoRotateSpeed) this._yaw += this._autoRotateSpeed * dt * -1;

    this._applyFov();
    // Camera looks down −Z at yaw 0; yaw rotates about +Y, pitch about the
    // camera's own X. Matches direction() in panoProjection.js exactly.
    this.camera.rotation.set(0, 0, 0);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = -this._yaw * DEG;
    this.camera.rotation.x = this._pitch * DEG;

    try { this.renderer.render(this.scene, this.camera); }
    catch (e) { this._emit('error', e?.message || 'WebGL render failed'); this.destroy(); return; }

    this._raf = requestAnimationFrame(() => this._loop());
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this._raf) cancelAnimationFrame(this._raf);
    this._ro?.disconnect();
    window.removeEventListener('resize', this._onWinResize);
    this.canvas.removeEventListener('wheel', this._onWheel);
    this.texture?.dispose();
    this.material?.dispose();
    this.mesh?.geometry?.dispose();
    try { this.renderer.dispose(); this.renderer.forceContextLoss(); } catch (e) {}
    if (this.canvas.parentNode) this.canvas.parentNode.removeChild(this.canvas);
  }
}
