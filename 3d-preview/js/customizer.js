/* EliteHub 3D studio: the customization window.
 * Wires the panels on 3d-preview/customizer.html to the Studio engine.
 *
 * URL options:
 *   ?id=<previewId>     reopen a saved preview (from Your account > Your 3D previews)
 *   ?template=<product>   start on a product
 *   ?start=upload       open on the "upload your 3D file" choice
 */
import { Studio, BACKDROPS, LIGHTING, VIEWS } from './studio/studio.js';
import {
  TEMPLATES, CATEGORIES, templateById, FABRIC_FINISHES, MUG_FINISHES,
  GLOSS_FINISHES, CUSHION_FINISHES, ACCEPTED_EXTENSIONS, MAX_UPLOAD_MB, ModelFileError,
} from './studio/models.js';
import { TEXT_FONTS } from './studio/textures.js';
import * as store from './store.js';

const EH = window.EH;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = (s) => EH.esc(s);
const icon = (n, c = '') => EH.icon(n, c);
const params = new URLSearchParams(location.search);

const CATALOGUE = '3d-preview/products.html';
const thumbSrc = (id) => `3d-preview/assets/products/${id}.jpg`;
const DEFAULT_NAME = 'Elite Hub 3D Studio';

const S = {
  previewId: null,
  cloudPaths: null,
  cloudSynced: false,
  cloudOwnerUid: null,
  name: DEFAULT_NAME,
  folderId: null,
  tab: 'product',
  designLayout: 'front',
  size: null,
  model: null,
  orderType: null,
  orderColor: null,
  qty: 1,
  dirty: false,
  loading: false,
  exportShape: 'square',
  exportRes: 2048,
  exportTransparent: false,
  videoSeconds: 8,
};

const DESIGN_LAYOUTS = [
  { id: 'front', label: 'Front' },
  { id: 'back', label: 'Back' },
  { id: 'side', label: 'Side' },
];

function layoutPreset(layout = S.designLayout) {
  const available = studio?.presets() || [];
  let ids;
  if (layout === 'front') ids = kind() === 'phonecase' ? ['back'] : ['front', 'chest', 'centre'];
  else if (layout === 'back') ids = kind() === 'phonecase' ? ['front'] : ['back'];
  else if (kind() === 'mug') ids = ['left', 'right', 'side'];
  else if (kind() === 'phonecase') ids = ['side', 'right', 'left'];
  else ids = ['side', 'right', 'left', 'sleeveL', 'sleeveR'];
  return available.find((p) => ids.includes(p.id)) || null;
}

function layoutFromPresetId(id) {
  if (!id) return null;
  if (kind() === 'phonecase') {
    if (id === 'back') return 'front';
    if (id === 'front') return 'back';
  }
  if (['side', 'right', 'left', 'sleeveL', 'sleeveR'].includes(id)) return 'side';
  return id === 'back' ? 'back' : 'front';
}

function updateDesignLayoutButtons() {
  const group = $('#designLayouts');
  if (!group) return;
  $$('[data-design-layout]', group).forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.designLayout === S.designLayout));
  });
}

function syncDesignLayoutFromSelection() {
  const layer = studio?.layers.find((item) => item.id === studio.selectedId);
  const layout = layoutFromPresetId(layer?.presetId);
  if (layout) S.designLayout = layout;
  updateDesignLayoutButtons();
}

function selectDesignLayout(layout) {
  if (!DESIGN_LAYOUTS.some((item) => item.id === layout)) return;
  S.designLayout = layout;
  const preset = layoutPreset(layout);
  if (studio.settings.turntable) {
    studio.setScene({ turntable: false });
    syncSpin();
  }
  const view = layout === 'side'
    ? (preset && ['left', 'sleeveL'].includes(preset.id) ? 'left' : 'right')
    : layout;
  studio.setView(view);
  const selected = studio.layers.find((item) => item.id === studio.selectedId);
  if (selected && preset) studio.applyPreset(selected.id, preset.id);
  renderDesign();
  renderLayerEditor();
}
let studio;
let backgroundRemovalPipeline;

