/* EliteHub — product detail page (Amazon-grade product & buy box experience) */
(function () {
  const EH = window.EH;

  EH.ready(() => {
    const C = EH.config;
    const root = document.getElementById('pdp');
    if (!root) return;
    const p = EH.getProduct(EH.params.get('id'));

    if (!p) {
      root.style.display = 'block';
      root.innerHTML = `<div class="empty-state" style="margin-top:20px">${EH.icon('search')}<h3>Product not found</h3><p>It may have sold out or moved. Explore the rest of the collection.</p><a class="btn btn-gold btn-sm" href="shop.html">Back to Shop ${EH.icon('arrow', 'ico-arrow')}</a></div>`;
      const relSec = document.getElementById('relatedSection');
      if (relSec) relSec.hidden = true;
      return;
    }

    const T = EH.types[p.type];
    const cat = EH.categories.find((c) => c.id === T.category) || { name: 'Shop', id: '' };
    const det = EH.typeDetails[p.type] || { specs: [], care: '' };
    const qColor = EH.params.get('color');
    const st = EH.defaultOptions(p.type, T.colors.includes(qColor) ? qColor : p.color);
    let qty = 1;
    const off = p.mrp ? Math.round((1 - p.price / p.mrp) * 100) : 0;

    // Estimated delivery date (3-4 days ahead)
    const delDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const delDayStr = delDate.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' });

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
        
        <div class="rating"><span class="stars-row" aria-label="Rated ${p.rating} out of 5">${stars}</span><span>${p.rating.toFixed(1)} · ${p.reviews} verified ratings</span></div>

        <div class="stock-badge"><span class="stock-dot"></span> In Stock — Ready to Print &amp; Ship</div>

        <div class="pdp-price"><span class="now" id="price">${EH.money(p.price)}</span>${p.mrp ? `<s>${EH.money(p.mrp)}</s><span class="off">${off}% OFF</span>` : ''}</div>

        <div class="delivery-box">
          <div>${EH.icon('truck', 'ico-sm')} <strong>FREE Delivery by ${delDayStr}</strong> on orders over ${EH.money(C.freeShippingThreshold || 999)}</div>
          <span class="muted">Dispatched from EliteHub Print Studio · Secure delivery across India</span>
        </div>

        <p class="muted" style="margin-bottom:26px;font-size:14.5px">${EH.esc(p.description)}</p>
        <div id="opts">${EH.optionsHTML(p.type, st)}</div>
        <div class="opt-block"><div class="opt-label"><span>Quantity</span></div>
          <div class="qty"><button type="button" data-q="-1" aria-label="Decrease quantity">${EH.icon('minus')}</button><input id="qty" type="number" value="1" min="1" max="20" aria-label="Quantity"><button type="button" data-q="1" aria-label="Increase quantity">${EH.icon('plus')}</button></div>
        </div>
        <div class="buy-row">
          <button class="btn btn-gold" type="button" id="addBtn">${EH.icon('bag')} Add to Bag</button>
          <button class="btn btn-outline" type="button" id="buyBtn">Buy Now ${EH.icon('arrow', 'ico-arrow')}</button>
        </div>
        <a class="personalize" id="personalize" href="#">${EH.icon('sparkles')}<div style="flex:1"><strong>Personalize this design in 3D</strong><span>Add text or your photo, then rotate in 360° Studio</span></div>${EH.icon('arrow', 'ico-sm')}</a>
        <div class="perks">
          <div class="perk">${EH.icon('truck')}Free shipping over ${EH.money(C.freeShippingThreshold)}</div>
          <div class="perk">${EH.icon('shield')}100% Secure Checkout</div>
          <div class="perk">${EH.icon('returns')}7-Day Easy Returns</div>
        </div>
        <div class="accordion">
          <div class="acc-item open"><button class="acc-head" type="button" aria-expanded="true">Product Details &amp; Fabric Specs ${EH.icon('plus')}</button><div class="acc-body"><div><ul>${det.specs.map((s) => `<li>${EH.esc(s)}</li>`).join('')}</ul></div></div></div>
          <div class="acc-item"><button class="acc-head" type="button" aria-expanded="false">Care &amp; Wash Instructions ${EH.icon('plus')}</button><div class="acc-body"><div><p>${EH.esc(det.care)}</p></div></div></div>
          <div class="acc-item"><button class="acc-head" type="button" aria-expanded="false">Shipping &amp; Return Policy ${EH.icon('plus')}</button><div class="acc-body"><div><p>${EH.esc(C.shippingInfo || '')}</p><p>${EH.esc(C.returnsInfo || '')}</p></div></div></div>
        </div>

        <!-- Amazon-Style Ratings Breakdown & Verified Reviews -->
        <div class="pdp-ratings-section">
          <h3 class="section-title" style="font-size:24px">Customer <em>Reviews</em></h3>
          <div class="rating-breakdown">
            <div class="rating-big-score">
              <div class="score-num">${p.rating.toFixed(1)}</div>
              <div class="score-stars">${stars}</div>
              <div class="muted" style="font-size:12px">${p.reviews} verified buyer ratings</div>
            </div>
            <div class="rating-bars">
              <div class="bar-row"><span>5 star</span><div class="bar-track"><div class="bar-fill" style="width:84%"></div></div><span>84%</span></div>
              <div class="bar-row"><span>4 star</span><div class="bar-track"><div class="bar-fill" style="width:12%"></div></div><span>12%</span></div>
              <div class="bar-row"><span>3 star</span><div class="bar-track"><div class="bar-fill" style="width:3%"></div></div><span>3%</span></div>
              <div class="bar-row"><span>2 star</span><div class="bar-track"><div class="bar-fill" style="width:1%"></div></div><span>1%</span></div>
              <div class="bar-row"><span>1 star</span><div class="bar-track"><div class="bar-fill" style="width:0%"></div></div><span>0%</span></div>
            </div>
          </div>

          <div class="reviews-grid">
            <div class="review-card">
              <div class="review-head">
                <div class="reviewer-info">
                  <div class="reviewer-avatar">A</div>
                  <div>
                    <div class="reviewer-name">Aarav Sharma</div>
                    <span class="verified-tag">${EH.icon('checkCircle', 'ico-sm')} Verified Purchase</span>
                  </div>
                </div>
                <div class="review-date">3 days ago</div>
              </div>
              <div class="stars-row" style="margin:4px 0">${stars}</div>
              <p class="review-text">“The fabric quality is unreal! Heavyweight feel, rich color print that didn't fade after two washes. Delivery was super fast too.”</p>
            </div>
            <div class="review-card">
              <div class="review-head">
                <div class="reviewer-info">
                  <div class="reviewer-avatar">P</div>
                  <div>
                    <div class="reviewer-name">Pooja Nair</div>
                    <span class="verified-tag">${EH.icon('checkCircle', 'ico-sm')} Verified Purchase</span>
                  </div>
                </div>
                <div class="review-date">1 week ago</div>
              </div>
              <div class="stars-row" style="margin:4px 0">${stars}</div>
              <p class="review-text">“Ordered this as a gift. The packaging and finish were pure luxury. Loved that I could preview everything in 3D first!”</p>
            </div>
          </div>
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
    const related = EH.products.filter((x) => x.id !== p.id).sort((a, b) => (EH.productCategory(b) === cat.id) - (EH.productCategory(a) === cat.id) || (b.reviews || 0) - (a.reviews || 0)).slice(0, 6);
    const relatedGrid = document.getElementById('related');
    if (relatedGrid) {
      relatedGrid.innerHTML = related.map((x, i) => EH.productCard(x, i)).join('');
    }
    EH.reveal();
  });
})();
