/* EliteHub: 3D products catalogue (3d-preview/products.html).
 * Every card opens the 3D studio on that product. URL keeps the filters:
 *   products.html?category=sweats&q=hood&orderable=1
 */
import { TEMPLATES, CATEGORIES } from './studio/catalog.js';

const EH = window.EH;
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => EH.esc(s);
const THUMB = (id, alt = false) => `3d-preview/assets/products/${id}${alt ? '-alt' : ''}.jpg`;
const params = new URLSearchParams(location.search);
const V = {
  category: CATEGORIES.some((c) => c.id === params.get('category')) ? params.get('category') : 'all',
  q: params.get('q') || '',
  orderable: params.get('orderable') === '1',
  sort: 'featured',
};

const price = (t) => (t.shop ? EH.types[t.shop].basePrice : null);
const colours = (t) => (t.shop ? EH.types[t.shop].colors : t.garment ? EH.types.tshirt.colors : []);

EH.ready(() => {
  $('#catSearch').value = V.q;
  $('#catOrderable').checked = V.orderable;
  $('#catSearch').addEventListener('input', (e) => { V.q = e.target.value.trim(); render(); });
  $('#catOrderable').addEventListener('change', (e) => { V.orderable = e.target.checked; render(); });
  $('#catSort').addEventListener('change', (e) => { V.sort = e.target.value; render(); });
  $('#catChips').addEventListener('click', (e) => {
    const b = e.target.closest('[data-cat]');
    if (b) { V.category = b.dataset.cat; render(); }
  });
  render();
});

function matches(t) {
  if (V.category !== 'all' && t.category !== V.category) return false;
  if (V.orderable && !t.shop) return false;
  if (V.q) {
    const hay = `${t.label} ${t.fit} ${t.note} ${CATEGORIES.find((c) => c.id === t.category)?.label}`.toLowerCase();
    if (!V.q.toLowerCase().split(/\s+/).every((w) => hay.includes(w))) return false;
  }
  return true;
}

function render() {
  const url = new URLSearchParams();
  if (V.category !== 'all') url.set('category', V.category);
  if (V.q) url.set('q', V.q);
  if (V.orderable) url.set('orderable', '1');
  history.replaceState(null, '', `${location.pathname}${url.toString() ? `?${url}` : ''}`);

  $('#catChips').innerHTML = CATEGORIES.map((c) => {
    const n = c.id === 'all' ? TEMPLATES.length : TEMPLATES.filter((t) => t.category === c.id).length;
    return `<button type="button" class="chip-btn ${V.category === c.id ? 'active' : ''}" data-cat="${c.id}" aria-pressed="${V.category === c.id}">${esc(c.label)} <span class="p3c-chip-n">${n}</span></button>`;
  }).join('');

  let list = TEMPLATES.filter(matches);
  const order = TEMPLATES.map((t) => t.id);
  const by = {
    featured: (a, b) => order.indexOf(a.id) - order.indexOf(b.id),
    new: (a, b) => (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0) || order.indexOf(a.id) - order.indexOf(b.id),
    price: (a, b) => (price(a) ?? Infinity) - (price(b) ?? Infinity),
    name: (a, b) => a.label.localeCompare(b.label),
  }[V.sort];
  list = list.sort(by);
  $('#catCount').textContent = `${list.length} ${list.length === 1 ? 'product' : 'products'}${V.category !== 'all' ? ` in ${CATEGORIES.find((c) => c.id === V.category).label}` : ''}`;

  const cards = list.map((t) => {
    const p = price(t);
    const dots = colours(t).slice(0, 6).map((c) => `<span style="background:${EH.colors[c].hex}" title="${esc(EH.colors[c].name)}"></span>`).join('');
    const extra = colours(t).length > 6 ? `<small>+${colours(t).length - 6}</small>` : '';
    return `
      <article class="p3c-card">
        <a class="p3c-media" href="3d-preview/customizer.html?template=${t.id}" aria-label="Customize ${esc(t.label)} in 3D">
          <img class="p3c-img" src="${THUMB(t.id)}" alt="${esc(t.label)}, 3D render" loading="lazy" width="720" height="720">
          <img class="p3c-img p3c-img-alt" src="${THUMB(t.id, true)}" alt="" loading="lazy" width="720" height="720">
          <span class="p3c-badges">${t.isNew ? '<span class="p3c-badge">New</span>' : ''}<span class="p3c-badge p3c-badge-3d">3D</span></span>
          <span class="p3c-open">${EH.icon('sparkles')} Customize in 3D</span>
        </a>
        <div class="p3c-body">
          <h3><a href="3d-preview/customizer.html?template=${t.id}">${esc(t.label)}</a></h3>
          <p class="p3c-fit">${esc(t.fit)}</p>
          <div class="p3c-foot">
            ${dots ? `<span class="p3c-dots" aria-label="${colours(t).length} colours">${dots}${extra}</span>` : '<span class="p3c-dots-text">White, kraft or black board</span>'}
            <span class="p3c-price">${p ? `From ${EH.money(p)}` : 'Preview only'}</span>
          </div>
        </div>
      </article>`;
  });
  const showUpload = !V.orderable && (!V.q || 'upload own model 3d file glb obj stl fbx'.includes(V.q.toLowerCase()));
  if (showUpload) {
    cards.push(`
      <article class="p3c-card p3c-upload">
        <a class="p3c-media" href="3d-preview/customizer.html?start=upload">
          <span class="p3c-upload-inner">${EH.icon('upload')}<b>Upload your own 3D model</b><span>GLB, GLTF, OBJ, STL or FBX, up to 20 MB. Add your design to it like any other product.</span></span>
        </a>
      </article>`);
  }
  $('#catGrid').innerHTML = cards.length ? cards.join('') : `
    <div class="empty-state p3c-empty">${EH.icon('search')}<h3>No matches</h3><p>Try another word, or clear the filters.</p>
      <button class="btn btn-gold btn-sm" type="button" id="catClear">Clear filters</button></div>`;
  $('#catClear')?.addEventListener('click', () => {
    V.category = 'all'; V.q = ''; V.orderable = false;
    $('#catSearch').value = ''; $('#catOrderable').checked = false;
    render();
  });
}