async function init() {
  store.followAuth();
  studio = new Studio($('#stage'));
  window.EHStudio = studio; // handy for debugging in the console

  bindTabs();
  bindLayoutToolbar();
  bindStage();
  bindFileInputs();
  renderViews();
  $('#newPreview').addEventListener('click', () => confirmDiscard().then((ok) => ok && openStartChooser()));
  $('#spinToggle').addEventListener('click', () => {
    const on = !studio.settings.turntable;
    studio.setScene({ turntable: on });
    syncSpin();
    if (S.tab === 'scene') renderScene();
  });

  studio.addEventListener('model', (e) => { if (!e.detail.paramsOnly) { resetOptions(); S.designLayout = 'front'; } renderAll(); });
  studio.addEventListener('layers', () => { renderLayerList(); renderLayerEditor(true); updateDesignLayoutButtons(); syncLayoutToolbar(); markDirty(); });
  studio.addEventListener('select', () => { syncDesignLayoutFromSelection(); renderLayerList(); renderLayerEditor(); syncLayoutToolbar(); });
  studio.addEventListener('view', (e) => {
    $$('#views button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === e.detail.view)));
    syncSpin();
  });

  window.addEventListener('beforeunload', (e) => { if (S.dirty) { e.preventDefault(); e.returnValue = ''; } });
  document.addEventListener('keydown', onKeyDown);
  store.onChange(() => { if (S.previewId) renderActions(); });

  const id = params.get('id');
  const template = params.get('template') || params.get('product');
  if (id) {
    await authSettled();
    const rec = await store.getPreview(id);
    if (rec) return openSaved(rec);
    EH.toast("That preview isn't saved on this device or account.", { type: 'error' });
  }
  const requestedTemplate = template === 'tshirt' ? 'tee' : template;
  const activeTemplate = TEMPLATES.some((t) => t.id === requestedTemplate) ? requestedTemplate : 'tee';
  await withLoading('Loading model', () => studio.loadTemplate(activeTemplate));
  const colorId = params.get('color')?.toLowerCase();
  const color = colorId && EH.colors?.[colorId];
  if (color?.hex) studio.setAppearance({ ...studio.appearance, color: color.hex });
  S.dirty = false;
  renderAll();

  let seededDesign = false;
  const designId = params.get('design');
  if (designId && EH.designs?.[designId] && EH.artwork && EH.svgToDataURL) {
    const artwork = EH.artwork(designId, { fill: true, noText: false });
    if (artwork) {
      const artworkBase = new URL('assets/', document.baseURI).href;
      const portableArtwork = artwork.replace(/href=["']assets\//g, 'href="' + artworkBase);
      await studio.addLayer({ type: 'image', src: EH.svgToDataURL(portableArtwork), name: EH.designs[designId].name || 'Product artwork', presetId: layoutPreset()?.id });
      seededDesign = true;
    }
  }
  let demoImage = null;
  if (params.get('demo') === '1') {
    try { demoImage = sessionStorage.getItem('eh_demo_img'); } catch (e) { /* ignore unavailable storage */ }
  }
  if (demoImage && /^data:image\//i.test(demoImage)) {
    await studio.addLayer({ type: 'image', src: demoImage, name: 'Uploaded artwork', presetId: layoutPreset()?.id });
    seededDesign = true;
  }
  const initialText = params.get('text')?.trim().slice(0, 60);
  if (initialText) {
    const textColor = EH.color.isLight(studio.appearance.color || '#ffffff') ? '#17151b' : '#f3eee7';
    await studio.addLayer({ type: 'text', text: initialText, name: initialText, color: textColor, presetId: layoutPreset()?.id });
    seededDesign = true;
  }
  if (seededDesign) setTab('design');
  if (!template) openStartChooser({ focusUpload: params.get('start') === 'upload' });
}

/* Firebase decides which account's previews we can open; give it a moment. */
function authSettled() {
  const api = window.EHFirebase;
  if (api) return Promise.race([api.ready, wait(4000)]);
  return new Promise((resolve) => {
    const done = () => { const a = window.EHFirebase; (a ? Promise.race([a.ready, wait(4000)]) : Promise.resolve()).then(resolve); };
    document.addEventListener('firebase:ready', done, { once: true });
    setTimeout(resolve, 5000);
  });
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function openSaved(rec) {
  await withLoading('Opening your preview', () => studio.setState(rec.state, rec.file || null));
  S.previewId = rec.id;
  S.name = rec.name;
  S.folderId = rec.folderId || null;
  S.cloudPaths = rec.cloudPaths || null;
  S.cloudSynced = !!rec.cloudSynced;
  S.cloudOwnerUid = rec.cloudOwnerUid || null;
  S.orderType = rec.orderType || null;
  S.orderColor = rec.orderColor || null;
  resetOptions();
  S.dirty = false;
  renderAll();
}

/* ------------------------------------------------------------------ */
/* Tabs                                                                */
/* ------------------------------------------------------------------ */
function bindTabs() {
  const tabs = $$('.p3d-tab');
  tabs.forEach((t) => t.addEventListener('click', () => setTab(t.dataset.tab)));
  $('.p3d-tabs').addEventListener('keydown', (e) => {
    const i = tabs.findIndex((t) => t.dataset.tab === S.tab);
    let j = null;
    if (e.key === 'ArrowRight') j = (i + 1) % tabs.length;
    if (e.key === 'ArrowLeft') j = (i - 1 + tabs.length) % tabs.length;
    if (e.key === 'Home') j = 0;
    if (e.key === 'End') j = tabs.length - 1;
    if (j !== null) { e.preventDefault(); setTab(tabs[j].dataset.tab); tabs[j].focus(); }
  });
}

function bindLayoutToolbar() {
  const toolbar = $('#layoutToolbar');
  toolbar.addEventListener('click', async (e) => {
    const layout = e.target.closest('[data-design-layout]');
    if (layout) return selectDesignLayout(layout.dataset.designLayout);
    const action = e.target.closest('[data-layout-act]')?.dataset.layoutAct;
    try {
      if (action === 'add-text') return addTextFromToolbar();
      if (action === 'upload') return $('#artInput').click();
      if (action === 'save') return save();
      if (action === 'load') return openSavedLayoutChooser();
      if (action === 'reset') return resetDesignLayers();
    } catch (error) {
      console.error(error);
      EH.toast(error.message || 'That design action could not be completed.', { type: 'error' });
    }
  });
  $('#layoutTextColor').addEventListener('input', (e) => {
    const layer = studio.layers.find((item) => item.id === studio.selectedId);
    if (layer?.type === 'text') studio.updateLayer(layer.id, { color: e.target.value });
  });
}

function syncLayoutToolbar() {
  const color = $('#layoutTextColor');
  if (!color || !studio) return;
  const selected = studio.layers.find((item) => item.id === studio.selectedId);
  color.disabled = selected?.type !== 'text';
  color.value = selected?.type === 'text' && /^#[0-9a-f]{6}$/i.test(selected.color) ? selected.color : '#17151b';
  updateDesignLayoutButtons();
}

function addTextFromToolbar() {
  const initialColor = EH.color.isLight(studio.appearance.color || '#ffffff') ? '#17151b' : '#f3eee7';
  const modal = EH.modal.open(`
    <h3>Add text to your design</h3>
    <form class="p3d-form" data-layout-text-form>
      <div class="field"><label for="layoutTextValue">Text</label><input class="input" id="layoutTextValue" maxlength="60" required placeholder="Type text to print" autocomplete="off"></div>
      <div class="form-grid">
        <div class="field"><label for="layoutFont">Font</label><select class="select" id="layoutFont">${TEXT_FONTS.map((font) => `<option value="${font.id}">${esc(font.label)}</option>`).join('')}</select></div>
        <div class="field"><label for="layoutTextColorNew">Text colour</label><input class="input" id="layoutTextColorNew" type="color" value="${initialColor}"></div>
      </div>
      <div class="preview-actions"><button class="btn btn-ghost btn-sm" type="button" data-close-modal>Cancel</button><button class="btn btn-gold btn-sm" type="submit">Add text</button></div>
    </form>`);
  const input = $('#layoutTextValue', modal);
  input.focus();
  $('[data-layout-text-form]', modal).addEventListener('submit', async (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text) return input.focus();
    EH.modal.close();
    setTab('design');
    await studio.addLayer({
      type: 'text', text, name: text,
      color: $('#layoutTextColorNew', modal).value,
      font: $('#layoutFont', modal).value,
      presetId: layoutPreset()?.id,
    });
  });
}

async function openSavedLayoutChooser() {
  const previews = await store.listPreviews();
  if (!previews.length) return EH.toast('There are no saved layouts on this account yet.');
  const modal = EH.modal.open(`
    <h3>Load a saved layout</h3>
    <p class="muted p3d-modal-lead">Choose one of your saved 3D designs.</p>
    <div class="p3d-saved-layouts">${previews.map((preview) => `<button type="button" class="p3d-saved-layout" data-load-layout="${esc(preview.id)}"><img src="${esc(preview.thumbnail || '')}" alt=""><span><b>${esc(preview.name)}</b><small>${esc(preview.product || 'Custom product')}</small></span></button>`).join('')}</div>`);
  modal.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-load-layout]');
    if (!button) return;
    const preview = await store.getPreview(button.dataset.loadLayout);
    if (!preview) return EH.toast('That saved layout is no longer available.', { type: 'error' });
    if (!(await confirmDiscard())) return;
    EH.modal.close();
    await openSaved(preview);
    setTab('design');
  });
}

async function resetDesignLayers() {
  if (!studio.layers.length) return;
  const discard = await EH.confirm('Reset this layout?', 'This removes all text and artwork from the product.', 'Reset layout');
  if (!discard) return;
  for (const layer of [...studio.layers]) studio.removeLayer(layer.id);
  S.designLayout = 'front';
  updateDesignLayoutButtons();
  studio.setView('front');
  syncLayoutToolbar();
}

function setTab(tab) {
  S.tab = tab;
  $$('.p3d-tab').forEach((t) => {
    const on = t.dataset.tab === tab;
    t.classList.toggle('active', on);
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
  });
  $$('.p3d-panel').forEach((p) => { p.hidden = p.id !== `panel-${tab}`; });
  studio.setEditing(tab === 'design');
  $('#layoutToolbar').hidden = tab !== 'design';
  $('#stageHint').textContent = tab === 'design' && studio.layers.length
    ? 'Drag artwork to move it; use an edge handle to stretch one way or a corner handle to stretch both ways.'
    : 'Drag to rotate. Scroll or pinch to zoom.';
  syncLayoutToolbar();
  $('.p3d-panels').scrollTop = 0;
}

