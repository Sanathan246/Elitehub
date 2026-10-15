/* =====================================================================
   EliteHub — core: layout, cart, search, modals, toasts, helpers
   ===================================================================== */
(function () {
  const EH = (window.EH = window.EH || {});
  const C = (EH.config = window.EH_CONFIG || {});
  C.coupons = C.coupons || {};
  C.social = C.social || {};

  /* ---------------- utils ---------------- */
  EH.$ = (s, r = document) => r.querySelector(s);
  EH.$$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  EH.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  EH.money = (n) => {
    const value = Number(n);
    return (C.currency || '₹') + (Number.isFinite(value) ? Math.round(value).toLocaleString('en-IN') : '0');
  };
  EH.params = new URLSearchParams(location.search);
  EH.uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  EH.store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
    remove(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }
  };
  EH.validEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v).trim());
  EH.validPhone = (v) => /^(\+?91[\s-]?)?[6-9]\d{9}$/.test(String(v).replace(/[\s-]/g, ''));

  /* ---------------- icons ---------------- */
  const I = {
    search: '<circle cx="11" cy="11" r="7.5"/><path d="m20.5 20.5-4.2-4.2"/>',
    user: '<circle cx="12" cy="8" r="4.2"/><path d="M4 21c0-4.2 3.6-7 8-7s8 2.8 8 7"/>',
    cart: '<circle cx="9" cy="20.5" r="1.2"/><circle cx="18" cy="20.5" r="1.2"/><path d="M2.5 3h2.6l2.4 12.2a1.8 1.8 0 0 0 1.8 1.4h8.6a1.8 1.8 0 0 0 1.8-1.4L21.3 7.5H6"/>',
    bag: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
    arrow: '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
    plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
    minus: '<path d="M5 12h14"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    menu: '<path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/>',
    star: '<path d="m12 2.8 2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3L2.9 9.5l6.3-.9Z"/>',
    gem: '<path d="M6 3h12l4 6-10 13L2 9Z"/><path d="M11 3 8 9l4 13 4-13-3-6"/><path d="M2 9h20"/>',
    palette: '<path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.9 0 1.6-.7 1.6-1.7 0-.4-.2-.8-.4-1.1-.3-.3-.4-.7-.4-1.1 0-.9.7-1.7 1.7-1.7h2c3 0 5.5-2.5 5.5-5.5C22 6 17.5 2 12 2Z"/><circle cx="7.5" cy="11.5" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="15" cy="7" r="1"/><circle cx="17.5" cy="11" r="1"/>',
    globe: '<circle cx="12" cy="12" r="9.5"/><path d="M12 2.5a14 14 0 0 0 0 19 14 14 0 0 0 0-19"/><path d="M2.5 12h19"/>',
    truck: '<path d="M14 17V6a1.5 1.5 0 0 0-1.5-1.5h-9A1.5 1.5 0 0 0 2 6v10a1 1 0 0 0 1 1h1.5"/><path d="M15 17H9"/><path d="M19.5 17H21a1 1 0 0 0 1-1v-3.6a1 1 0 0 0-.2-.6l-3.5-4.4a1 1 0 0 0-.8-.4H14"/><circle cx="17" cy="17.5" r="2"/><circle cx="7" cy="17.5" r="2"/>',
    shirt: '<path d="M20.4 3.5 16 2a4 4 0 0 1-8 0L3.6 3.5a2 2 0 0 0-1.3 2.2l.6 3.5a1 1 0 0 0 1 .8H6v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V10h2.1a1 1 0 0 0 1-.8l.6-3.5a2 2 0 0 0-1.3-2.2Z"/>',
    shield: '<path d="M20 13c0 5-3.5 7.5-7.7 9a1 1 0 0 1-.6 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.2-2.7a1.2 1.2 0 0 1 1.6 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1Z"/><path d="m9 12 2 2 4-4"/>',
    lock: '<rect x="3.5" y="11" width="17" height="10.5" rx="2"/><path d="M7.5 11V7a4.5 4.5 0 0 1 9 0v4"/>',
    returns: '<path d="M3 12a9 9 0 1 0 9-9 9.7 9.7 0 0 0-6.7 2.7L3 8"/><path d="M3 3v5h5"/>',
    type: '<path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
    package: '<path d="m7.5 4.3 9 5.1"/><path d="M21 8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.7Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    sparkles: '<path d="M10 15.5A2 2 0 0 0 8.5 14l-6.1-1.6a.5.5 0 0 1 0-1L8.5 10A2 2 0 0 0 10 8.5l1.6-6.1a.5.5 0 0 1 1 0L14 8.5a2 2 0 0 0 1.5 1.5l6.1 1.6a.5.5 0 0 1 0 1L15.5 14a2 2 0 0 0-1.5 1.5l-1.6 6.1a.5.5 0 0 1-1 0Z"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    checkCircle: '<circle cx="12" cy="12" r="9.5"/><path d="m8 12 3 3 5-6"/>',
    trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M4 16a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2"/>',
    up: '<path d="m18 15-6-6-6 6"/>',
    down: '<path d="m6 9 6 6 6-6"/>',
    left: '<path d="m15 18-6-6 6-6"/>',
    right: '<path d="m9 18 6-6-6-6"/>',
    undo: '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/>',
    redo: '<path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 15-6.7l3 2.7"/>',
    center: '<circle cx="12" cy="12" r="3"/><path d="M12 2v4"/><path d="M12 18v4"/><path d="M2 12h4"/><path d="M18 12h4"/>',
    flip: '<path d="M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3"/><path d="M16 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3"/><path d="M12 2v2"/><path d="M12 8v2"/><path d="M12 14v2"/><path d="M12 20v2"/>',
    layers: '<path d="m12 2 10 5-10 5L2 7Z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/>',
    bold: '<path d="M7 5h6a3.5 3.5 0 0 1 0 7H7Z"/><path d="M7 12h7a3.5 3.5 0 0 1 0 7H7Z"/>',
    italic: '<path d="M19 4h-9"/><path d="M14 20H5"/><path d="M15 4 9 20"/>',
    alignL: '<path d="M21 6H3"/><path d="M15 12H3"/><path d="M17 18H3"/>',
    alignC: '<path d="M21 6H3"/><path d="M17 12H7"/><path d="M19 18H5"/>',
    alignR: '<path d="M21 6H3"/><path d="M21 12H9"/><path d="M21 18H7"/>',
    tag: '<path d="M12.6 2.6A2 2 0 0 0 11.2 2H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.7 8.7a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4Z"/><circle cx="7.5" cy="7.5" r="1.2"/>',
    mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-9 5.7a2 2 0 0 1-2 0L2 7"/>',
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z"/>',
    pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
    clock: '<circle cx="12" cy="12" r="9.5"/><path d="M12 6.5V12l3.5 2"/>',
    card: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/><path d="M6 15h4"/>',
    cash: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>',
    instagram: '<rect x="2.5" y="2.5" width="19" height="19" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17.5 6.5h.01"/>',
    youtube: '<path d="M2.5 17a24 24 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.6 49.6 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24 24 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.6 49.6 0 0 1-16.2 0A2 2 0 0 1 2.5 17"/><path d="m10 15 5-3-5-3Z"/>',
    pinterest: '<circle cx="12" cy="12" r="9.5"/><path d="M10.3 21 12 13.5"/><path d="M9.2 13.9a3.8 3.8 0 1 1 6.3-1.9c-.5 2-2.3 3-3.5 2.2"/>',
    xsocial: '<path d="M4 4h4.5L20 20h-4.5Z"/><path d="M20 4l-6.6 7.2M10.6 12.8 4 20"/>',
    whatsapp: '<path d="M3.5 20.5 5 16.3A8.6 8.6 0 1 1 8 19.2Z"/><path d="M9.2 8.6c.2-.5.5-.6.8-.6h.5c.2 0 .4 0 .5.4l.7 1.7c.1.2 0 .4-.1.6l-.5.6c-.1.1-.2.3 0 .5.5.9 1.3 1.7 2.3 2.2.2.1.4.1.5 0l.7-.8c.1-.2.3-.2.5-.1l1.6.8c.2.1.3.2.3.4 0 .5-.2 1.1-.7 1.4-.5.3-1.2.5-2 .3a8 8 0 0 1-4.9-4.6c-.4-1.1-.4-2 .1-2.8Z"/>',
    heart: '<path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7Z"/>',
    ruler: '<path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.4 2.4 0 0 1 0-3.4l2.6-2.6a2.4 2.4 0 0 1 3.4 0Z"/><path d="m14.5 12.5 2-2"/><path d="m11.5 9.5 2-2"/><path d="m8.5 6.5 2-2"/><path d="m17.5 15.5 2-2"/>'
  };
  EH.icon = (name, cls = '') => `<svg class="ico ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[name] || ''}</svg>`;

  /* ---------------- decorative backgrounds ---------------- */
  EH.starsSVG = (n = 140, seed = 7) => {
    let s = seed;
    const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    let out = '';
    for (let i = 0; i < n; i++) {
      const r = rnd() < 0.92 ? 0.5 + rnd() * 0.9 : 1.4 + rnd() * 0.8;
      out += `<circle cx="${(rnd() * 1600).toFixed(1)}" cy="${(rnd() * 900).toFixed(1)}" r="${r.toFixed(2)}" fill="#fff" opacity="${(0.2 + rnd() * 0.7).toFixed(2)}"/>`;
    }
    return `<svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${out}</svg>`;
  };

  const ridge = (pts) => pts.map((p, i) => (i ? 'L' : 'M') + p[0] + ',' + p[1]).join(' ');
  /* fractal (midpoint-displacement) ridge line, deterministic per seed */
  const ridgePts = (seed, y0, amp, peaks = [], rough = 0.52, levels = 7) => {
    let s = seed;
    const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280) * 2 - 1;
    let pts = [[0, y0], [1440, y0]];
    let a = amp;
    for (let l = 0; l < levels; l++) {
      const next = [pts[0]];
      for (let i = 0; i < pts.length - 1; i++) {
        const [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
        next.push([(x1 + x2) / 2, (y1 + y2) / 2 + rnd() * a], pts[i + 1]);
      }
      pts = next;
      a *= rough;
    }
    const env = (x) => peaks.reduce((h, [cx, w, ht]) => h + ht * Math.exp(-(((x - cx) / w) ** 2)), 0);
    return pts.map(([x, y]) => [Math.round(x), Math.min(316, Math.round(y - env(x)))]);
  };
  EH.mountainsSVG = (variant = 'hero') => {
    const far = ridgePts(11, 175, 70, [[1130, 170, 70], [300, 160, 45], [760, 120, 20]]);
    const mid = ridgePts(29, 228, 46, [[1300, 150, 40], [90, 140, 35], [560, 160, 18]]);
    const near = ridgePts(47, 270, 26, [[1000, 220, 14], [200, 200, 12]]);
    const close = (p) => ridge(p) + ' L1440,320 L0,320 Z';
    const glow = variant === 'hero' ? 0.85 : 1;
    return `<svg viewBox="0 0 1440 320" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <defs><linearGradient id="rim-${variant}" x1="0" x2="1"><stop offset="0" stop-color="#ffbe78" stop-opacity="0"/><stop offset=".45" stop-color="#ffbe78" stop-opacity="${0.35 * glow}"/><stop offset=".7" stop-color="#ffd29a" stop-opacity="${0.9 * glow}"/><stop offset=".9" stop-color="#9b7bff" stop-opacity="${0.5 * glow}"/><stop offset="1" stop-color="#9b7bff" stop-opacity="0"/></linearGradient>
      <linearGradient id="fade-${variant}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#120f1a"/><stop offset="1" stop-color="#070609"/></linearGradient>
      <filter id="blur-${variant}"><feGaussianBlur stdDeviation="3"/></filter></defs>
      <path d="${close(far)}" fill="url(#fade-${variant})"/>
      <path d="${ridge(far)}" fill="none" stroke="url(#rim-${variant})" stroke-width="4" filter="url(#blur-${variant})"/>
      <path d="${ridge(far)}" fill="none" stroke="url(#rim-${variant})" stroke-width="1.2"/>
      <path d="${close(mid)}" fill="#0a0810"/>
      <path d="${ridge(mid)}" fill="none" stroke="url(#rim-${variant})" stroke-width="1" opacity=".55"/>
      <path d="${close(near)}" fill="#060508"/>
    </svg>`;
  };

  EH.flowSVG = () => `<svg viewBox="0 0 1440 400" preserveAspectRatio="none" aria-hidden="true">
    <defs><linearGradient id="flowg" x1="0" x2="1"><stop offset="0" stop-color="#f2c48a" stop-opacity="0"/><stop offset=".35" stop-color="#f2c48a" stop-opacity=".9"/><stop offset=".7" stop-color="#ffd8a8" stop-opacity=".9"/><stop offset="1" stop-color="#9b7bff" stop-opacity="0"/></linearGradient>
    <filter id="flowb"><feGaussianBlur stdDeviation="14"/></filter><filter id="flowb2"><feGaussianBlur stdDeviation="1.4"/></filter></defs>
    <path d="M0,300 C300,170 520,370 780,240 S1180,110 1440,190" fill="none" stroke="url(#flowg)" stroke-width="70" opacity=".12" filter="url(#flowb)"/>
    <path d="M0,300 C300,170 520,370 780,240 S1180,110 1440,190" fill="none" stroke="url(#flowg)" stroke-width="2" opacity=".75" filter="url(#flowb2)"/>
    <path d="M0,326 C320,214 540,384 800,268 S1200,150 1440,226" fill="none" stroke="url(#flowg)" stroke-width="1" opacity=".5"/>
    <path d="M0,350 C340,250 560,396 820,296 S1220,190 1440,262" fill="none" stroke="url(#flowg)" stroke-width=".8" opacity=".3"/>
  </svg>`;

  EH.decorate = (root = document) => {
    EH.$$('i[data-icon]', root).forEach((el) => { el.outerHTML = EH.icon(el.dataset.icon, el.className); });
    EH.$$('[data-stars]', root).forEach((el, i) => { if (!el.childElementCount) el.innerHTML = EH.starsSVG(+el.dataset.stars || 140, 7 + i * 13); });
    EH.$$('[data-mountains]', root).forEach((el) => { if (!el.childElementCount) el.innerHTML = EH.mountainsSVG(el.dataset.mountains || 'hero'); });
    EH.$$('[data-flow]', root).forEach((el) => { if (!el.childElementCount) el.innerHTML = EH.flowSVG(); });
  };

  /* ---------------- reveal on scroll ---------------- */
  let io;
  EH.reveal = (root = document) => {
    const els = EH.$$('.reveal:not(.in)', root);
    if (!('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('in')); return; }
    io = io || new IntersectionObserver((entries) => entries.forEach((en) => {
      if (!en.isIntersecting) return;
      const el = en.target;
      el.classList.add('in');
      io.unobserve(el);
      // once revealed, drop the helper classes so the element's own hover transitions apply
      setTimeout(() => el.classList.remove('reveal', 'in', 'd1', 'd2', 'd3', 'd4', 'd5'), 1400);
    }), { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    els.forEach((e) => io.observe(e));
  };

  /* ---------------- toast ---------------- */
  EH.toast = (msg, opts = {}) => {
    let wrap = EH.$('.toast-wrap');
    if (!wrap) { wrap = document.createElement('div'); wrap.className = 'toast-wrap'; wrap.setAttribute('role', 'status'); wrap.setAttribute('aria-live', 'polite'); document.body.appendChild(wrap); }
    const t = document.createElement('div');
    t.className = 'toast' + (opts.type === 'error' ? ' err' : '');
    t.innerHTML = EH.icon(opts.type === 'error' ? 'x' : opts.icon || 'checkCircle') + '<span class="t-msg"></span>';
    t.querySelector('.t-msg').textContent = String(msg == null ? '' : msg);
    if (opts.action) {
      const act = document.createElement(opts.action.href ? 'a' : 'button');
      act.className = opts.action.href ? '' : 't-act';
      if (!opts.action.href) act.type = 'button';
      else act.href = opts.action.href;
      act.textContent = String(opts.action.label || 'Continue');
      t.appendChild(act);
    }
    const close = () => { t.classList.add('out'); setTimeout(() => t.remove(), 300); };
    if (opts.action && opts.action.onClick) {
      const actionButton = t.querySelector('.t-act');
      if (actionButton) actionButton.addEventListener('click', () => { opts.action.onClick(); close(); });
    }
    wrap.appendChild(t);
    setTimeout(close, opts.duration || 3200);
  };

  /* ---------------- modal ---------------- */
  EH.modal = {
    open(html, opts = {}) {
      EH.modal.close(true);
      const m = document.createElement('div');
      m.className = 'modal';
      m.setAttribute('role', 'dialog');
      m.setAttribute('aria-modal', 'true');
      m.innerHTML = `<div class="modal-backdrop" data-close-modal></div><div class="modal-box ${opts.wide ? 'wide' : ''}"><button class="icon-btn modal-close" data-close-modal aria-label="Close">${EH.icon('x')}</button>${html}</div>`;
      document.body.appendChild(m);
      document.body.style.overflow = 'hidden';
      m._onClose = typeof opts.onClose === 'function' ? opts.onClose : null;
      requestAnimationFrame(() => m.classList.add('open'));
      m.addEventListener('click', (e) => { if (e.target.closest('[data-close-modal]')) EH.modal.close(); });
      EH.modal.el = m;
      const f = m.querySelector('input, select, button:not(.modal-close)');
      if (f && !opts.noFocus) setTimeout(() => f.focus({ preventScroll: true }), 50);
      return m;
    },
    close(instant) {
      const m = EH.modal.el;
      if (!m) return;
      EH.modal.el = null;
      document.body.style.overflow = '';
      const onClose = m._onClose;
      m._onClose = null;
      if (onClose) onClose();
      if (instant) { m.remove(); return; }
      m.classList.remove('open');
      setTimeout(() => m.remove(), 300);
    }
  };

  /** In-page confirmation dialog. Resolves true when the person confirms. */
  EH.confirm = (title, msg, okLabel = 'Confirm') => new Promise((resolve) => {
    let done = false;
    const finish = (value) => { if (!done) { done = true; resolve(value); } };
    const m = EH.modal.open(`<h3>${title}</h3><p class="muted" style="font-size:14px;margin:6px 0 22px">${msg}</p>
      <div class="preview-actions"><button class="btn btn-ghost btn-sm" type="button" data-cf="0">Cancel</button><button class="btn btn-gold btn-sm" type="button" data-cf="1">${okLabel}</button></div>`, { noFocus: true, onClose: () => finish(false) });
    m.addEventListener('click', (e) => {
      const b = e.target.closest('[data-cf]');
      if (b && !done) { finish(b.dataset.cf === '1'); EH.modal.close(); }
    });
  });

  EH.sizeGuide = () => {
    const rows = [['S', '42', '27.5', '22'], ['M', '44', '28.5', '22.5'], ['L', '46', '29.5', '23'], ['XL', '48', '30.5', '23.5'], ['XXL', '50', '31.5', '24']];
    EH.modal.open(`<h3>Size Guide</h3><p class="muted" style="font-size:13px">Oversized / relaxed fit. Measurements in inches, garment laid flat. Between sizes? Size down for a regular fit.</p>
      <table class="size-table"><thead><tr><th>Size</th><th>Chest</th><th>Length</th><th>Shoulder</th></tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`);
  };

  /* ---------------- pricing & options ---------------- */
  EH.sizeAdd = (type, size) => { const T = EH.types[type]; return (T && T.sizeAdd && T.sizeAdd[size]) || 0; };
  EH.defaultOptions = (type, color) => {
    const T = EH.types[type];
    const st = { color: color || T.colors[0], size: null, model: null };
    if (T.sizes && !['tshirt', 'hoodie'].includes(type)) st.size = T.sizes[0];
    if (T.models) st.model = T.models[0];
    return st;
  };
  EH.optionsHTML = (type, st, opts = {}) => {
    const T = EH.types[type];
    const want = (k) => !opts.only || opts.only.includes(k);
    let h = '';
    if (want('color')) h += `<div class="opt-block"><div class="opt-label"><span>Colour: <b data-color-name>${EH.colors[st.color] ? EH.colors[st.color].name : ''}</b></span></div><div class="swatches">${T.colors.map((c) => `<button type="button" class="swatch ${c === st.color ? 'active' : ''}" data-color="${c}" aria-label="${EH.colors[c].name}" title="${EH.colors[c].name}"><span style="background:${EH.colors[c].hex}"></span></button>`).join('')}</div></div>`;
    if (!want('size') && !want('model')) return h;
    if (T.sizes) {
      const guide = ['tshirt', 'hoodie'].includes(type) && opts.sizeGuide !== false ? `<button type="button" data-size-guide>Size guide</button>` : '';
      h += `<div class="opt-block" data-size-block><div class="opt-label"><span>Size: <b data-size-name>${st.size || 'Select a size'}</b></span>${guide}</div><div class="sizes">${T.sizes.map((s) => `<button type="button" class="size-btn ${s === st.size ? 'active' : ''}" data-size="${s}">${s}${T.sizeAdd && T.sizeAdd[s] ? ` <small class="muted">+${EH.money(T.sizeAdd[s])}</small>` : ''}</button>`).join('')}</div></div>`;
    }
    if (T.models) h += `<div class="opt-block"><div class="opt-label"><span>Phone model</span></div><select class="select" data-model aria-label="Phone model">${T.models.map((m) => `<option ${m === st.model ? 'selected' : ''}>${m}</option>`).join('')}</select></div>`;
    return h;
  };
  EH.bindOptions = (root, st, onChange) => {
    root.addEventListener('click', (e) => {
      const sw = e.target.closest('[data-color]');
      if (sw && root.contains(sw)) {
        st.color = sw.dataset.color;
        EH.$$('[data-color]', root).forEach((b) => b.classList.toggle('active', b === sw));
        const n = EH.$('[data-color-name]', root);
        if (n) n.textContent = EH.colors[st.color].name;
        onChange && onChange('color');
      }
      const sz = e.target.closest('[data-size]');
      if (sz && root.contains(sz)) {
        st.size = sz.dataset.size;
        EH.$$('[data-size]', root).forEach((b) => b.classList.toggle('active', b === sz));
        const n = EH.$('[data-size-name]', root);
        if (n) n.textContent = st.size;
        const blk = EH.$('[data-size-block]', root);
        if (blk) blk.classList.remove('need');
        onChange && onChange('size');
      }
      if (e.target.closest('[data-size-guide]')) EH.sizeGuide();
    });
    root.addEventListener('change', (e) => { if (e.target.matches('[data-model]')) { st.model = e.target.value; onChange && onChange('model'); } });
  };
  EH.requireSize = (root, type, st) => {
    const T = EH.types[type];
    if (T.sizes && !st.size) {
      const blk = EH.$('[data-size-block]', root);
      if (blk) { blk.classList.add('need'); blk.querySelector('[data-size-name]').innerHTML = '<span style="color:var(--danger)">Please select a size</span>'; blk.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
      EH.toast('Please select a size', { type: 'error' });
      return false;
    }
    return true;
  };
  EH.optionMeta = (it) => [EH.colors[it.color] ? EH.colors[it.color].name : it.color, it.size, it.model].filter(Boolean).join(' · ');

  /* ---------------- cart ---------------- */
  const CART_KEY = 'eh_cart';
  const clampQty = (value) => Math.max(1, Math.min(20, parseInt(value, 10) || 1));
  EH.cart = {
    items() {
      const items = EH.store.get(CART_KEY, []);
      return Array.isArray(items) ? items.filter((item) => item && typeof item === 'object') : [];
    },
    save(items) {
      const ok = EH.store.set(CART_KEY, items);
      if (!ok) EH.toast('Your browser storage is full — please remove an item or two.', { type: 'error' });
      EH.cart.refresh(ok ? items : undefined);
      return ok;
    },
    add(item) {
      const items = EH.cart.items();
      const key = item.custom ? 'custom:' + (item.customId || EH.uid()) : [item.productId, item.color, item.size || '', item.model || ''].join('|');
      const qty = clampQty(item.qty);
      const existing = items.find((i) => i.key === key);
      if (existing) existing.qty = Math.min(20, clampQty(existing.qty) + qty);
      else items.push(Object.assign({}, item, { key, lineId: EH.uid(), qty, price: Number(item.price) || 0 }));
      const ok = EH.cart.save(items);
      if (ok) bumpBadge();
      return ok;
    },
    addProduct(p, st, qty = 1) {
      return EH.cart.add({ productId: p.id, name: p.name, sub: EH.productSubtitle(p), type: p.type, design: p.design, color: st.color, size: st.size, model: st.model, qty, price: p.price + EH.sizeAdd(p.type, st.size) });
    },
    setQty(lineId, qty) {
      const items = EH.cart.items();
      const it = items.find((i) => i.lineId === lineId);
      if (!it) return;
      it.qty = clampQty(qty);
      EH.cart.save(items);
    },
    remove(lineId) { EH.cart.save(EH.cart.items().filter((i) => i.lineId !== lineId)); },
    clear() { EH.cart.save([]); },
    count(items) { return (Array.isArray(items) ? items : EH.cart.items()).reduce((a, i) => a + clampQty(i.qty), 0); },
    subtotal(items) { return (Array.isArray(items) ? items : EH.cart.items()).reduce((a, i) => a + (Number(i.price) || 0) * clampQty(i.qty), 0); },
    refresh(items) {
      const current = Array.isArray(items) ? items : EH.cart.items();
      const n = EH.cart.count(current);
      EH.$$('.cart-badge').forEach((b) => { b.textContent = n; b.hidden = n === 0; });
      renderDrawer(current);
      document.dispatchEvent(new CustomEvent('cart:change'));
    }
  };
  function bumpBadge() { EH.$$('.cart-badge').forEach((b) => { b.classList.add('bump'); setTimeout(() => b.classList.remove('bump'), 300); }); }

  EH.coupon = (code, subtotal) => {
    if (!code) return null;
    const c = C.coupons[String(code).toUpperCase()];
    if (!c) return { error: 'This coupon code is not valid.' };
    if (c.minOrder && subtotal < c.minOrder) return { error: `Add items worth ${EH.money(c.minOrder - subtotal)} more to use this code.` };
    const amount = c.type === 'percent' ? Math.round((subtotal * c.value) / 100) : Math.min(c.value, subtotal);
    return { code: String(code).toUpperCase(), amount, label: c.label || '' };
  };
  EH.totals = (items, couponCode, payment) => {
    const list = Array.isArray(items) ? items : EH.cart.items();
    const subtotal = EH.cart.subtotal(list);
    const cp = EH.coupon(couponCode, subtotal);
    const discount = cp && !cp.error ? cp.amount : 0;
    const after = subtotal - discount;
    const shipping = !list.length ? 0 : after >= (C.freeShippingThreshold || 0) ? 0 : C.shippingFee || 0;
    const codFee = payment === 'cod' ? C.codFee || 0 : 0;
    return { subtotal, discount, coupon: discount ? cp.code : null, shipping, codFee, total: after + shipping + codFee };
  };

  EH.thumbHTML = (it = {}) => {
    const image = typeof it.image === 'string' && /^data:image\//i.test(it.image) ? EH.esc(it.image) : '';
    const color = EH.colors && EH.colors[it.color] ? it.color : 'black';
    const design = EH.designs && EH.designs[it.design] ? it.design : '';
    return it.custom && image
      ? `<img src="${image}" alt="${EH.esc(it.name)}">`
      : EH.mockup(it.type, { color, design });
  };

  /* ---------------- layout ---------------- */
  const NAV = [['home', 'index.html', 'Home'], ['shop', 'shop.html', 'Shop'], ['trending', 'shop.html?tag=trending', 'Trending'], ['contact', 'contact.html', 'Contact']];
  function currentNav() {
    const page = document.body.dataset.page || '';
    if (page === 'shop' && EH.params.get('tag') === 'trending') return 'trending';
    return page;
  }

  function renderLayout() {
    const active = currentNav();
    const head = EH.$('#site-header');
    if (head) {
      head.outerHTML = `<header class="site-header ${document.body.dataset.header === 'solid' ? 'solid' : ''}" id="siteHeader">
        <div class="container header-inner">
          <a class="brand" href="index.html" aria-label="${C.brandName} — home"><img class="brand-mono" src="assets/logo-monogram.png" alt="" width="46" height="48"><img class="brand-word" src="assets/logo-wordmark.png" alt="${C.brandName}" width="113" height="25"></a>
          <nav class="main-nav" aria-label="Main">${NAV.map(([k, h, l]) => `<a href="${h}" class="${k === active ? 'active' : ''}"${k === active ? ' aria-current="page"' : ''}>${l}</a>`).join('')}</nav>
          <div class="header-actions">
            <button class="icon-btn" type="button" data-open-search aria-label="Search">${EH.icon('search')}</button>
            <a class="icon-btn" href="account.html" aria-label="My account &amp; orders">${EH.icon('user')}</a>
            <button class="icon-btn" type="button" data-open-cart aria-label="Open cart">${EH.icon('cart')}<span class="cart-badge" hidden>0</span></button>
            <button class="icon-btn menu-btn" type="button" data-toggle-menu aria-label="Menu" aria-controls="mobileNav" aria-expanded="false">${EH.icon('menu')}</button>
          </div>
        </div>
      </header>
      <nav class="mobile-nav" id="mobileNav" aria-label="Mobile" aria-hidden="true" inert>${NAV.concat([['customize', '3d-preview/customizer.html', '3D Studio'], ['account', 'account.html', 'My Orders']]).map(([k, h, l]) => `<a href="${h}" class="${k === active ? 'active' : ''}">${l}</a>`).join('')}</nav>`;
    }
    const foot = EH.$('#site-footer');
    if (foot) {
      const soc = [['instagram', 'instagram', 'Instagram'], ['youtube', 'youtube', 'YouTube'], ['pinterest', 'pinterest', 'Pinterest'], ['x', 'xsocial', 'X']].filter(([k]) => C.social[k]);
      foot.outerHTML = `<footer class="site-footer">
        <div class="container footer-inner">
          <a class="footer-brand" href="index.html" aria-label="${C.brandName} — home"><img src="assets/logo-monogram.png" alt="" width="56" height="58"><img src="assets/logo-wordmark.png" alt="${C.brandName}" width="100" height="22"><span>${EH.esc(C.tagline || '')}</span></a>
          <nav class="footer-nav" aria-label="Footer">${NAV.map(([, h, l]) => `<a href="${h}">${l}</a>`).join('')}<a href="3d-preview/customizer.html">3D Studio</a><a href="account.html">My Orders</a></nav>
          <div class="footer-right">
            <div class="socials">${soc.map(([k, ic, l]) => `<a href="${C.social[k]}" target="_blank" rel="noopener" aria-label="${l}">${EH.icon(ic)}</a>`).join('')}</div>
            <p class="copyright">© ${new Date().getFullYear()} ${EH.esc(C.brandName)}. All rights reserved.</p>
          </div>
        </div>
      </footer>`;
    }
    document.body.insertAdjacentHTML('beforeend', `
      <div class="backdrop" data-close-cart></div>
      <aside class="cart-drawer" id="cartDrawer" aria-label="Shopping bag" aria-hidden="true" inert>
        <div class="drawer-head"><h3>Your Bag<span data-cart-count></span></h3><button class="icon-btn" type="button" data-close-cart aria-label="Close bag">${EH.icon('x')}</button></div>
        <div class="ship-progress" data-ship></div>
        <div class="cart-items" data-cart-items></div>
        <div class="drawer-foot" data-cart-foot></div>
      </aside>
      <div class="search-overlay" id="searchOverlay" aria-hidden="true" inert>
        <button class="icon-btn search-close" type="button" data-close-search aria-label="Close search">${EH.icon('x', 'ico-lg')}</button>
        <div class="container search-panel">
          <form class="search-form" role="search" action="shop.html">${EH.icon('search')}<input type="search" name="q" placeholder="Search tees, hoodies, mugs…" autocomplete="off" aria-label="Search products"></form>
          <div class="search-suggest">Popular: ${['Oversized Tee', 'Hoodie', 'Mug', 'Phone Case', 'Cushion'].map((s) => `<button type="button" class="chip-btn" data-suggest="${s}">${s}</button>`).join('')}</div>
          <div class="search-results"></div>
        </div>
      </div>
      ${C.whatsappNumber ? `<a class="wa-float" href="${EH.waLink('Hi ' + C.brandName + '! I have a question.')}" target="_blank" rel="noopener" aria-label="Chat on WhatsApp">${EH.icon('whatsapp')}</a>` : ''}`);
  }

  /* ---------------- drawer ---------------- */
  function renderDrawer(items = EH.cart.items()) {
    const box = EH.$('[data-cart-items]');
    if (!box) return;
    const t = EH.totals(items);
    EH.$('[data-cart-count]').textContent = items.length ? `(${EH.cart.count()})` : '';
    const ship = EH.$('[data-ship]');
    const th = Number(C.freeShippingThreshold) || 0;
    if (!items.length) ship.hidden = true;
    else {
      ship.hidden = false;
      const left = th - t.subtotal;
      const progress = th > 0 ? Math.min(100, (t.subtotal / th) * 100) : 100;
      ship.innerHTML = (left > 0 ? `Add <b>${EH.money(left)}</b> more for <b>FREE shipping</b>` : `${EH.icon('truck', 'ico-sm')} You've unlocked <b>FREE shipping</b>!`.replace('<svg', '<svg style="display:inline;vertical-align:-3px;margin-right:4px;color:var(--gold)"')) + `<div class="ship-bar"><i style="width:${progress}%"></i></div>`;
    }
    if (!items.length) {
      box.innerHTML = `<div class="cart-empty">${EH.icon('bag')}<h4>Your bag is empty</h4><p>Find something you love — or design your own.</p><a class="btn btn-gold btn-sm" href="shop.html">Shop Now ${EH.icon('arrow', 'ico-arrow')}</a><br><br><a class="link-arrow" href="3d-preview/customizer.html">Create a 3D preview ${EH.icon('arrow')}</a></div>`;
      EH.$('[data-cart-foot]').hidden = true;
      return;
    }
     box.innerHTML = items.map((it) => {
       const qty = clampQty(it.qty);
       const lineId = EH.esc(String(it.lineId || ''));
       const href = it.custom ? '3d-preview/customizer.html' : `product.html?id=${encodeURIComponent(String(it.productId || ''))}`;
       return `<div class="cart-line">
         <a class="cart-thumb" href="${href}">${EH.thumbHTML(it)}</a>
         <div><h4>${EH.esc(it.name)}${it.custom ? '<span class="tag-custom">Custom</span>' : ''}</h4><div class="meta">${EH.esc(EH.optionMeta(it))}</div>
           <div class="qty qty-sm"><button type="button" data-qty="-1" data-line="${lineId}" aria-label="Decrease">${EH.icon('minus')}</button><input type="number" value="${qty}" min="1" max="20" data-line-input="${lineId}" aria-label="Quantity"><button type="button" data-qty="1" data-line="${lineId}" aria-label="Increase">${EH.icon('plus')}</button></div></div>
         <div><div class="price">${EH.money((Number(it.price) || 0) * qty)}</div><button type="button" class="line-remove" data-remove="${lineId}">${EH.icon('trash')} Remove</button></div>
       </div>`;
     }).join('');
    const foot = EH.$('[data-cart-foot]');
    foot.hidden = false;
    foot.innerHTML = `<div class="sum-row"><span>Subtotal</span><span>${EH.money(t.subtotal)}</span></div>
      <div class="sum-row"><span>Shipping</span><span>${t.shipping ? EH.money(t.shipping) : 'FREE'}</span></div>
      <div class="sum-row total"><span>Total</span><span>${EH.money(t.total)}</span></div>
      <p class="note">Have a coupon? Apply it at checkout.</p>
      <a class="btn btn-gold btn-block" href="checkout.html">Checkout ${EH.icon('arrow', 'ico-arrow')}</a>
      <button class="btn btn-ghost btn-block btn-sm" type="button" data-close-cart>Continue Shopping</button>`;
  }
  EH.openCart = () => {
    renderDrawer();
    const drawer = EH.$('#cartDrawer');
    drawer.removeAttribute('inert');
    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
    EH.$('.backdrop').classList.add('show');
    document.body.style.overflow = 'hidden';
  };
  EH.closeCart = () => {
    const d = EH.$('#cartDrawer');
    if (!d) return;
    d.classList.remove('open');
    d.setAttribute('aria-hidden', 'true');
    d.setAttribute('inert', '');
    EH.$('.backdrop').classList.remove('show');
    document.body.style.overflow = '';
  };

  /* ---------------- search ---------------- */
  EH.searchProducts = (q) => {
    const words = String(q || '').toLowerCase().trim().split(/\s+/).filter(Boolean);
    if (!words.length) return EH.products.slice();
    return EH.products.filter((p) => {
      const T = EH.types[p.type];
      const cat = (EH.categories.find((c) => c.id === T.category) || {}).name || '';
      const hay = [p.name, EH.productSubtitle(p), T.label, T.short, cat, (EH.designs[p.design] || {}).name, (p.tags || []).join(' '), p.color].join(' ').toLowerCase();
      return words.every((w) => hay.includes(w) || (w.endsWith('s') && hay.includes(w.slice(0, -1))));
    });
  };
  function openSearch() {
    const o = EH.$('#searchOverlay');
    o.removeAttribute('inert');
    o.classList.add('open');
    o.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    const inp = EH.$('input', o);
    setTimeout(() => inp.focus(), 60);
    runSearch(inp.value);
  }
  function closeSearch() {
    const o = EH.$('#searchOverlay');
    if (!o) return;
    o.classList.remove('open');
    o.setAttribute('aria-hidden', 'true');
    o.setAttribute('inert', '');
    document.body.style.overflow = '';
  }

  function closeMenu() {
    const nav = EH.$('#mobileNav');
    const btn = EH.$('[data-toggle-menu]');
    if (!nav || !btn) return;
    nav.classList.remove('open');
    nav.setAttribute('aria-hidden', 'true');
    nav.setAttribute('inert', '');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-label', 'Menu');
    btn.innerHTML = EH.icon('menu');
  }
  function runSearch(q) {
    const box = EH.$('.search-results');
    if (!q.trim()) {
      box.innerHTML = `<p class="result-count">Trending right now</p><div class="product-grid">${EH.trendingOrder.slice(0, 5).map((id) => EH.productCard(EH.getProduct(id))).join('')}</div>`;
      EH.$$('.reveal', box).forEach((el) => el.classList.add('in'));
      return;
    }
    const res = EH.searchProducts(q);
    box.innerHTML = res.length
      ? `<p class="result-count">${res.length} result${res.length > 1 ? 's' : ''} for “${EH.esc(q)}”</p><div class="product-grid">${res.slice(0, 10).map(EH.productCard).join('')}</div>`
      : `<div class="empty-state">${EH.icon('search')}<h3>No matches</h3><p>Try another word — or create exactly what you want.</p><a class="btn btn-gold btn-sm" href="3d-preview/customizer.html">Design in 3D ${EH.icon('arrow', 'ico-arrow')}</a></div>`;
    EH.$$('.reveal', box).forEach((el) => el.classList.add('in'));
  }

  /* ---------------- product card & quick add ---------------- */
  EH.productCard = (p, i = 0) => {
    if (!p) return '';
    const badge = (p.tags || []).includes('new') ? 'New' : (p.tags || []).includes('bestseller') ? 'Bestseller' : '';
    return `<article class="p-card reveal d${(i % 5) + 1}">
      <a class="p-media" href="product.html?id=${p.id}" aria-label="${EH.esc(p.name)}">${badge ? `<span class="p-badge">${badge}</span>` : ''}${EH.productSVG(p)}</a>
      <div class="p-body"><a class="p-name" href="product.html?id=${p.id}">${EH.esc(p.name)}</a><div class="p-sub">${EH.esc(EH.productSubtitle(p))}</div>
        <div class="p-foot"><span class="p-price">${EH.money(p.price)}</span><button class="p-add" type="button" data-quick-add="${p.id}" aria-label="Add ${EH.esc(p.name)} to bag">${EH.icon('plus')}</button></div></div>
    </article>`;
  };
  EH.quickAdd = (id) => {
    const p = EH.getProduct(id);
    if (!p) return;
    const T = EH.types[p.type];
    const st = EH.defaultOptions(p.type, p.color);
    if (!T.sizes && !T.models && T.colors.length <= 1) { EH.cart.addProduct(p, st); EH.toast(`${p.name} added to your bag`, { action: { label: 'View bag', onClick: EH.openCart } }); return; }
    const m = EH.modal.open(`<div class="qa"><div class="qa-media" data-qa-media>${EH.productSVG(p, st.color)}</div>
      <div><h3>${EH.esc(p.name)}</h3><p class="pdp-sub">${EH.esc(EH.productSubtitle(p))}</p>
      <div class="pdp-price" style="margin:12px 0 18px"><span class="now" style="font-size:24px" data-qa-price>${EH.money(p.price)}</span>${p.mrp ? `<s>${EH.money(p.mrp)}</s>` : ''}</div>
      <div data-qa-opts>${EH.optionsHTML(p.type, st)}</div>
      <button class="btn btn-gold btn-block" type="button" data-qa-add>${EH.icon('bag')} Add to Bag</button>
      <p style="text-align:center;margin-top:14px"><a class="link-arrow" href="product.html?id=${p.id}">View full details ${EH.icon('arrow')}</a></p></div></div>`, { noFocus: true });
    const opts = EH.$('[data-qa-opts]', m);
    EH.bindOptions(opts, st, (what) => {
      if (what === 'color') EH.$('[data-qa-media]', m).innerHTML = EH.productSVG(p, st.color);
      EH.$('[data-qa-price]', m).textContent = EH.money(p.price + EH.sizeAdd(p.type, st.size));
    });
    EH.$('[data-qa-add]', m).addEventListener('click', () => {
      if (!EH.requireSize(opts, p.type, st)) return;
      if (EH.cart.addProduct(p, st)) { EH.modal.close(); EH.toast(`${p.name} added to your bag`, { action: { label: 'View bag', onClick: EH.openCart } }); }
    });
  };

  /* ---------------- integrations ---------------- */
  EH.waLink = (text) => `https://wa.me/${String(C.whatsappNumber || '').replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;
  EH.mailLink = (subject, body) => `mailto:${C.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  /** Email a form to the store owner via Web3Forms (if configured). */
  EH.sendForm = async (subject, data) => {
    if (!C.web3formsKey) return { ok: false, skipped: true };
    try {
      const r = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(Object.assign({ access_key: C.web3formsKey, subject, from_name: (C.brandName || 'Store') + ' Website' }, data))
      });
      const j = await r.json();
      return { ok: !!j.success, message: j.message };
    } catch (e) { return { ok: false, message: e.message }; }
  };

  /* design files (full-resolution print files) live in IndexedDB */
  EH.files = {
    _db: null,
    open() {
      return new Promise((res, rej) => {
        if (EH.files._db) return res(EH.files._db);
        if (!window.indexedDB) return rej(new Error('IndexedDB unavailable'));
        const r = indexedDB.open('elitehub', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('designs');
        r.onsuccess = () => { EH.files._db = r.result; res(r.result); };
        r.onerror = () => rej(r.error);
      });
    },
    async put(key, val) {
      try {
        const db = await EH.files.open();
        return await new Promise((res) => { const tx = db.transaction('designs', 'readwrite'); tx.objectStore('designs').put(val, key); tx.oncomplete = () => res(true); tx.onerror = () => res(false); });
      } catch (e) { return false; }
    },
    async get(key) {
      try {
        const db = await EH.files.open();
        return await new Promise((res) => { const rq = db.transaction('designs').objectStore('designs').get(key); rq.onsuccess = () => res(rq.result || null); rq.onerror = () => res(null); });
      } catch (e) { return null; }
    }
  };
  /** Read an uploaded image and shrink it (longest side ≤ max px). Resolves to a data URL. */
  EH.readImage = (file, max = 1000) => new Promise((resolve, reject) => {
    if (!file || !/^image\//.test(file.type)) return reject(new Error('Please choose an image file (PNG, JPG or WEBP).'));
    if (file.size > 15 * 1024 * 1024) return reject(new Error('That image is over 15 MB — please choose a smaller one.'));
    const fr = new FileReader();
    fr.onerror = () => reject(new Error('Could not read that file.'));
    fr.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('That image could not be opened.'));
      img.onload = () => {
        const s = Math.min(1, max / Math.max(img.width, img.height));
        const cv = document.createElement('canvas');
        cv.width = Math.max(1, Math.round(img.width * s));
        cv.height = Math.max(1, Math.round(img.height * s));
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        const keepAlpha = /png|webp|gif|svg/.test(file.type);
        resolve(cv.toDataURL(keepAlpha ? 'image/png' : 'image/jpeg', 0.9));
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  });

  EH.download = (data, filename) => {
    const a = document.createElement('a');
    const url = typeof data === 'string' ? data : URL.createObjectURL(data);
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    if (typeof data !== 'string') setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  /** Download a stored custom-design file, falling back to the signed-in user's Firebase copy. */
  EH.downloadDesign = async (customId, kind = 'print', filename) => {
    try {
      let data = await EH.files.get(kind + ':' + customId);
      if (!data && ['mockup', 'details', 'preview', 'previewBlob'].includes(kind) && window.EHFirebase?.enabled) {
        const api = window.EHFirebase;
        await api.ready;
        const user = api.currentUser;
        if (user) {
          const record = await api.getCustomization(user.uid, customId);
          const path = record?.assets?.[kind === 'previewBlob' || kind === 'preview' ? 'preview' : kind];
          if (path) data = await api.downloadCustomizationAsset(user.uid, path);
        }
      }
      if (!data) { EH.toast('That design file is no longer stored on this device or account.', { type: 'error' }); return; }
      const extension = { mockup: 'glb', details: 'json', preview: 'png', previewBlob: 'png' }[kind] || 'png';
      EH.download(data, filename || `elitehub-design-${customId}-${kind}.${extension}`);
    } catch (error) {
      console.error('Design file could not be downloaded.', error);
      EH.toast(error.message || 'That design file could not be downloaded.', { type: 'error' });
    }
  };
  /** Order line items with thumbnails + optional design-file buttons. */
  EH.orderItemsHTML = (items, withFiles) => (Array.isArray(items) ? items : []).map((it = {}) => {
    const qty = clampQty(it.qty);
    const name = EH.esc(it.name || 'Item');
    const customId = it.customId ? EH.esc(String(it.customId)) : '';
    return `<div class="sum-item">
      <div class="cart-thumb">${EH.thumbHTML(it)}<span class="q">${qty}</span></div>
      <div><h4>${name}${it.custom ? '<span class="tag-custom">Custom</span>' : ''}</h4><div class="meta">${EH.esc(EH.optionMeta(it))}</div>
        ${withFiles && it.custom && customId ? `<div style="display:flex;gap:12px;margin-top:6px;flex-wrap:wrap"><button type="button" class="link-arrow" data-dl-design="${customId}" data-kind="print" data-file="${customId}-print-file.png" style="font-size:12px;color:var(--gold)">${EH.icon('download')} Print file</button><button type="button" class="link-arrow" data-dl-design="${customId}" data-kind="preview" data-file="${customId}-preview.png" style="font-size:12px">${EH.icon('download')} Preview</button>${it.custom3d ? `<button type="button" class="link-arrow" data-dl-design="${customId}" data-kind="mockup" data-file="${customId}-mockup.glb" style="font-size:12px">${EH.icon('download')} 3D mockup (.GLB)</button><button type="button" class="link-arrow" data-dl-design="${customId}" data-kind="details" data-file="${customId}-details.json" style="font-size:12px">${EH.icon('download')} Design details (.JSON)</button>` : ''}</div>` : ''}</div>
      <div class="price" style="font-size:13.5px;font-weight:600">${EH.money((Number(it.price) || 0) * qty)}</div>
    </div>`;
  }).join('');
  EH.totalsHTML = (t) => `<div class="sum-row"><span>Subtotal</span><span>${EH.money(t.subtotal)}</span></div>
    ${t.discount ? `<div class="sum-row" style="color:var(--success)"><span>Discount (${EH.esc(t.coupon)})</span><span>−${EH.money(t.discount)}</span></div>` : ''}
    <div class="sum-row"><span>Shipping</span><span>${t.shipping ? EH.money(t.shipping) : 'FREE'}</span></div>
    ${t.codFee ? `<div class="sum-row"><span>COD fee</span><span>${EH.money(t.codFee)}</span></div>` : ''}
    <div class="sum-row total"><span>Total</span><span>${EH.money(t.total)}</span></div>`;

  /* ---------------- orders ---------------- */
  EH.orderId = () => {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `EH${String(d.getFullYear()).slice(2)}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  };
  EH.paymentLabel = (m) => ({ online: 'Paid online (Razorpay)', cod: 'Cash on Delivery', whatsapp: 'Confirm on WhatsApp' }[m] || m);
  EH.orderText = (o) => {
    const c = o.customer;
    const lines = [
      `*New Order — ${o.id}*`,
      `Date: ${new Date(o.date).toLocaleString('en-IN')}`,
      '',
      `*Customer*`,
      `${c.name} · ${c.phone}${c.email ? ' · ' + c.email : ''}`,
      `${c.address1}${c.address2 ? ', ' + c.address2 : ''}, ${c.city}, ${c.state} - ${c.pincode}`,
      '',
      `*Items*`,
      ...o.items.map((it, i) => `${i + 1}. ${it.name}${it.custom ? ' [CUSTOM DESIGN]' : ''} — ${EH.optionMeta(it)} × ${it.qty} = ${EH.money(it.price * it.qty)}${it.custom && it.summary ? `\n   ↳ ${it.summary}` : ''}`),
      '',
      `Subtotal: ${EH.money(o.totals.subtotal)}`,
      o.totals.discount ? `Discount (${o.totals.coupon}): -${EH.money(o.totals.discount)}` : null,
      `Shipping: ${o.totals.shipping ? EH.money(o.totals.shipping) : 'FREE'}`,
      o.totals.codFee ? `COD fee: ${EH.money(o.totals.codFee)}` : null,
      `*Total: ${EH.money(o.totals.total)}*`,
      `Payment: ${EH.paymentLabel(o.payment)}${o.paymentId ? ' (' + o.paymentId + ')' : ''}`,
      c.notes ? `Notes: ${c.notes}` : null,
      o.items.some((i) => i.custom) ? '\nI will share my custom design file(s) with you.' : null
    ];
    return lines.filter((l) => l !== null).join('\n');
  };

  /* ---------------- newsletter ---------------- */
  function bindNewsletter() {
    EH.$$('[data-newsletter]').forEach((form) => {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const inp = EH.$('input[type=email]', form);
        const note = form.parentElement.querySelector('.form-note');
        const email = inp.value.trim().toLowerCase();
        const say = (msg, cls = '') => { if (note) { note.textContent = msg; note.className = 'form-note ' + cls; } };
        if (!EH.validEmail(email)) { say('Please enter a valid email address.', 'err'); inp.focus(); return; }

        if (!C.web3formsKey) {
          if (!C.email) { say('Newsletter sign-up is not available right now. Please try again later.', 'err'); return; }
          say(`Your email app is opening. Send the message to join. If it does not open, email ${C.email}.`);
          location.href = EH.mailLink('Newsletter signup', `Please add ${email} to the ${C.brandName || 'EliteHub'} newsletter.`);
          return;
        }

        const stored = EH.store.get('eh_newsletter_sent', []);
        const list = Array.isArray(stored) ? stored : [];
        if (list.includes(email)) { say("You're already on the list — thank you!", 'ok'); return; }
        const btn = EH.$('button', form);
        btn.classList.add('is-loading');
        try {
          const result = await EH.sendForm('New newsletter subscriber', {
            email,
            message: `${email} subscribed to the ${C.brandName || 'store'} newsletter.`
          });
          if (!result.ok) {
            say('We could not sign you up right now. Please try again later or use the contact page.', 'err');
            return;
          }
          list.push(email);
          EH.store.set('eh_newsletter_sent', list);
          inp.value = '';
          say("You're subscribed. Watch your inbox for exclusive drops and offers.", 'ok');
        } catch (error) {
          say('We could not sign you up right now. Please try again later or use the contact page.', 'err');
        } finally {
          btn.classList.remove('is-loading');
        }
      });
    });
  }

  /* ---------------- global events ---------------- */
  function bindGlobal() {
    document.addEventListener('click', (e) => {
      const t = e.target;
      if (t.closest('[data-open-cart]')) { e.preventDefault(); EH.openCart(); }
      else if (t.closest('[data-close-cart]')) EH.closeCart();
      else if (t.closest('[data-open-search]')) openSearch();
      else if (t.closest('[data-close-search]')) closeSearch();
      const qa = t.closest('[data-quick-add]');
      if (qa) { e.preventDefault(); EH.quickAdd(qa.dataset.quickAdd); }
      const sug = t.closest('[data-suggest]');
      if (sug) { const inp = EH.$('#searchOverlay input'); inp.value = sug.dataset.suggest; runSearch(inp.value); }
      const q = t.closest('[data-qty]');
      if (q) { const it = EH.cart.items().find((i) => i.lineId === q.dataset.line); if (it) EH.cart.setQty(it.lineId, it.qty + +q.dataset.qty); }
      const rm = t.closest('[data-remove]');
      if (rm) EH.cart.remove(rm.dataset.remove);
      if (t.closest('[data-toggle-menu]')) {
        const nav = EH.$('#mobileNav');
        const btn = t.closest('[data-toggle-menu]');
        const open = nav.classList.toggle('open');
        nav.setAttribute('aria-hidden', String(!open));
        if (open) nav.removeAttribute('inert');
        else nav.setAttribute('inert', '');
        btn.setAttribute('aria-expanded', String(open));
        btn.setAttribute('aria-label', open ? 'Close menu' : 'Menu');
        btn.innerHTML = EH.icon(open ? 'x' : 'menu');
      }
      const dl = t.closest('[data-dl-design]');
      if (dl) EH.downloadDesign(dl.dataset.dlDesign, dl.dataset.kind || 'print', dl.dataset.file);
      const acc = t.closest('.acc-head');
      if (acc) { const item = acc.parentElement; item.classList.toggle('open'); acc.setAttribute('aria-expanded', item.classList.contains('open')); }
    });
    document.addEventListener('change', (e) => { if (e.target.matches('[data-line-input]')) EH.cart.setQty(e.target.dataset.lineInput, parseInt(e.target.value, 10) || 1); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { EH.closeCart(); closeSearch(); closeMenu(); EH.modal.close(); } });
    const si = EH.$('#searchOverlay input');
    if (si) {
      let tm;
      si.addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(() => runSearch(si.value), 120); });
    }
    const header = EH.$('#siteHeader');
    const onScroll = () => header && header.classList.toggle('scrolled', window.scrollY > 30);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    window.addEventListener('storage', (e) => { if (e.key === CART_KEY) EH.cart.refresh(); });
  }

  EH.ready = (fn) => (document.readyState !== 'loading' ? fn() : document.addEventListener('DOMContentLoaded', fn));
  EH.ready(() => {
    renderLayout();
    bindGlobal();
    bindNewsletter();
    EH.decorate();
    EH.cart.refresh();
    EH.reveal();
  });
})();
