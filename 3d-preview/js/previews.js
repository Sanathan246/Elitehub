/* EliteHub: "Your 3D previews" on 3d-preview/account.html.
 * Folders on the left, saved previews on the right. Previews can be dragged
 * onto a folder, or moved with the card menu.
 */
import * as store from './store.js';

const EH = window.EH;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = (s) => EH.esc(s);
const icon = (n, c = '') => EH.icon(n, c);

const ALL = '__all';
const LOOSE = '__loose';
const svg = (d) => `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICONS = {
  folder: svg('<path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h4.2l2 2.2h8.8A1.5 1.5 0 0 1 21 9.7v8.8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z"/>'),
  folderOpen: svg('<path d="M3 18.5V7.5A1.5 1.5 0 0 1 4.5 6h4.2l2 2.2h7.8A1.5 1.5 0 0 1 20 9.7V11"/><path d="M3 18.5 5.6 12a1.5 1.5 0 0 1 1.4-1h13.5a1 1 0 0 1 .9 1.4L19 18.9a1.5 1.5 0 0 1-1.4 1.1H4.5A1.5 1.5 0 0 1 3 18.5z"/>'),
  stack: svg('<path d="m12 3 9 4.5-9 4.5-9-4.5z"/><path d="m3 12 9 4.5 9-4.5"/><path d="m3 16.5 9 4.5 9-4.5"/>'),
  inbox: svg('<path d="M3 13h5l1.5 2.5h5L16 13h5"/><path d="M5.5 5h13L21 13v5.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5V13z"/>'),
  pencil: svg('<path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17z"/><path d="m14.5 7.5 3 3"/>'),
  more: svg('<circle cx="5.5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="18.5" cy="12" r="1.2"/>'),
  move: svg('<path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h4.2l2 2.2h8.8A1.5 1.5 0 0 1 21 9.7v8.8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z"/><path d="M10 14h6m-2.5-2.5L16 14l-2.5 2.5"/>'),
};

const V = { folder: ALL, sort: 'updated', query: '' };
const dateFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
let previews = [];
let folders = [];
let cloudSyncPromise = null;
let cloudSyncWarning = '';

EH.ready(() => {
  store.followAuth();
  store.onChange(refresh);
  document.addEventListener('firebase:auth-changed', (e) => {
    greet(e.detail && e.detail.user);
    refresh();
  });

  $('[data-pv="new-folder"]').addEventListener('click', newFolder);
  $('#pvSort').addEventListener('change', (e) => { V.sort = e.target.value; renderGrid(); });
  $('#pvSearch').addEventListener('input', (e) => { V.query = e.target.value.trim().toLowerCase(); renderGrid(); });
  document.addEventListener('click', closeMenusOnOutside);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenus(); });

  // Tiles and links point at this page with a fragment; with <base href="../"> the browser
  // treats them as same-page jumps, so scroll smoothly and keep the header from covering headings.
  if (location.hash) setTimeout(() => document.getElementById(location.hash.slice(1))?.scrollIntoView(), 300);
  refresh();
});

function greet(user) {
  const g = $('#acctGreeting');
  if (!g) return;
  if (user) {
    const name = user.displayName || (user.email || '').split('@')[0];
    g.textContent = `Hello, ${name}. Your orders, details and saved 3D previews, all in one place.`;
  } else {
    g.innerHTML = 'Orders, delivery details and your saved 3D previews, all in one place. <a class="gold" href="3d-preview/account.html#security">Sign in</a> to keep them with your account.';
  }
}

async function refresh() {
  await syncCloudPreviews();
  [previews, folders] = await Promise.all([store.listPreviews(), store.listFolders()]);
  if (V.folder !== ALL && V.folder !== LOOSE && !folders.some((f) => f.id === V.folder)) V.folder = ALL;
  renderTile();
  renderFolders();
  renderGrid();
  renderBanner();
  const storageMessage = store.isGuest()
    ? 'Previews are stored in this browser. Sign in before saving to keep them with your account on this device.'
    : 'Cloud-saved previews are available across devices when you sign in. Folder organization stays in this browser.';
  $('#pvStorageNote').textContent = cloudSyncWarning ? `${storageMessage} ${cloudSyncWarning}` : storageMessage;
}

async function syncCloudPreviews() {
  const api = window.EHFirebase;
  if (!api?.enabled || store.isGuest()) { cloudSyncWarning = ''; return; }
  if (cloudSyncPromise) return cloudSyncPromise;
  cloudSyncWarning = '';
  cloudSyncPromise = (async () => {
    await api.ready;
    const user = api.currentUser;
    if (!user || user.uid !== store.currentOwner() || typeof api.listCustomizations !== 'function') return;
    const [remote, local] = await Promise.all([api.listCustomizations(user.uid), store.listPreviews()]);
    const localIds = new Set(local.map((item) => item.id));
    for (const record of remote) {
      const id = String(record.previewId || record.id || '');
      if (!id || localIds.has(id) || record.orderId || !record.assets?.details || !record.assets?.preview) continue;
      try {
        const [detailsBlob, previewBlob] = await Promise.all([
          api.downloadCustomizationAsset(user.uid, record.assets.details),
          api.downloadCustomizationAsset(user.uid, record.assets.preview),
        ]);
        const details = JSON.parse(await detailsBlob.text());
        if (!details.state || typeof details.state !== 'object') continue;
        if (api.currentUser?.uid !== user.uid || store.currentOwner() !== user.uid) break;
        const thumbnail = await blobDataUrl(previewBlob);
        if (api.currentUser?.uid !== user.uid || store.currentOwner() !== user.uid) break;
        await store.savePreview({
          id,
          name: record.name || details.name || 'Saved 3D preview',
          product: record.product || details.product || '3D preview',
          kind: record.kind || details.kind || 'product',
          orderType: record.orderType || details.orderType || details.productType || null,
          orderColor: record.orderColor || details.orderColor || null,
          thumbnail,
          state: details.state,
          fileName: record.sourceModelName || details.sourceModelName || details.state.model?.fileName || null,
          cloudPaths: record.assets,
          cloudSynced: true,
          cloudOwnerUid: user.uid,
        });
        localIds.add(id);
      } catch (error) {
        cloudSyncWarning = 'Some saved previews could not be downloaded. Check your cloud access and try again.';
        console.warn('A saved cloud preview could not be loaded.', record.id, error);
      }
    }
  })();
  try {
    await cloudSyncPromise;
  } catch (error) {
    cloudSyncWarning = 'Your cloud previews could not be loaded. Check your sign-in and Firebase access.';
    console.warn('Saved previews could not sync from Firebase.', error);
  } finally {
    cloudSyncPromise = null;
  }
}

function blobDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Preview image could not be read.'));
    reader.readAsDataURL(blob);
  });
}

/* ---------- tile on the account home ---------- */
function renderTile() {
  const t = $('#tilePreviewsText');
  if (!t) return;
  t.textContent = previews.length
    ? `${previews.length} saved ${previews.length === 1 ? 'preview' : 'previews'}${folders.length ? ` in ${folders.length} ${folders.length === 1 ? 'folder' : 'folders'}` : ''}`
    : 'Saved 3D mockups, sorted into folders';
  $('#tilePreviewThumbs').innerHTML = previews.slice(0, 3).map((p) => `<img src="${esc(p.thumbnail)}" alt="">`).join('');
}

/* ---------- guest previews after signing in ---------- */
async function renderBanner() {
  const b = $('#pvBanner');
  const n = await store.guestPreviewCount();
  b.hidden = !n;
  if (!n) return;
  b.innerHTML = `<span>${n} ${n === 1 ? 'preview was' : 'previews were'} saved on this device before you signed in.</span>
    <button class="btn btn-outline btn-sm" type="button">Add to my account</button>`;
  $('button', b).onclick = async () => {
    const moved = await store.adoptGuestPreviews();
    EH.toast(`${moved} ${moved === 1 ? 'preview' : 'previews'} added to your account`);
  };
}

/* ---------- folders ---------- */
function countIn(id) {
  if (id === ALL) return previews.length;
  if (id === LOOSE) return previews.filter((p) => !p.folderId).length;
  return previews.filter((p) => p.folderId === id).length;
}

function renderFolders() {
  const nav = $('#pvFolders');
  const row = (id, name, ico, editable) => `
    <div class="pv-folder ${V.folder === id ? 'active' : ''}" data-folder-row="${id}" ${id !== ALL ? 'data-drop' : ''}>
      <button type="button" class="pv-folder-btn" data-folder="${id}" aria-current="${V.folder === id}" title="${esc(name)}">
        ${ico}<span class="pv-folder-name">${esc(name)}</span><span class="pv-folder-count">${countIn(id)}</span>
      </button>
      ${editable ? `<button type="button" class="icon-btn" data-folder-rename="${id}" aria-label="Rename folder ${esc(name)}" title="Rename">${ICONS.pencil}</button>
      <button type="button" class="icon-btn" data-folder-delete="${id}" aria-label="Delete folder ${esc(name)}" title="Delete folder">${icon('trash')}</button>` : ''}
    </div>`;
  nav.innerHTML = `
    ${row(ALL, 'All previews', ICONS.stack, false)}
    ${row(LOOSE, 'Not in a folder', ICONS.inbox, false)}
    <p class="pv-folders-label">Folders</p>
    ${folders.length ? folders.map((f) => row(f.id, f.name, V.folder === f.id ? ICONS.folderOpen : ICONS.folder, true)).join('') : '<p class="pv-folders-empty">No folders yet.</p>'}
    <button type="button" class="pv-new-folder" data-pv-new>${icon('plus')} New folder</button>`;

  nav.onclick = async (e) => {
    const f = e.target.closest('[data-folder]');
    if (f) { V.folder = f.dataset.folder; renderFolders(); renderGrid(); return; }
    if (e.target.closest('[data-pv-new]')) return newFolder();
    const rn = e.target.closest('[data-folder-rename]');
    if (rn) {
      const folder = folders.find((x) => x.id === rn.dataset.folderRename);
      const name = await promptName('Rename folder', 'Folder name', folder.name, 'Rename');
      if (name) { await store.renameFolder(folder.id, name); EH.toast('Folder renamed'); }
      return;
    }
    const del = e.target.closest('[data-folder-delete]');
    if (del) {
      const folder = folders.find((x) => x.id === del.dataset.folderDelete);
      const n = countIn(folder.id);
      const ok = await EH.confirm('Delete this folder?', `“${esc(folder.name)}” will be removed.${n ? ` Its ${n} ${n === 1 ? 'preview moves' : 'previews move'} to Not in a folder; nothing is deleted.` : ''}`, 'Delete folder');
      if (ok) { await store.deleteFolder(folder.id); EH.toast('Folder deleted'); }
    }
  };

  // drag a preview card onto a folder to move it
  $$('[data-drop]', nav).forEach((rowEl) => {
    rowEl.addEventListener('dragover', (e) => { if (e.dataTransfer.types.includes('text/x-preview')) { e.preventDefault(); rowEl.classList.add('drop'); } });
    rowEl.addEventListener('dragleave', () => rowEl.classList.remove('drop'));
    rowEl.addEventListener('drop', async (e) => {
      e.preventDefault();
      rowEl.classList.remove('drop');
      const id = e.dataTransfer.getData('text/x-preview');
      const target = rowEl.dataset.folderRow;
      const folderId = target === LOOSE ? null : target;
      const p = previews.find((x) => x.id === id);
      if (!p || (p.folderId || null) === folderId) return;
      await store.movePreview(id, folderId);
      EH.toast(`Moved to ${folderId ? folders.find((x) => x.id === folderId).name : 'Not in a folder'}`);
    });
  });
}

async function newFolder() {
  const name = await promptName('New folder', 'Folder name', '', 'Create folder', 'e.g. Diwali drop, Client mockups');
  if (!name) return;
  const f = await store.createFolder(name);
  V.folder = f.id;
  EH.toast(`Folder “${f.name}” created`);
}

/* ---------- grid ---------- */
function visible() {
  let list = previews.filter((p) => V.folder === ALL || (V.folder === LOOSE ? !p.folderId : p.folderId === V.folder));
  if (V.query) list = list.filter((p) => `${p.name} ${p.product}`.toLowerCase().includes(V.query));
  const by = {
    updated: (a, b) => b.updatedAt - a.updatedAt,
    name: (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
    product: (a, b) => String(a.product).localeCompare(String(b.product)) || b.updatedAt - a.updatedAt,
  }[V.sort];
  return list.sort(by);
}

function folderName(id) {
  return id ? (folders.find((f) => f.id === id)?.name || 'Not in a folder') : 'Not in a folder';
}

function renderGrid() {
  const grid = $('#pvGrid');
  const title = V.folder === ALL ? 'All previews' : V.folder === LOOSE ? 'Not in a folder' : folderName(V.folder);
  $('#pvFolderTitle').textContent = title;
  const list = visible();
  $('#pvCount').textContent = `${list.length} ${list.length === 1 ? 'preview' : 'previews'}`;

  if (!previews.length) {
    grid.innerHTML = `<div class="empty-state pv-empty">${icon('layers')}<h3>No 3D previews yet</h3>
      <p>Upload a 3D mockup, or put your design on any of our 3D products, then save it here.</p>
      <div class="pv-empty-actions"><a class="btn btn-gold btn-sm" href="3d-preview/products.html">Browse 3D products</a><a class="btn btn-ghost btn-sm" href="3d-preview/customizer.html?start=upload">Upload a 3D file</a></div></div>`;
    return;
  }
  if (!list.length) {
    grid.innerHTML = `<div class="empty-state pv-empty">${ICONS.folder}<h3>${V.query ? 'No matches' : 'This folder is empty'}</h3>
      <p>${V.query ? 'Try another name or product.' : 'Drag previews onto this folder, or use “Move to folder” on any preview.'}</p></div>`;
    return;
  }
  grid.innerHTML = list.map((p) => `
    <article class="pv-card" draggable="true" data-id="${p.id}">
      <a class="pv-thumb" href="3d-preview/customizer.html?id=${encodeURIComponent(p.id)}" aria-label="Open ${esc(p.name)} in the 3D studio">
        ${p.thumbnail ? `<img src="${esc(p.thumbnail)}" alt="" loading="lazy">` : ''}
        ${p.kind === 'upload' ? '<span class="pv-badge">Your file</span>' : ''}
      </a>
      <div class="pv-body">
        <h4><a href="3d-preview/customizer.html?id=${encodeURIComponent(p.id)}">${esc(p.name)}</a></h4>
        <p class="pv-meta">${esc(p.product || '3D preview')}</p>
        <p class="pv-meta">Edited ${dateFmt.format(new Date(p.updatedAt))}${V.folder === ALL && p.folderId ? `<span class="pv-in">${ICONS.folder}${esc(folderName(p.folderId))}</span>` : ''}</p>
        <div class="pv-actions">
          <a class="btn btn-outline btn-sm" href="3d-preview/customizer.html?id=${encodeURIComponent(p.id)}">${p.orderType ? 'Continue to order' : 'Open'}</a>
          <div class="pv-menu-wrap">
            <button type="button" class="icon-btn" data-menu="${p.id}" aria-haspopup="menu" aria-expanded="false" aria-label="More actions for ${esc(p.name)}">${ICONS.more}</button>
            <div class="pv-menu" role="menu" hidden>
              <button type="button" role="menuitem" data-do="rename">${ICONS.pencil} Rename</button>
              <button type="button" role="menuitem" data-do="move">${ICONS.move} Move to folder</button>
              <button type="button" role="menuitem" data-do="duplicate">${icon('copy')} Duplicate</button>
              <button type="button" role="menuitem" data-do="download">${icon('download')} Download image</button>
              <button type="button" role="menuitem" data-do="delete" class="danger">${icon('trash')} Delete</button>
            </div>
          </div>
        </div>
      </div>
    </article>`).join('');

  grid.onclick = async (e) => {
    const m = e.target.closest('[data-menu]');
    if (m) {
      const menu = m.nextElementSibling;
      const open = menu.hidden;
      closeMenus();
      if (open) { menu.hidden = false; m.setAttribute('aria-expanded', 'true'); menu.querySelector('button').focus(); }
      return;
    }
    const act = e.target.closest('[data-do]');
    if (!act) return;
    const id = act.closest('[data-id]').dataset.id;
    const p = previews.find((x) => x.id === id);
    closeMenus();
    if (act.dataset.do === 'rename') {
      const name = await promptName('Rename preview', 'Name', p.name, 'Rename');
      if (name) { await store.renamePreview(id, name); EH.toast('Preview renamed'); }
    }
    if (act.dataset.do === 'move') moveDialog(p);
    if (act.dataset.do === 'duplicate') { const c = await store.duplicatePreview(id); EH.toast(`Made “${c.name}”`); }
    if (act.dataset.do === 'download' && p.thumbnail) EH.download(p.thumbnail, `${p.name.replace(/[^\w-]+/g, '-').toLowerCase()}.jpg`);
    if (act.dataset.do === 'delete') {
      const cloudCopy = !!(p.cloudSynced && p.cloudOwnerUid);
      const ok = await EH.confirm('Delete this preview?', `“${esc(p.name)}” and its saved artwork will be removed${cloudCopy ? ' from your account and this device' : ' from this device'}. This can't be undone.`, 'Delete');
      if (!ok) return;
      try {
        if (cloudCopy) {
          const api = window.EHFirebase;
          await api?.ready;
          if (!api?.enabled || api.currentUser?.uid !== p.cloudOwnerUid) throw new Error('Sign in to the account that owns this saved preview before deleting it.');
          await api.deleteCustomization(p.cloudOwnerUid, id);
        }
        await store.deletePreview(id);
        EH.toast('Preview deleted');
      } catch (error) {
        console.error('Saved preview could not be deleted.', error);
        EH.toast(error.message || 'This preview could not be deleted.', { type: 'error' });
      }
    }
  };
  grid.onkeydown = (e) => {
    const menu = e.target.closest('.pv-menu');
    if (!menu || !['ArrowDown', 'ArrowUp'].includes(e.key)) return;
    e.preventDefault();
    const items = $$('button', menu);
    const i = items.indexOf(e.target);
    items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length].focus();
  };
  $$('.pv-card', grid).forEach((card) => {
    card.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/x-preview', card.dataset.id);
      e.dataTransfer.effectAllowed = 'move';
      card.classList.add('dragging');
      $('#pvFolders').classList.add('dropping');
    });
    card.addEventListener('dragend', () => { card.classList.remove('dragging'); $('#pvFolders').classList.remove('dropping'); });
  });
}

