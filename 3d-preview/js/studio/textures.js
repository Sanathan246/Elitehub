import * as THREE from 'three';

let kraftCache = null;
/** Kraft board: warm brown base with fibres and flecks, tileable enough at 200 mm. */
export function kraftTexture() {
  if (kraftCache) return kraftCache;
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#b58f61';
  ctx.fillRect(0, 0, 512, 512);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const img = ctx.getImageData(0, 0, 512, 512);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (rnd() - 0.5) * 22;
    img.data[i] += n; img.data[i + 1] += n * 0.9; img.data[i + 2] += n * 0.7;
  }
  ctx.putImageData(img, 0, 0);
  for (let i = 0; i < 1400; i++) {
    const x = rnd() * 512, y = rnd() * 512, l = 4 + rnd() * 14, a = rnd() * Math.PI;
    ctx.strokeStyle = rnd() > 0.5 ? 'rgba(90,62,30,0.18)' : 'rgba(230,200,150,0.16)';
    ctx.lineWidth = 0.6 + rnd() * 0.8;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  kraftCache = tex;
  return tex;
}

/** Radial studio backdrop drawn into a texture (used as scene.background so exports include it). */
export function backdropTexture(inner, outer, existing) {
  const c = existing?.image || document.createElement('canvas');
  c.width = c.height = 1024;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  const g = ctx.createRadialGradient(512, 430, 0, 512, 512, 760);
  g.addColorStop(0, inner);
  g.addColorStop(0.55, mix(inner, outer, 0.55));
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1024, 1024);
  // fine grain stops gradient banding in recorded video
  const img = ctx.getImageData(0, 0, 1024, 1024);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 3;
    img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
  const tex = existing || new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

let shadowCache = null;
/** Radial falloff used as a soft contact shadow under products. */
export function contactShadowTexture() {
  if (shadowCache) return shadowCache;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(0,0,0,0.75)');
  g.addColorStop(0.35, 'rgba(0,0,0,0.38)');
  g.addColorStop(0.7, 'rgba(0,0,0,0.08)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  shadowCache = new THREE.CanvasTexture(c);
  return shadowCache;
}

function mix(a, b, t) {
  const ca = new THREE.Color(a), cb = new THREE.Color(b);
  return '#' + ca.lerp(cb, t).getHexString();
}

// The same families the rest of EliteHub already loads (see the <head> of each page).
export const TEXT_FONTS = [
  { id: 'montserrat', label: 'Montserrat Bold', css: () => '700 200px "Montserrat"', load: '700 200px Montserrat' },
  { id: 'bebas', label: 'Bebas Neue', css: () => '400 200px "Bebas Neue"', load: '400 200px "Bebas Neue"' },
  { id: 'cormorant', label: 'Cormorant Garamond', css: () => '600 200px "Cormorant Garamond"', load: '600 200px "Cormorant Garamond"' },
  { id: 'vibes', label: 'Great Vibes', css: () => '400 200px "Great Vibes"', load: '400 200px "Great Vibes"' },
  { id: 'kaushan', label: 'Kaushan Script', css: () => '400 200px "Kaushan Script"', load: '400 200px "Kaushan Script"' },
  { id: 'marker', label: 'Permanent Marker', css: () => '400 200px "Permanent Marker"', load: '400 200px "Permanent Marker"' },
];

/** Renders a text layer to a canvas. Returns { canvas, aspect }. */
export async function renderTextCanvas({ text, font = 'montserrat', color = '#17151b', align = 'center' }) {
  const f = TEXT_FONTS.find((x) => x.id === font) || TEXT_FONTS[0];
  try { await document.fonts.load(f.load, text); } catch {}
  const lines = String(text || ' ').split('\n');
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  const setFont = () => { ctx.font = f.css(); };
  setFont();
  const lh = 200 * 1.05;
  const widths = lines.map((l) => ctx.measureText(l).width);
  const pad = 40;
  const w = Math.ceil(Math.max(...widths, 10) + pad * 2);
  const h = Math.ceil(lh * lines.length + pad * 2);
  const scale = Math.min(1, 2048 / Math.max(w, h));
  c.width = Math.ceil(w * scale);
  c.height = Math.ceil(h * scale);
  ctx.scale(scale, scale);
  setFont();
  ctx.fillStyle = color;
  ctx.textBaseline = 'middle';
  ctx.textAlign = align;
  const x = align === 'left' ? pad : align === 'right' ? w - pad : w / 2;
  lines.forEach((l, i) => ctx.fillText(l, x, pad + lh * (i + 0.5)));
  return { canvas: c, aspect: c.width / c.height };
}

/** Downscale an uploaded image to keep the live studio responsive. Returns a data URL. */
export async function normaliseImage(file, max = 2048) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.naturalWidth * s));
    c.height = Math.max(1, Math.round(img.naturalHeight * s));
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const isJpeg = /jpe?g/i.test(file.type);
    return c.toDataURL(isJpeg ? 'image/jpeg' : 'image/png', 0.92);
  } finally {
    URL.revokeObjectURL(url);
  }
}
