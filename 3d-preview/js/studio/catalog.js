// The 3D product catalogue. No three.js here, so the catalogue page stays light.
// `shop` is the EliteHub product type (js/mockups.js) a product can be ordered as;
// null means preview-only. `color` is the default catalogue colour.

export const CATEGORIES = [
  { id: 'all', label: 'All products' },
  { id: 'tops', label: 'T-shirts & tops' },
  { id: 'sweats', label: 'Hoodies & sweatshirts' },
  { id: 'accessories', label: 'Accessories' },
  { id: 'home', label: 'Home & living' },
];

/* Every 3D product. `shop` is the EliteHub product type (js/mockups.js) it can be
   ordered as; null means preview-only. `color` is the default catalogue colour. */
export const TEMPLATES = [
  { id: 'tee', label: 'Oversized tee', category: 'tops', shop: 'tshirt', color: 'white', fit: 'Oversized fit, drop shoulder', note: 'Drop shoulder, boxy fit', garment: true },
  { id: 'longsleeve', label: 'Long-sleeve tee', category: 'tops', shop: null, color: 'black', fit: 'Oversized fit, ribbed cuffs', note: 'Oversized, ribbed cuffs', garment: true, isNew: true },
  { id: 'tank', label: 'Tank top', category: 'tops', shop: null, color: 'beige', fit: 'Relaxed fit, deep armholes', note: 'Relaxed, deep armholes', garment: true, isNew: true },
  { id: 'crewneck', label: 'Crewneck sweatshirt', category: 'sweats', shop: null, color: 'navy', fit: 'Boxy fit, ribbed hem', note: 'Boxy, ribbed hem and cuffs', garment: true, isNew: true },
  { id: 'hoodie', label: 'Hoodie', category: 'sweats', shop: 'hoodie', color: 'black', fit: 'Boxy fit, kangaroo pocket', note: 'Kangaroo pocket, drawstrings', garment: true, isNew: true },
  { id: 'mug', label: 'Ceramic mug', category: 'accessories', shop: 'mug', color: 'white', fit: '330 ml ceramic', note: '330 ml, front print; enlarge to wrap the side' },
  { id: 'phonecase', label: 'Phone case', category: 'accessories', shop: 'phonecase', color: 'lavender', fit: 'Model-shaped case with camera cutouts', note: 'Choose a phone model for its matching camera layout', isNew: true },
  { id: 'tote', label: 'Tote bag', category: 'accessories', shop: 'tote', color: 'natural', fit: 'Cotton canvas, long handles', note: 'Canvas, print both sides', isNew: true },
  { id: 'cushion', label: 'Cushion', category: 'home', shop: 'cushion', color: 'beige', fit: '16 or 18 inch, piped edge', note: 'Square, piped edge', isNew: true },
  { id: 'frame', label: 'Framed poster', category: 'home', shop: 'frame', color: 'black', fit: 'A4 or A3, white mount', note: 'A4 or A3 in a slim frame', isNew: true },
];
export const templateById = (id) => TEMPLATES.find((t) => t.id === id);
export const PALETTE = {
  black: '#17151b', white: '#f2efea', beige: '#d6c3a1', navy: '#1f2746', maroon: '#5c1d28',
  olive: '#4d5136', lavender: '#b8a7d9', natural: '#e7dbc3', gold: '#c9a35a',
};