function renderAll() {
  renderProduct();
  renderDesign();
  renderFinish();
  renderScene();
  renderExport();
  renderActions();
  syncLayoutToolbar();
  syncSpin();

  document.title = 'Elite Hub 3D Studio — EliteHub';
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */
const kind = () => (studio.model?.kind === 'upload' ? 'upload' : studio.model?.template || 'tee');
const tpl = () => templateById(kind());
/** EliteHub product type this can be ordered as (js/mockups.js), or null for preview-only. */
const shopType = () => kind() === 'upload' ? (EH.types[S.orderType] ? S.orderType : null) : (tpl()?.shop || null);
/** Which EliteHub palette the colour swatches come from. */
const paletteType = () => shopType() || (tpl()?.garment ? 'tshirt' : null);
const catalogueColorId = () => {
  const type = paletteType();
  if (!type) return null;
  if (kind() === 'upload') return EH.types[type].colors.includes(S.orderColor) ? S.orderColor : null;
  const hex = String(studio.appearance.color || '').toLowerCase();
  return EH.types[type].colors.find((c) => EH.colors[c].hex.toLowerCase() === hex) || null;
};
const productLabel = () => (kind() === 'upload' ? studio.model.fileName : tpl()?.label || 'Product');
/** T-shirts and hoodies make people choose a size; other products start on their first size. */
const needsSizeChoice = () => ['tshirt', 'hoodie'].includes(shopType());
function resetOptions() {
  const type = shopType();
  const d = type ? EH.defaultOptions(type) : { size: null, model: null };
  S.size = d.size;
  S.model = d.model;
  if (type === 'phonecase') {
    const savedModel = studio.model?.params?.phoneModel;
    const requestedModel = params.has('id') ? savedModel : (params.get('model') || savedModel);
    S.model = EH.types.phonecase.models.includes(requestedModel) ? requestedModel : (d.model || EH.types.phonecase.models[0]);
    if (kind() !== 'upload' && studio.model?.params?.phoneModel !== S.model) studio.setParams({ phoneModel: S.model });
  }
}

function markDirty() {
  if (S.loading) return;
  S.dirty = true;
  renderActions();
}

async function withLoading(text, fn) {
  S.loading = true;
  $('#loadingText').textContent = text;
  $('#loading').hidden = false;
  try { return await fn(); }
  finally { $('#loading').hidden = true; S.loading = false; }
}

function productThumb(k = kind()) {
  if (templateById(k)) return `<img src="${thumbSrc(k)}" alt="" loading="lazy">`;
  return `<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M50 14 84 32v36L50 86 16 68V32z"/><path d="M16 32l34 18 34-18M50 50v36"/><path d="M33 23l34 18" stroke-dasharray="3 4"/></svg>`;
}

function seg(name, options, value, label) {
  return `<div class="p3d-seg" role="radiogroup" aria-label="${esc(label)}">${options.map((o) =>
    `<button type="button" role="radio" aria-checked="${String(o.id) === String(value)}" data-${name}="${esc(o.id)}">${esc(o.label)}</button>`).join('')}</div>`;
}

function swatches(list, value, attr = 'data-hex') {
  return `<div class="swatches">${list.map((c) =>
    `<button type="button" class="swatch ${c.hex.toLowerCase() === String(value).toLowerCase() ? 'active' : ''}" ${attr}="${c.hex}" aria-label="${esc(c.label)}" title="${esc(c.label)}"><span style="background:${c.hex}"></span></button>`).join('')}
    <label class="swatch p3d-custom-swatch ${list.some((c) => c.hex.toLowerCase() === String(value).toLowerCase()) ? '' : 'active'}" title="Custom colour">
      <span style="background:${list.some((c) => c.hex.toLowerCase() === String(value).toLowerCase()) ? 'conic-gradient(#e6bf86,#b8a7d9,#1f2746,#5c1d28,#e6bf86)' : value}"></span>
      <input type="color" value="${/^#[0-9a-f]{6}$/i.test(value) ? value : '#e6bf86'}" data-custom-color aria-label="Custom colour">
    </label></div>`;
}

const slug = (s) => String(s || 'elitehub-3d').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'elitehub-3d';

/* ------------------------------------------------------------------ */
/* Product tab                                                         */
/* ------------------------------------------------------------------ */
function phoneModelOptions(models, selected) {
  const groups = [
    { label: 'Apple', match: (m) => m.startsWith('iPhone') },
    { label: 'Samsung', match: (m) => m.startsWith('Galaxy') },
    { label: 'Google', match: (m) => m.startsWith('Pixel') },
    { label: 'OnePlus', match: (m) => m.startsWith('OnePlus') },
    { label: 'Xiaomi, Redmi & POCO', match: (m) => /^(Xiaomi|Redmi|POCO)/.test(m) },
    { label: 'OPPO', match: (m) => m.startsWith('OPPO') },
    { label: 'vivo', match: (m) => m.startsWith('vivo') },
    { label: 'Motorola', match: (m) => /^(motorola|moto )/i.test(m) },
    { label: 'realme', match: (m) => m.startsWith('realme') },
    { label: 'Nothing', match: (m) => m.startsWith('Nothing') },
  ];
  return groups.map((group) => {
    const choices = models.filter(group.match);
    return choices.length ? '<optgroup label="' + esc(group.label) + '">' + choices.map((model) => '<option value="' + esc(model) + '"' + (model === selected ? ' selected' : '') + '>' + esc(model) + '</option>').join('') + '</optgroup>' : '';
  }).join('');
}
function renderProduct() {
  const el = $('#panel-product');
  const k = kind();
  const m = studio.model || {};
  const sub = k === 'upload'
    ? `Your 3D file. ${Number(m.stats?.triangles || 0).toLocaleString('en-IN')} triangles`
    : TEMPLATES.find((t) => t.id === k)?.note;
  let options = '';
  if (k === 'upload') {
    options += `<div class="field"><label for="orderType">Order this design as</label><select class="select" id="orderType" data-order-type>
      <option value="">Choose a store product</option>
      ${Object.entries(EH.types).map(([id, product]) => `<option value="${esc(id)}" ${id === S.orderType ? 'selected' : ''}>${esc(product.label)} - ${EH.money(product.basePrice)}</option>`).join('')}
    </select><p class="p3d-note">Your design uses the current store price for the selected product.</p></div>`;
  }
  const type = shopType();
  const T = type ? EH.types[type] : null;
  if (T?.sizes) {
    options += `<div class="opt-block" data-size-block><div class="opt-label"><span>Size: <b data-size-name>${S.size || 'Select a size'}</b></span>${needsSizeChoice() ? '<button type="button" data-size-guide>Size guide</button>' : ''}</div>
      <div class="sizes">${T.sizes.map((s) => `<button type="button" class="size-btn ${s === S.size ? 'active' : ''}" data-size="${esc(s)}">${esc(s)}${T.sizeAdd?.[s] ? ` <small class="muted">+${EH.money(T.sizeAdd[s])}</small>` : ''}</button>`).join('')}</div>
      ${needsSizeChoice() ? '<p class="p3d-note">Needed only when you add it to your bag.</p>' : ''}</div>`;
  }
  if (T?.models) {
    options += '<div class="field"><label for="phoneModel">Phone model</label><select class="select" id="phoneModel" data-phone-model>' + phoneModelOptions(T.models, S.model) + '</select></div>';
  }
  if (k === 'mug') {
    options += `<p class="p3d-note">330 ml ceramic, microwave and dishwasher safe. Prints wrap around the side, so check the edges in the 3/4 view.</p>`;
  } else if (tpl()?.garment && !type) {
    options += `<p class="p3d-note">Preview only for now: this style isn't in the EliteHub shop yet. You can still design it, save it and download images.</p>`;
  } else if (k === 'upload') {
    options += `<button class="btn btn-ghost btn-sm" type="button" data-act="replace">${icon('upload')} Replace file</button>
      <p class="p3d-note">Textures must be inside the file. If your model looks grey, export it as .glb with textures embedded.</p>`;
  }

  el.innerHTML = `
    <div class="selected-product-line p3d-current">
      <div class="selected-product-thumb">${productThumb()}</div>
      <div><h3>${esc(productLabel())}</h3><p>${esc(sub || '')}</p></div>
      ${shopType() ? `<b>${EH.money(EH.types[shopType()].basePrice)}</b>` : ''}
    </div>
    ${options}
    <div class="p3d-layer-head"><h3 class="p3d-h">Switch product</h3><a class="p3d-link" href="${CATALOGUE}">Full catalogue</a></div>
    <div class="p3d-templates">${TEMPLATES.map((t) => `
      <button type="button" class="p3d-template ${k === t.id ? 'active' : ''}" data-template="${t.id}" aria-pressed="${k === t.id}">
        <span class="p3d-template-art">${productThumb(t.id)}</span>
        <b>${esc(t.label)}</b><small>${t.shop ? EH.money(EH.types[t.shop].basePrice) : 'Preview only'}</small>
      </button>`).join('')}</div>
    <h3 class="p3d-h">Or upload your own 3D mockup</h3>
    <button type="button" class="studio-dropzone p3d-dropzone" data-act="upload">
      <span class="upload-icon-wrap">${icon('upload')}</span>
      <strong>Upload a 3D file</strong>
      <span>GLB, GLTF, OBJ, STL or FBX, up to ${MAX_UPLOAD_MB} MB</span>
    </button>
    <p class="p3d-note">Your original file is included with your order. Save the preview to your account to sync it across devices.</p>`;

  el.onclick = async (e) => {
    const t = e.target.closest('[data-template]');
    if (t && t.dataset.template !== kind()) {
      S.orderType = null;
      S.orderColor = null;
      await withLoading('Loading model', () => studio.loadTemplate(t.dataset.template));
      markDirty();
      return;
    }
    const sz = e.target.closest('[data-size]');
    if (sz) { S.size = sz.dataset.size; renderProduct(); renderActions(); return; }
    if (e.target.closest('[data-size-guide]')) { EH.sizeGuide(); return; }
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'upload' || act === 'replace') $('#modelInput').click();
  };
  el.onchange = (e) => {
    if (e.target.matches('[data-order-type]')) {
      S.orderType = EH.types[e.target.value] ? e.target.value : null;
      S.orderColor = S.orderType ? (EH.types[S.orderType].colors[0] || null) : null;
      resetOptions();
      renderAll();
      markDirty();
      return;
    }
    if (e.target.matches('[data-phone-model]')) {
      S.model = e.target.value;
      if (kind() !== 'upload') studio.setParams({ phoneModel: S.model });
      markDirty();
    }
  };
}

