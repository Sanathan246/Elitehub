/* EliteHub — product detail page */
(function () {
  const EH = window.EH;

  EH.ready(() => {
    const C = EH.config;
    const root = document.getElementById('pdp');
    const p = EH.getProduct(EH.params.get('id'));

    if (!p) {
      root.style.display = 'block';
      root.innerHTML = `<div class="empty-state" style="margin-top:20px">${EH.icon('search')}<h3>Product not found</h3><p>It may have sold out or moved. Explore the rest of the collection.</p><a class="btn btn-gold btn-sm" href="shop.html">Back to Shop ${EH.icon('arrow', 'ico-arrow')}</a></div>`;
      document.getElementById('relatedSection').hidden = true;
      return;
    }

    const T = EH.types[p.type];
    const cat = EH.categories.find((c) => c.id === T.category) || { name: 'Shop', id: '' };
    const det = EH.typeDetails[p.type] || { specs: [], care: '' };
    const qColor = EH.params.get('color');
    const st = EH.defaultOptions(p.type, T.colors.includes(qColor) ? qColor : p.color);
    let qty = 1;
    const off = p.mrp ? Math.round((1 - p.price / p.mrp) * 100) : 0;
    const stars = Array.from({ length: 5 }, (_, i) => EH.icon('star').replace('fill="none"', i < Math.round(p.rating) ? 'fill="currentColor"' : 'fill="none"')).join('');

    document.title = `${p.name} — ${EH.productSubtitle(p)} | EliteHub`;
    const meta = document.querySelector('meta[name=description]');
    if (meta) meta.setAttribute('content', p.description);

    root.innerHTML = `
      <div class="pdp-gallery">
        <div class="pdp-stage" id="stage">${EH.productSVG(p, st.color)}</div>
        <div class="pdp-thumbs" id="thumbs">${T.colors.map((c) => `<button type="button" data-thumb="${c}" class="${c === st.color ? 'active' : ''}" aria-label="View in ${EH.colors[c].name}">${EH.productSVG(p, c)}</button>`).join('')}</div>
      </div>
      <div class="pdp-info">
        <nav class="crumbs" aria-label="Breadcrumb"><a href="index.html">Home</a><span class="sep">/</span><a href="shop.html">Shop</a><span class="sep">/</span><a href="shop.html?cat=${cat.id}">${cat.name}</a></nav>
        <span class="eyebrow" style="font-size:11px;color:var(--gold)">${EH.esc(cat.name)}</span>
        <h1>${EH.esc(p.name)}</h1>
        <p class="pdp-sub">${EH.esc(EH.productSubtitle(p))}</p>
        <div class="rating"><span class="stars-row" aria-label="Rated ${p.rating} out of 5">${stars}</span><span>${p.rating.toFixed(1)} · ${p.reviews} reviews</span></div>
        <div class="pdp-price"><span class="now" id="price">${EH.money(p.price)}</span>${p.mrp ? `<s>${EH.money(p.mrp)}</s><span class="off">${off}% OFF</span>` : ''}</div>
        <p class="muted" style="margin-bottom:26px;font-size:14.5px">${EH.esc(p.description)}</p>
        <div id="opts">${EH.optionsHTML(p.type, st)}</div>
        <div class="opt-block"><div class="opt-label"><span>Quantity</span></div>
          <div class="qty"><button type="button" data-q="-1" aria-label="Decrease quantity">${EH.icon('minus')}</button><input id="qty" type="number" value="1" min="1" max="20" aria-label="Quantity"><button type="button" data-q="1" aria-label="Increase quantity">${EH.icon('plus')}</button></div>
        </div>
        <div class="buy-row">
          <button class="btn btn-gold" type="button" id="addBtn">${EH.icon('bag')} Add to Bag</button>
          <button class="btn btn-outline" type="button" id="buyBtn">Buy Now ${EH.icon('arrow', 'ico-arrow')}</button>
        </div>
        <a class="personalize" id="personalize" href="#">${EH.icon('sparkles')}<div style="flex:1"><strong>Personalize this design</strong><span>Add text or a photo, then inspect your product in 3D</span></div>${EH.icon('arrow', 'ico-sm')}</a>
        <div class="perks">
          <div class="perk">${EH.icon('truck')}Free shipping over ${EH.money(C.freeShippingThreshold)}</div>
          <div class="perk">${EH.icon('shield')}Secure checkout</div>
          <div class="perk">${EH.icon('returns')}Easy returns</div>
        </div>
        <div class="accordion">
          <div class="acc-item open"><button class="acc-head" type="button" aria-expanded="true">Product Details ${EH.icon('plus')}</button><div class="acc-body"><div><ul>${det.specs.map((s) => `<li>${EH.esc(s)}</li>`).join('')}</ul></div></div></div>
          <div class="acc-item"><button class="acc-head" type="button" aria-expanded="false">Care Instructions ${EH.icon('plus')}</button><div class="acc-body"><div><p>${EH.esc(det.care)}</p></div></div></div>
          <div class="acc-item"><button class="acc-head" type="button" aria-expanded="false">Shipping &amp; Returns ${EH.icon('plus')}</button><div class="acc-body"><div><p>${EH.esc(C.shippingInfo || '')}</p><p>${EH.esc(C.returnsInfo || '')}</p></div></div></div>
        </div>
      </div>`;

    const stage = document.getElementById('stage');
    const opts = document.getElementById('opts');
    const qtyIn = document.getElementById('qty');
    const personalize = document.getElementById('personalize');

    const update = (what) => {
      if (what === 'color') {
        stage.innerHTML = EH.productSVG(p, st.color);
        EH.$$('#thumbs [data-thumb]').forEach((b) => b.classList.toggle('active', b.dataset.thumb === st.color));
        const u = new URL(location.href);
        u.searchParams.set('color', st.color);
        history.replaceState(null, '', u);
      }
      document.getElementById('price').textContent = EH.money(p.price + EH.sizeAdd(p.type, st.size));
      const studioParams = new URLSearchParams({
        template: p.type === 'tshirt' ? 'tee' : p.type,
        color: st.color,
        design: p.design,
      });
      personalize.href = '3d-preview/customizer.html?' + studioParams.toString();
    };
    EH.bindOptions(opts, st, update);
    update();

    document.getElementById('thumbs').addEventListener('click', (e) => {
      const b = e.target.closest('[data-thumb]');
      if (!b) return;
      const sw = opts.querySelector(`[data-color="${b.dataset.thumb}"]`);
      if (sw) sw.click();
    });
    root.addEventListener('click', (e) => {
      const q = e.target.closest('[data-q]');
      if (q) { qty = Math.max(1, Math.min(20, qty + +q.dataset.q)); qtyIn.value = qty; }
    });
    qtyIn.addEventListener('change', () => { qty = Math.max(1, Math.min(20, parseInt(qtyIn.value, 10) || 1)); qtyIn.value = qty; });

    const add = () => {
      if (!EH.requireSize(opts, p.type, st)) return false;
      return EH.cart.addProduct(p, st, qty);
    };
    document.getElementById('addBtn').addEventListener('click', () => {
      if (add()) EH.toast(`${p.name} added to your bag`, { action: { label: 'View bag', onClick: EH.openCart } });
    });
    document.getElementById('buyBtn').addEventListener('click', () => { if (add()) location.href = 'checkout.html'; });

    /* related products: same category first */
    const related = EH.products.filter((x) => x.id !== p.id).sort((a, b) => (EH.productCategory(b) === cat.id) - (EH.productCategory(a) === cat.id) || b.reviews - a.reviews).slice(0, 6);
    document.getElementById('related').innerHTML = related.map((x, i) => EH.productCard(x, i)).join('');
    EH.reveal();
  });
})();