function closeMenus() {
  $$('.pv-menu').forEach((m) => { m.hidden = true; });
  $$('[data-menu][aria-expanded="true"]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
}
function closeMenusOnOutside(e) {
  if (!e.target.closest('.pv-menu-wrap')) closeMenus();
}

/* ---------- dialogs (EH.modal) ---------- */
function promptName(title, label, value, okLabel, placeholder = '') {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (!done) { done = true; resolve(v); } };
    const m = EH.modal.open(`
      <h3>${esc(title)}</h3>
      <form class="p3d-form acct-dialog" data-prompt>
        <div class="field"><label for="promptInput">${esc(label)}</label><input class="input" id="promptInput" maxlength="80" value="${esc(value)}" placeholder="${esc(placeholder)}" required></div>
        <div class="preview-actions"><button class="btn btn-ghost btn-sm" type="button" data-close-modal>Cancel</button><button class="btn btn-gold btn-sm" type="submit">${esc(okLabel)}</button></div>
      </form>`, { onClose: () => finish(null) });
    const input = $('#promptInput', m);
    setTimeout(() => { input.focus(); input.select(); }, 60);
    $('[data-prompt]', m).addEventListener('submit', (e) => {
      e.preventDefault();
      const v = input.value.trim();
      if (!v) return input.focus();
      finish(v);
      EH.modal.close();
    });
  });
}