/* ------------------------------------------------------------------ */
/* Design tab: artwork + text layers                                   */
/* ------------------------------------------------------------------ */
function renderDesign() {
  const el = $('#panel-design');
  el.innerHTML = '<p class="p3d-note">Use the layout bar above the preview to choose Front, Back or Sleeves, add text or artwork, and save your layout. Drag a design on the product to move it; use an edge handle to stretch one way or a corner handle to stretch both ways.</p>' +
    '<div class="p3d-layer-head"><h3 class="p3d-h">Layers</h3><span class="muted" id="layerCount"></span></div>' +
    '<ul class="p3d-layers" id="layerList"></ul>' +
    '<div id="layerEditor"></div>';
  renderLayerList();
  renderLayerEditor();
}

function placementLabel(l) {
  if (!l.presetId) return 'Custom position';
  return studio.handle?.presets.find((p) => p.id === l.presetId)?.label || 'Custom position';
}

function renderLayerList() {
  const list = $('#layerList');
  if (!list) return;
  const layers = [...studio.layers].reverse();
  $('#layerCount').textContent = layers.length ? `${layers.length}` : '';
  if (!layers.length) {
    list.innerHTML = `<li class="p3d-empty">Add artwork or text. It lands on the side you're looking at; then drag it across the model to place it.</li>`;
    return;
  }
  list.innerHTML = layers.map((l) => `
    <li class="p3d-layer ${l.id === studio.selectedId ? 'active' : ''}" data-layer="${l.id}">
      <button type="button" class="p3d-layer-main" data-select="${l.id}" aria-pressed="${l.id === studio.selectedId}">
        <span class="p3d-layer-thumb">${l.type === 'image' ? `<img src="${esc(l.src)}" alt="">` : `<span style="color:${esc(l.color)}">Aa</span>`}</span>
        <span class="p3d-layer-text"><b>${esc(l.type === 'text' ? `“${l.text}”` : l.name)}</b><small>${esc(placementLabel(l))}</small></span>
      </button>
      <button type="button" class="icon-btn" data-toggle="${l.id}" aria-pressed="${!l.visible}" aria-label="${l.visible ? 'Hide' : 'Show'} ${esc(l.name)}" title="${l.visible ? 'Hide' : 'Show'}">${icon(l.visible ? 'eye' : 'x')}</button>
      <button type="button" class="icon-btn" data-remove="${l.id}" aria-label="Remove ${esc(l.name)}" title="Remove">${icon('trash')}</button>
    </li>`).join('');
  list.onclick = (e) => {
    const sel = e.target.closest('[data-select]');
    if (sel) studio.select(sel.dataset.select === studio.selectedId ? null : sel.dataset.select);
    const tog = e.target.closest('[data-toggle]');
    if (tog) { const l = studio.layers.find((x) => x.id === tog.dataset.toggle); studio.updateLayer(l.id, { visible: !l.visible }); }
    const rm = e.target.closest('[data-remove]');
    if (rm) studio.removeLayer(rm.dataset.remove);
  };
}

/** Re-renders the selected layer's controls. With `soft`, only refreshes values (keeps sliders under the pointer). */
function renderLayerEditor(soft = false) {
  const box = $('#layerEditor');
  if (!box) return;
  const l = studio.layers.find((x) => x.id === studio.selectedId);
  if (!l) { box.innerHTML = ''; box.dataset.for = ''; return; }
  if (soft && box.dataset.for === l.id) {
    $$('[data-preset]', box).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.preset === l.presetId)));
    return;
  }
  box.dataset.for = l.id;
  const presets = studio.presets();
  const colors = [...new Set(['black', 'white', 'gold', 'navy', 'maroon', 'beige', 'lavender'])].map((c) => ({ id: c, label: EH.colors[c].name, hex: EH.colors[c].hex }));
  box.innerHTML = `
    <div class="p3d-edit">
      ${l.type === 'text' ? `
        <div class="field"><label for="layerText">Text</label><textarea class="textarea p3d-textarea" id="layerText" rows="2" maxlength="120" data-prop="text">${esc(l.text)}</textarea></div>
        <div class="field"><label for="layerFont">Font</label><select class="select" id="layerFont" data-prop="font">${TEXT_FONTS.map((f) => `<option value="${f.id}" ${f.id === l.font ? 'selected' : ''}>${f.label}</option>`).join('')}</select></div>
        <div class="opt-block p3d-opt"><div class="opt-label"><span>Text colour</span></div>${swatches(colors, l.color, 'data-text-color')}</div>` : ''}
      ${l.type === 'image' ? `
        <div class="p3d-row">
          <button class="btn btn-outline btn-sm" type="button" data-layer-act="remove-background">${icon('sparkles')} Remove background (AI)</button>
          ${l.originalSrc ? `<button class="btn btn-ghost btn-sm" type="button" data-layer-act="restore-image">Restore original</button>` : ''}
        </div>
        <p class="p3d-note" data-background-status>Runs in your browser. Use an edge handle to stretch one way or a corner handle to stretch both ways.</p>` : ''}
      <div class="opt-block p3d-opt"><div class="opt-label"><span>Position</span></div>
        <div class="p3d-chips">${presets.map((p) => `<button type="button" class="chip-btn" data-preset="${p.id}" aria-pressed="${p.id === l.presetId}">${esc(p.label)}</button>`).join('')}</div>
        <p class="p3d-note">Or drag the artwork on the model.</p>
      </div>
      <label class="p3d-range"><span>Rotation <output data-out="rotation">${Math.round(l.rotation)}°</output></span>
        <input type="range" min="-180" max="180" step="1" value="${l.rotation}" data-prop="rotation"></label>
      <label class="p3d-range"><span>Opacity <output data-out="opacity">${Math.round(l.opacity * 100)}%</output></span>
        <input type="range" min="0.1" max="1" step="0.01" value="${l.opacity}" data-prop="opacity"></label>
      <div class="p3d-row">
        <button class="btn btn-ghost btn-sm" type="button" data-layer-act="duplicate">${icon('copy')} Duplicate</button>
        <button class="btn btn-ghost btn-sm" type="button" data-layer-act="up" title="Bring forward">${icon('up')} Forward</button>
        <button class="btn btn-ghost btn-sm" type="button" data-layer-act="down" title="Send backward">${icon('down')} Back</button>
      </div>
    </div>`;

  box.oninput = (e) => {
    const prop = e.target.dataset.prop;
    if (!prop) return;
    if (prop === 'rotation' || prop === 'opacity') {
      const v = Number(e.target.value);
      const out = $(`[data-out="${prop}"]`, box);
      if (out) out.textContent = prop === 'rotation' ? `${Math.round(v)}°` : `${Math.round(v * 100)}%`;
      studio.updateLayer(l.id, { [prop]: v });
    } else if (prop === 'text') {
      clearTimeout(box._t);
      box._t = setTimeout(() => { const t = e.target.value || ' '; studio.updateLayer(l.id, { text: t, name: t }); }, 250);
    }
  };
  box.onchange = (e) => {
    if (e.target.dataset.prop === 'font') studio.updateLayer(l.id, { font: e.target.value });
    if (e.target.matches('[data-custom-color]')) { studio.updateLayer(l.id, { color: e.target.value }); renderLayerEditor(); }
  };
  box.onclick = (e) => {
    const p = e.target.closest('[data-preset]');
    if (p) { S.designLayout = layoutFromPresetId(p.dataset.preset) || S.designLayout; studio.applyPreset(l.id, p.dataset.preset); updateDesignLayoutButtons(); renderLayerEditor(); return; }
    const c = e.target.closest('[data-text-color]');
    if (c) { studio.updateLayer(l.id, { color: c.dataset.textColor }); renderLayerEditor(); return; }
    const a = e.target.closest('[data-layer-act]')?.dataset.layerAct;
    if (a === 'duplicate') studio.duplicateLayer(l.id);
    if (a === 'up') studio.moveLayer(l.id, 1);
    if (a === 'down') studio.moveLayer(l.id, -1);
    if (a === 'remove-background') removeImageBackground(l.id, e.target.closest('[data-layer-act]'));
    if (a === 'restore-image' && l.originalSrc) {
      studio.updateLayer(l.id, { src: l.originalSrc, originalSrc: null });
      markDirty();
      renderLayerEditor();
    }
  };
}

