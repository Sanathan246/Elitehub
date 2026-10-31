/* EliteHub — shop / category / trending listing (Amazon-grade faceted browsing) */
(function () {
  const EH = window.EH;

  EH.ready(() => {
    const st = {
      cat: EH.params.get('cat') || '',
      tag: EH.params.get('tag') || '',
      type: EH.params.get('type') || '',
      price: EH.params.get('price') || 'all',
      rating: EH.params.get('rating') || 'all',
      q: EH.params.get('q') || '',
      sort: EH.params.get('sort') || (EH.params.get('tag') === 'trending' ? 'trending' : 'featured')
    };

    const chips = document.getElementById('catChips');
    const grid = document.getElementById('shopGrid');
    const search = document.getElementById('shopSearch');
    const sort = document.getElementById('shopSort');
    const sidebarCatList = document.getElementById('sidebarCatList');
    const sidebarPriceList = document.getElementById('sidebarPriceList');
    const sidebarRatingList = document.getElementById('sidebarRatingList');
    const sidebarTagList = document.getElementById('sidebarTagList');
    const clearBtn = document.getElementById('clearAllFiltersBtn');

    if (!EH.categories.some((c) => c.id === st.cat)) st.cat = '';
    if (!Array.from(sort.options).some((o) => o.value === st.sort)) st.sort = 'featured';
    if (search) search.value = st.q;
    if (sort) sort.value = st.sort;

    const filters = [{ key: '', label: 'All' }, { key: 'tag:trending', label: 'Trending' }].concat(EH.categories.map((c) => ({ key: 'cat:' + c.id, label: c.name })));
    const activeKey = () => (st.tag ? 'tag:' + st.tag : st.cat ? 'cat:' + st.cat : '');

    function syncUrl() {
      const p = new URLSearchParams();
      if (st.cat) p.set('cat', st.cat);
      if (st.tag) p.set('tag', st.tag);
      if (st.type) p.set('type', st.type);
      if (st.price && st.price !== 'all') p.set('price', st.price);
      if (st.rating && st.rating !== 'all') p.set('rating', st.rating);
      if (st.q) p.set('q', st.q);
      if (st.sort !== 'featured') p.set('sort', st.sort);
      history.replaceState(null, '', location.pathname + (p.toString() ? '?' + p : ''));
      EH.$$('.main-nav a, .mobile-nav a').forEach((a) => {
        const h = a.getAttribute('href');
        const on = st.tag === 'trending' ? h === 'shop.html?tag=trending' : h === 'shop.html';
        if (h && h.startsWith('shop.html')) a.classList.toggle('active', on);
      });
    }

    function heading() {
      const cat = EH.categories.find((c) => c.id === st.cat);
      let title = 'The <span class="gold-text">Shop</span>', lead = 'Premium prints on everything you love. Pick a favourite — or make it yours in our design studio.', crumb = 'Shop';
      if (st.tag === 'trending') { title = 'Trending <span class="gold-text">Now</span>'; lead = 'The prints everyone is wearing, sipping from and gifting right now.'; crumb = 'Trending'; }
      else if (st.type) {
        const typeInfo = EH.types[st.type];
        title = typeInfo ? `${typeInfo.label} <span class="gold-text">Collection</span>` : 'The <span class="gold-text">Shop</span>';
        lead = `Explore our custom ${typeInfo ? typeInfo.label.toLowerCase() : 'products'} printed fresh with premium inks.`;
        crumb = typeInfo ? typeInfo.label : 'Shop';
      }
      else if (cat) { const [a, ...b] = cat.name.split(' '); title = b.length ? `${a} <span class="gold-text">${b.join(' ')}</span>` : `<span class="gold-text">${a}</span>`; lead = cat.blurb + ' — premium custom prints, made to order.'; crumb = cat.name; }
      const shopTitle = document.getElementById('shopTitle');
      const shopLead = document.getElementById('shopLead');
      const crumbCurrent = document.getElementById('crumbCurrent');
      if (shopTitle) shopTitle.innerHTML = title;
      if (shopLead) shopLead.textContent = lead;
      if (crumbCurrent) crumbCurrent.textContent = crumb;
      document.title = `${crumb} — EliteHub | Luxury Customizations`;
    }

    function renderSidebar() {
      if (!sidebarCatList) return;
      const allCount = EH.products.length;
      sidebarCatList.innerHTML = `
        <button type="button" class="filter-item ${!st.cat && !st.type ? 'active' : ''}" data-cat-filter="">
          <span>All Departments</span>
          <span class="filter-count">${allCount}</span>
        </button>
        ${EH.categories.map((c) => {
          const count = EH.products.filter((p) => EH.productCategory(p) === c.id).length;
          return `<button type="button" class="filter-item ${st.cat === c.id ? 'active' : ''}" data-cat-filter="${c.id}">
            <span>${c.name}</span>
            <span class="filter-count">${count}</span>
          </button>`;
        }).join('')}
      `;

      if (sidebarPriceList) {
        sidebarPriceList.querySelectorAll('[data-price-filter]').forEach((b) => {
          b.classList.toggle('active', b.dataset.priceFilter === (st.price || 'all'));
        });
      }
      if (sidebarRatingList) {
        sidebarRatingList.querySelectorAll('[data-rating-filter]').forEach((b) => {
          b.classList.toggle('active', b.dataset.ratingFilter === (st.rating || 'all'));
        });
      }
      if (sidebarTagList) {
        sidebarTagList.querySelectorAll('[data-tag-filter]').forEach((b) => {
          b.classList.toggle('active', b.dataset.tagFilter === (st.tag || 'all'));
        });
      }
    }

    function renderChips() {
      if (!chips) return;
      const k = activeKey();
      chips.innerHTML = filters.map((f) => `<button class="chip ${f.key === k && !st.type ? 'active' : ''}" type="button" data-key="${f.key}" role="tab" aria-selected="${f.key === k}">${f.label}</button>`).join('');
    }

    function filterProducts() {
      let list = EH.products.slice();

      if (st.tag === 'trending') {
        const order = EH.trendingOrder;
        list = list.filter((p) => (p.tags || []).includes('trending')).sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
      } else if (st.tag) {
        list = list.filter((p) => (p.tags || []).includes(st.tag));
      }

      if (st.cat) {
        list = list.filter((p) => EH.productCategory(p) === st.cat);
      }
      if (st.type) {
        list = list.filter((p) => p.type === st.type);
      }

      if (st.price === 'under-600') list = list.filter((p) => p.price < 600);
      else if (st.price === '600-1000') list = list.filter((p) => p.price >= 600 && p.price <= 1000);
      else if (st.price === '1000-1500') list = list.filter((p) => p.price >= 1000 && p.price <= 1500);
      else if (st.price === 'above-1500') list = list.filter((p) => p.price > 1500);

      if (st.rating === '4.5') list = list.filter((p) => (p.rating || 5) >= 4.5);
      else if (st.rating === '4') list = list.filter((p) => (p.rating || 5) >= 4.0);

      const q = st.q.trim().toLowerCase();
      if (q) {
        list = list.filter((p) =>
          p.name.toLowerCase().includes(q) ||
          p.type.toLowerCase().includes(q) ||
          (p.subtitle || '').toLowerCase().includes(q) ||
          (p.description || '').toLowerCase().includes(q)
        );
      }

      if (st.sort === 'price-asc') list.sort((a, b) => a.price - b.price);
      else if (st.sort === 'price-desc') list.sort((a, b) => b.price - a.price);
      else if (st.sort === 'new') list.sort((a, b) => ((b.tags || []).includes('new') ? 1 : 0) - ((a.tags || []).includes('new') ? 1 : 0));
      else if (st.sort === 'rating') list.sort((a, b) => (b.rating || 5) - (a.rating || 5) || (b.reviews || 0) - (a.reviews || 0));
      else if (st.sort === 'trending') {
        const order = EH.trendingOrder;
        list.sort((a, b) => {
          const ai = order.indexOf(a.id), bi = order.indexOf(b.id);
          return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
        });
      }

      return list;
    }

    function render() {
      heading();
      renderChips();
      renderSidebar();
      const list = filterProducts();
      const countEl = document.getElementById('resultCount');
      if (countEl) {
        countEl.textContent = list.length === 0 ? 'No products found' : `Showing ${list.length} ${list.length === 1 ? 'product' : 'products'}`;
      }
      if (!list.length) {
        grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">${EH.icon('search')}<h3>No products found</h3><p>Try resetting filters or searching for something else.</p><button class="btn btn-gold btn-sm" type="button" id="resetEmptyBtn">View All Products</button></div>`;
        const rBtn = document.getElementById('resetEmptyBtn');
        if (rBtn) rBtn.addEventListener('click', () => { resetFilters(); });
        return;
      }
      grid.innerHTML = list.map((p, i) => EH.productCard(p, i)).join('');
      EH.reveal(grid);
    }

    function resetFilters() {
      st.cat = '';
      st.tag = '';
      st.type = '';
      st.price = 'all';
      st.rating = 'all';
      st.q = '';
      st.sort = 'featured';
      if (search) search.value = '';
      if (sort) sort.value = 'featured';
      syncUrl();
      render();
    }

    if (chips) {
      chips.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-key]');
        if (!btn) return;
        st.type = '';
        const k = btn.dataset.key;
        if (k.startsWith('tag:')) { st.tag = k.slice(4); st.cat = ''; }
        else if (k.startsWith('cat:')) { st.cat = k.slice(4); st.tag = ''; }
        else { st.cat = ''; st.tag = ''; }
        syncUrl();
        render();
      });
    }

    if (sidebarCatList) {
      sidebarCatList.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-cat-filter]');
        if (!btn) return;
        st.cat = btn.dataset.catFilter;
        st.type = '';
        syncUrl();
        render();
      });
    }

    if (sidebarPriceList) {
      sidebarPriceList.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-price-filter]');
        if (!btn) return;
        st.price = btn.dataset.priceFilter;
        syncUrl();
        render();
      });
    }

    if (sidebarRatingList) {
      sidebarRatingList.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-rating-filter]');
        if (!btn) return;
        st.rating = btn.dataset.ratingFilter;
        syncUrl();
        render();
      });
    }

    if (sidebarTagList) {
      sidebarTagList.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-tag-filter]');
        if (!btn) return;
        st.tag = btn.dataset.tagFilter === 'all' ? '' : btn.dataset.tagFilter;
        syncUrl();
        render();
      });
    }

    if (clearBtn) clearBtn.addEventListener('click', resetFilters);

    if (search) {
      let t;
      search.addEventListener('input', () => {
        clearTimeout(t);
        t = setTimeout(() => { st.q = search.value; syncUrl(); render(); }, 200);
      });
    }

    if (sort) {
      sort.addEventListener('change', () => {
        st.sort = sort.value;
        syncUrl();
        render();
      });
    }

    render();
  });
})();