function moveDialog(p) {
  const m = EH.modal.open(`
    <h3>Move to folder</h3>
    <p class="muted p3d-modal-lead">Choose where “${esc(p.name)}” should live.</p>
    <form class="p3d-form acct-dialog" data-move>
      <div class="pv-move-list" role="radiogroup" aria-label="Folders">
        <label class="pv-move-option"><input type="radio" name="folder" value="" ${!p.folderId ? 'checked' : ''}> ${ICONS.inbox} Not in a folder</label>
        ${folders.map((f) => `<label class="pv-move-option"><input type="radio" name="folder" value="${f.id}" ${p.folderId === f.id ? 'checked' : ''}> ${ICONS.folder} ${esc(f.name)}</label>`).join('')}
        <label class="pv-move-option"><input type="radio" name="folder" value="__new"> ${icon('plus')} New folder…</label>
      </div>
      <div class="field" data-newfolder hidden><label for="moveNewFolder">New folder name</label><input class="input" id="moveNewFolder" maxlength="60"></div>
      <div class="preview-actions"><button class="btn btn-ghost btn-sm" type="button" data-close-modal>Cancel</button><button class="btn btn-gold btn-sm" type="submit">Move</button></div>
    </form>`, { noFocus: true });
  const form = $('[data-move]', m);
  form.addEventListener('change', () => {
    const isNew = form.folder.value === '__new';
    $('[data-newfolder]', m).hidden = !isNew;
    if (isNew) $('#moveNewFolder', m).focus();
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    let id = form.folder.value || null;
    let label = id ? folderName(id) : 'Not in a folder';
    if (id === '__new') {
      const name = $('#moveNewFolder', m).value.trim();
      if (!name) return $('#moveNewFolder', m).focus();
      const f = await store.createFolder(name);
      id = f.id;
      label = f.name;
    }
    EH.modal.close();
    await store.movePreview(p.id, id);
    EH.toast(`Moved to ${label}`);
  });
}