async function removeImageBackground(layerId, button) {
  const layer = studio.layers.find((item) => item.id === layerId);
  if (!layer || layer.type !== 'image' || !button) return;
  button.disabled = true;
  const status = $('[data-background-status]', $('#layerEditor'));
  if (status) status.textContent = 'Loading the in-browser AI model… The first download may take a moment.';
  try {
    if (!backgroundRemovalPipeline) {
      backgroundRemovalPipeline = import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.2')
        .then(({ pipeline }) => pipeline('background-removal', 'Xenova/modnet', {
          dtype: 'q8',
          progress_callback: (event) => {
            const progress = Number(event.progress);
            if (status && Number.isFinite(progress)) status.textContent = `Downloading background-removal model… ${Math.round(progress)}%`;
          },
        }))
        .catch((error) => {
          backgroundRemovalPipeline = null;
          throw error;
        });
    }
    const remover = await backgroundRemovalPipeline;
    if (status) status.textContent = 'Removing the background…';
    const output = await remover(layer.src);
    if (!output?.[0]) throw new Error('The AI model did not return a cutout.');
    const blob = await output[0].toBlob();
    if (!blob || !blob.size) throw new Error('The AI model returned an empty image.');
    const src = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('The transparent image could not be read.'));
      reader.readAsDataURL(blob);
    });
    await studio.updateLayer(layer.id, { src, originalSrc: layer.originalSrc || layer.src });
    markDirty();
    renderLayerEditor();
    EH.toast('Background removed. You can restore the original image anytime.');
  } catch (error) {
    console.error('In-browser background removal failed.', error);
    if (status) status.textContent = 'Background removal failed. Check your connection and try again.';
    EH.toast(error.message || 'Background removal failed. Please try again.', { type: 'error', duration: 6000 });
  } finally {
    if (button.isConnected) button.disabled = false;
  }
}

async function addArtworkFile(file) {
  try {
    const src = await EH.readImage(file, 2048);
    if (S.tab !== 'design') setTab('design');
    await studio.addLayer({ type: 'image', src, name: file.name, presetId: layoutPreset()?.id });
  } catch (err) {
    EH.toast(err.message || 'That image could not be added.', { type: 'error' });
  }
}

/* ------------------------------------------------------------------ */
/* Finish tab: colour + material                                       */
/* ------------------------------------------------------------------ */
function renderFinish() {
  const el = $('#panel-finish');
  const k = kind();
  const a = studio.appearance;
  let html = '';
  const ptype = paletteType();
  if (ptype) {
    const list = EH.types[ptype].colors.map((c) => ({ id: c, label: EH.colors[c].name, hex: EH.colors[c].hex }));
    const cat = catalogueColorId();
    const what = k === 'frame' ? 'Frame colour' : 'Colour';
    html += `<div class="opt-block p3d-opt"><div class="opt-label"><span>${what}: <b data-colour-name>${cat ? EH.colors[cat].name : 'Custom'}</b></span></div>${swatches(list, a.color)}
      ${shopType() ? `<p class="p3d-note" data-colour-note ${cat ? 'hidden' : ''}>Custom colours are for previews. Pick a colour above to order this ${esc(tpl().label.toLowerCase())}.</p>` : ''}</div>`;
    const fin = tpl()?.garment ? FABRIC_FINISHES : { mug: MUG_FINISHES, phonecase: GLOSS_FINISHES, cushion: CUSHION_FINISHES }[k];
    if (fin) {
      html += `<div class="opt-block p3d-opt"><div class="opt-label"><span>${tpl()?.garment || k === 'cushion' ? 'Fabric' : k === 'mug' ? 'Glaze' : 'Finish'}</span></div>
        <div class="p3d-cards">${fin.map((f) => `<button type="button" class="p3d-card ${a.finish === f.id ? 'active' : ''}" data-finish="${f.id}" aria-pressed="${a.finish === f.id}"><b>${esc(f.label)}</b>${f.note ? `<small>${esc(f.note)}</small>` : ''}</button>`).join('')}</div></div>`;
    }
  } else {
    html += `<div class="opt-block p3d-opt"><div class="opt-label"><span>Materials</span></div>
      ${seg('override', [{ id: 'original', label: 'From the file' }, { id: 'single', label: 'One colour' }], a.override ? 'single' : 'original', 'Materials')}</div>`;
    if (a.override) {
      const list = Object.keys(EH.colors).map((c) => ({ label: EH.colors[c].name, hex: EH.colors[c].hex }));
      html += `<div class="opt-block p3d-opt"><div class="opt-label"><span>Colour</span></div>${swatches(list, a.color)}</div>`;
    }
  }
  el.innerHTML = html;

  const updateColourPreview = (hex) => {
    studio.setAppearance({ ...studio.appearance, color: hex });
    const id = catalogueColorId();
    const label = $('[data-colour-name]', el);
    if (label) label.textContent = id ? EH.colors[id].name : 'Custom';
    const note = $('[data-colour-note]', el);
    if (note) note.hidden = !!id;
    $$('[data-hex]', el).forEach((button) => button.classList.toggle('active', button.dataset.hex.toLowerCase() === hex.toLowerCase()));
    const custom = $('.p3d-custom-swatch', el);
    if (custom) {
      custom.classList.toggle('active', !id);
      const dot = $('span', custom);
      if (dot) dot.style.background = id ? 'conic-gradient(#e6bf86,#b8a7d9,#1f2746,#5c1d28,#e6bf86)' : hex;
    }
    renderProduct();
    renderActions();
    markDirty();
  };
  const apply = (patch) => { studio.setAppearance({ ...studio.appearance, ...patch }); renderFinish(); renderProduct(); renderActions(); markDirty(); };
  el.onclick = (e) => {
    const sw = e.target.closest('[data-hex]');
    if (sw) {
      if (kind() === 'upload') {
        S.orderColor = EH.types[shopType()]?.colors.find((c) => EH.colors[c].hex.toLowerCase() === sw.dataset.hex.toLowerCase()) || S.orderColor;
      }
      return apply({ color: sw.dataset.hex });
    }
    const f = e.target.closest('[data-finish]');
    if (f) return apply({ finish: f.dataset.finish });
    const ov = e.target.closest('[data-override]');
    if (ov) return apply({ override: ov.dataset.override === 'single' });
  };
  el.oninput = (e) => { if (e.target.matches('[data-custom-color]')) updateColourPreview(e.target.value); };
  el.onchange = (e) => { if (e.target.matches('[data-custom-color]')) apply({ color: e.target.value }); };
}

/* ------------------------------------------------------------------ */
/* Scene tab                                                           */
/* ------------------------------------------------------------------ */
function renderScene() {
  const el = $('#panel-scene');
  const s = studio.settings;
  const custom = !BACKDROPS.some((b) => b.id === s.backdrop);
  el.innerHTML = `
    <div class="opt-block p3d-opt"><div class="opt-label"><span>Backdrop: <b>${custom ? 'Custom' : esc(BACKDROPS.find((b) => b.id === s.backdrop).label)}</b></span></div>
      <div class="swatches">${BACKDROPS.map((b) => `<button type="button" class="swatch p3d-backdrop ${s.backdrop === b.id ? 'active' : ''}" data-backdrop="${b.id}" aria-label="${esc(b.label)}" title="${esc(b.label)}"><span style="background:${b.id === 'transparent' ? 'repeating-conic-gradient(#3a3a3a 0 25%,#202020 0 50%) 50%/10px 10px' : `radial-gradient(circle at 45% 35%, ${b.inner}, ${b.outer})`}"></span></button>`).join('')}
        <label class="swatch p3d-custom-swatch ${custom ? 'active' : ''}" title="Custom backdrop"><span style="background:${custom ? s.backdrop : 'conic-gradient(#e6bf86,#6b4cf0,#1f2746,#5c1d28,#e6bf86)'}"></span><input type="color" value="${custom ? s.backdrop : '#2a2233'}" data-backdrop-color aria-label="Custom backdrop colour"></label>
      </div>
      <p class="p3d-note">Studio dark matches the lighting in your reference video. Transparent backgrounds apply to PNG downloads.</p>
    </div>
    <div class="opt-block p3d-opt"><div class="opt-label"><span>Lighting</span></div>${seg('lighting', LIGHTING, s.lighting, 'Lighting')}</div>
    <label class="check p3d-check"><input type="checkbox" data-floor ${s.floor ? 'checked' : ''}> Soft shadow under the product</label>
    <label class="check p3d-check"><input type="checkbox" data-turntable ${s.turntable ? 'checked' : ''}> Turntable (spin the product)</label>
    <label class="p3d-range"><span>Spin speed <output>${s.speed.toFixed(1)}×</output></span><input type="range" min="0.3" max="2.5" step="0.1" value="${s.speed}" data-speed></label>`;

  const set = (patch) => { studio.setScene(patch); syncSpin(); markDirty(); };
  el.onclick = (e) => {
    const b = e.target.closest('[data-backdrop]');
    if (b) { set({ backdrop: b.dataset.backdrop }); renderScene(); }
    const l = e.target.closest('[data-lighting]');
    if (l) { set({ lighting: l.dataset.lighting }); renderScene(); }
  };
  el.oninput = (e) => {
    if (e.target.matches('[data-speed]')) { set({ speed: Number(e.target.value) }); e.target.previousElementSibling.querySelector('output').textContent = `${Number(e.target.value).toFixed(1)}×`; }
    if (e.target.matches('[data-backdrop-color]')) studio.setScene({ backdrop: e.target.value });
  };
  el.onchange = (e) => {
    if (e.target.matches('[data-floor]')) set({ floor: e.target.checked });
    if (e.target.matches('[data-turntable]')) set({ turntable: e.target.checked });
    if (e.target.matches('[data-backdrop-color]')) { set({ backdrop: e.target.value }); renderScene(); }
  };
}

