/* =====================================================================
   EliteHub — Design Studio (Fabric.js canvas editor)
   ===================================================================== */
(function () {
  const EH = window.EH;
  const BASE = 600;          // logical canvas size (px)
  const K = BASE / 400;      // mockup units → canvas units
  const PROPS = ['kind', 'name', 'assetId', 'designId', 'autoInk', 'artFill', 'removeWhite', 'whiteTolerance', 'gray', 'trace', 'traceStrength'];
  const FONTS = ['Montserrat', 'Cormorant Garamond', 'Playfair Display', 'Great Vibes', 'Dancing Script', 'Kaushan Script', 'Pacifico', 'Lobster', 'Permanent Marker', 'Bebas Neue', 'Oswald', 'Anton'];
  const SWATCHES = ['#ffffff', '#111111', '#e6bf86', '#c9a35a', '#e63946', '#ff8a5c', '#f6c945', '#2bb673', '#2f5bff', '#7b5cff', '#b8a7d9', '#ff6fb5'];
  const TEMPLATES = [
    { text: 'Good Vibes\nOnly', font: 'Kaushan Script', size: 50 },
    { text: 'DREAM\nPLAN\nDO\nREPEAT', font: 'Bebas Neue', size: 48, lineHeight: 0.9, charSpacing: 60 },
    { text: 'Better Days\nAhead', font: 'Kaushan Script', size: 46 },
    { text: 'DREAM\nCREATE\nWEAR', font: 'Permanent Marker', size: 40, angle: -8 },
    { text: 'Stay Golden', font: 'Great Vibes', size: 60, fill: '#e6bf86' },
    { text: 'TRUST THE TIMING', font: 'Montserrat', size: 18, weight: '600', charSpacing: 300 },
    { text: 'Your Name', font: 'Cormorant Garamond', size: 50, weight: '600' },
    { text: 'BORN TO\nSTAND OUT', font: 'Anton', size: 42, lineHeight: 0.95 }
  ];

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  const S = { type: 'tshirt', color: 'black', size: null, model: null, qty: 1 };
  const assets = {};   // asset id → data URL
  const thumbs = {};   // asset id → small thumbnail
  let uploads = [];    // recent uploads [{id, name}]
  let canvas;
  let exporting = false, restoring = false, muted = false;
  let hist = [], hIndex = -1;
  let saveTimer, pushTimer, preview3dTimer, loadTok = 0, lastWasText = false;

  EH.ready(init);

  /* ---------------- helpers ---------------- */
  const T = () => EH.types[S.type];
  const inkColor = () => { const t = T(); const hex = EH.color.hexOf(S.color); return t.ink ? t.ink(hex) : EH.color.inkFor(hex); };
  const unitPrice = () => T().basePrice + EH.sizeAdd(S.type, S.size);
  const printRect = (type = S.type) => {
    const p = EH.types[type].print;
    return { x: p.x * K, y: p.y * K, w: p.w * K, h: p.h * K, cx: (p.x + p.w / 2) * K, cy: (p.y + p.h / 2) * K };
  };
  const loadImage = (url) => new Promise((res) => fabric.Image.fromURL(url, (img) => res(img && img.width ? img : null), { crossOrigin: 'anonymous' }));
  const artKey = (id, ink, fill) => `art:${id}:${ink.replace('#', '')}:${fill ? 1 : 0}`;
  function ensureAsset(key) {
    if (!key) return '';
    if (assets[key]) return assets[key];
    if (key.startsWith('art:')) {
      const [, id, ink, fill] = key.split(':');
      assets[key] = EH.svgToDataURL(EH.artwork(id, { px: 1000, ink: '#' + ink, fill: fill === '1', noText: true }));
      return assets[key];
    }
    return '';
  }
  function makeThumb(id) {
    return new Promise((res) => {
      if (thumbs[id]) return res(thumbs[id]);
      const src = ensureAsset(id);
      if (!src) return res('');
      if (id.startsWith('art:')) { thumbs[id] = src; return res(src); }
      const img = new Image();
      img.onload = () => {
        const s = Math.min(1, 160 / Math.max(img.width, img.height));
        const cv = document.createElement('canvas');
        cv.width = Math.max(1, img.width * s); cv.height = Math.max(1, img.height * s);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        thumbs[id] = cv.toDataURL('image/png');
        res(thumbs[id]);
      };
      img.onerror = () => res('');
      img.src = src;
    });
  }

  function makeClip() {
    const t = T(), p = printRect(), cf = t.clipFabric;
    if (cf && cf.kind === 'path') {
      const path = new fabric.Path(cf.d, { originX: 'left', originY: 'top', strokeWidth: 0 });
      path.set({ left: path.left * K, top: path.top * K, scaleX: K, scaleY: K, absolutePositioned: true });
      return path;
    }
    const r = cf && cf.rx ? cf.rx * K : 0;
    return new fabric.Rect({ left: p.x, top: p.y, width: p.w, height: p.h, rx: r, ry: r, originX: 'left', originY: 'top', strokeWidth: 0, absolutePositioned: true });
  }

  /* ---------------- serialisation & history ---------------- */
  function serialize() {
    return canvas.getObjects().map((o) => {
      const j = o.toObject(PROPS);
      delete j.clipPath;
      if (j.type === 'image' && o.assetId) j.src = 'asset:' + o.assetId;
      return j;
    });
  }
  function enliven(list) {
    return new Promise((res) => {
      const objs = list.map((j) => (j.type === 'image' && typeof j.src === 'string' && j.src.startsWith('asset:') ? Object.assign({}, j, { src: ensureAsset(j.src.slice(6)) }) : j))
        .filter((j) => j.type !== 'image' || j.src);
      if (!objs.length) return res([]);
      fabric.util.enlivenObjects(objs, (out) => res(out.filter(Boolean)));
    });
  }
  async function restoreObjects(list) {
    restoring = true;
    canvas.discardActiveObject();
    canvas.getObjects().slice().forEach((o) => canvas.remove(o));
    const objs = await enliven(list);
    objs.forEach((o) => { o.clipPath = makeClip(); canvas.add(o); });
    restoring = false;
    canvas.requestRenderAll();
    schedule3DRefresh();
  }
  const snapshot = () => JSON.stringify({ type: S.type, color: S.color, objects: serialize() });
  function pushHistory() {
    if (restoring || muted || !canvas) return;
    const snap = snapshot();
    if (hist[hIndex] === snap) { renderLayers(); return; }
    hist = hist.slice(0, hIndex + 1);
    hist.push(snap);
    if (hist.length > 50) hist.shift();
    hIndex = hist.length - 1;
    updateHistoryButtons();
    renderLayers();
    scheduleSave();
    schedule3DRefresh();
  }
  const pushSoon = () => { clearTimeout(pushTimer); pushTimer = setTimeout(pushHistory, 350); };
  async function goHistory(i) {
    if (i < 0 || i >= hist.length) return;
    hIndex = i;
    const snap = JSON.parse(hist[i]);
    if (snap.type !== S.type || snap.color !== S.color) {
      S.type = snap.type; S.color = snap.color;
      const t = T();
      if (t.sizes && !t.sizes.includes(S.size)) S.size = EH.defaultOptions(S.type, S.color).size;
      if (t.models && !t.models.includes(S.model)) S.model = t.models[0];
      renderProductUI();
      setProduct();
    }
    await restoreObjects(snap.objects);
    updateHistoryButtons();
    renderLayers();
    syncPanels();
    scheduleSave();
  }
  function updateHistoryButtons() {
    $('#undoBtn').disabled = hIndex <= 0;
    $('#redoBtn').disabled = hIndex >= hist.length - 1;
  }

  function schedule3DRefresh() {
    if (!canvas || !$('#stageBox').classList.contains('view-3d') || !window.EliteHub3D) return;
    clearTimeout(preview3dTimer);
    preview3dTimer = setTimeout(() => {
      if (!$('#stageBox').classList.contains('view-3d') || !window.EliteHub3D) return;
      try {
        window.EliteHub3D.update({ type: S.type, color: S.color, print: T().print, textureUrl: exportPrint(1000) });
      } catch (error) {
        $('#preview3dCaption').textContent = '3D preview could not update';
      }
    }, 140);
  }

  function setStageView(view) {
    const is3d = view === '3d';
    const box = $('#stageBox');
    box.classList.toggle('view-3d', is3d);
    $('#preview3d').hidden = !is3d;
    $$('.stage-view-toggle [data-stage-view]').forEach((button) => {
      const active = button.dataset.stageView === view;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    if (is3d) {
      const hex = EH.color.hexOf(S.color);
      const viewer = window.EliteHub3D;
      $('#preview3dCaption').textContent = viewer && viewer.uploadedModelName
        ? `Uploaded 3D model · ${EH.colors[S.color]?.name || hex}`
        : `${T().label} · ${EH.colors[S.color]?.name || hex}`;
      if (!viewer || !viewer.init($('#product3dMount'))) {
        $('#preview3dCaption').textContent = '3D preview is unavailable in this browser';
        return;
      }
      viewer.setVisible(true);
      schedule3DRefresh();
    } else {
      if (window.EliteHub3D) window.EliteHub3D.setVisible(false);
      requestAnimationFrame(() => { fit(); canvas.calcOffset(); });
    }
  }

  /* ---------------- persistence (IndexedDB) ---------------- */
  function scheduleSave() { clearTimeout(saveTimer); saveTimer = setTimeout(save, 600); }
  function save() {
    const keep = {};
    canvas.getObjects().forEach((o) => { if (o.assetId && o.assetId.startsWith('up:')) keep[o.assetId] = assets[o.assetId]; });
    uploads.forEach((u) => { if (assets[u.id]) keep[u.id] = assets[u.id]; });
    EH.files.put('studio', { v: 1, S: Object.assign({}, S), objects: serialize(), uploads, assets: keep });
  }

  /* ---------------- product background ---------------- */
  async function setProduct() {
    const tok = ++loadTok;
    const base = EH.mockup(S.type, { color: S.color, layer: 'base', px: 1200 });
    const over = EH.mockup(S.type, { color: S.color, layer: 'overlay', px: 1200 });
    const [b, o] = await Promise.all([loadImage(EH.svgToDataURL(base)), loadImage(EH.svgToDataURL(over))]);
    if (tok !== loadTok || !b || !o) return;
    const opts = { originX: 'left', originY: 'top', left: 0, top: 0, scaleX: BASE / 1200, scaleY: BASE / 1200, selectable: false, evented: false };
    b.set(opts); o.set(opts);
    canvas.setBackgroundImage(b, () => canvas.requestRenderAll());
    canvas.setOverlayImage(o, () => canvas.requestRenderAll());
  }

  function fit() {
    const box = $('#stageBox');
    const w = Math.max(240, Math.floor(box.clientWidth));
    if (canvas.getWidth() === w) return;
    canvas.setDimensions({ width: w, height: w });
    canvas.setZoom(w / BASE);
    canvas.calcOffset();
    canvas.requestRenderAll();
  }

  /* ---------------- adding objects ---------------- */
  function addObj(o, select = true) {
    o.clipPath = makeClip();
    canvas.add(o);
    if (select) canvas.setActiveObject(o);
    canvas.requestRenderAll();
    return o;
  }
  function fitInto(o, frac = 0.8, cover = false) {
    const p = printRect();
    const s = cover ? Math.max(p.w / o.width, p.h / o.height) : Math.min((p.w * frac) / o.width, (p.h * frac) / o.height);
    o.set({ scaleX: s, scaleY: s });
  }
  function addText(opt = {}) {
    const p = printRect();
    const t = new fabric.IText(opt.text || 'Your Text', {
      left: p.cx, top: p.cy + (opt.offsetY || 0) * p.h,
      fontFamily: opt.font || 'Montserrat', fontSize: opt.size || 44, fontWeight: opt.weight || 'normal',
      fill: opt.fill || inkColor(), textAlign: 'center', lineHeight: opt.lineHeight || 1.05,
      charSpacing: opt.charSpacing || 0, angle: opt.angle || 0,
      strokeWidth: 0, stroke: '#111111', paintFirst: 'stroke', strokeLineJoin: 'round'
    });
    t.kind = 'text';
    t.autoInk = !opt.fill;
    const maxW = p.w * 0.92, maxH = p.h * 0.92;
    const sw = t.getScaledWidth(), sh = t.getScaledHeight();
    if (sw > maxW || sh > maxH) { const s = Math.min(maxW / sw, maxH / sh); t.set({ scaleX: s, scaleY: s }); }
    return addObj(t, opt.select !== false);
  }
  async function addArt(id, opt = {}) {
    const D = EH.designs[id];
    if (!D) return null;
    const fill = !!(D.scene && T().sceneFill);
    const key = artKey(id, inkColor(), fill);
    const img = await loadImage(ensureAsset(key));
    if (!img) return null;
    const p = printRect();
    img.set({ left: p.cx, top: p.cy });
    Object.assign(img, { kind: 'art', name: D.name, assetId: key, designId: id, artFill: fill });
    fitInto(img, opt.frac || 0.9, fill);
    return addObj(img, opt.select !== false);
  }
  async function addUpload(id, opt = {}) {
    const img = await loadImage(ensureAsset(id));
    if (!img) { EH.toast('That image could not be added.', { type: 'error' }); return null; }
    const p = printRect();
    img.set({ left: p.cx, top: p.cy + (opt.offsetY || 0) * p.h });
    const up = uploads.find((u) => u.id === id);
    Object.assign(img, { kind: 'image', name: (up && up.name) || opt.name || 'Your image', assetId: id });
    fitInto(img, opt.frac || 0.8);
    return addObj(img, opt.select !== false);
  }
  async function applyDesign(id) {
    const D = EH.designs[id];
    if (!D) return;
    muted = true;
    const p = printRect();
    let size = Math.min(p.w, p.h) * 0.9;
    let art = null;
    if (D.kind !== 'text') { art = await addArt(id, { select: false }); if (art) size = art.getScaledHeight(); }
    if (!(art && art.artFill)) {
      (D.template || []).forEach((t) => addText({ text: t.text, font: t.font, size: (t.size * size) / 200, weight: t.weight, lineHeight: t.lineHeight, charSpacing: t.charSpacing, angle: t.angle, fill: t.fill, offsetY: ((t.offsetY || 0) * size) / p.h, select: false }));
    }
    muted = false;
    canvas.discardActiveObject();
    canvas.requestRenderAll();
  }
  async function handleFile(file) {
    if (!file) return;
    try {
      const src = await EH.readImage(file, 2000);
      const id = 'up:' + EH.uid();
      assets[id] = src;
      uploads = [{ id, name: file.name.replace(/\.[^.]+$/, '').slice(0, 40) }].concat(uploads).slice(0, 9);
      await makeThumb(id);
      renderUploads();
      await addUpload(id);
      syncPanels();
    } catch (err) { EH.toast(err.message, { type: 'error' }); }
  }

  /* ---------------- object actions ---------------- */
  function act(a) {
    const o = canvas.getActiveObject();
    if (!o) return;
    if (a === 'delete') {
      if (o.type === 'activeSelection') { muted = true; o.forEachObject((x) => canvas.remove(x)); muted = false; canvas.discardActiveObject(); pushHistory(); }
      else canvas.remove(o);
    } else if (a === 'duplicate' && o.type !== 'activeSelection') {
      o.clone((c) => {
        PROPS.forEach((k) => { if (o[k] !== undefined) c[k] = o[k]; });
        c.set({ left: o.left + 18, top: o.top + 18 });
        addObj(c);
      }, PROPS);
    } else if (a === 'center') {
      const p = printRect();
      o.setPositionByOrigin(new fabric.Point(p.cx, p.cy), 'center', 'center');
      o.setCoords();
      pushHistory();
    } else if (a === 'flip') { o.set('flipX', !o.flipX); pushHistory(); }
    else if (a === 'forward') { canvas.bringForward(o); pushHistory(); }
    else if (a === 'backward') { canvas.sendBackwards(o); pushHistory(); }
    canvas.requestRenderAll();
  }

  /* ---------------- product / colour switching ---------------- */
  function onColorChange() {
    const ink = inkColor();
    canvas.getObjects().forEach((o) => {
      if (o.kind === 'text' && o.autoInk) o.set('fill', ink);
      if (o.kind === 'art' && o.designId) {
        const key = artKey(o.designId, ink, o.artFill);
        if (key !== o.assetId) { o.assetId = key; o.setSrc(ensureAsset(key), () => canvas.requestRenderAll()); }
      }
    });
    setProduct();
    renderSummary();
    pushHistory();
  }
  function switchType(type) {
    if (type === S.type || !EH.types[type]) return;
    const oldP = printRect(S.type), newP = printRect(type);
    S.type = type;
    const t = T();
    if (!t.colors.includes(S.color)) S.color = t.colors[0];
    S.size = EH.defaultOptions(type, S.color).size;
    S.model = t.models ? (t.models.includes(S.model) ? S.model : t.models[0]) : null;
    const s = Math.min(newP.w / oldP.w, newP.h / oldP.h);
    canvas.discardActiveObject();
    canvas.getObjects().forEach((o) => {
      const c = o.getCenterPoint();
      o.set({ scaleX: o.scaleX * s, scaleY: o.scaleY * s });
      o.setPositionByOrigin(new fabric.Point(newP.cx + (c.x - oldP.cx) * s, newP.cy + (c.y - oldP.cy) * s), 'center', 'center');
      o.clipPath = makeClip();
      o.setCoords();
    });
    renderProductUI();
    onColorChange();
  }

  /* ---------------- UI rendering ---------------- */
  function renderProductUI() {
    $('#typeGrid').innerHTML = Object.keys(EH.types).map((k) => `<button type="button" class="type-btn ${k === S.type ? 'active' : ''}" data-type="${k}" aria-pressed="${k === S.type}">${EH.mockup(k, { color: EH.types[k].colors[0] })}<span>${EH.types[k].short}</span></button>`).join('');
    $('#colorOpts').innerHTML = EH.optionsHTML(S.type, S, { only: ['color'] });
    renderSummary();
  }
  function renderSummary() {
    const t = T();
    $('#sumName').textContent = 'Custom ' + t.label;
    $('#sumOpts').innerHTML = EH.optionsHTML(S.type, S, { only: ['size', 'model'] });
    $('#sumQty').value = S.qty;
    renderPrice();
  }
  function renderPrice() {
    const u = unitPrice();
    $('#sumPrice').innerHTML = EH.money(u * S.qty) + (S.qty > 1 ? ` <small class="muted" style="font-size:13px;font-weight:400">(${EH.money(u)} each)</small>` : '');
  }
  function renderUploads() {
    const box = $('#uploads');
    box.innerHTML = uploads.length
      ? uploads.map((u) => `<button type="button" data-upload="${u.id}" title="Add ${EH.esc(u.name)}"><img src="${thumbs[u.id] || ''}" alt="${EH.esc(u.name)}"></button>`).join('')
      : '<p class="hint" style="grid-column:1/-1">Images you upload will appear here.</p>';
  }
  function renderLayers() {
    const box = $('#layerList');
    if (!box || !canvas) return;
    const all = canvas.getObjects();
    const act = canvas.getActiveObject();
    const sel = act ? (act.type === 'activeSelection' ? act.getObjects() : [act]) : [];
    box.innerHTML = all.length ? all.slice().reverse().map((o) => {
      const i = all.indexOf(o);
      const ico = o.kind === 'text' ? EH.icon('type') : thumbs[o.assetId] ? `<img src="${thumbs[o.assetId]}" alt="">` : EH.icon('image');
      const name = o.kind === 'text' ? `“${(o.text || '').replace(/\n/g, ' ').slice(0, 26)}”` : o.name || 'Image';
      return `<div class="layer ${sel.includes(o) ? 'active' : ''}" data-layer="${i}"><span class="l-ico">${ico}</span><span class="l-name">${EH.esc(name)}</span>
        <span class="l-acts"><button type="button" data-layer-act="up" aria-label="Move up">${EH.icon('up')}</button><button type="button" data-layer-act="down" aria-label="Move down">${EH.icon('down')}</button><button type="button" data-layer-act="del" aria-label="Delete">${EH.icon('trash')}</button></span></div>`;
    }).join('') : '<p class="hint">Nothing here yet — add text, an image or artwork.</p>';
    all.forEach((o) => { if (o.assetId && o.assetId.startsWith('up:') && !thumbs[o.assetId]) makeThumb(o.assetId).then(renderLayers); });
  }

  function switchTab(name) {
    $$('.tool-tab').forEach((t) => { t.classList.toggle('active', t.dataset.tab === name); t.setAttribute('aria-selected', t.dataset.tab === name); });
    $$('.tool-panel').forEach((p) => { p.hidden = p.dataset.panel !== name; });
    if (name === 'layers') renderLayers();
  }

  function syncPanels(fromUser) {
    const o = canvas.getActiveObject();
    const single = o && o.type !== 'activeSelection';
    $$('#objTools [data-act]').forEach((b) => { b.disabled = !o || (b.dataset.act === 'duplicate' && !single); });
    const isText = !!(single && o.kind === 'text');
    const isImg = !!(single && (o.kind === 'image' || o.kind === 'art'));
    $('#textProps').hidden = !isText;
    $('#textHeading').textContent = isText ? 'Edit selected text' : 'Add text';
    $('#addTextBtn').innerHTML = `${EH.icon('plus')} ${isText ? 'Add Another Text' : 'Add Text'}`;
    const ti = $('#textInput');
    if (isText) {
      if (document.activeElement !== ti) ti.value = o.text;
      $$('#fontGrid [data-font]').forEach((b) => b.classList.toggle('active', b.dataset.font === o.fontFamily));
      $$('#textColors [data-tcolor]').forEach((b) => b.classList.toggle('active', String(b.dataset.tcolor).toLowerCase() === String(o.fill).toLowerCase()));
      $$('[data-style="bold"]').forEach((b) => b.classList.toggle('active', o.fontWeight === 'bold' || +o.fontWeight >= 600));
      $$('[data-style="italic"]').forEach((b) => b.classList.toggle('active', o.fontStyle === 'italic'));
      $$('[data-align]').forEach((b) => b.classList.toggle('active', b.dataset.align === o.textAlign));
      $('#spacing').value = o.charSpacing; $('#spacingOut').textContent = o.charSpacing;
      $('#lineHeight').value = o.lineHeight; $('#lineOut').textContent = (+o.lineHeight).toFixed(2);
      $('#outline').value = o.strokeWidth; $('#outlineOut').textContent = o.strokeWidth;
    } else if (lastWasText) ti.value = '';
    lastWasText = isText;
    $('#imageProps').hidden = !isImg;
    if (isImg) {
      $('#opacity').value = o.opacity; $('#opacityOut').textContent = Math.round(o.opacity * 100) + '%';
      $('#removeWhite').checked = !!o.removeWhite;
      $('#whiteTolerance').value = o.whiteTolerance || 15;
      $('#whiteToleranceOut').textContent = (o.whiteTolerance || 15) + '%';
      $('#grayscale').checked = !!o.gray;
      $('#tracePhoto').checked = !!o.trace;
      $('#traceStrength').value = o.traceStrength || 4;
      $('#traceStrengthOut').textContent = o.traceStrength || 4;
    }
    if (fromUser && isText) switchTab('text');
    if (fromUser && single && o.kind === 'image') switchTab('image');
    renderLayers();
  }

  /* ---------------- exports ---------------- */
  function withCleanCanvas(fn) {
    exporting = true;
    const activeObj = canvas.getActiveObject();
    canvas.discardActiveObject();
    try { return fn(); } finally {
      exporting = false;
      if (activeObj && canvas.getObjects().includes(activeObj)) canvas.setActiveObject(activeObj);
      canvas.requestRenderAll();
    }
  }
  const exportMockup = (px = 1000, fmt = 'png', bg = null) => withCleanCanvas(() => {
    const prev = canvas.backgroundColor;
    if (bg) canvas.backgroundColor = bg;
    const url = canvas.toDataURL({ format: fmt, quality: 0.88, multiplier: px / canvas.getWidth() });
    canvas.backgroundColor = prev;
    return url;
  });
  const exportPrint = (px = 2400) => withCleanCanvas(() => {
    const bgI = canvas.backgroundImage, ovI = canvas.overlayImage;
    canvas.backgroundImage = null; canvas.overlayImage = null;
    const p = printRect(), z = canvas.getZoom();
    const url = canvas.toDataURL({ format: 'png', left: p.x * z, top: p.y * z, width: p.w * z, height: p.h * z, multiplier: px / (Math.max(p.w, p.h) * z) });
    canvas.backgroundImage = bgI; canvas.overlayImage = ovI;
    return url;
  });
  function designSummary() {
    return canvas.getObjects().map((o) => o.kind === 'text'
      ? `Text "${(o.text || '').replace(/\n/g, ' ')}" (${o.fontFamily}, ${o.fill})`
      : o.kind === 'art' ? `Artwork: ${o.name}` : `Uploaded image${o.name ? ` "${o.name}"` : ''}`).join(' · ');
  }
  function needsContent() {
    if (canvas.getObjects().length) return false;
    EH.toast('Add some text, an image or artwork to your design first', { type: 'error' });
    switchTab('text');
    return true;
  }
  function addToBag() {
    if (needsContent()) return false;
    if (!EH.requireSize($('#sumOpts'), S.type, S)) return false;
    const t = T();
    const customId = EH.uid();
    const image = exportMockup(420, 'jpeg', '#15121c');
    const ok = EH.cart.add({ custom: true, customId, name: 'Custom ' + t.label, type: S.type, color: S.color, size: S.size, model: S.model, qty: S.qty, price: unitPrice(), image, summary: designSummary() });
    if (!ok) return false;
    EH.files.put('print:' + customId, exportPrint(2400));
    EH.files.put('preview:' + customId, exportMockup(1200, 'png'));
    EH.toast('Your custom design was added to the bag', { action: { label: 'View bag', onClick: EH.openCart } });
    return true;
  }
  function preview() {
    if (needsContent()) return;
    const url = exportMockup(1000, 'png');
    const t = T();
    const m = EH.modal.open(`<h3>Your Preview</h3><p class="muted" style="font-size:13px;margin-bottom:16px">Custom ${t.label} · ${EH.esc(EH.optionMeta(S))}</p>
      <img class="preview-img" src="${url}" alt="Preview of your custom design">
      <div class="preview-actions">
        <button class="btn btn-ghost btn-sm" type="button" data-dl="mock">${EH.icon('download')} Preview</button>
        <button class="btn btn-ghost btn-sm" type="button" data-dl="print">${EH.icon('download')} Print File</button>
        <button class="btn btn-gold btn-sm" type="button" data-pv-add>${EH.icon('bag')} Add to Bag</button>
      </div>`, { noFocus: true });
    m.addEventListener('click', (e) => {
      const dl = e.target.closest('[data-dl]');
      if (dl) EH.download(dl.dataset.dl === 'mock' ? url : exportPrint(2400), `elitehub-${S.type}-${dl.dataset.dl === 'mock' ? 'preview' : 'print-file'}.png`);
      if (e.target.closest('[data-pv-add]')) { EH.modal.close(); addToBag(); }
    });
  }
  function downloadPrintArtwork() {
    if (needsContent()) return;
    try {
      EH.download(exportPrint(2400), `elitehub-${S.type}-print-artwork.png`);
      EH.toast('Transparent print artwork downloaded');
    } catch (error) {
      EH.toast('Could not create the print artwork. Try removing and re-adding the uploaded image.', { type: 'error' });
    }
  }

  /* ---------------- init ---------------- */
  async function init() {
    const loading = $('#stageLoading');
    if (!window.fabric) { loading.innerHTML = 'The design studio could not load. Please check your internet connection and refresh the page.'; return; }

    /* static panels */
    $('#fontGrid').innerHTML = FONTS.map((f) => `<button type="button" class="font-btn" data-font="${f}" style="font-family:'${f}';font-size:${['Bebas Neue', 'Anton', 'Oswald'].includes(f) ? 17 : 15}px" title="${f}">${f}</button>`).join('');
    $('#textColors').innerHTML = SWATCHES.map((c) => `<button type="button" class="color-dot" data-tcolor="${c}" aria-label="Text colour ${c}"><span style="background:${c}"></span></button>`).join('') + `<label class="color-pick" title="Custom colour">${EH.icon('plus')}<input type="color" id="customColor" aria-label="Custom text colour"></label>`;
    $('#tplList').innerHTML = TEMPLATES.map((t, i) => `<button type="button" class="tpl-btn" data-tpl="${i}" style="font-family:'${t.font}';${t.weight ? `font-weight:${t.weight};` : ''}${t.charSpacing ? `letter-spacing:${t.charSpacing / 1000}em;font-size:15px;` : ''}">${EH.esc(t.text.replace(/\n/g, ' '))}</button>`).join('');
    $('#artGrid').innerHTML = Object.keys(EH.designs).filter((id) => EH.designs[id].kind !== 'text').map((id) => `<button type="button" data-art="${id}" title="${EH.designs[id].name}" aria-label="Add ${EH.designs[id].name}">${EH.artwork(id, { ink: '#f3ede4' })}</button>`).join('');
    $('#sumShip').textContent = `Free shipping on orders over ${EH.money(EH.config.freeShippingThreshold)}`;

    /* make sure web fonts are ready before drawing text on the canvas */
    try { await Promise.race([Promise.all(FONTS.map((f) => document.fonts.load(`40px "${f}"`))), new Promise((r) => setTimeout(r, 4000))]); } catch (e) { /* continue with fallbacks */ }

    /* canvas */
    fabric.textureSize = 4096;
    fabric.Object.prototype.set({
      originX: 'center', originY: 'center', transparentCorners: false, cornerColor: '#e6bf86', cornerStrokeColor: '#1d140a',
      borderColor: '#e6bf86', cornerStyle: 'circle', cornerSize: 12, touchCornerSize: 30, borderScaleFactor: 1.4, padding: 6, borderDashArray: [5, 4]
    });
    const delImg = new Image();
    delImg.src = EH.svgToDataURL('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#e5484d"/><path d="M8 8l8 8M16 8l-8 8" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/></svg>');
    fabric.Object.prototype.controls.deleteControl = new fabric.Control({
      x: 0.5, y: -0.5, offsetX: 16, offsetY: -16, cursorStyle: 'pointer', cornerSize: 24,
      mouseUpHandler: () => { act('delete'); return true; },
      render(ctx, left, top) { ctx.save(); ctx.translate(left, top); ctx.drawImage(delImg, -11, -11, 22, 22); ctx.restore(); }
    });

    canvas = new fabric.Canvas('studioCanvas', { preserveObjectStacking: true, controlsAboveOverlay: true, allowTouchScrolling: true, selectionColor: 'rgba(230,191,134,.08)', selectionBorderColor: '#e6bf86', selectionLineWidth: 1 });
    EH.studio = { canvas, state: S };   // handy for debugging from the console

    /* dashed print-area guide (screen only, never exported) */
    canvas.on('after:render', (e) => {
      const ctx = (e && e.ctx) || canvas.contextContainer;
      if (exporting || ctx !== canvas.contextContainer) return;
      const v = canvas.viewportTransform, z = canvas.getZoom(), p = printRect(), cf = T().clipFabric;
      ctx.save();
      ctx.transform(v[0], v[1], v[2], v[3], v[4], v[5]);
      ctx.setLineDash([6 / z, 5 / z]);
      ctx.strokeStyle = 'rgba(230,191,134,.75)';
      ctx.lineWidth = 1.2 / z;
      if (cf && cf.kind === 'path' && window.Path2D) { ctx.scale(K, K); ctx.lineWidth = 1.2 / z / K; ctx.setLineDash([6 / z / K, 5 / z / K]); ctx.stroke(new Path2D(cf.d)); }
      else if (cf && cf.rx && ctx.roundRect) { ctx.beginPath(); ctx.roundRect(p.x, p.y, p.w, p.h, cf.rx * K); ctx.stroke(); }
      else ctx.strokeRect(p.x, p.y, p.w, p.h);
      ctx.restore();
    });

    /* initial state: URL params start a fresh design, otherwise resume the saved one */
    const q = EH.params;
    const fromParams = q.has('product') || q.has('design') || q.has('text');
    const saved = await EH.files.get('studio');
    if (saved) {
      Object.assign(assets, saved.assets || {});
      uploads = (saved.uploads || []).filter((u) => assets[u.id]);
    }
    let savedObjects = [];
    if (fromParams) {
      if (EH.types[q.get('product')]) S.type = q.get('product');
      const c = q.get('color');
      S.color = T().colors.includes(c) ? c : T().colors[0];
      const d = EH.defaultOptions(S.type, S.color);
      S.size = d.size; S.model = d.model;
    } else if (saved && saved.S && EH.types[saved.S.type]) {
      Object.assign(S, saved.S);
      if (!T().colors.includes(S.color)) S.color = T().colors[0];
      savedObjects = saved.objects || [];
    } else {
      const d = EH.defaultOptions(S.type, S.color);
      S.size = d.size; S.model = d.model;
    }

    renderProductUI();
    await Promise.all(uploads.map((u) => makeThumb(u.id)));
    renderUploads();
    fit();
    await setProduct();
    if ('ResizeObserver' in window) new ResizeObserver(() => fit()).observe($('#stageBox'));
    else window.addEventListener('resize', fit);

    if (savedObjects.length) await restoreObjects(savedObjects);
    else if (fromParams) {
      muted = true;
      if (q.get('design')) await applyDesign(q.get('design'));
      let demoImg = null;
      if (q.get('demo')) { try { demoImg = sessionStorage.getItem('eh_demo_img'); } catch (e) { /* ignore */ } }
      if (demoImg) {
        const id = 'up:' + EH.uid();
        assets[id] = demoImg;
        uploads = [{ id, name: 'Your photo' }].concat(uploads).slice(0, 9);
        await makeThumb(id);
        renderUploads();
        await addUpload(id, { frac: 0.62, offsetY: -0.1, select: false });
      }
      if (q.get('text')) addText({ text: q.get('text'), font: 'Great Vibes', size: 60, offsetY: demoImg ? 0.3 : 0, select: false });
      muted = false;
      canvas.discardActiveObject();
      hist = [];
      // drop the params so a refresh resumes this design instead of recreating it
      window.history.replaceState(null, '', 'customize.html');
    }
    loading.remove();
    pushHistory();
    syncPanels();

    /* ---------- canvas events ---------- */
    canvas.on('object:added', pushHistory);
    canvas.on('object:removed', pushHistory);
    canvas.on('object:modified', pushHistory);
    canvas.on('text:changed', () => { syncPanels(); pushSoon(); });
    canvas.on('text:editing:exited', pushHistory);
    canvas.on('selection:created', (e) => syncPanels(!!(e && e.e)));
    canvas.on('selection:updated', (e) => syncPanels(!!(e && e.e)));
    canvas.on('selection:cleared', () => syncPanels());

    /* ---------- tool panels ---------- */
    document.querySelector('.tool-tabs').addEventListener('click', (e) => { const t = e.target.closest('[data-tab]'); if (t) switchTab(t.dataset.tab); });
    $('#typeGrid').addEventListener('click', (e) => { const b = e.target.closest('[data-type]'); if (b) switchType(b.dataset.type); });
    EH.bindOptions($('#colorOpts'), S, (what) => { if (what === 'color') onColorChange(); });
    EH.bindOptions($('#sumOpts'), S, () => { renderPrice(); scheduleSave(); });

    const textInput = $('#textInput');
    textInput.addEventListener('input', () => {
      const o = canvas.getActiveObject();
      if (o && o.kind === 'text') { o.set('text', textInput.value || ' '); o.setCoords(); canvas.requestRenderAll(); renderLayers(); pushSoon(); }
    });
    $('#addTextBtn').addEventListener('click', () => {
      const o = canvas.getActiveObject();
      const val = o && o.kind === 'text' ? '' : textInput.value.trim();
      addText({ text: val || 'Your Text' });
      textInput.focus();
      textInput.select();
    });
    $('#tplList').addEventListener('click', (e) => {
      const b = e.target.closest('[data-tpl]');
      if (b) addText(TEMPLATES[+b.dataset.tpl]);
    });
    const withText = (fn) => { const o = canvas.getActiveObject(); if (o && o.kind === 'text') { fn(o); o.setCoords(); canvas.requestRenderAll(); syncPanels(); pushSoon(); } };
    $('#fontGrid').addEventListener('click', (e) => {
      const b = e.target.closest('[data-font]');
      if (!b) return;
      const f = b.dataset.font;
      document.fonts.load(`40px "${f}"`).catch(() => {}).then(() => withText((o) => { o.set('fontFamily', f); if (o.initDimensions) o.initDimensions(); }));
    });
    const setFill = (c) => withText((o) => {
      o.set({ fill: c, stroke: EH.color.isLight(c) ? '#111111' : '#ffffff' });
      o.autoInk = false;
    });
    $('#textColors').addEventListener('click', (e) => { const b = e.target.closest('[data-tcolor]'); if (b) setFill(b.dataset.tcolor); });
    $('#textColors').addEventListener('input', (e) => { if (e.target.id === 'customColor') setFill(e.target.value); });
    $$('[data-style]').forEach((b) => b.addEventListener('click', () => withText((o) => {
      if (b.dataset.style === 'bold') o.set('fontWeight', o.fontWeight === 'bold' || +o.fontWeight >= 600 ? 'normal' : 'bold');
      else o.set('fontStyle', o.fontStyle === 'italic' ? 'normal' : 'italic');
    })));
    $$('[data-align]').forEach((b) => b.addEventListener('click', () => withText((o) => o.set('textAlign', b.dataset.align))));
    $('#spacing').addEventListener('input', (e) => withText((o) => o.set('charSpacing', +e.target.value)));
    $('#lineHeight').addEventListener('input', (e) => withText((o) => o.set('lineHeight', +e.target.value)));
    $('#outline').addEventListener('input', (e) => withText((o) => o.set('strokeWidth', +e.target.value)));

    /* uploads */
    const fileInput = $('#fileInput');
    const dz = $('#dropzone');
    fileInput.addEventListener('change', () => { handleFile(fileInput.files[0]); fileInput.value = ''; });
    ['dragenter', 'dragover'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add('drag'); }));
    ['dragleave', 'drop'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove('drag'); }));
    dz.addEventListener('drop', (e) => handleFile(e.dataTransfer.files[0]));
    $('#stageBox').addEventListener('dragover', (e) => e.preventDefault());
    $('#stageBox').addEventListener('drop', (e) => { e.preventDefault(); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); });
    $('#uploads').addEventListener('click', (e) => { const b = e.target.closest('[data-upload]'); if (b) addUpload(b.dataset.upload); });
    const withImg = (fn) => { const o = canvas.getActiveObject(); if (o && o.type === 'image') { fn(o); canvas.requestRenderAll(); pushSoon(); } };
    const applyFilters = (o) => {
      const f = [];
      if (o.removeWhite) f.push(new fabric.Image.filters.RemoveColor({ color: '#FFFFFF', distance: (o.whiteTolerance || 15) / 100 }));
      if (o.gray || o.trace) f.push(new fabric.Image.filters.Grayscale());
      if (o.trace) {
        const strength = o.traceStrength || 4;
        const edge = strength / 4;
        f.push(new fabric.Image.filters.Convolute({ matrix: [0, -edge, 0, -edge, strength, -edge, 0, -edge, 0] }));
      }
      o.filters = f;
      o.applyFilters();
    };
    $('#opacity').addEventListener('input', (e) => withImg((o) => { o.set('opacity', +e.target.value); $('#opacityOut').textContent = Math.round(e.target.value * 100) + '%'; }));
    $('#removeWhite').addEventListener('change', (e) => withImg((o) => { o.removeWhite = e.target.checked; applyFilters(o); }));
    $('#grayscale').addEventListener('change', (e) => withImg((o) => { o.gray = e.target.checked; applyFilters(o); }));
    $('#whiteTolerance').addEventListener('input', (e) => {
      $('#whiteToleranceOut').textContent = e.target.value + '%';
      withImg((o) => { o.whiteTolerance = +e.target.value; if (o.removeWhite) applyFilters(o); });
    });
    $('#tracePhoto').addEventListener('change', (e) => withImg((o) => { o.trace = e.target.checked; applyFilters(o); }));
    $('#traceStrength').addEventListener('input', (e) => {
      $('#traceStrengthOut').textContent = e.target.value;
      withImg((o) => { o.traceStrength = +e.target.value; if (o.trace) applyFilters(o); });
    });

    /* art */
    $('#artGrid').addEventListener('click', (e) => { const b = e.target.closest('[data-art]'); if (b) addArt(b.dataset.art); });

    /* layers */
    $('#layerList').addEventListener('click', (e) => {
      const row = e.target.closest('[data-layer]');
      if (!row) return;
      const o = canvas.getObjects()[+row.dataset.layer];
      if (!o) return;
      const a = e.target.closest('[data-layer-act]');
      if (!a) { canvas.setActiveObject(o); canvas.requestRenderAll(); syncPanels(); return; }
      if (a.dataset.layerAct === 'up') canvas.bringForward(o);
      if (a.dataset.layerAct === 'down') canvas.sendBackwards(o);
      if (a.dataset.layerAct === 'del') { canvas.remove(o); return; }
      canvas.requestRenderAll();
      pushHistory();
    });

    /* toolbar */
    document.querySelector('.stage-view-toggle').addEventListener('click', (e) => {
      const button = e.target.closest('[data-stage-view]');
      if (button) setStageView(button.dataset.stageView);
    });
    document.querySelector('.preview3d-controls').addEventListener('click', (e) => {
      const button = e.target.closest('[data-3d-action]');
      if (!button || !window.EliteHub3D) return;
      const active = window.EliteHub3D.action(button.dataset['3dAction']);
      if (button.dataset['3dAction'] === 'auto') button.setAttribute('aria-pressed', String(active));
      if (button.dataset['3dAction'] === 'reset') document.querySelector('[data-3d-action="auto"]').setAttribute('aria-pressed', 'false');
    });
    document.addEventListener('elitehub:3d-ready', () => {
      if ($('#stageBox').classList.contains('view-3d')) setStageView('3d');
    });
    $('#modelFileInput').addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const status = $('#modelUploadStatus');
      const viewer = window.EliteHub3D;
      if (!viewer || !viewer.loadModel) {
        status.textContent = 'The 3D model viewer is unavailable. Refresh the page and try again.';
        status.dataset.state = 'error';
        e.target.value = '';
        return;
      }
      status.textContent = 'Loading your 3D product model…';
      status.dataset.state = '';
      const result = await viewer.loadModel(file);
      e.target.value = '';
      if (!result.ok) {
        status.textContent = result.message;
        status.dataset.state = 'error';
        return;
      }
      status.textContent = `${result.name} loaded. Your artwork will appear on its front.`;
      status.dataset.state = 'success';
      $('#clearModelBtn').hidden = false;
      setStageView('3d');
    });
    $('#clearModelBtn').addEventListener('click', () => {
      if (window.EliteHub3D) window.EliteHub3D.clearModel();
      $('#modelUploadStatus').textContent = 'Using the built-in product model.';
      $('#modelUploadStatus').dataset.state = '';
      $('#clearModelBtn').hidden = true;
      if ($('#stageBox').classList.contains('view-3d')) schedule3DRefresh();
    });
    $('#objTools').addEventListener('click', (e) => { const b = e.target.closest('[data-act]'); if (b) act(b.dataset.act); });
    $('#undoBtn').addEventListener('click', () => goHistory(hIndex - 1));
    $('#redoBtn').addEventListener('click', () => goHistory(hIndex + 1));
    $('#resetBtn').addEventListener('click', async () => {
      if (!canvas.getObjects().length) return;
      if (!(await EH.confirm('Start Over?', 'This removes everything from your design. You can still undo it afterwards.', 'Start Over'))) return;
      muted = true;
      canvas.getObjects().slice().forEach((o) => canvas.remove(o));
      muted = false;
      canvas.discardActiveObject();
      pushHistory();
      syncPanels();
    });

    /* summary */
    document.querySelector('.summary-card').addEventListener('click', (e) => {
      const b = e.target.closest('[data-sq]');
      if (b) { S.qty = Math.max(1, Math.min(20, S.qty + +b.dataset.sq)); $('#sumQty').value = S.qty; renderPrice(); scheduleSave(); }
    });
    $('#sumQty').addEventListener('change', (e) => { S.qty = Math.max(1, Math.min(20, parseInt(e.target.value, 10) || 1)); e.target.value = S.qty; renderPrice(); scheduleSave(); });
    $('#previewBtn').addEventListener('click', preview);
    $('#downloadPrintBtn').addEventListener('click', downloadPrintArtwork);
    $('#addCartBtn').addEventListener('click', addToBag);

    /* keyboard shortcuts */
    document.addEventListener('keydown', (e) => {
      const tag = (e.target.tagName || '').toLowerCase();
      if (['input', 'textarea', 'select'].includes(tag) || EH.modal.el) return;
      const o = canvas.getActiveObject();
      if (o && o.isEditing) return;
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (mod && k === 'z') { e.preventDefault(); goHistory(e.shiftKey ? hIndex + 1 : hIndex - 1); }
      else if (mod && k === 'y') { e.preventDefault(); goHistory(hIndex + 1); }
      else if (mod && k === 'd' && o) { e.preventDefault(); act('duplicate'); }
      else if ((e.key === 'Delete' || e.key === 'Backspace') && o) { e.preventDefault(); act('delete'); }
      else if (o && e.key.startsWith('Arrow')) {
        e.preventDefault();
        const d = e.shiftKey ? 10 : 2;
        if (e.key === 'ArrowLeft') o.left -= d;
        if (e.key === 'ArrowRight') o.left += d;
        if (e.key === 'ArrowUp') o.top -= d;
        if (e.key === 'ArrowDown') o.top += d;
        o.setCoords();
        canvas.requestRenderAll();
        pushSoon();
      }
    });
  }
})();
