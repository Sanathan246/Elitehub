// The 3D preview studio. Framework-free: mount it into any element.
//
//   const studio = new Studio(document.querySelector('#stage'));
//   await studio.loadTemplate('tee');
//   await studio.addLayer({ type: 'image', src: dataUrl, name: 'logo.png' });
//
// Events (studio.addEventListener):
//   'model'  – a model finished loading         detail: { model }
//   'layers' – layers added/removed/changed     detail: { layers }
//   'select' – selected layer changed            detail: { id }
//   'view'   – camera moved to a named view      detail: { view }

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { DecalGeometry } from 'three/addons/geometries/DecalGeometry.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { buildTemplate, loadModelFile, defaultAppearance, defaultParams } from './models.js';
import { backdropTexture, renderTextCanvas, contactShadowTexture } from './textures.js';

export const BACKDROPS = [
  { id: 'studio', label: 'Studio dark', inner: '#3b3c3e', outer: '#0f1011' },
  { id: 'midnight', label: 'Midnight', inner: '#2a2233', outer: '#070609' },
  { id: 'light', label: 'Studio light', inner: '#ffffff', outer: '#c6c8cb' },
  { id: 'stone', label: 'Stone', inner: '#d8d4cc', outer: '#8d8982' },
  { id: 'transparent', label: 'Transparent' },
];
export const LIGHTING = [
  { id: 'soft', label: 'Soft studio' },
  { id: 'contrast', label: 'High contrast' },
  { id: 'flat', label: 'Even' },
];
export const VIEWS = [
  { id: 'front', label: 'Front', dir: [0, 0.07, 1] },
  { id: 'back', label: 'Back', dir: [0, 0.07, -1] },
  { id: 'left', label: 'Left', dir: [-1, 0.07, 0] },
  { id: 'right', label: 'Right', dir: [1, 0.07, 0] },
  { id: 'angle', label: '3/4', dir: [0.62, 0.2, 0.86] },
];

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const lid = () => `ly_${Math.random().toString(36).slice(2, 9)}`;
const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const arr = (v) => [+v.x.toFixed(6), +v.y.toFixed(6), +v.z.toFixed(6)];