function syncSpin() {
  const b = $('#spinToggle');
  b.setAttribute('aria-pressed', String(!!studio.settings.turntable));
}

function renderViews() {
  $('#views').innerHTML = VIEWS.map((v) => `<button type="button" data-view="${v.id}" aria-pressed="${v.id === 'angle'}">${v.label}</button>`).join('');
  $('#views').onclick = (e) => {
    const b = e.target.closest('[data-view]');
    if (!b) return;
    if (studio.settings.turntable) { studio.setScene({ turntable: false }); syncSpin(); }
    studio.setView(b.dataset.view);
  };
}

/* ------------------------------------------------------------------ */
/* Export tab                                                          */
/* ------------------------------------------------------------------ */
const SHAPES = [{ id: 'square', label: 'Square', r: [1, 1] }, { id: 'landscape', label: 'Landscape', r: [16, 9] }, { id: 'portrait', label: 'Portrait', r: [4, 5] }];
const RES = [{ id: 1080, label: 'HD' }, { id: 2048, label: '2K' }, { id: 4096, label: '4K' }];
const DURATIONS = [{ id: 4, label: '4 s' }, { id: 8, label: '8 s' }, { id: 12, label: '12 s' }];

function exportSize(longSide) {
  const r = SHAPES.find((s) => s.id === S.exportShape).r;
  const k = longSide / Math.max(...r);
  return [Math.round(r[0] * k / 2) * 2, Math.round(r[1] * k / 2) * 2];
}

function renderExport() {
  const el = $('#panel-export');
  const rec = Studio.recordingSupport();
  el.innerHTML = `
    <div class="field"><label for="previewName">Preview name</label><input class="input" id="previewName" maxlength="80" value="${esc(S.name)}"></div>
    <h3 class="p3d-h">Image</h3>
    <div class="opt-block p3d-opt"><div class="opt-label"><span>Shape</span></div>${seg('shape', SHAPES, S.exportShape, 'Image shape')}</div>
    <div class="opt-block p3d-opt"><div class="opt-label"><span>Resolution</span><span class="muted" data-res-out>${exportSize(S.exportRes).join(' × ')} px</span></div>${seg('res', RES, S.exportRes, 'Resolution')}</div>
    <label class="check p3d-check"><input type="checkbox" data-transparent ${S.exportTransparent ? 'checked' : ''}> Transparent background</label>
    <button class="btn btn-outline btn-block" type="button" data-act="png">${icon('download')} Download image (PNG)</button>
    <button class="btn btn-outline btn-block" type="button" data-act="glb">${icon('download')} Download 3D mockup (.GLB)</button>
    <button class="btn btn-outline btn-block" type="button" data-act="details">${icon('download')} Download design details (.JSON)</button>
    <h3 class="p3d-h">360° video</h3>
    <div class="opt-block p3d-opt"><div class="opt-label"><span>Length</span></div>${seg('dur', DURATIONS, S.videoSeconds, 'Video length')}</div>
    <button class="btn btn-outline btn-block" type="button" data-act="video" ${rec ? '' : 'disabled'}>${icon('sparkles')} Record 360° video</button>
    <p class="p3d-note">${rec ? `One full turn at 30 fps, saved as .${rec.ext}. Uses the backdrop from Scene.` : 'This browser cannot record video. Try Chrome, Edge or Safari 17+.'}</p>
    `;

  el.oninput = (e) => {
    if (e.target.id === 'previewName') {
      S.name = e.target.value.trim() || DEFAULT_NAME;

      markDirty();
    }
  };
  el.onchange = (e) => { if (e.target.matches('[data-transparent]')) S.exportTransparent = e.target.checked; };
  el.onclick = async (e) => {
    const sh = e.target.closest('[data-shape]');
    if (sh) { S.exportShape = sh.dataset.shape; return renderExport(); }
    const r = e.target.closest('[data-res]');
    if (r) { S.exportRes = Number(r.dataset.res); return renderExport(); }
    const d = e.target.closest('[data-dur]');
    if (d) { S.videoSeconds = Number(d.dataset.dur); return renderExport(); }
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'png') downloadPng();
    if (act === 'glb') downloadGlb();
    if (act === 'details') downloadDetails();
    if (act === 'video') recordVideo();
  };
}

async function downloadPng() {
  const [w, h] = exportSize(S.exportRes);
  const blob = await studio.capture({ width: w, height: h, transparent: S.exportTransparent || studio.settings.backdrop === 'transparent' });
  if (!blob) return EH.toast('The image could not be created. Try a smaller resolution.', { type: 'error' });
  EH.download(blob, `${slug(S.name)}-${w}x${h}.png`);
  EH.toast('Image downloaded');
}

function customizationDetails(id, order = null) {
  const type = shopType();
  const colorId = catalogueColorId();
  const visible = studio.layers.filter((layer) => layer.visible);
  const summary = visible.length
    ? `3D design: ${visible.map((layer) => `${layer.type === 'text' ? `“${layer.text}”` : layer.name} (${placementLabel(layer).toLowerCase()})`).join(', ')}`
    : '3D studio, no artwork';
  return {
    version: 1,
    customizationId: id,
    previewId: S.previewId,
    orderId: order?.id || null,
    name: S.name,
    product: type ? EH.types[type].label : productLabel(),
    kind: kind(),
    productType: type,
    sourceModelName: kind() === 'upload' ? (studio.model?.fileName || '') : '',
    color: colorId ? EH.colors[colorId].name : 'Custom',
    colorHex: kind() === 'upload' && colorId ? EH.colors[colorId].hex : (studio.appearance.color || ''),
    finish: studio.appearance.finish || '',
    size: type && EH.types[type]?.sizes ? S.size || '' : '',
    model: type && EH.types[type]?.models ? S.model || '' : '',
    quantity: order?.quantity || S.qty,
    unitPrice: type ? EH.types[type].basePrice + EH.sizeAdd(type, S.size) : 0,
    summary,
    state: studio.getState(),
  };
}

function glbMetadata(details) {
  return {
    customizationId: details.customizationId,
    product: details.product,
    productType: details.productType || '',
    color: details.color,
    colorHex: details.colorHex,
    finish: details.finish,
    size: details.size,
    model: details.model,
    sourceModelName: details.sourceModelName,
    quantity: details.quantity,
    unitPrice: details.unitPrice,
    summary: details.summary,
  };
}

async function downloadGlb() {
  try {
    const details = customizationDetails(S.previewId || EH.uid());
    const mockup = await studio.exportGlb({ name: S.name, ...glbMetadata(details) });
    EH.download(mockup, `${slug(S.name)}.glb`);
    EH.toast('3D mockup downloaded');
  } catch (error) {
    console.error('3D mockup export failed.', error);
    EH.toast(error.message || 'The 3D mockup could not be exported.', { type: 'error' });
  }
}

function downloadDetails() {
  const id = S.previewId || EH.uid();
  const details = new Blob([JSON.stringify(customizationDetails(id), null, 2)], { type: 'application/json' });
  EH.download(details, `${slug(S.name)}-details.json`);
  EH.toast('Design details downloaded');
}

