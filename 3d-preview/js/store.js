/* EliteHub 3D previews: saved previews + folders.
 *
 * IndexedDB keeps a local cache and guest previews. Signed-in previews are
 * also saved as Firestore metadata + Firebase Storage assets; previews.js
 * hydrates those cloud records back into this cache on each device. Uploaded
 * 3D files and artwork can be many MB, which is far over Firestore's 1 MB limit.
 *
 * Each record carries an `owner`: the signed-in Firebase uid, or "guest".
 * Lists only ever show the current owner's records, so two people sharing a
 * computer don't see each other's previews.
 *
 * Preview: { id, owner, name, folderId|null, product, thumbnail, state, file?, fileName?, createdAt, updatedAt }
 * Folder:  { id, owner, name, createdAt }
 */

const DB_NAME = 'elitehub-3d-previews';
const DB_VERSION = 1;
const GUEST = 'guest';

let owner = GUEST;
let dbPromise = null;
let memoryOnly = false;
const memory = { previews: new Map(), folders: new Map() };

export function setOwner(uid) {
  const next = uid || GUEST;
  if (next === owner) return;
  owner = next;
  emit();
}
export const currentOwner = () => owner;
export const isGuest = () => owner === GUEST;
export const isPersistent = () => !memoryOnly;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    if (!('indexedDB' in window)) { memoryOnly = true; resolve(null); return; }
    let req;
    try { req = indexedDB.open(DB_NAME, DB_VERSION); } catch { memoryOnly = true; resolve(null); return; }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('previews')) db.createObjectStore('previews', { keyPath: 'id' }).createIndex('owner', 'owner');
      if (!db.objectStoreNames.contains('folders')) db.createObjectStore('folders', { keyPath: 'id' }).createIndex('owner', 'owner');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = req.onblocked = () => { memoryOnly = true; resolve(null); };
  });
  return dbPromise;
}

const asPromise = (req) => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });

async function all(storeName, who = owner) {
  const db = await openDb();
  const rows = db
    ? await asPromise(db.transaction(storeName).objectStore(storeName).index('owner').getAll(who))
    : [...memory[storeName].values()].filter((r) => r.owner === who);
  return rows;
}
async function getRaw(storeName, id) {
  const db = await openDb();
  return db ? asPromise(db.transaction(storeName).objectStore(storeName).get(id)) : memory[storeName].get(id);
}
async function getOne(storeName, id) {
  const row = await getRaw(storeName, id);
  return row && row.owner === owner ? row : null;
}
async function put(storeName, rec) {
  const db = await openDb();
  if (!db) { memory[storeName].set(rec.id, rec); return rec; }
  await asPromise(db.transaction(storeName, 'readwrite').objectStore(storeName).put(rec));
  return rec;
}
async function remove(storeName, id) {
  const db = await openDb();
  if (!db) { memory[storeName].delete(id); return; }
  await asPromise(db.transaction(storeName, 'readwrite').objectStore(storeName).delete(id));
}

export const newId = (prefix) => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

/* ---------- previews ---------- */
export async function listPreviews() {
  return (await all('previews')).sort((a, b) => b.updatedAt - a.updatedAt);
}
export const getPreview = (id) => getOne('previews', id);

export async function savePreview(data) {
  const now = Date.now();
  let existing = null;
  if (data.id) {
    const row = await getRaw('previews', data.id);
    if (row && row.owner !== owner) {
      /* The id belongs to another account on this device (for example, the person signed
         out while the preview was open). Save a fresh copy instead of overwriting theirs. */
      const { id, cloudPaths, cloudSynced, cloudOwnerUid, ...rest } = data;
      data = rest;
    } else {
      existing = row || null;
    }
  }
  const rec = { folderId: null, createdAt: now, ...(existing || {}), ...data, owner, updatedAt: now };
  if (!rec.id) rec.id = newId('pv');
  await put('previews', rec);
  emit();
  return rec;
}
export async function renamePreview(id, name) {
  const p = await getPreview(id);
  if (!p) return null;
  return savePreview({ ...p, name: name.trim() || p.name });
}
export async function movePreview(id, folderId) {
  const p = await getPreview(id);
  if (!p) return null;
  return savePreview({ ...p, folderId: folderId || null });
}
export async function duplicatePreview(id) {
  const p = await getPreview(id);
  if (!p) return null;
  // The copy exists only on this device until it is saved again while signed in.
  const { id: _id, createdAt, updatedAt, cloudPaths, cloudSynced, cloudOwnerUid, ...rest } = p;
  return savePreview({ ...rest, name: `${p.name} (copy)` });
}
export async function deletePreview(id) {
  if (!(await getPreview(id))) return;
  await remove('previews', id);
  emit();
}

/* ---------- folders ---------- */
export async function listFolders() {
  return (await all('folders')).sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}
export async function createFolder(name) {
  const rec = { id: newId('fd'), owner, name: (name || '').trim() || 'New folder', createdAt: Date.now() };
  await put('folders', rec);
  emit();
  return rec;
}
export async function renameFolder(id, name) {
  const f = await getOne('folders', id);
  if (!f) return;
  await put('folders', { ...f, name: name.trim() || f.name });
  emit();
}
/** Removes the folder; its previews stay, moved to "Not in a folder". */
export async function deleteFolder(id) {
  const f = await getOne('folders', id);
  if (!f) return;
  for (const p of (await listPreviews()).filter((x) => x.folderId === id)) await put('previews', { ...p, folderId: null });
  await remove('folders', id);
  emit();
}

/* ---------- guest previews after sign-in ---------- */
export async function guestPreviewCount() {
  return owner === GUEST ? 0 : (await all('previews', GUEST)).length;
}
/** Moves previews (and their folders) saved while signed out into this account. */
export async function adoptGuestPreviews() {
  if (owner === GUEST) return 0;
  const folders = await all('folders', GUEST);
  const previews = await all('previews', GUEST);
  for (const f of folders) await put('folders', { ...f, owner });
  for (const p of previews) await put('previews', { ...p, owner });
  emit();
  return previews.length;
}

/* ---------- change events (this tab + other tabs) ---------- */
const listeners = new Set();
let channel = null;
try {
  channel = new BroadcastChannel('elitehub-3d-previews');
  channel.onmessage = () => listeners.forEach((fn) => fn());
} catch {}
function emit() {
  listeners.forEach((fn) => fn());
  try { channel?.postMessage('changed'); } catch {}
}
export function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

/** Follows the site's Firebase auth (js/firebase.js) so previews belong to the right account. */
export function followAuth() {
  const apply = (user) => setOwner(user && user.uid);
  if (window.EHFirebase?.currentUser) apply(window.EHFirebase.currentUser);
  document.addEventListener('firebase:auth-changed', (e) => apply(e.detail && e.detail.user));
  document.addEventListener('firebase:ready', (e) => { const api = e.detail && e.detail.api; if (api && !api.enabled) apply(null); });
}