export class Studio extends EventTarget {
  constructor(container) {
    super();
    this.container = container;
    this.handle = null;
    this.model = null;          // { kind: 'template'|'upload', template, params, fileName }
    this.fileBlob = null;
    this.sourceGroupTransform = null;
    this.appearance = {};
    this.layers = [];
    this.selectedId = null;
    this.editing = false;       // true while the Design tab is open: enables drag-to-move
    this.settings = { backdrop: 'studio', lighting: 'soft', floor: false, turntable: false, speed: 1 };
    this.scale = 1;
    this.bounds = new THREE.Box3(new THREE.Vector3(-0.5, -0.5, -0.5), new THREE.Vector3(0.5, 0.5, 0.5));
    this._tween = null;

    const r = (this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }));
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 0.92;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.setClearColor(0x000000, 0);
    r.domElement.style.touchAction = 'none';
    r.domElement.setAttribute('aria-label', '3D preview. Drag to rotate, scroll or pinch to zoom.');
    r.domElement.setAttribute('role', 'img');
    container.appendChild(r.domElement);
    // Shown over the live canvas while an export renders at another size, so the stage never flickers.
    this._freeze = document.createElement('canvas');
    this._freeze.className = 'studio-freeze';
    Object.assign(this._freeze.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', zIndex: 2, display: 'none', pointerEvents: 'none' });
    container.appendChild(this._freeze);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(28, 1, 0.01, 50);
    this.camera.position.set(0.8, 0.3, 2.4);

    const pmrem = new THREE.PMREMGenerator(r);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(r), 0.04).texture;
    pmrem.dispose();
    this.envIntensity = 1;

    this.key = new THREE.DirectionalLight('#ffffff', 1.6);
    this.key.position.set(2.2, 3.1, 2.6);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(2048, 2048);
    Object.assign(this.key.shadow.camera, { left: -1, right: 1, top: 1, bottom: -1, near: 0.5, far: 8 });
    this.key.shadow.bias = -0.0003;
    this.key.shadow.normalBias = 0.012;
    this.key.shadow.radius = 4;
    this.rim = new THREE.DirectionalLight('#e2e8ff', 0.8);
    this.rim.position.set(-2.6, 1.6, -2.4);
    this.hemi = new THREE.HemisphereLight('#ffffff', '#3a3a3a', 0.25);
    // Key and rim ride with the camera, like a turntable rig: every side of the
    // product gets the same studio light when people orbit around it.
    this.key.target.position.set(0, 0, -3);
    this.rim.target.position.set(0, 0, -3);
    this.camera.add(this.key, this.key.target, this.rim, this.rim.target);
    this.scene.add(this.camera, this.hemi);

    // Soft contact shadow under the product (a cast shadow from a side light
    // would slide around as the camera-mounted key light moves).
    this.floor = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: contactShadowTexture(), transparent: true, depthWrite: false, opacity: 0.6, toneMapped: false }),
    );
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.renderOrder = -1;
    this.floor.visible = false;
    this.scene.add(this.floor);

    this.spin = new THREE.Group();     // turntable rotation lives here
    this.scene.add(this.spin);

    this.controls = new OrbitControls(this.camera, r.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 0.6;
    this.controls.maxDistance = 6;
    this.controls.screenSpacePanning = true;
    this.controls.addEventListener('start', () => { this._tween = null; });

    this.raycaster = new THREE.Raycaster();
    this._helper = new THREE.Object3D();
    this._selection = this._makeSelectionFrame();

    this._backdropTex = null;
    this.setScene(this.settings);

    this._bindPointer();
    this._ro = new ResizeObserver(() => this.resize());
    this._ro.observe(container);
    this.resize();
    this._clock = new THREE.Clock();
    this._loop = this._loop.bind(this);
    r.setAnimationLoop(this._loop);
  }

  /* ------------------------------------------------------------ */
  /* Models                                                        */
  /* ------------------------------------------------------------ */
  async loadTemplate(kind, params = {}, appearance = null) {
    const h = await buildTemplate(kind, { ...defaultParams(kind), ...params });
    this.fileBlob = null;
    this._setHandle(h, { kind: 'template', template: kind, params: { ...defaultParams(kind), ...params } });
    this.setAppearance(appearance || defaultAppearance(kind));
    this.setScene({ floor: !['tee', 'longsleeve', 'tank', 'crewneck', 'hoodie'].includes(kind) });
    return h;
  }

  async loadFile(blob, fileName, appearance = null) {
    const h = await loadModelFile(blob, fileName, { maxAnisotropy: this.renderer.capabilities.getMaxAnisotropy() });
    this.fileBlob = blob;
    this._setHandle(h, { kind: 'upload', fileName, stats: h.stats });
    this.setAppearance(appearance || defaultAppearance('upload'));
    this.setScene({ floor: true });
    return h;
  }

  _setHandle(h, info) {
    for (const l of this.layers) this._removeDecal(l);
    if (this.handle) {
      this.spin.remove(this.handle.group);
      this.handle.dispose();
    }
    this.spin.rotation.y = 0;
    this.handle = h;
    this.sourceGroupTransform = {
      position: h.group.position.clone(),
      quaternion: h.group.quaternion.clone(),
      scale: h.group.scale.clone(),
    };
    this.model = info;
    this.spin.add(h.group);
    this._normalize();
    // Layers survive a model swap: put each back on a matching print position.
    for (const l of this.layers) this._placeAtPreset(l, l.presetId, true);
    this._rebuildAllDecals();
    this._applyEnv();
    this.setView('angle', { animate: false });
    this.dispatchEvent(new CustomEvent('model', { detail: { model: info } }));
  }

  _normalize() {
    const g = this.handle.group;
    g.position.set(0, 0, 0);
    g.scale.setScalar(1);
    g.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(g);
    const size = box.getSize(new THREE.Vector3());
    const c = box.getCenter(new THREE.Vector3());
    const s = 1 / Math.max(size.x, size.y, size.z, 1e-6);
    g.scale.setScalar(s);
    g.position.copy(c).multiplyScalar(-s);
    g.updateMatrixWorld(true);
    this.scale = s;
    this.bounds = new THREE.Box3().setFromObject(g);
    this.floor.position.y = this.bounds.min.y - 0.001;
    const fs = this.bounds.getSize(new THREE.Vector3());
    const r = Math.max(fs.x, fs.z) * 1.5 + 0.12;
    this.floor.scale.set(r, r, 1);
  }

  /** Box/can options (dimensions, size, lid open). */
  setParams(next) {
    if (!this.handle?.setParams) return;
    const geometryChange = Object.keys(next).some((k) => k !== 'open');
    this.handle.setParams(next);
    this.model.params = { ...this.model.params, ...next };
    if (geometryChange) {
      const camDir = this.camera.position.clone().sub(this.controls.target);
      this._normalize();
      this._rebuildAllDecals();
      this._applyEnv();
      this.setAppearance(this.appearance);
      const d = this._fitDistance();
      this.controls.target.copy(this.bounds.getCenter(new THREE.Vector3()));
      this.camera.position.copy(this.controls.target).add(camDir.setLength(d));
    }
    this.dispatchEvent(new CustomEvent('model', { detail: { model: this.model, paramsOnly: true } }));
  }

  setAppearance(app) {
    this.appearance = { ...app };
    this.handle?.applyAppearance(this.appearance);
    for (const l of this.layers) if (l._mat) Object.assign(l._mat, this._printProps());
    this._applyEnv();
  }

  /* ------------------------------------------------------------ */
  /* Scene: backdrop, light, floor, turntable                       */
  /* ------------------------------------------------------------ */
  setScene(patch) {
    Object.assign(this.settings, patch);
    const s = this.settings;
    const b = BACKDROPS.find((x) => x.id === s.backdrop);
    const custom = !b && /^#/.test(s.backdrop);
    if (s.backdrop === 'transparent') {
      this.scene.background = null;
    } else {
      const inner = custom ? new THREE.Color(s.backdrop).offsetHSL(0, 0, 0.08).getStyle() : b.inner;
      const outer = custom ? new THREE.Color(s.backdrop).offsetHSL(0, 0, -0.12).getStyle() : b.outer;
      this._backdropTex = backdropTexture(inner, outer, this._backdropTex);
      this.scene.background = this._backdropTex;
    }
    this.container.dataset.backdrop = s.backdrop === 'transparent' ? 'transparent' : 'solid';

    const L = {
      // key positions are camera-relative (x right, y up, z towards the viewer)
      soft: { env: 0.42, key: 2.3, rim: 1.2, hemi: 0.08, kp: [2.4, 1.7, 0.1], rp: [-2.2, 0.8, -3.6] },
      contrast: { env: 0.16, key: 3.6, rim: 2.6, hemi: 0.02, kp: [2.6, 1.0, -0.4], rp: [-2.4, 0.6, -3.6] },
      flat: { env: 0.95, key: 0.8, rim: 0.4, hemi: 0.3, kp: [0.6, 1.6, 0.8], rp: [-1.5, 1, -3.6] },
    }[s.lighting] || {};
    this.envIntensity = L.env;
    this.key.intensity = L.key;
    this.key.position.set(...L.kp);
    this.rim.position.set(...L.rp);
    this.rim.intensity = L.rim;
    this.hemi.intensity = L.hemi;
    this.floor.visible = !!s.floor;
    this.floor.material.opacity = ['studio', 'midnight', 'cobalt'].includes(s.backdrop) ? 0.85 : 0.5;
    this._applyEnv();
  }

  _applyEnv() {
    this.spin.traverse((o) => {
      if (!o.isMesh) return;
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      ms.forEach((m) => { if ('envMapIntensity' in m) m.envMapIntensity = this.envIntensity; });
    });
  }

  /* ------------------------------------------------------------ */
  /* Camera                                                        */
  /* ------------------------------------------------------------ */
  resize() {
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  _fitDistance(aspect = this.camera.aspect) {
    const size = this.bounds.getSize(new THREE.Vector3());
    const vf = THREE.MathUtils.degToRad(this.camera.fov);
    const hf = 2 * Math.atan(Math.tan(vf / 2) * aspect);
    const horiz = Math.max(size.x, size.z);
    const d = Math.max((size.y / 2) / Math.tan(vf / 2), (horiz / 2) / Math.tan(hf / 2));
    return d * 1.3 + Math.max(size.x, size.z) / 2;
  }

  setView(id, { animate = true } = {}) {
    const v = VIEWS.find((x) => x.id === id) || VIEWS[4];
    const target = this.bounds.getCenter(new THREE.Vector3());
    const pos = target.clone().add(v3(v.dir).normalize().multiplyScalar(this._fitDistance()));
    if (id !== 'angle') this.spin.rotation.y = 0;
    if (!animate || reducedMotion()) {
      this.controls.target.copy(target);
      this.camera.position.copy(pos);
      this.controls.update();
    } else {
      this._tween = { t: 0, dur: 0.75, fromPos: this.camera.position.clone(), toPos: pos, fromT: this.controls.target.clone(), toT: target };
    }
    this.dispatchEvent(new CustomEvent('view', { detail: { view: id } }));
  }

  /* ------------------------------------------------------------ */
  /* Design layers (artwork + text projected as decals)             */
  /* ------------------------------------------------------------ */
  _printProps() {
    return this.handle ? this.handle.printSurface() : { roughness: 0.8, metalness: 0 };
  }

  async addLayer(def) {
    const layer = {
      id: def.id || lid(),
      type: def.type,                 // 'image' | 'text'
      name: def.name || (def.type === 'text' ? def.text : 'Artwork'),
      src: def.src || null,
      originalSrc: def.originalSrc || null,
      text: def.text ?? '',
      font: def.font || 'montserrat',
      color: def.color || '#17151b',
      size: def.size ?? null,
      scaleX: def.scaleX ?? 1,
      scaleY: def.scaleY ?? 1,
      rotation: def.rotation ?? 0,
      opacity: def.opacity ?? 1,
      visible: def.visible ?? true,
      presetId: def.presetId ?? null,
      anchor: def.anchor ?? null,
    };
    await this._prepareTexture(layer);
    if (!layer.anchor) this._placeAtPreset(layer, layer.presetId || this._presetFacingCamera(), layer.size == null);
    if (layer.size == null) layer.size = 0.25;
    this.layers.push(layer);
    this._buildDecal(layer);
    if (!def.silent) {
      this.select(layer.id);
      this._emitLayers();
    }
    return layer;
  }

  async updateLayer(id, patch) {
    const l = this.layers.find((x) => x.id === id);
    if (!l) return;
    const retexture = ['text', 'font', 'color', 'src'].some((k) => k in patch && patch[k] !== l[k]);
    Object.assign(l, patch);
    if (retexture) await this._prepareTexture(l);
    if ('opacity' in patch && l._mat) l._mat.opacity = l.opacity;
    if (retexture || ['size', 'scaleX', 'scaleY', 'rotation', 'anchor', 'visible'].some((k) => k in patch)) this._buildDecal(l);
    this._emitLayers();
  }

  applyPreset(id, presetId) {
    const l = this.layers.find((x) => x.id === id);
    if (!l) return;
    this._placeAtPreset(l, presetId, true);
    this._buildDecal(l);
    this._emitLayers();
  }

  removeLayer(id) {
    const i = this.layers.findIndex((x) => x.id === id);
    if (i < 0) return;
    const [l] = this.layers.splice(i, 1);
    this._removeDecal(l);
    l._mat?.dispose();
    l._tex?.dispose();
    if (this.selectedId === id) this.select(this.layers[this.layers.length - 1]?.id || null);
    this._emitLayers();
  }

  async duplicateLayer(id) {
    const l = this.layers.find((x) => x.id === id);
    if (!l) return;
    const { _mesh, _meshes, _mat, _tex, _frame, _aspect, id: _, ...rest } = l;
    const n = v3(l.anchor.n);
    const p = v3(l.anchor.p).add(new THREE.Vector3(0, -1, 0).projectOnPlane(n).setLength((l.size / this.scale) * 0.6));
    await this.addLayer({ ...rest, name: `${l.name} copy`, anchor: { p: arr(p), n: l.anchor.n }, presetId: null });
  }

  moveLayer(id, delta) {
    const i = this.layers.findIndex((x) => x.id === id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= this.layers.length) return;
    [this.layers[i], this.layers[j]] = [this.layers[j], this.layers[i]];
    this.layers.forEach((l, k) => {
      for (const mesh of l._meshes || (l._mesh ? [l._mesh] : [])) mesh.renderOrder = 10 + k;
    });
    this._emitLayers();
  }

  select(id) {
    this.selectedId = id;
    this._updateSelectionFrame();
    this.dispatchEvent(new CustomEvent('select', { detail: { id } }));
  }

  presets() {
    return this.handle ? this.handle.presets.map(({ id, label }) => ({ id, label })) : [];
  }

  _emitLayers() {
    this._updateSelectionFrame();
    this.dispatchEvent(new CustomEvent('layers', { detail: { layers: this.layers } }));
  }

  async _prepareTexture(l) {
    l._tex?.dispose();
    if (l.type === 'text') {
      const { canvas, aspect } = await renderTextCanvas(l);
      l._tex = new THREE.CanvasTexture(canvas);
      l._aspect = aspect;
    } else {
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = l.src; });
      l._tex = new THREE.Texture(img);
      l._tex.needsUpdate = true;
      l._aspect = img.naturalWidth / img.naturalHeight;
    }
    l._tex.colorSpace = THREE.SRGBColorSpace;
    l._tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    if (!l._mat) {
      l._mat = new THREE.MeshPhysicalMaterial({
        transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
      });
    }
    Object.assign(l._mat, this._printProps());
    l._mat.map = l._tex;
    l._mat.opacity = l.opacity;
    l._mat.envMapIntensity = this.envIntensity;
    l._mat.needsUpdate = true;
  }

  _presetFacingCamera() {
    if (!this.handle) return null;
    const camDir = this.camera.position.clone().sub(this.controls.target).normalize();
    const g = this.handle.group;
    // The first preset (front centre) wins unless the camera clearly faces another side.
    let best = null, bestScore = -Infinity;
    this.handle.presets.forEach((p, i) => {
      const d = v3(p.origin).sub(v3(p.target)).transformDirection(g.matrixWorld);
      const score = d.dot(camDir) + (i === 0 ? 0.35 : 0) - i * 0.02;
      if (score > bestScore) { best = p.id; bestScore = score; }
    });
    return best;
  }

  _placeAtPreset(l, presetId, setSize) {
    if (!this.handle) return;
    const presets = this.handle.presets;
    const p = presets.find((x) => x.id === presetId) || presets[0];
    const g = this.handle.group;
    g.updateMatrixWorld(true);
    const o = v3(p.origin).applyMatrix4(g.matrixWorld);
    const t = v3(p.target).applyMatrix4(g.matrixWorld);
    const hit = this._cast(o, t.clone().sub(o).normalize());
    l.presetId = p.id;
    if (setSize) l.size = p.size * this.scale;
    if (hit) this._setAnchorFromHit(l, hit);
    else l.anchor = { p: p.target, n: arr(v3(p.origin).sub(v3(p.target)).normalize()) };
  }

  _cast(origin, dir) {
    if (!this.handle) return null;
    this.raycaster.set(origin, dir);
    this.raycaster.far = 20;
    const hits = this.raycaster.intersectObjects(this.handle.targets, false);
    return hits[0] || null;
  }

  _hitNormal(hit) {
    const n = (hit.normal || hit.face.normal).clone();
    n.applyMatrix3(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld)).normalize();
    if (n.dot(this.raycaster.ray.direction) > 0) n.negate();
    return n;
  }

  _setAnchorFromHit(l, hit) {
    const g = this.handle.group;
    const n = this._hitNormal(hit);
    const inv = g.matrixWorld.clone().invert();
    const pl = hit.point.clone().applyMatrix4(inv);
    const nl = n.clone().transformDirection(inv);
    l.anchor = { p: arr(pl), n: arr(nl) };
  }

  _removeDecal(l) {
    for (const mesh of l._meshes || (l._mesh ? [l._mesh] : [])) {
      mesh.parent?.remove(mesh);
      mesh.geometry.dispose();
    }
    l._meshes = [];
    l._mesh = null;
    l._frame = null;
  }

  _rebuildAllDecals() {
    for (const l of this.layers) this._buildDecal(l);
    this._updateSelectionFrame();
  }

  _buildDecal(l) {
    this._removeDecal(l);
    if (!this.handle || !l.visible || !l._tex || !l.anchor) return;
    const g = this.handle.group;
    g.updateMatrixWorld(true);
    const p = v3(l.anchor.p).applyMatrix4(g.matrixWorld);
    const n = v3(l.anchor.n).transformDirection(g.matrixWorld);
    const hit = this._cast(p.clone().addScaledVector(n, 0.5), n.clone().negate());
    if (!hit) return;
    const hn = this._hitNormal(hit);
    const on = hn.clone().lerp(n, 0.55).normalize();
    const h = this._helper;
    h.position.copy(hit.point);
    h.up.set(0, 1, 0).applyQuaternion(this.spin.quaternion);
    if (Math.abs(on.dot(h.up)) > 0.92) h.up.set(0, 0, -1).applyQuaternion(this.spin.quaternion);
    h.lookAt(hit.point.clone().add(on));
    h.rotateZ(THREE.MathUtils.degToRad(-l.rotation));
    h.updateMatrixWorld(true);
    const w = l.size * l.scaleX;
    const ht = (l.size / (l._aspect || 1)) * l.scaleY;
    // Keep the projection deep enough to reach the sides of curved products as the print grows.
    const productSpan = this.bounds.getSize(new THREE.Vector3()).length();
    const depth = THREE.MathUtils.clamp(Math.max(w, ht, productSpan * 0.5) * 1.1, 0.06, Math.max(0.6, productSpan));
    const sideWrap = !['phonecase', 'frame'].includes(this.handle.kind);
    const meshes = [];
    const targets = this.handle.targets?.length ? this.handle.targets : [hit.object];
    const projectorBounds = new THREE.Box3(
      new THREE.Vector3(-w / 2, -ht / 2, -depth / 2),
      new THREE.Vector3(w / 2, ht / 2, depth / 2),
    ).applyMatrix4(new THREE.Matrix4().compose(hit.point, h.quaternion, new THREE.Vector3(1, 1, 1)));
    for (const target of targets) {
      if (!target.geometry.boundingBox) target.geometry.computeBoundingBox();
      const targetBounds = target.geometry.boundingBox?.clone().applyMatrix4(target.matrixWorld);
      if (targetBounds && !targetBounds.intersectsBox(projectorBounds)) continue;
      const projected = new DecalGeometry(target, hit.point, h.rotation.clone(), new THREE.Vector3(w, ht, depth));
      const geo = keepFacing(projected, on, sideWrap ? -0.15 : 0.1);
      projected.dispose();
      if (!geo.attributes.position?.count) {
        geo.dispose();
        continue;
      }
      geo.applyMatrix4(target.matrixWorld.clone().invert());
      const mesh = new THREE.Mesh(geo, l._mat);
      mesh.renderOrder = 10 + this.layers.indexOf(l);
      mesh.raycast = () => {};
      target.add(mesh);
      meshes.push(mesh);
    }
    if (!meshes.length) return;
    l._meshes = meshes;
    l._mesh = meshes[0];
    // frame in the hit object's local space so it follows lids and turntables
    const inv = hit.object.matrixWorld.clone().invert();
    const fm = new THREE.Matrix4().compose(hit.point, h.quaternion, new THREE.Vector3(1, 1, 1)).premultiply(inv);
    l._frame = { object: hit.object, matrix: fm, w, h: ht, depth };
    if (l.id === this.selectedId) this._updateSelectionFrame();
  }

  _layerAtPoint(worldPoint) {
    for (let i = this.layers.length - 1; i >= 0; i--) {
      const l = this.layers[i];
      if (!l._frame || !l.visible) continue;
      const m = l._frame.matrix.clone().premultiply(l._frame.object.matrixWorld).invert();
      // frame matrix is unit-scale in world terms, so q is in world units
      const q = worldPoint.clone().applyMatrix4(m);
      const pad = 1.08;
      if (Math.abs(q.x) <= (l._frame.w / 2) * pad && Math.abs(q.y) <= (l._frame.h / 2) * pad && Math.abs(q.z) <= l._frame.depth) return l;
    }
    return null;
  }

  _makeSelectionFrame() {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(new Array(32 * 3).fill(0), 3));
    const mat = new THREE.LineBasicMaterial({ color: '#e6bf86', depthTest: false, transparent: true, opacity: 0.95 });
    const lines = new THREE.LineSegments(geo, mat);
    lines.name = '__ehSelectionFrame';
    lines.renderOrder = 999;
    lines.visible = false;
    lines.raycast = () => {};
    return lines;
  }

  _updateSelectionFrame() {
    const sel = this._selection;
    const l = this.layers.find((x) => x.id === this.selectedId);
    sel.parent?.remove(sel);
    sel.visible = false;
    if (!l || !l._frame || !this.editing) return;
    const { object, matrix, w, h } = l._frame;
    const hw = w / 2, hh = h / 2, c = Math.min(hw, hh) * 0.35, z = 0.004;
    const pts = [];
    const corner = (x, y, dx, dy) => { pts.push(x, y, z, x + dx, y, z, x, y, z, x, y + dy, z); };
    corner(-hw, -hh, c, c); corner(hw, -hh, -c, c); corner(hw, hh, -c, -c); corner(-hw, hh, c, -c);
    const handleSize = Math.min(hw, hh, 0.025);
    const handle = (x, y) => {
      pts.push(x - handleSize, y, z, x + handleSize, y, z, x, y - handleSize, z, x, y + handleSize, z);
    };
    handle(0, -hh); handle(hw, 0); handle(0, hh); handle(-hw, 0);
    sel.geometry.attributes.position.array.set(pts);
    sel.geometry.attributes.position.needsUpdate = true;
    sel.geometry.computeBoundingSphere();
    sel.matrixAutoUpdate = false;
    sel.matrix.copy(matrix);
    object.add(sel);
    sel.visible = true;
  }

  _selectionScreenGeometry(layer) {
    if (!layer?._frame) return null;
    const { object, matrix, w, h } = layer._frame;
    object.updateMatrixWorld(true);
    this.camera.updateMatrixWorld(true);
    const rect = this.renderer.domElement.getBoundingClientRect();
    const project = (x, y) => {
      const p = new THREE.Vector3(x, y, 0.006)
        .applyMatrix4(matrix)
        .applyMatrix4(object.matrixWorld)
        .project(this.camera);
      return { x: rect.left + (p.x + 1) * rect.width / 2, y: rect.top + (1 - p.y) * rect.height / 2 };
    };
    const corners = [project(-w / 2, -h / 2), project(w / 2, -h / 2), project(w / 2, h / 2), project(-w / 2, h / 2)];
    const handles = [
      { ...corners[0], index: 0, axes: 'xy' },
      { ...corners[1], index: 1, axes: 'xy' },
      { ...corners[2], index: 2, axes: 'xy' },
      { ...corners[3], index: 3, axes: 'xy' },
      { x: (corners[0].x + corners[1].x) / 2, y: (corners[0].y + corners[1].y) / 2, index: 4, axes: 'y' },
      { x: (corners[1].x + corners[2].x) / 2, y: (corners[1].y + corners[2].y) / 2, index: 5, axes: 'x' },
      { x: (corners[2].x + corners[3].x) / 2, y: (corners[2].y + corners[3].y) / 2, index: 6, axes: 'y' },
      { x: (corners[3].x + corners[0].x) / 2, y: (corners[3].y + corners[0].y) / 2, index: 7, axes: 'x' },
    ];
    const topWidth = new THREE.Vector2(corners[1].x - corners[0].x, corners[1].y - corners[0].y);
    const bottomWidth = new THREE.Vector2(corners[2].x - corners[3].x, corners[2].y - corners[3].y);
    const leftHeight = new THREE.Vector2(corners[3].x - corners[0].x, corners[3].y - corners[0].y);
    const rightHeight = new THREE.Vector2(corners[2].x - corners[1].x, corners[2].y - corners[1].y);
    return {
      center: project(0, 0),
      corners,
      handles,
      width: (topWidth.length() + bottomWidth.length()) / 2,
      height: (leftHeight.length() + rightHeight.length()) / 2,
      widthAxis: topWidth.add(bottomWidth).normalize(),
      heightAxis: leftHeight.add(rightHeight).normalize(),
    };
  }

  _resizeHandleAt(layer, e) {
    const geometry = this._selectionScreenGeometry(layer);
    if (!geometry) return null;
    let nearest = null;
    geometry.handles.forEach((handle) => {
      const distance = Math.hypot(e.clientX - handle.x, e.clientY - handle.y);
      if (!nearest || distance < nearest.distance) nearest = { ...handle, distance, center: geometry.center };
    });
    return nearest && nearest.distance <= 22 ? nearest : null;
  }

  _resizeCursor(handle) {
    if (handle.axes === 'x') return 'ew-resize';
    if (handle.axes === 'y') return 'ns-resize';
    return handle.index % 2 ? 'nesw-resize' : 'nwse-resize';
  }

  setEditing(on) {
    this.editing = on;
    this._updateSelectionFrame();
  }

  /* ------------------------------------------------------------ */
  /* Pointer: drag artwork across the model                         */
  /* ------------------------------------------------------------ */
  _bindPointer() {
    const el = this.renderer.domElement;
    const ndc = new THREE.Vector2();
    const pick = (e) => {
      const r = el.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      this.raycaster.setFromCamera(ndc, this.camera);
      if (!this.handle) return null;
      return this.raycaster.intersectObjects(this.handle.targets, false)[0] || null;
    };
    let down = null;
    let drag = null;
    let pending = null;

    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      down = { x: e.clientX, y: e.clientY, t: performance.now() };
      if (!this.editing) return;
      const selected = this.layers.find((item) => item.id === this.selectedId);
      const handle = selected && this._resizeHandleAt(selected, e);
      if (selected && handle) {
        const geometry = this._selectionScreenGeometry(selected);
        const layer = selected;
        drag = {
          layer,
          mode: 'resize',
          startScaleX: layer.scaleX,
          startScaleY: layer.scaleY,
          startX: e.clientX,
          startY: e.clientY,
          center: geometry.center,
          startDistance: Math.max(1, Math.hypot(e.clientX - geometry.center.x, e.clientY - geometry.center.y)),
          width: geometry.width,
          height: geometry.height,
          widthAxis: geometry.widthAxis,
          heightAxis: geometry.heightAxis,
          axes: handle.axes,
          signX: handle.index === 0 || handle.index === 3 || handle.index === 7 ? -1 : 1,
          signY: handle.index < 2 || handle.index === 4 ? -1 : 1,
        };
        this.controls.enabled = false;
        el.setPointerCapture(e.pointerId);
        el.style.cursor = this._resizeCursor(handle);
      } else {
        const hit = pick(e);
        const layer = hit && this._layerAtPoint(hit.point);
        if (!layer) return;
        if (this.selectedId !== layer.id) this.select(layer.id);
        drag = { layer, mode: 'move' };
        this.controls.enabled = false;
        el.setPointerCapture(e.pointerId);
        el.style.cursor = 'grabbing';
      }
    });
    el.addEventListener('pointermove', (e) => {
      if (drag) {
        pending = e;
        if (drag.mode === 'resize') {
          const dx = e.clientX - drag.startX;
          const dy = e.clientY - drag.startY;
          if (drag.axes === 'xy') {
            const distance = Math.hypot(e.clientX - drag.center.x, e.clientY - drag.center.y);
            const minFactor = Math.max(0.1 / drag.startScaleX, 0.1 / drag.startScaleY);
            const maxFactor = Math.min(20 / drag.startScaleX, 20 / drag.startScaleY);
            const factor = THREE.MathUtils.clamp(distance / drag.startDistance, minFactor, maxFactor);
            drag.layer.scaleX = drag.startScaleX * factor;
            drag.layer.scaleY = drag.startScaleY * factor;
          } else {
            const widthDelta = (dx * drag.widthAxis.x + dy * drag.widthAxis.y) * drag.signX;
            const heightDelta = (dx * drag.heightAxis.x + dy * drag.heightAxis.y) * drag.signY;
            if (drag.axes === 'x') drag.layer.scaleX = THREE.MathUtils.clamp(drag.startScaleX * (1 + (2 * widthDelta / drag.width)), 0.1, 20);
            if (drag.axes === 'y') drag.layer.scaleY = THREE.MathUtils.clamp(drag.startScaleY * (1 + (2 * heightDelta / drag.height)), 0.1, 20);
          }
          this._buildDecal(drag.layer);
          return;
        }
        if (!drag.raf) {
          drag.raf = requestAnimationFrame(() => {
            if (!drag) return;
            drag.raf = 0;
            const hit = pick(pending);
            if (hit) {
              this._setAnchorFromHit(drag.layer, hit);
              drag.layer.presetId = null;
              this._buildDecal(drag.layer);
            }
          });
        }
        return;
      }
      if (this.editing && !down && e.pointerType === 'mouse') {
        const hit = pick(e);
        const layer = hit && this._layerAtPoint(hit.point);
        const handle = layer && this._resizeHandleAt(layer, e);
        el.style.cursor = handle ? this._resizeCursor(handle) : layer ? 'grab' : '';
      }
    });
    const end = (e) => {
      if (drag) {
        if (drag.raf) cancelAnimationFrame(drag.raf);
        drag = null;
        this.controls.enabled = true;
        el.style.cursor = '';
        this._emitLayers();
      } else if (down && this.editing && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 5 && performance.now() - down.t < 500) {
        const hit = pick(e);
        const layer = hit && this._layerAtPoint(hit.point);
        this.select(layer ? layer.id : null);
      }
      down = null;
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }

  /** Exports the product, its materials and printed artwork as a self-contained GLB. */
  async exportGlb(extras = {}) {
    if (!this.handle) throw new Error('Load a product before exporting a 3D mockup.');
    const root = this.handle.group.clone(true);
    const source = this.sourceGroupTransform;
    if (source) {
      root.position.copy(source.position);
      root.quaternion.copy(source.quaternion);
      root.scale.copy(source.scale);
    }
    root.name = extras.name || 'EliteHub 3D Mockup';
    root.traverse((object) => {
      if (object.name === '__ehSelectionFrame') {
        object.parent?.remove(object);
        return;
      }
      if (!object.isMesh || !object.material) return;
      object.material = Array.isArray(object.material)
        ? object.material.map((material) => material.clone())
        : object.material.clone();
    });
    root.userData = { ...root.userData, ...extras, format: 'EliteHub custom product', version: 1 };
    const exportScene = new THREE.Scene();
    exportScene.add(root);
    exportScene.updateMatrixWorld(true);
    const exporter = new GLTFExporter();
    return new Promise((resolve, reject) => {
      exporter.parse(exportScene, (result) => {
        if (result instanceof ArrayBuffer) resolve(new Blob([result], { type: 'model/gltf-binary' }));
        else reject(new Error('The 3D mockup exporter did not return a binary GLB.'));
      }, reject, { binary: true, onlyVisible: true });
    });
  }

  /* ------------------------------------------------------------ */
  /* Loop                                                          */
  /* ------------------------------------------------------------ */
  _loop() {
    const dt = Math.min(this._clock.getDelta(), 0.05);
    if (this._paused) return;
    if (this._tween) {
      const tw = this._tween;
      tw.t = Math.min(1, tw.t + dt / tw.dur);
      const k = tw.t < 0.5 ? 4 * tw.t ** 3 : 1 - Math.pow(-2 * tw.t + 2, 3) / 2;
      this.camera.position.lerpVectors(tw.fromPos, tw.toPos, k);
      this.controls.target.lerpVectors(tw.fromT, tw.toT, k);
      if (tw.t >= 1) this._tween = null;
    }
    if (this.settings.turntable && !reducedMotion()) {
      this.spin.rotation.y += dt * 0.55 * this.settings.speed;
    }
    this.controls.update();
    this.handle?.update(dt);
    this.renderer.render(this.scene, this.camera);
  }

  /* ------------------------------------------------------------ */
  /* Export                                                        */
  /* ------------------------------------------------------------ */
  _freezeFrame(on) {
    const f = this._freeze;
    if (!on) { f.style.display = 'none'; return; }
    const src = this.renderer.domElement;
    this.renderer.render(this.scene, this.camera);
    f.width = src.width;
    f.height = src.height;
    f.getContext('2d').drawImage(src, 0, 0);
    f.style.display = 'block';
  }

  _withSize(width, height, { transparent = false } = {}, fn) {
    const r = this.renderer;
    this._freezeFrame(true);
    this._paused = true;
    const prevSize = r.getSize(new THREE.Vector2());
    const prevPR = r.getPixelRatio();
    const prevBg = this.scene.background;
    const prevAspect = this.camera.aspect;
    const prevPos = this.camera.position.clone();
    const selVisible = this._selection.visible;
    this._selection.visible = false;
    if (transparent) this.scene.background = null;
    r.setPixelRatio(1);
    r.setSize(width, height, false);
    const aspect = width / height;
    const need = this._fitDistance(aspect), have = this._fitDistance(prevAspect);
    if (need > have) {
      const dir = this.camera.position.clone().sub(this.controls.target);
      this.camera.position.copy(this.controls.target).add(dir.multiplyScalar(need / have));
    }
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    const restore = () => {
      this.scene.background = prevBg;
      this._selection.visible = selVisible;
      r.setPixelRatio(prevPR);
      r.setSize(prevSize.x, prevSize.y, false);
      this.camera.aspect = prevAspect;
      this.camera.position.copy(prevPos);
      this.camera.updateProjectionMatrix();
      this._paused = false;
      this.renderer.render(this.scene, this.camera);
      this._freezeFrame(false);
    };
    return fn(restore);
  }

  /** Renders the current view to an image Blob. */
  capture({ width = 2048, height = 2048, transparent = false, type = 'image/png', quality = 0.92 } = {}) {
    const max = Math.min(4096, this.renderer.capabilities.maxTextureSize);
    const s = Math.min(1, max / Math.max(width, height));
    width = Math.round(width * s);
    height = Math.round(height * s);
    return this._withSize(width, height, { transparent }, (restore) => {
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
      return new Promise((res) => {
        this.renderer.domElement.toBlob((b) => { restore(); res(b); }, type, quality);
      });
    });
  }

  async thumbnail(size = 480) {
    const blob = await this.capture({ width: size, height: size, type: 'image/jpeg', quality: 0.86 });
    return new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(blob); });
  }

  /* ------------------------------------------------------------ */
  /* Design details used with orders                               */
  /* ------------------------------------------------------------ */
  getState() {
    return {
      version: 1,
      model: this.model ? { ...this.model } : null,
      appearance: { ...this.appearance },
      scene: { ...this.settings },
      layers: this.layers.map((l) => ({
        id: l.id, type: l.type, name: l.name, src: l.type === 'image' ? l.src : null, originalSrc: l.originalSrc,
        text: l.text, font: l.font, color: l.color,
        size: l.size, scaleX: l.scaleX, scaleY: l.scaleY, rotation: l.rotation, opacity: l.opacity, visible: l.visible,
        presetId: l.presetId, anchor: l.anchor,
      })),
      camera: { position: arr(this.camera.position), target: arr(this.controls.target) },
    };
  }

  dispose() {
    this.renderer.setAnimationLoop(null);
    this._ro.disconnect();
    this.controls.dispose();
    this.handle?.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

/** Drop decal triangles that face away from the projector (stops prints bleeding to the inside). */
function keepFacing(geo, dir, minFacing = 0.1) {
  const pos = geo.attributes.position, nor = geo.attributes.normal, uv = geo.attributes.uv;
  const P = [], N = [], U = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), fnm = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i); b.fromBufferAttribute(pos, i + 1); c.fromBufferAttribute(pos, i + 2);
    fnm.subVectors(c, b).cross(a.clone().sub(b)).normalize();
    const vn = new THREE.Vector3().fromBufferAttribute(nor, i).add(new THREE.Vector3().fromBufferAttribute(nor, i + 1)).add(new THREE.Vector3().fromBufferAttribute(nor, i + 2)).normalize();
    if (vn.dot(dir) < minFacing && fnm.dot(dir) < minFacing) continue;
    for (let k = 0; k < 3; k++) {
      P.push(pos.getX(i + k), pos.getY(i + k), pos.getZ(i + k));
      N.push(nor.getX(i + k), nor.getY(i + k), nor.getZ(i + k));
      U.push(uv.getX(i + k), uv.getY(i + k));
    }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  geo.dispose();
  return out;
}