let recordAbort = null;
async function recordVideo() {
  const [w, h] = exportSize(1080);
  recordAbort = new AbortController();
  $('#recording').hidden = false;
  $('#recordBar').style.width = '0%';
  try {
    const { blob, ext } = await studio.recordTurntable({
      seconds: S.videoSeconds, width: w, height: h, signal: recordAbort.signal,
      onProgress: (t) => { $('#recordBar').style.width = `${Math.round(t * 100)}%`; $('#recordText').textContent = `Recording 360° video, ${Math.round(t * 100)}%`; },
    });
    EH.download(blob, `${slug(S.name)}-360.${ext}`);
    EH.toast('Video downloaded');
  } catch (err) {
    if (err.name !== 'AbortError') EH.toast(err.message || 'Recording failed.', { type: 'error' });
  } finally {
    $('#recording').hidden = true;
    $('#recordText').textContent = 'Recording 360° video';
    recordAbort = null;
  }
}

/* ------------------------------------------------------------------ */
/* Save + add to bag                                                   */
/* ------------------------------------------------------------------ */
function renderActions() {
  const el = $('#actions');
  const type = shopType();
  const cat = catalogueColorId();
  const sellable = type && cat;
  const status = !S.previewId ? 'Not saved yet' : S.dirty ? 'Unsaved changes' : 'Saved to Your 3D previews';
  const unit = type ? EH.types[type].basePrice + EH.sizeAdd(type, S.size) : 0;
  el.innerHTML = `
    <p class="p3d-status" role="status"><span class="p3d-status-dot ${S.previewId && !S.dirty ? 'ok' : ''}"></span>${status}</p>
    ${sellable ? `
      <div class="studio-buy-total"><span>Subtotal</span><strong>${EH.money(unit * S.qty)}</strong></div>
      <label class="studio-qty"><span>Quantity</span><span><button type="button" data-qty="-1" aria-label="Decrease quantity">−</button><input type="number" min="1" max="20" value="${S.qty}" id="qty" aria-label="Quantity"><button type="button" data-qty="1" aria-label="Increase quantity">+</button></span></label>
      <div class="p3d-action-row">
        <button class="btn btn-ghost" type="button" data-act="save">${icon('heart')} Save</button>
        <button class="btn btn-gold studio-add-button" type="button" data-act="bag">${icon('bag')} Buy now</button>
      </div>` : `
      <button class="btn btn-gold btn-block studio-add-button" type="button" data-act="save">${icon('heart')} Save to Your 3D previews</button>
    `}`;
  el.onclick = (e) => {
    const q = e.target.closest('[data-qty]');
    if (q) { S.qty = Math.min(20, Math.max(1, S.qty + Number(q.dataset.qty))); renderActions(); return; }
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'save') save();
    if (act === 'bag') addToBag();
  };
  el.onchange = (e) => { if (e.target.id === 'qty') { S.qty = Math.min(20, Math.max(1, Math.round(Number(e.target.value) || 1))); renderActions(); } };
}

