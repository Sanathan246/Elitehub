/* =====================================================================
   EliteHub — Product mockups & artwork library (pure SVG)
   EH.mockup(type, { color, design, content, layer, className })
   ===================================================================== */
(function () {
  const EH = (window.EH = window.EH || {});
  let seq = 0;
  const uid = () => 'm' + (++seq).toString(36) + Math.random().toString(36).slice(2, 5);

  /* ---------------- colours ---------------- */
  const COLORS = {
    black:    { name: 'Black',    hex: '#17151b' },
    white:    { name: 'White',    hex: '#f2efea' },
    beige:    { name: 'Beige',    hex: '#d6c3a1' },
    navy:     { name: 'Navy',     hex: '#1f2746' },
    maroon:   { name: 'Maroon',   hex: '#5c1d28' },
    olive:    { name: 'Olive',    hex: '#4d5136' },
    lavender: { name: 'Lavender', hex: '#b8a7d9' },
    natural:  { name: 'Natural',  hex: '#e7dbc3' },
    gold:     { name: 'Gold',     hex: '#c9a35a' }
  };

  const rgb = (hex) => { const h = hex.replace('#', ''); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
  const lum = (hex) => { const [r, g, b] = rgb(hex).map((v) => v / 255); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const shade = (hex, amt) => {
    const f = (v) => Math.max(0, Math.min(255, Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt)));
    return '#' + rgb(hex).map((v) => f(v).toString(16).padStart(2, '0')).join('');
  };
  const isLight = (hex) => lum(hex) > 0.45;
  const inkFor = (hex) => (isLight(hex) ? '#1b1720' : '#f3ede4');
  const hexOf = (c) => (COLORS[c] ? COLORS[c].hex : c);

  const spark = (x, y, s) => `M${x},${y - s} Q${x},${y} ${x + s},${y} Q${x},${y} ${x},${y + s} Q${x},${y} ${x - s},${y} Q${x},${y} ${x},${y - s}Z`;
  const dots = (list, fill, op = 1) => list.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" opacity="${op}"/>`).join('');

  /* ---------------- product types ---------------- */
  const TEE = 'M162,50 Q200,100 238,50 Q270,56 296,68 C322,80 346,112 364,150 L320,184 Q306,166 293,150 L295,356 Q200,366 105,356 L107,150 Q94,166 80,184 L36,150 C54,112 78,80 104,68 Q130,56 162,50 Z';
  const HOOD_BACK = 'M146,86 C136,46 160,18 200,18 C240,18 264,46 254,86 Z';
  const HOODIE = 'M150,80 Q124,84 100,94 C70,106 56,142 50,192 L42,292 L76,304 L102,182 L100,332 L102,356 Q200,364 298,356 L300,332 L298,182 L324,304 L358,292 L350,192 C344,142 330,106 300,94 Q276,84 250,80 Q200,108 150,80 Z';
  const HOOD_IN = 'M160,82 C158,54 176,36 200,36 C224,36 242,54 240,82 C232,100 216,112 200,114 C184,112 168,100 160,82 Z';
  const MUG = 'M92,92 L92,312 A80,16 0 0 0 252,312 L252,92 Z';
  const CUSHION = 'M96,92 Q200,76 304,92 Q322,200 304,308 Q200,324 96,308 Q78,200 96,92 Z';
  const TOTE = 'M106,172 L294,172 L302,362 L98,362 Z';

  const shadow = (u, cx, cy, rx, ry, op = 0.5) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#000" opacity="${op}" filter="url(#${u}b)"/>`;
  const sideGrad = (id, edge, mid = 0) => `<linearGradient id="${id}" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity="${edge}"/><stop offset=".24" stop-color="#000" stop-opacity="${mid}"/><stop offset=".76" stop-color="#000" stop-opacity="${mid}"/><stop offset="1" stop-color="#000" stop-opacity="${edge}"/></linearGradient>`;
  const visualThreads = (baseHex) => {
    const isDark = !isLight(baseHex);
    const primary = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(65,52,42,0.12)';
    const secondary = isDark ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.28)';
    return `<g fill="none" stroke-linecap="round" opacity="${isDark ? 0.9 : 0.7}">
      <path d="M54,108 Q200,136 346,108" stroke="${primary}" stroke-width="1.1"/>
      <path d="M58,149 Q200,180 342,148" stroke="${secondary}" stroke-width="0.9"/>
      <path d="M50,191 Q200,224 350,190" stroke="${primary}" stroke-width="1.1"/>
      <path d="M62,232 Q200,260 338,230" stroke="${secondary}" stroke-width="0.9"/>
      <path d="M72,272 Q200,300 328,270" stroke="${primary}" stroke-width="1.1"/>
      <path d="M96,84 Q116,114 98,148" stroke="${secondary}" stroke-width="0.8"/>
      <path d="M304,84 Q284,116 302,150" stroke="${secondary}" stroke-width="0.8"/>
      <path d="M95,246 Q120,286 100,320" stroke="${secondary}" stroke-width="0.8"/>
      <path d="M305,246 Q280,286 300,320" stroke="${secondary}" stroke-width="0.8"/>
    </g>`;
  };

  const TYPES = {
    tshirt: {
      label: 'Oversized Tee', short: 'T-Shirt', category: 'clothing', basePrice: 899,
      colors: ['black', 'white', 'beige', 'navy', 'maroon', 'olive', 'lavender'],
      sizes: ['S', 'M', 'L', 'XL', 'XXL'],
      print: { x: 132, y: 96, w: 136, h: 200 },
      art: { x: 140, y: 100, w: 120, h: 150 },
      base(c, u) {
        const L = isLight(c);
        const inner = shade(c, L ? -0.28 : -0.55);
        const rib = shade(c, L ? -0.08 : 0.07);
        const seam = L ? 'rgba(0,0,0,.13)' : 'rgba(255,255,255,.07)';
        const rim = L ? 'rgba(0,0,0,.18)' : 'rgba(255,255,255,.16)';
        return `${shadow(u, 200, 366, 150, 12)}
          <path d="${TEE}" fill="${c}"/>
          <path d="M162,50 Q200,62 238,50 Q200,100 162,50 Z" fill="${inner}"/>
          <path d="M162,50 Q200,62 238,50 L236,46 Q200,57 164,46 Z" fill="${rib}"/>
          <path d="M162,50 Q200,100 238,50 L245,52 Q200,113 155,52 Z" fill="${rib}"/>
          ${visualThreads(c)}
          <g fill="none" stroke="${seam}" stroke-width="1.3">
            <path d="M157,55 Q200,106 243,55" stroke-dasharray="2 2"/>
            <path d="M104,70 Q110,110 107,150"/><path d="M296,70 Q290,110 293,150"/>
            <path d="M41,144 L85,178"/><path d="M359,144 L315,178"/>
            <path d="M106,345 Q200,355 294,345"/>
          </g>
          <path d="${TEE}" fill="none" stroke="${rim}" stroke-width="1.2"/>`;
      },
      over(c, u) {
        const L = isLight(c);
        return `<defs><clipPath id="${u}c"><path d="${TEE}"/></clipPath>${sideGrad(u + 'g', L ? 0.16 : 0.42)}
          <radialGradient id="${u}h" cx=".5" cy=".3" r=".55"><stop offset="0" stop-color="#fff" stop-opacity="${L ? 0.12 : 0.07}"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
          <g clip-path="url(#${u}c)">
            <rect width="400" height="400" fill="url(#${u}g)"/><rect width="400" height="400" fill="url(#${u}h)"/>
            <g filter="url(#${u}f)" fill="none" stroke="#000" opacity="${L ? 0.1 : 0.4}">
              <path d="M120,165 Q132,255 122,352" stroke-width="12"/><path d="M280,165 Q268,255 278,352" stroke-width="12"/>
              <path d="M150,312 Q200,326 252,308" stroke-width="7"/><path d="M300,80 Q326,114 338,160" stroke-width="8"/><path d="M100,80 Q74,114 62,160" stroke-width="8"/>
            </g>
            <g filter="url(#${u}f)" fill="none" stroke="#fff" opacity="${L ? 0.35 : 0.06}">
              <path d="M150,110 Q158,220 148,330" stroke-width="10"/><path d="M252,110 Q244,220 254,330" stroke-width="8"/>
            </g>
          </g>`;
      }
    },

    hoodie: {
      label: 'Classic Hoodie', short: 'Hoodie', category: 'clothing', basePrice: 1499,
      colors: ['black', 'white', 'beige', 'navy', 'maroon', 'olive'],
      sizes: ['S', 'M', 'L', 'XL', 'XXL'],
      print: { x: 142, y: 120, w: 116, h: 124 },
      art: { x: 146, y: 122, w: 108, h: 116 },
      base(c, u) {
        const L = isLight(c);
        const dark = shade(c, L ? -0.1 : -0.25);
        const inner = shade(c, L ? -0.3 : -0.6);
        const rib = shade(c, L ? -0.07 : 0.06);
        const seam = L ? 'rgba(0,0,0,.14)' : 'rgba(255,255,255,.07)';
        const rim = L ? 'rgba(0,0,0,.18)' : 'rgba(255,255,255,.15)';
        return `${shadow(u, 200, 366, 160, 12)}
          <path d="${HOOD_BACK}" fill="${dark}"/>
          <path d="${HOODIE}" fill="${c}"/>
          <path d="${HOOD_IN}" fill="${inner}"/>
          <path d="${HOOD_IN}" fill="none" stroke="${rib}" stroke-width="7"/>
          <path d="M100,332 Q200,342 300,332 L298,356 Q200,364 102,356 Z" fill="${rib}"/>
          <path d="M44,280 L78,292 L76,304 L42,292 Z" fill="${rib}"/><path d="M356,280 L322,292 L324,304 L358,292 Z" fill="${rib}"/>
          <path d="M138,256 Q200,250 262,256 L280,324 Q200,330 120,324 Z" fill="${c}"/>
          ${visualThreads(c)}
          <g fill="none" stroke="${seam}" stroke-width="1.3">
            <path d="M138,256 Q200,250 262,256 L280,324 Q200,330 120,324 Z"/>
            <path d="M100,94 Q106,140 102,182"/><path d="M300,94 Q294,140 298,182"/>
            <path d="M102,336 Q200,346 298,336" stroke-dasharray="2 2"/>
          </g>
          <path d="M138,256 L120,324" stroke="${shade(c, L ? -0.25 : -0.5)}" stroke-width="3"/><path d="M262,256 L280,324" stroke="${shade(c, L ? -0.25 : -0.5)}" stroke-width="3"/>
          <path d="${HOODIE}" fill="none" stroke="${rim}" stroke-width="1.2"/><path d="${HOOD_BACK}" fill="none" stroke="${rim}" stroke-width="1"/>`;
      },
      over(c, u) {
        const L = isLight(c);
        const cord = shade(c, L ? -0.18 : 0.3);
        return `<defs><clipPath id="${u}c"><path d="${HOODIE}"/></clipPath>${sideGrad(u + 'g', L ? 0.16 : 0.42)}</defs>
          <g clip-path="url(#${u}c)">
            <rect width="400" height="400" fill="url(#${u}g)"/>
            <g filter="url(#${u}f)" fill="none" stroke="#000" opacity="${L ? 0.1 : 0.4}">
              <path d="M118,190 Q128,270 118,340" stroke-width="12"/><path d="M282,190 Q272,270 282,340" stroke-width="12"/>
              <path d="M70,150 Q62,220 58,286" stroke-width="8"/><path d="M330,150 Q338,220 342,286" stroke-width="8"/>
            </g>
          </g>
          <g fill="none" stroke="${cord}" stroke-width="3.2" stroke-linecap="round">
            <path d="M186,110 C186,130 185,148 183,170"/><path d="M214,110 C214,130 215,148 217,170"/>
          </g>
          <rect x="180.5" y="168" width="5" height="12" rx="1.5" fill="${shade(cord, -0.2)}" transform="rotate(4 183 174)"/>
          <rect x="214.5" y="168" width="5" height="12" rx="1.5" fill="${shade(cord, -0.2)}" transform="rotate(-4 217 174)"/>
          <circle cx="186" cy="108" r="3" fill="none" stroke="${shade(c, L ? -0.3 : 0.25)}" stroke-width="1.5"/><circle cx="214" cy="108" r="3" fill="none" stroke="${shade(c, L ? -0.3 : 0.25)}" stroke-width="1.5"/>`;
      }
    },

    mug: {
      label: 'Ceramic Mug', short: 'Mug', category: 'accessories', basePrice: 449,
      colors: ['white', 'black'],
      print: { x: 106, y: 118, w: 132, h: 176 },
      art: { x: 110, y: 126, w: 124, h: 160 },
      base(c, u) {
        const L = isLight(c);
        return `${shadow(u, 184, 322, 112, 12, 0.6)}
          <defs><linearGradient id="${u}i" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${shade(c, L ? -0.45 : -0.6)}"/><stop offset="1" stop-color="${shade(c, L ? -0.15 : -0.2)}"/></linearGradient></defs>
          <path d="M252,136 C314,130 320,256 252,262 L252,238 C294,234 292,160 252,160 Z" fill="${shade(c, L ? -0.06 : 0.04)}"/>
          <path d="${MUG}" fill="${c}"/>
          <ellipse cx="172" cy="92" rx="80" ry="16" fill="${shade(c, L ? -0.04 : 0.12)}"/>
          <ellipse cx="172" cy="94" rx="72" ry="12" fill="url(#${u}i)"/>`;
      },
      over(c, u) {
        const L = isLight(c);
        return `<defs><clipPath id="${u}c"><path d="${MUG}"/></clipPath>
          <linearGradient id="${u}g" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity="${L ? 0.28 : 0.5}"/><stop offset=".14" stop-color="#fff" stop-opacity="0"/><stop offset=".2" stop-color="#fff" stop-opacity="${L ? 0.45 : 0.16}"/><stop offset=".27" stop-color="#fff" stop-opacity="0"/><stop offset=".7" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="${L ? 0.32 : 0.55}"/></linearGradient>
          <linearGradient id="${u}hd" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity=".25"/><stop offset=".6" stop-color="#fff" stop-opacity="${L ? 0.25 : 0.1}"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></linearGradient></defs>
          <rect x="92" y="80" width="160" height="250" fill="url(#${u}g)" clip-path="url(#${u}c)"/>
          <path d="M252,136 C314,130 320,256 252,262 L252,238 C294,234 292,160 252,160 Z" fill="url(#${u}hd)"/>
          <path d="M92,94 L92,312 A80,16 0 0 0 252,312 L252,94" fill="none" stroke="${L ? 'rgba(0,0,0,.12)' : 'rgba(255,255,255,.14)'}" stroke-width="1"/>
          <ellipse cx="172" cy="92" rx="80" ry="16" fill="none" stroke="${L ? 'rgba(0,0,0,.14)' : 'rgba(255,255,255,.22)'}" stroke-width="1.2"/>`;
      }
    },

    phonecase: {
      label: 'Phone Case', short: 'Phone Case', category: 'phone-cases', basePrice: 599,
      colors: ['black', 'white', 'navy', 'lavender'],
      models: [
        'iPhone 18 Pro Max', 'iPhone 18 Pro', 'iPhone 17 Pro Max', 'iPhone 17 Pro', 'iPhone Air', 'iPhone 17', 'iPhone 17e',
        'iPhone 16 Pro Max', 'iPhone 16 Pro', 'iPhone 16 Plus', 'iPhone 16e', 'iPhone 16',
        'iPhone 15 Pro Max', 'iPhone 15 Pro', 'iPhone 15 Plus', 'iPhone 15', 'iPhone 14 Pro Max', 'iPhone 14 Pro', 'iPhone 14 Plus', 'iPhone 14',
        'iPhone 13 Pro Max', 'iPhone 13 Pro', 'iPhone 13', 'iPhone 13 mini', 'iPhone 12 Pro Max', 'iPhone 12 Pro', 'iPhone 12', 'iPhone 12 mini',
        'iPhone 11 Pro Max', 'iPhone 11 Pro', 'iPhone 11',
        'Galaxy S26 Ultra', 'Galaxy S26+', 'Galaxy S26', 'Galaxy S25 Ultra', 'Galaxy S25+', 'Galaxy S25 Edge', 'Galaxy S25 FE', 'Galaxy S25',
        'Galaxy S24 Ultra', 'Galaxy S24+', 'Galaxy S24 FE', 'Galaxy S24', 'Galaxy S23 Ultra', 'Galaxy S23+', 'Galaxy S23 FE', 'Galaxy S23',
        'Galaxy S22 Ultra', 'Galaxy S22+', 'Galaxy S22', 'Galaxy S21 Ultra', 'Galaxy S21+', 'Galaxy S21 FE', 'Galaxy S21',
        'Galaxy A57 5G', 'Galaxy A56 5G', 'Galaxy A55 5G', 'Galaxy A54 5G', 'Galaxy A37 5G', 'Galaxy A36 5G', 'Galaxy A35 5G',
        'Galaxy A27 5G', 'Galaxy A26 5G', 'Galaxy A25 5G', 'Galaxy A17 5G', 'Galaxy A16 5G', 'Galaxy A15 5G', 'Galaxy A14 5G',
        'Galaxy Z Fold8', 'Galaxy Z Fold7', 'Galaxy Z Fold6', 'Galaxy Z Fold5', 'Galaxy Z Flip8', 'Galaxy Z Flip7', 'Galaxy Z Flip6', 'Galaxy Z Flip5',
        'Pixel 11 Pro XL', 'Pixel 11 Pro', 'Pixel 11 Pro Fold', 'Pixel 11', 'Pixel 10 Pro XL', 'Pixel 10 Pro', 'Pixel 10 Pro Fold', 'Pixel 10', 'Pixel 10a',
        'Pixel 9 Pro XL', 'Pixel 9 Pro', 'Pixel 9 Pro Fold', 'Pixel 9', 'Pixel 9a', 'Pixel 8 Pro', 'Pixel 8', 'Pixel 8a',
        'Pixel 7 Pro', 'Pixel 7', 'Pixel 7a', 'Pixel 6 Pro', 'Pixel 6', 'Pixel 6a',
        'OnePlus 15', 'OnePlus 13', 'OnePlus 13R', 'OnePlus 13s', 'OnePlus 12', 'OnePlus 12R', 'OnePlus 11', 'OnePlus 11R', 'OnePlus 10 Pro',
        'OnePlus Nord 5', 'OnePlus Nord 4', 'OnePlus Nord 3',
        'Xiaomi 17 Pro Max', 'Xiaomi 17 Pro', 'Xiaomi 17', 'Xiaomi 15', 'Xiaomi 14',
        'Redmi Note 15 Pro+ 5G', 'Redmi Note 15 Pro 5G', 'Redmi Note 15 5G', 'Redmi Note 14 Pro+ 5G', 'Redmi Note 14 Pro 5G', 'Redmi Note 14 5G',
        'Redmi Note 13 Pro+ 5G', 'Redmi Note 13 Pro 5G', 'Redmi Note 13 5G', 'Redmi Note 12 Pro+ 5G', 'Redmi Note 12 Pro 5G', 'Redmi Note 12 5G',
        'POCO X8', 'POCO X7 Pro', 'POCO X7', 'POCO X6 Pro', 'POCO X6', 'POCO F8 Ultra', 'POCO F8 Pro', 'POCO F7', 'POCO F6',
        'OPPO Reno16', 'OPPO Reno16c', 'OPPO Reno15 Pro', 'OPPO Reno15', 'OPPO Reno14 Pro', 'OPPO Reno14', 'OPPO Reno13 Pro', 'OPPO Reno13',
        'OPPO Reno12 Pro', 'OPPO Reno12', 'OPPO Find X9 Ultra', 'OPPO Find X9 Pro', 'OPPO Find X9', 'OPPO Find X8 Pro', 'OPPO Find X8',
        'vivo V70 Elite', 'vivo V70', 'vivo V60 Pro', 'vivo V60', 'vivo V50', 'vivo V40', 'vivo V40 Pro', 'vivo V30',
        'vivo X300 Ultra', 'vivo X300 Pro', 'vivo X300 FE', 'vivo X300', 'vivo X200 Pro', 'vivo X200',
        'vivo Y400', 'vivo Y300', 'vivo Y200', 'vivo T5 5G',
        'motorola edge 70 max', 'motorola edge 70 pro', 'motorola edge 70', 'motorola edge 60 pro', 'motorola edge 60 fusion',
        'motorola edge 60', 'motorola edge 50 ultra', 'motorola edge 50 pro', 'motorola edge 50 fusion', 'motorola edge 50 neo',
        'motorola edge 50', 'motorola razr 70', 'motorola razr 60', 'motorola razr 50', 'moto g96', 'moto g86', 'moto g85', 'moto g75',
        'realme 16 Pro+', 'realme 16 Pro', 'realme 16', 'realme 15 Pro+', 'realme 15 Pro', 'realme 15', 'realme 14 Pro+', 'realme 14 Pro', 'realme 14',
        'Nothing Phone (3)', 'Nothing Phone (3a) Pro', 'Nothing Phone (3a)', 'Nothing Phone (2a) Plus', 'Nothing Phone (2a)'
      ],
      print: { x: 128, y: 40, w: 144, h: 320 },
      art: { x: 128, y: 40, w: 144, h: 320 },
      sceneFill: true,
      clip: '<rect x="128" y="40" width="144" height="320" rx="28"/>',
      clipFabric: { kind: 'rect', rx: 28 },
      base(c, u) {
        return `${shadow(u, 206, 364, 84, 10, 0.55)}
          <rect x="128" y="40" width="144" height="320" rx="28" fill="${c}"/>`;
      },
      over(c, u) {
        const L = isLight(c);
        return `<defs><clipPath id="${u}c"><rect x="128" y="40" width="144" height="320" rx="28"/></clipPath>
          <linearGradient id="${u}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".16"/><stop offset=".35" stop-color="#fff" stop-opacity="0"/><stop offset=".7" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".25"/></linearGradient>
          <radialGradient id="${u}l" cx=".4" cy=".35" r=".6"><stop offset="0" stop-color="#4b5bd8"/><stop offset=".5" stop-color="#121426"/><stop offset="1" stop-color="#05060b"/></radialGradient></defs>
          <rect x="128" y="40" width="144" height="320" fill="url(#${u}g)" clip-path="url(#${u}c)"/>
          <rect x="129" y="41" width="142" height="318" rx="27" fill="none" stroke="${L ? 'rgba(0,0,0,.18)' : 'rgba(255,255,255,.2)'}" stroke-width="1.5"/>
          <rect x="133" y="45" width="134" height="310" rx="23" fill="none" stroke="${L ? 'rgba(0,0,0,.06)' : 'rgba(255,255,255,.06)'}" stroke-width="1"/>
          <rect x="272" y="112" width="3" height="40" rx="1.5" fill="${shade(c, L ? -0.2 : 0.15)}"/>
          <rect x="125" y="96" width="3" height="16" rx="1.5" fill="${shade(c, L ? -0.2 : 0.15)}"/><rect x="125" y="122" width="3" height="30" rx="1.5" fill="${shade(c, L ? -0.2 : 0.15)}"/>
          <rect x="139" y="51" width="70" height="70" rx="19" fill="rgba(10,10,14,.55)" stroke="rgba(255,255,255,.18)" stroke-width="1.2"/>
          ${[[158, 70], [158, 102], [190, 86]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="13" fill="#1d1d24" stroke="#4a4a55" stroke-width="1.4"/><circle cx="${x}" cy="${y}" r="8.5" fill="url(#${u}l)"/><circle cx="${x - 3}" cy="${y - 3}" r="2" fill="#fff" opacity=".55"/>`).join('')}
          <circle cx="190" cy="62" r="4" fill="#efe6c8"/><circle cx="190" cy="110" r="2.6" fill="#2a2a33"/>`;
      }
    },

    cushion: {
      label: 'Cushion', short: 'Cushion', category: 'home-living', basePrice: 799,
      colors: ['white', 'beige', 'black'],
      sizes: ['16 × 16 in', '18 × 18 in'], sizeAdd: { '18 × 18 in': 100 },
      print: { x: 104, y: 104, w: 192, h: 192 },
      art: { x: 116, y: 116, w: 168, h: 168 },
      sceneFill: false,
      clip: `<path d="${CUSHION}"/>`,
      clipFabric: { kind: 'path', d: CUSHION },
      base(c, u) {
        return `${shadow(u, 204, 330, 120, 12, 0.55)}<path d="${CUSHION}" fill="${c}"/>`;
      },
      over(c, u) {
        const L = isLight(c);
        return `<defs><clipPath id="${u}c"><path d="${CUSHION}"/></clipPath>
          <radialGradient id="${u}r" cx=".46" cy=".42" r=".62"><stop offset="0" stop-color="#fff" stop-opacity="${L ? 0.18 : 0.07}"/><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="${L ? 0.3 : 0.55}"/></radialGradient></defs>
          <g clip-path="url(#${u}c)">
            <rect width="400" height="400" fill="url(#${u}r)"/>
            <g filter="url(#${u}f)" fill="none" stroke="#000" stroke-width="5" opacity="${L ? 0.16 : 0.4}">
              <path d="M98,96 Q130,118 140,140"/><path d="M302,96 Q272,120 262,140"/><path d="M98,304 Q130,282 140,262"/><path d="M302,304 Q272,282 262,262"/>
            </g>
          </g>
          <path d="${CUSHION}" fill="none" stroke="${L ? 'rgba(0,0,0,.2)' : 'rgba(255,255,255,.16)'}" stroke-width="2"/>`;
      }
    },

    tote: {
      label: 'Tote Bag', short: 'Tote Bag', category: 'accessories', basePrice: 549,
      colors: ['natural', 'black'],
      print: { x: 130, y: 208, w: 140, h: 138 },
      art: { x: 136, y: 212, w: 128, h: 128 },
      base(c, u) {
        const L = isLight(c);
        const strap = shade(c, L ? -0.12 : 0.08);
        return `${shadow(u, 200, 366, 120, 10, 0.55)}
          <path d="M164,176 C164,104 236,104 236,176" fill="none" stroke="${shade(c, L ? -0.3 : -0.3)}" stroke-width="9"/>
          <path d="${TOTE}" fill="${c}"/>
          <path d="M106,172 L294,172 L294.8,186 L105.2,186 Z" fill="${shade(c, L ? -0.08 : 0.05)}"/>
          <path d="M156,190 C156,92 244,92 244,190" fill="none" stroke="${strap}" stroke-width="11"/>
          <rect x="150.5" y="180" width="11" height="28" fill="${strap}"/><rect x="238.5" y="180" width="11" height="28" fill="${strap}"/>
          <g stroke="${L ? 'rgba(0,0,0,.25)' : 'rgba(255,255,255,.18)'}" stroke-width="1" fill="none">
            <path d="M152,194 L160,206 M160,194 L152,206"/><path d="M240,194 L248,206 M248,194 L240,206"/>
            <path d="M107,190 L293,190" stroke-dasharray="2 2"/>
          </g>`;
      },
      over(c, u) {
        const L = isLight(c);
        return `<defs><clipPath id="${u}c"><path d="${TOTE}"/></clipPath>${sideGrad(u + 'g', L ? 0.18 : 0.4)}</defs>
          <g clip-path="url(#${u}c)">
            <rect width="400" height="400" fill="url(#${u}g)"/>
            <g filter="url(#${u}f)" fill="none" stroke="#000" opacity="${L ? 0.1 : 0.35}" stroke-width="7"><path d="M150,200 Q140,280 152,360"/><path d="M262,200 Q272,280 258,360"/></g>
          </g>
          <path d="${TOTE}" fill="none" stroke="${L ? 'rgba(0,0,0,.18)' : 'rgba(255,255,255,.15)'}" stroke-width="1.2"/>`;
      }
    },

    frame: {
      label: 'Framed Poster', short: 'Poster', category: 'home-living', basePrice: 999,
      colors: ['black', 'white', 'gold'],
      sizes: ['A4', 'A3'], sizeAdd: { A3: 400 },
      print: { x: 130, y: 92, w: 140, h: 216 },
      art: { x: 130, y: 92, w: 140, h: 216 },
      sceneFill: true,
      ink: () => '#f3ede4',
      clip: '<rect x="130" y="92" width="140" height="216"/>',
      clipFabric: { kind: 'rect', rx: 0 },
      base(c, u) {
        const gold = c === COLORS.gold.hex;
        return `<defs><linearGradient id="${u}fr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${gold ? '#f3d999' : shade(c, 0.12)}"/><stop offset=".5" stop-color="${c}"/><stop offset="1" stop-color="${gold ? '#8a6428' : shade(c, -0.25)}"/></linearGradient></defs>
          <rect x="116" y="80" width="184" height="260" fill="#000" opacity=".6" filter="url(#${u}b)"/>
          <rect x="108" y="70" width="184" height="260" fill="url(#${u}fr)"/>
          <rect x="120" y="82" width="160" height="236" fill="#f3efe7"/>
          <rect x="130" y="92" width="140" height="216" fill="#121019"/>`;
      },
      over(c, u) {
        return `<defs><linearGradient id="${u}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".14"/><stop offset=".4" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity=".04"/></linearGradient></defs>
          <rect x="120" y="82" width="160" height="236" fill="url(#${u}g)"/>
          <rect x="120.5" y="82.5" width="159" height="235" fill="none" stroke="rgba(0,0,0,.25)" stroke-width="1"/>
          <rect x="108.5" y="70.5" width="183" height="259" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="1"/>`;
      }
    }
  };

  /* ---------------- artwork library (200 × 200 canvas) ---------------- */
  const SCENE_MOUNTAIN = (u) => `<defs><linearGradient id="${u}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1c1d3f"/><stop offset=".5" stop-color="#6d4f8a"/><stop offset=".78" stop-color="#e59a62"/><stop offset="1" stop-color="#f6cf8e"/></linearGradient></defs>
    <rect width="200" height="200" fill="url(#${u}s)"/>
    ${dots([[20, 22, 0.9], [46, 40, 0.6], [80, 18, 0.8], [150, 28, 0.7], [178, 50, 0.9], [112, 44, 0.5], [30, 66, 0.5]], '#fff', 0.8)}
    <circle cx="132" cy="112" r="22" fill="#fbe2b0" opacity=".95"/>
    <path d="M0,150 L40,96 L62,120 L98,70 L130,116 L150,98 L200,150 L200,200 L0,200Z" fill="#3b3456"/>
    <path d="M98,70 L87,86 L95,83 L100,90 L105,82 L112,87Z M40,96 L33,106 L39,104 L44,108 L49,102Z" fill="#f4eef6" opacity=".9"/>
    <path d="M0,170 L30,138 L58,160 L96,124 L134,166 L168,140 L200,166 L200,200 L0,200Z" fill="#221e35"/>
    <path d="M0,186 L50,166 L100,184 L150,170 L200,186 L200,200 L0,200Z" fill="#121020"/>
    <path d="M56,62 q4,-4 8,0 q4,-4 8,0 M78,52 q3,-3 6,0 q3,-3 6,0" fill="none" stroke="#1c1830" stroke-width="1.4"/>`;

  const SCENE_LAKE = (u) => `<defs><linearGradient id="${u}k" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fbcc6"/><stop offset=".6" stop-color="#dfeae5"/><stop offset="1" stop-color="#f2ecdd"/></linearGradient>
    <linearGradient id="${u}w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6aa1a9"/><stop offset="1" stop-color="#2c5964"/></linearGradient></defs>
    <rect width="200" height="200" fill="url(#${u}k)"/>
    <circle cx="140" cy="60" r="15" fill="#fff6dc"/>
    <path d="M0,122 L36,72 L60,98 L96,52 L130,100 L152,84 L200,122 Z" fill="#7aa7ad"/>
    <path d="M96,52 L86,67 L94,65 L98,71 L104,64 L110,69Z M36,72 L29,82 L35,80 L40,85 L44,79Z" fill="#fff"/>
    <path d="M0,130 L44,98 L78,124 L118,92 L160,126 L200,106 L200,130 Z" fill="#3f7680"/>
    <rect y="130" width="200" height="70" fill="url(#${u}w)"/>
    <g stroke="#fff" stroke-linecap="round" opacity=".55"><path d="M120,144 L160,144" stroke-width="2"/><path d="M130,152 L150,152" stroke-width="1.6"/><path d="M40,162 L84,162" stroke-width="1.6"/><path d="M90,176 L120,176" stroke-width="1.4"/></g>
    ${[[14, 134, 30], [28, 136, 40], [44, 134, 26], [178, 134, 34], [190, 136, 24]].map(([x, y, h]) => `<path d="M${x},${y - h} L${x - h * 0.28},${y} L${x + h * 0.28},${y}Z M${x},${y - h * 0.75} L${x - h * 0.36},${y - h * 0.2} L${x + h * 0.36},${y - h * 0.2}Z" fill="#1f4048"/>`).join('')}`;

  const DESIGNS = {
    'abstract-mind': {
      name: 'Abstract Mind', kind: 'graphic',
      render({ ink, u }) {
        const pts = [];
        const n = 22;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 - Math.PI / 2;
          const r = i % 2 ? 16 + ((i * 37) % 11) : 50 + ((i * 53) % 34);
          pts.push((100 + Math.cos(a) * r).toFixed(1) + ',' + (100 + Math.sin(a) * r).toFixed(1));
        }
        return `<defs><linearGradient id="${u}a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#a9d0ff"/><stop offset="1" stop-color="#2f5bff"/></linearGradient></defs>
          <path d="M26,92 C28,58 62,44 84,56 C104,68 94,96 70,104 C50,112 25,120 26,92Z" fill="url(#${u}a)" opacity=".9"/>
          <path d="M118,126 C140,108 178,116 174,142 C170,168 136,172 122,160 C110,150 104,136 118,126Z" fill="url(#${u}a)" opacity=".85"/>
          <path d="M120,38 C134,26 162,30 160,50 C158,66 136,70 126,62 C116,56 110,46 120,38Z" fill="#6f9dff" opacity=".8"/>
          <polygon points="${pts.join(' ')}" fill="${ink}"/>
          <g stroke="${ink}" stroke-linecap="round"><path d="M100,100 L176,58" stroke-width="2.2"/><path d="M100,100 L30,152" stroke-width="2.2"/><path d="M100,100 L150,180" stroke-width="1.4"/></g>
          ${dots([[40, 130, 3], [160, 90, 2.5], [60, 40, 2], [176, 160, 3.5], [24, 60, 2], [140, 24, 2.2], [90, 172, 2.6]], '#5b8cff', 0.9)}
          <circle cx="100" cy="100" r="9" fill="#2f5bff"/>`;
      }
    },
    'better-days': {
      name: 'Better Days Ahead', kind: 'text',
      template: [{ text: 'Better\nDays\nAhead', font: 'Kaushan Script', size: 46, angle: -7, lineHeight: 0.92 }],
      render({ ink }) {
        return `<g transform="rotate(-7 100 100)" fill="${ink}" font-family="'Kaushan Script', cursive" text-anchor="middle">
          <text x="98" y="72" font-size="48">Better</text><text x="104" y="116" font-size="48">Days</text><text x="100" y="158" font-size="44">Ahead</text></g>
          <path d="M58,174 Q100,162 148,170" stroke="${ink}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
      }
    },
    butterfly: {
      name: 'Butterfly Effect', kind: 'graphic',
      render({ ink, u }) {
        const wings = `<path d="M102,98 C114,52 166,30 182,56 C196,80 168,108 104,106 Z" fill="url(#${u}w)"/>
          <path d="M103,108 C146,108 174,130 160,158 C148,182 116,160 103,114 Z" fill="url(#${u}w2)"/>
          <g fill="none" stroke="rgba(255,255,255,.75)" stroke-width="1.2"><path d="M104,102 C130,84 156,66 176,58"/><path d="M104,104 C136,96 160,90 184,80"/><path d="M104,110 C126,124 142,140 152,160"/><path d="M106,112 C122,136 128,150 126,166"/></g>
          ${dots([[170, 64, 3], [178, 76, 2], [154, 150, 2.5]], '#fff', 0.85)}`;
        return `<defs><linearGradient id="${u}w" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d7eeff"/><stop offset=".45" stop-color="#7fb4ff"/><stop offset="1" stop-color="#4b3fd8"/></linearGradient>
          <linearGradient id="${u}w2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6aa8ff"/><stop offset="1" stop-color="#a77bff"/></linearGradient></defs>
          <g>${wings}</g><g transform="translate(200 0) scale(-1 1)">${wings}</g>
          <ellipse cx="100" cy="110" rx="4.5" ry="28" fill="${ink}"/><circle cx="100" cy="80" r="5" fill="${ink}"/>
          <g fill="none" stroke="${ink}" stroke-width="1.6" stroke-linecap="round"><path d="M98,77 C92,62 86,54 80,52"/><path d="M102,77 C108,62 114,54 120,52"/></g>
          <path d="${spark(40, 40, 6)} ${spark(160, 176, 5)} ${spark(30, 150, 4)}" fill="${ink}" opacity=".8"/>`;
      }
    },
    'dream-plan': {
      name: 'Dream Plan Do Repeat', kind: 'text',
      template: [{ text: 'DREAM\nPLAN\nDO\nREPEAT', font: 'Bebas Neue', size: 42, lineHeight: 0.9, charSpacing: 80 }],
      render({ ink }) {
        return `<g fill="${ink}" font-family="'Bebas Neue', sans-serif" text-anchor="middle" letter-spacing="2">
          <text x="100" y="60" font-size="44">DREAM</text><text x="100" y="101" font-size="44">PLAN</text>
          <text x="100" y="142" font-size="44" fill="#e2b77a">DO</text><text x="100" y="183" font-size="44">REPEAT</text></g>`;
      }
    },
    galaxy: {
      name: 'Galaxy Vibes', kind: 'graphic',
      render({ ink, u }) {
        return `<defs><radialGradient id="${u}p" cx=".35" cy=".3" r=".85"><stop offset="0" stop-color="#f6d7a0"/><stop offset=".55" stop-color="#b9785a"/><stop offset="1" stop-color="#3b2a6b"/></radialGradient></defs>
          <g transform="rotate(-18 100 104)"><path d="M30,104 A70,16 0 0 1 170,104" fill="none" stroke="${ink}" stroke-width="2.5" opacity=".85"/></g>
          <circle cx="100" cy="104" r="36" fill="url(#${u}p)"/>
          <g fill="none" stroke="rgba(255,255,255,.28)" stroke-width="2"><path d="M68,94 Q100,86 132,94"/><path d="M66,110 Q100,104 134,112"/></g>
          <g transform="rotate(-18 100 104)"><path d="M30,104 A70,16 0 0 0 170,104" fill="none" stroke="${ink}" stroke-width="2.5"/><path d="M42,104 A58,11 0 0 0 158,104" fill="none" stroke="#e2b77a" stroke-width="1.2"/></g>
          <circle cx="158" cy="56" r="7" fill="${ink}" opacity=".9"/>
          <path d="${spark(40, 44, 7)} ${spark(166, 150, 6)} ${spark(46, 160, 5)} ${spark(120, 30, 4)}" fill="${ink}"/>
          ${dots([[70, 30, 1.6], [150, 100, 1.4], [26, 100, 1.6], [180, 120, 1.2], [90, 176, 1.6], [130, 170, 1.2]], ink, 0.9)}`;
      }
    },
    'mountain-soul': {
      name: 'Mountain Soul', kind: 'graphic', scene: true,
      template: [{ text: 'MOUNTAIN SOUL', font: 'Montserrat', size: 13, weight: 600, charSpacing: 400, offsetY: 0.42 }],
      render({ ink, u, fill, noText }) {
        if (fill) return SCENE_MOUNTAIN(u);
        return `<svg x="34" y="22" width="132" height="132" viewBox="0 0 200 200">${SCENE_MOUNTAIN(u)}</svg>
          <rect x="34" y="22" width="132" height="132" fill="none" stroke="${ink}" stroke-opacity=".35"/>
          ${noText ? '' : `<text x="100" y="180" text-anchor="middle" font-family="Montserrat, sans-serif" font-weight="600" font-size="11" letter-spacing="4" fill="${ink}">MOUNTAIN SOUL</text>`}`;
      }
    },
    astronaut: {
      name: 'Lost in Space', kind: 'graphic',
      render({ u }) {
        const suit = '#f1ece4', line = '#1d1a24';
        return `<defs><linearGradient id="${u}v" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1b1f4a"/><stop offset=".6" stop-color="#6a4fd0"/><stop offset="1" stop-color="#e8b87a"/></linearGradient></defs>
          <path d="${spark(34, 40, 7)} ${spark(166, 36, 5)} ${spark(170, 130, 6)} ${spark(28, 120, 4)}" fill="#e2b77a"/>
          ${dots([[60, 24, 1.5], [140, 60, 1.4], [180, 80, 1.5], [20, 80, 1.3], [150, 176, 1.5], [44, 180, 1.4]], '#f1ece4', 0.9)}
          <g stroke="${line}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round">
            <path d="M54,162 C58,140 84,136 100,146 C116,136 142,140 146,162 C140,174 116,176 100,168 C84,176 60,174 54,162Z" fill="${suit}"/>
            <path d="M76,142 C72,116 80,98 100,96 C120,98 128,116 124,142 Z" fill="${suit}"/>
            <path d="M80,108 C66,118 62,134 70,150 L80,152 C78,140 80,128 88,120Z" fill="${suit}"/>
            <path d="M120,108 C134,118 138,134 130,150 L120,152 C122,140 120,128 112,120Z" fill="${suit}"/>
            <circle cx="74" cy="152" r="6" fill="${suit}"/><circle cx="126" cy="152" r="6" fill="${suit}"/>
            <rect x="90" y="114" width="20" height="14" rx="3" fill="${suit}"/>
            <circle cx="100" cy="72" r="27" fill="${suit}"/>
            <path d="M80,70 C80,56 120,56 120,70 C120,86 80,86 80,70Z" fill="url(#${u}v)"/>
          </g>
          <path d="M86,64 Q92,60 100,60" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".7"/>
          ${dots([[108, 70, 1.2], [96, 76, 0.9], [112, 76, 0.8]], '#fff', 0.9)}
          <circle cx="95" cy="121" r="2" fill="#e2b77a"/><circle cx="105" cy="121" r="2" fill="#7fb4ff"/>`;
      }
    },
    'good-vibes': {
      name: 'Good Vibes Only', kind: 'text',
      template: [{ text: 'Good\nVibes\nOnly', font: 'Kaushan Script', size: 48, angle: -8, lineHeight: 0.92 }],
      render({ ink }) {
        return `<g transform="rotate(-8 100 100)" fill="${ink}" font-family="'Kaushan Script', cursive" text-anchor="middle">
          <text x="96" y="74" font-size="50">Good</text><text x="104" y="120" font-size="50">Vibes</text><text x="100" y="164" font-size="46">Only</text></g>`;
      }
    },
    'dream-create': {
      name: 'Dream Create Wear', kind: 'graphic',
      template: [{ text: 'DREAM\nCREATE\nWEAR', font: 'Permanent Marker', size: 32, angle: -10, lineHeight: 1 }],
      render({ ink, noText }) {
        return `<g fill="none" stroke="${ink}" stroke-width="2.2" stroke-linejoin="round" opacity=".92"><path d="M82,40 L86,18 L94,31 L100,14 L106,31 L114,18 L118,40 Z"/><path d="M82,45 L118,45"/></g>
          ${noText ? '' : `<g transform="rotate(-10 100 100)" fill="${ink}" font-family="'Permanent Marker', cursive" text-anchor="middle" opacity=".92">
            <text x="100" y="84" font-size="34">DREAM</text><text x="104" y="120" font-size="34">CREATE</text><text x="100" y="156" font-size="34">WEAR</text></g>`}
          <path d="M64,172 C96,162 126,156 152,150 C132,160 112,168 92,178" stroke="${ink}" stroke-width="2.6" fill="none" stroke-linecap="round" opacity=".9"/>
          ${noText ? '' : `<text x="100" y="196" font-family="'Cormorant Garamond', serif" font-weight="600" font-size="11" letter-spacing="3" text-anchor="middle" fill="${ink}" opacity=".8">ELITEHUB</text>`}`;
      }
    },
    'mountain-line': {
      name: 'Mountain Line', kind: 'graphic',
      render({ ink }) {
        return `<g fill="none" stroke="${ink}" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round">
            <path d="M18,150 L62,92 L80,112 L108,68 L140,116 L156,100 L184,150"/>
            <path d="M100,80 L108,90 L115,80"/><path d="M56,100 L62,106 L68,99"/><path d="M108,68 L101,96 L105,118"/><path d="M62,92 L58,116"/>
            <path d="M18,150 L184,150"/><path d="M40,161 L90,161"/><path d="M110,161 L162,161"/><path d="M62,171 L140,171"/>
            <path d="M146,38 A14,14 0 1 0 162,56 A11,11 0 1 1 146,38Z"/>
          </g>
          <path d="${spark(40, 46, 5)} ${spark(84, 30, 3.5)} ${spark(176, 86, 4)}" fill="${ink}"/>
          ${dots([[24, 70, 1.3], [120, 40, 1.2], [60, 60, 1], [180, 30, 1.3]], ink, 0.9)}`;
      }
    },
    'lake-scene': {
      name: 'Serene Lake', kind: 'graphic', scene: true,
      render({ ink, u, fill }) {
        if (fill) return SCENE_LAKE(u);
        return `<svg x="22" y="22" width="156" height="156" viewBox="0 0 200 200">${SCENE_LAKE(u)}</svg><rect x="22" y="22" width="156" height="156" fill="none" stroke="${ink}" stroke-opacity=".25"/>`;
      }
    },
    'elite-crest': {
      name: 'Elite Crest', kind: 'graphic',
      template: [{ text: 'ELITEHUB', font: 'Cormorant Garamond', size: 16, weight: 600, charSpacing: 400, offsetY: 0.36, fill: '#e2b77a' }],
      render({ u, noText }) {
        const leaves = [];
        for (let i = 0; i < 8; i++) {
          const a = ((104 + i * 17) * Math.PI) / 180;
          const x = 100 + Math.cos(a) * 52, y = 100 + Math.sin(a) * 52;
          const rot = (a * 180) / Math.PI + 90 + 28;
          leaves.push(`<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="9" ry="3.6" transform="rotate(${rot.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})"/>`);
        }
        const branch = `<path d="M92,154 A52,52 0 0 1 64,58" fill="none" stroke="url(#${u}g)" stroke-width="2"/><g fill="url(#${u}g)">${leaves.join('')}</g>`;
        return `<defs><linearGradient id="${u}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f6e0ad"/><stop offset=".5" stop-color="#d4a45e"/><stop offset="1" stop-color="#a87633"/></linearGradient></defs>
          ${branch}<g transform="translate(200 0) scale(-1 1)">${branch}</g>
          <path d="M84,40 L88,24 L95,33 L100,20 L105,33 L112,24 L116,40 Z" fill="url(#${u}g)"/>
          ${noText ? '' : `<image href="assets/logo-monogram.png" x="68" y="62" width="64" height="67"/>
          <text x="100" y="166" text-anchor="middle" font-family="'Cormorant Garamond', serif" font-weight="600" font-size="15" letter-spacing="4" fill="url(#${u}g)">ELITEHUB</text>
          <text x="100" y="180" text-anchor="middle" font-family="Montserrat, sans-serif" font-size="6" letter-spacing="2.4" fill="url(#${u}g)">LUXURY CUSTOMIZATIONS</text>`}`;
      }
    },
    'stay-golden': {
      name: 'Stay Golden', kind: 'graphic',
      template: [{ text: 'Stay Golden', font: 'Great Vibes', size: 44, offsetY: 0.22 }],
      render({ ink, u, noText }) {
        return `<defs><linearGradient id="${u}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd27a"/><stop offset=".55" stop-color="#ff8a5c"/><stop offset="1" stop-color="#c2477f"/></linearGradient>
          <mask id="${u}m"><rect width="200" height="200" fill="#fff"/><rect y="100" width="200" height="3" fill="#000"/><rect y="111" width="200" height="5" fill="#000"/><rect y="124" width="200" height="7" fill="#000"/><rect y="139" width="200" height="9" fill="#000"/></mask></defs>
          <circle cx="100" cy="92" r="58" fill="url(#${u}g)" mask="url(#${u}m)"/>
          ${noText ? '' : `<text x="100" y="150" font-family="'Great Vibes', cursive" font-size="46" fill="${ink}" text-anchor="middle">Stay Golden</text>`}`;
      }
    },
    'moon-phases': {
      name: 'Moon Phases', kind: 'graphic',
      template: [{ text: 'TRUST THE TIMING', font: 'Montserrat', size: 11, weight: 600, charSpacing: 400, offsetY: 0.2 }],
      render({ ink, noText }) {
        const r = 12, y = 92;
        const m = (cx, kind) => {
          const o = `<circle cx="${cx}" cy="${y}" r="${r}" fill="none" stroke="${ink}" stroke-width="1.4"/>`;
          if (kind === 0) return o;
          if (kind === 4) return `<circle cx="${cx}" cy="${y}" r="${r}" fill="${ink}"/>`;
          const top = `M${cx},${y - r} A${r},${r} 0 0 1 ${cx},${y + r}`;
          const back = kind === 1 ? ` A${r / 2},${r} 0 0 0 ${cx},${y - r}Z` : kind === 2 ? 'Z' : ` A${r / 2},${r} 0 0 1 ${cx},${y - r}Z`;
          return o + `<path d="${top}${back}" fill="${ink}"/>`;
        };
        return `${m(36, 0)}${m(68, 1)}${m(100, 2)}${m(132, 3)}${m(164, 4)}
          <path d="M60,62 L140,62 M60,122 L140,122" stroke="${ink}" stroke-width="1" opacity=".45"/>
          <path d="${spark(100, 44, 5)}" fill="${ink}"/>
          ${noText ? '' : `<text x="100" y="146" text-anchor="middle" font-family="Montserrat, sans-serif" font-weight="600" font-size="10" letter-spacing="4" fill="${ink}">TRUST THE TIMING</text>`}`;
      }
    }
  };

  /* ---------------- composer ---------------- */
  const commonDefs = (u) => `<filter id="${u}b" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="8"/></filter><filter id="${u}f" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="6"/></filter>`;

  function placeInner(T, inner, u, slice) {
    const b = T.art;
    const clipDef = T.clip ? `<clipPath id="${u}pc">${T.clip}</clipPath>` : '';
    return `${clipDef}<g${T.clip ? ` clip-path="url(#${u}pc)"` : ''}><svg x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" viewBox="0 0 200 200" preserveAspectRatio="xMidYMid ${slice ? 'slice' : 'meet'}" overflow="hidden">${inner}</svg></g>`;
  }

  /**
   * Render a product mockup as an SVG string.
   * opts.color   colour key or hex
   * opts.design  artwork id from EH.designs
   * opts.content raw SVG markup drawn inside the 200×200 print box
   * opts.layer   'full' (default) | 'base' (product only) | 'overlay' (shading only)
   * opts.noText  render artwork without its text parts
   * opts.px      explicit width/height attribute (for rasterising)
   */
  EH.mockup = function (type, opts = {}) {
    const T = TYPES[type] || TYPES.tshirt;
    const c = hexOf(opts.color || T.colors[0]);
    const u = uid();
    const layer = opts.layer || 'full';
    const ink = opts.ink || (T.ink ? T.ink(c) : inkFor(c));
    let content = '';
    if (layer === 'full') {
      if (opts.content) content = placeInner(T, opts.content, u, opts.slice);
      else if (opts.design && DESIGNS[opts.design]) {
        const D = DESIGNS[opts.design];
        const fill = !!(D.scene && T.sceneFill);
        content = placeInner(T, D.render({ ink, u: u + 'd', fill, noText: opts.noText }), u, fill);
      }
    }
    const size = opts.px ? ` width="${opts.px}" height="${opts.px}"` : '';
    const label = opts.label ? ` role="img" aria-label="${opts.label}"` : ' aria-hidden="true"';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"${size} class="${opts.className || 'mock'}"${label}><defs>${commonDefs(u)}</defs>${layer !== 'overlay' ? T.base(c, u) : ''}${content}${layer !== 'base' ? T.over(c, u) : ''}</svg>`;
  };

  /** Artwork on its own (for the design studio's art library). */
  EH.artwork = function (id, opts = {}) {
    const D = DESIGNS[id];
    if (!D) return '';
    const u = uid();
    const size = opts.px ? ` width="${opts.px}" height="${opts.px}"` : '';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"${size}>${D.render({ ink: opts.ink || '#f3ede4', u, fill: !!opts.fill, noText: opts.noText !== false })}</svg>`;
  };

  EH.svgToDataURL = (svg) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  EH.colors = COLORS;
  EH.types = TYPES;
  EH.designs = DESIGNS;
  EH.color = { hexOf, isLight, inkFor, shade };
})();