async function save() {
  if (S.previewId) return doSave();
  const folders = await store.listFolders();
  const guest = store.isGuest();
  const m = EH.modal.open(`
    <h3>Save 3D preview</h3>
    <p class="muted p3d-modal-lead">It goes to <b>Your account › Your 3D previews</b>, where you can sort previews into folders.</p>
    <form class="p3d-form" data-save>
      <div class="field"><label for="saveName">Name</label><input class="input" id="saveName" maxlength="80" required value="${esc(S.name === DEFAULT_NAME ? `${productLabel()} preview` : S.name)}"></div>
      <div class="field"><label for="saveFolder">Folder</label>
        <select class="select" id="saveFolder">
          <option value="">Not in a folder</option>
          ${folders.map((f) => `<option value="${f.id}" ${f.id === S.folderId ? 'selected' : ''}>${esc(f.name)}</option>`).join('')}
          <option value="__new">New folder…</option>
        </select></div>
      <div class="field" data-newfolder hidden><label for="saveNewFolder">New folder name</label><input class="input" id="saveNewFolder" maxlength="60" placeholder="e.g. Diwali drop"></div>
      ${guest ? `<p class="form-note">You're not signed in, so this preview is saved on this device only. <a class="gold" href="login.html">Sign in</a> first to keep it with your account.</p>` : ''}
      <div class="preview-actions"><button class="btn btn-ghost btn-sm" type="button" data-close-modal>Cancel</button><button class="btn btn-gold btn-sm" type="submit">Save preview</button></div>
    </form>`);
  const sel = $('#saveFolder', m);
  sel.addEventListener('change', () => { $('[data-newfolder]', m).hidden = sel.value !== '__new'; if (sel.value === '__new') $('#saveNewFolder', m).focus(); });
  $('[data-save]', m).addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = $('#saveName', m).value.trim();
    if (!name) return $('#saveName', m).focus();
    let folderId = sel.value || null;
    if (folderId === '__new') {
      const fname = $('#saveNewFolder', m).value.trim();
      if (!fname) return $('#saveNewFolder', m).focus();
      folderId = (await store.createFolder(fname)).id;
    }
    S.name = name;
    S.folderId = folderId;
    EH.modal.close();
    await doSave();
  });
}

async function doSave() {
  const btns = [...$$('[data-act="save"]'), ...$$('[data-layout-act="save"]')];
  btns.forEach((b) => { b.disabled = true; });
  try {
    const thumbnail = await studio.thumbnail(480);
    const rec = await store.savePreview({
      id: S.previewId || undefined,
      name: S.name,
      folderId: S.folderId,
      product: productLabel(),
      kind: kind(),
      orderType: S.orderType,
      orderColor: S.orderColor,
      thumbnail,
      state: studio.getState(),
      file: studio.fileBlob || null,
      fileName: studio.model?.fileName || null,
    });
    S.previewId = rec.id;
    S.dirty = false;
    const firebaseApi = window.EHFirebase;
    if (firebaseApi?.enabled) {
      try {
        await firebaseApi.ready;
        const user = firebaseApi.currentUser;
        if (user) {
          const assets = await createCustomizationAssets(rec.id);
          S.cloudPaths = await firebaseApi.saveCustomization(user.uid, rec.id, assets.metadata, assets.files);
          S.cloudOwnerUid = user.uid;
          S.cloudSynced = true;
          await store.savePreview({ id: rec.id, cloudPaths: S.cloudPaths, cloudSynced: true, cloudOwnerUid: user.uid });
        } else {
          S.cloudSynced = false;
        }
      } catch (error) {
        S.cloudSynced = false;
        console.error('Saved preview could not sync to Firebase.', error);
        EH.toast('Preview saved on this device, but Firebase sync failed: ' + (error.message || 'please try again.'), { type: 'error', duration: 6000 });
      }
    }
    history.replaceState(null, '', `${location.pathname}?id=${encodeURIComponent(rec.id)}`);
    renderAll();
    EH.toast(S.cloudSynced ? `Saved “${rec.name}” to your account` : `Saved “${rec.name}” on this device`, { action: { label: 'View', href: '3d-preview/account.html#previews' } });
  } catch (err) {
    console.error(err);
    EH.toast(/quota/i.test(err?.name || err?.message) ? 'Browser storage is full. Delete a few saved previews and try again.' : 'This preview could not be saved.', { type: 'error' });
  } finally {
    btns.forEach((b) => { b.disabled = false; });
  }
}

async function createCustomizationAssets(id, order = null) {
  const details = customizationDetails(id, order);
  const [mockup, preview] = await Promise.all([
    studio.exportGlb({ name: details.name, ...glbMetadata(details) }),
    studio.capture({ width: 1024, height: 1024, type: 'image/png' }),
  ]);
  if (!preview) throw new Error('A preview image could not be created.');
  const files = {
    mockup,
    details: new Blob([JSON.stringify(details, null, 2)], { type: 'application/json' }),
    preview,
  };
  if (details.sourceModelName && studio.fileBlob) files.sourceModel = studio.fileBlob;
  return {
    files,
    metadata: {
      name: details.name,
      product: details.product,
      kind: details.kind,
      productType: details.productType || '',
      color: details.color,
      colorHex: details.colorHex,
      finish: details.finish,
      size: details.size,
      model: details.model,
      quantity: details.quantity,
      unitPrice: details.unitPrice,
      summary: details.summary,
      previewId: details.previewId || '',
      orderId: details.orderId || '',
      sourceModelName: details.sourceModelName || '',
    },
  };
}

async function addToBag() {
  const type = shopType();
  if (!type || !EH.types[type]) {
    setTab('product');
    EH.toast('Choose a store product for your uploaded model first.', { type: 'error' });
    return;
  }
  if (!catalogueColorId()) {
    setTab('finish');
    EH.toast('Choose a store colour for this order first.', { type: 'error' });
    return;
  }
  const T = EH.types[type];
  if (T.sizes && !S.size && needsSizeChoice()) {
    setTab('product');
    const blk = $('[data-size-block]');
    if (blk) { blk.classList.add('need'); $('[data-size-name]', blk).innerHTML = '<span style="color:var(--danger)">Please select a size</span>'; }
    EH.toast('Please select a size', { type: 'error' });
    return;
  }
  const btn = $('[data-act="bag"]');
  btn.disabled = true;
  try {
    const customId = EH.uid();
    const image = await studio.thumbnail(512);
    const name = kind() === 'upload'
      ? `${T.label} - ${S.name !== DEFAULT_NAME ? S.name : productLabel()}`
      : (S.name !== DEFAULT_NAME ? S.name : T.label);
    const details = customizationDetails(customId);
    details.name = name;
    const [mockup, preview] = await Promise.all([
      studio.exportGlb({ name, ...glbMetadata(details) }),
      studio.capture({ width: 1024, height: 1024, type: 'image/png' }),
    ]);
    if (!image || !preview) throw new Error('The product preview could not be prepared. Please try again.');
    const sourceModelKey = kind() === 'upload' && studio.fileBlob ? `sourceModel:${customId}` : '';
    const filesSaved = await Promise.all([
      EH.files.put(`mockup:${customId}`, mockup),
      EH.files.put(`details:${customId}`, new Blob([JSON.stringify(details, null, 2)], { type: 'application/json' })),
      EH.files.put(`previewBlob:${customId}`, preview),
      ...(sourceModelKey ? [EH.files.put(sourceModelKey, studio.fileBlob)] : []),
    ]);
    if (filesSaved.some((saved) => !saved)) throw new Error('The 3D mockup could not be saved in this browser. Check available storage and try again.');
    const ok = EH.cart.add({
      custom: true, custom3d: true, customId, previewId: S.previewId || '', name, type, color: catalogueColorId(), size: T.sizes ? S.size : undefined, model: T.models ? S.model : undefined,
      sourceModelKey: sourceModelKey || undefined,
      sourceModelName: sourceModelKey ? (studio.model?.fileName || '') : '',
      qty: S.qty, price: T.basePrice + EH.sizeAdd(type, S.size), image, summary: details.summary,
    });
    if (!ok) return;
    const visible = studio.layers.filter((l) => l.visible);
    const print = visible.find((l) => l.type === 'image') || visible[0];
    if (print) {
      const data = print.type === 'image' ? print.src : print._tex?.image?.toDataURL?.('image/png');
      if (data) EH.files.put(`print:${customId}`, data).catch(() => {});
    }
    EH.files.put(`preview:${customId}`, image).catch(() => {});
    EH.files.put(`3d:${customId}`, JSON.stringify(studio.getState())).catch(() => {});
    location.assign('checkout.html');
  } catch (error) {
    console.error('3D customization could not be added to the bag.', error);
    EH.toast(error.message || 'The 3D customization could not be added to your bag.', { type: 'error', duration: 6000 });
  } finally {
    btn.disabled = false;
  }
}

/* ------------------------------------------------------------------ */
/* Starting a preview                                                  */
/* ------------------------------------------------------------------ */
function openStartChooser({ focusUpload = false } = {}) {
  const m = EH.modal.open(`
    <h3>Start a 3D preview</h3>
    <p class="muted p3d-modal-lead">Bring a 3D mockup you already have, or put your design on an EliteHub product.</p>
    <div class="p3d-start">
      <button type="button" class="p3d-start-upload" data-start="upload">
        <span class="upload-icon-wrap">${icon('upload')}</span>
        <b>Upload your 3D mockup</b>
        <span>Drop a .glb, .gltf, .obj, .stl or .fbx file here, or choose one. Up to ${MAX_UPLOAD_MB} MB.</span>
      </button>
      <div class="p3d-start-products">
        <p>Or create from our products <a class="p3d-link" href="${CATALOGUE}">See the catalogue</a></p>
        <div class="p3d-start-grid">${TEMPLATES.map((t) => `<button type="button" class="p3d-start-tile" data-start="${t.id}"><img src="${thumbSrc(t.id)}" alt=""><span>${esc(t.label)}</span></button>`).join('')}</div>
      </div>
    </div>`, { wide: true, noFocus: true });
  const up = $('[data-start="upload"]', m);
  if (focusUpload) setTimeout(() => up.focus(), 60);
  m.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-start]');
    if (!b) return;
    if (b.dataset.start === 'upload') { $('#modelInput').click(); return; }
    EH.modal.close();
    resetPreview();
    await withLoading('Loading model', () => studio.loadTemplate(b.dataset.start));
    S.dirty = false;
    renderAll();
  });
  ['dragenter', 'dragover'].forEach((ev) => up.addEventListener(ev, (e) => { e.preventDefault(); up.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((ev) => up.addEventListener(ev, () => up.classList.remove('over')));
  up.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const f = e.dataTransfer.files[0];
    if (f) { EH.modal.close(); resetPreview(); loadModelFile(f); }
  });
}

function resetPreview() {
  for (const l of [...studio.layers]) studio.removeLayer(l.id);
  S.previewId = null;
  S.name = DEFAULT_NAME;
  S.folderId = null;
  S.size = null;
  S.orderType = null;
  S.orderColor = null;
  S.qty = 1;
  history.replaceState(null, '', location.pathname);
}

async function confirmDiscard() {
  if (!S.dirty) return true;
  return EH.confirm('Discard changes?', 'Your latest changes to this preview are not saved yet.', 'Discard');
}

async function loadModelFile(file) {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (!ACCEPTED_EXTENSIONS.includes(ext)) {
    EH.toast(`.${ext} isn't a supported 3D file. Use GLB, GLTF, OBJ, STL or FBX.`, { type: 'error' });
    return;
  }
  try {
    await withLoading(`Reading ${file.name}`, () => studio.loadFile(file, file.name));
    if (!S.previewId && S.name === DEFAULT_NAME) S.name = file.name.replace(/\.[^.]+$/, '');
    markDirty();
    renderAll();
    setTab('product');
  } catch (err) {
    console.error(err);
    EH.toast(err instanceof ModelFileError ? err.message : "This file couldn't be opened.", { type: 'error', duration: 6000 });
  }
}

function bindFileInputs() {
  $('#modelInput').addEventListener('change', (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    if (EH.modal.el) { EH.modal.close(); resetPreview(); }
    loadModelFile(f);
  });
  $('#artInput').addEventListener('change', (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (f) addArtworkFile(f);
  });
}

function bindStage() {
  const stage = $('#stage');
  const hint = $('#dropHint');
  let depth = 0;
  const fileKind = (dt) => {
    const item = [...(dt.items || [])].find((i) => i.kind === 'file');
    if (!item) return null;
    return /^image\//.test(item.type) ? 'image' : 'model';
  };
  stage.addEventListener('dragenter', (e) => {
    const k = fileKind(e.dataTransfer);
    if (!k) return;
    e.preventDefault();
    depth++;
    $('#dropText').textContent = k === 'image' ? 'Drop to add artwork' : 'Drop to open this 3D file';
    hint.hidden = false;
  });
  stage.addEventListener('dragover', (e) => { if (fileKind(e.dataTransfer)) e.preventDefault(); });
  stage.addEventListener('dragleave', () => { depth = Math.max(0, depth - 1); if (!depth) hint.hidden = true; });
  stage.addEventListener('drop', (e) => {
    e.preventDefault();
    depth = 0;
    hint.hidden = true;
    const f = e.dataTransfer.files[0];
    if (!f) return;
    if (/^image\//.test(f.type)) addArtworkFile(f);
    else loadModelFile(f);
  });
  $('#recordCancel').addEventListener('click', () => recordAbort?.abort());
}

function onKeyDown(e) {
  if (EH.modal.el) return;
  const typing = e.target.closest('input, textarea, select, [contenteditable]');
  if (typing) return;
  if ((e.key === 'Delete' || e.key === 'Backspace') && studio.selectedId && S.tab === 'design') {
    e.preventDefault();
    studio.removeLayer(studio.selectedId);
  }
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); }
}

// Last, so every helper above is defined before init runs.
EH.ready(init);
