/* EliteHub — shop / category / trending listing */
(function () {
  const EH = window.EH;

  EH.ready(() => {
    const st = {
      cat: EH.params.get('cat') || '',
      tag: EH.params.get('tag') || '',
      q: EH.params.get('q') || '',
      sort: EH.params.get('sort') || (EH.params.get('tag') === 'trending' ? 'trending' : 'featured')
    };
    const chips = document.getElementById('catChips');
    const grid = document.getElementById('shopGrid');
    const search = document.getElementById('shopSearch');
    const sort = document.getElementById('shopSort');
    search.value = st.q;
    sort.value = st.sort;

    const filters = [{ key: '', label: 'All' }, { key: 'tag:trending', label: 'Trending' }].concat(EH.categories.map((c) => ({ key: 'cat:' + c.id, label: c.name })));
    const activeKey = () => (st.tag ? 'tag:' + st.tag : st.cat ? 'cat:' + st.cat : '');

    function syncUrl() {
      const p = new URLSearchParams();
      if (st.cat) p.set('cat', st.cat);
      if (st.tag) p.set('tag', st.tag);
      if (st.q) p.set('q', st.q);
      if (st.sort !== 'featured') p.set('sort', st.sort);
      history.replaceState(null, '', 'shop.html' + (p.toString() ? '?' + p : ''));
      // keep header nav highlight in sync
      EH.$$('.main-nav a, .mobile-nav a').forEach((a) => {
        const h = a.getAttribute('href');
        const on = st.tag === 'trending' ? h === 'shop.html?tag=trending' : h === 'shop.html';
        if (h.startsWith('shop.html')) a.classList.toggle('active', on);
      });
    }

    function heading() {
      const cat = EH.categories.find((c) => c.id === st.cat);
      let title = 'The <span class="gold-text">Shop</span>', lead = 'Premium prints on everything you love. Pick a favourite — or make it yours in our design studio.', crumb = 'Shop';
      if (st.tag === 'trending') { title = 'Trending <span class="gold-text">Now</span>'; lead = 'The prints everyone is wearing, sipping from and gifting right now.'; crumb = 'Trending'; }
      else if (cat) { const [a, ...b] = cat.name.split(' '); title = b.length ? `${a} <span class="gold-text">${b.join(' ')}</span>` : `<span class="gold-text">${a}</span>`; lead = cat.blurb + ' — premium custom prints, made to order.'; crumb = cat.name; }
      document.getElementById('shopTitle').innerHTML = title;
      document.getElementById('shopLead').textContent = lead;
      document.getElementById('crumbCurrent').textContent = crumb;
      document.title = `${crumb} — EliteHub | Luxury Customizations`;
    }

    function render() {
      chips.innerHTML = filters.map((f) => `<button type="button" role="tab" class="chip-btn ${f.key === activeKey() ? 'active' : ''}" aria-selected="${f.key === activeKey()}" data-filter="${f.key}">${f.label}</button>`).join('');
      let list = EH.searchProducts(st.q);
      if (st.cat) list = list.filter((p) => EH.productCategory(p) === st.cat);
      if (st.tag) list = list.filter((p) => (p.tags || []).includes(st.tag));
      const order = EH.products.map((p) => p.id);
      const has = (p, t) => ((p.tags || []).includes(t) ? 1 : 0);
      const sorters = {
        featured: (a, b) => order.indexOf(a.id) - order.indexOf(b.id),
        trending: (a, b) => has(b, 'trending') - has(a, 'trending') || b.reviews - a.reviews,
        new: (a, b) => has(b, 'new') - has(a, 'new') || order.indexOf(b.id) - order.indexOf(a.id),
        'price-asc': (a, b) => a.price - b.price,
        'price-desc': (a, b) => b.price - a.price,
        rating: (a, b) => b.rating - a.rating || b.reviews - a.reviews
      };
      list.sort(sorters[st.sort] || sorters.featured);
      document.getElementById('resultCount').textContent = `${list.length} product${list.length === 1 ? '' : 's'}${st.q ? ` matching “${st.q}”` : ''}`;
      grid.innerHTML = list.length
        ? list.map((p, i) => EH.productCard(p, i)).join('')
        : `<div class="empty-state" style="grid-column:1/-1">${EH.icon('search')}<h3>Nothing here yet</h3><p>Try a different search or category — or design exactly what you have in mind.</p><a class="btn btn-gold btn-sm" href="3d-preview/customizer.html">Design Your Own ${EH.icon('arrow', 'ico-arrow')}</a></div>`;
      heading();
      EH.reveal(grid);
    }

    chips.addEventListener('click', (e) => {
      const b = e.target.closest('[data-filter]');
      if (!b) return;
      const [kind, val] = b.dataset.filter.split(':');
      st.cat = kind === 'cat' ? val : '';
      st.tag = kind === 'tag' ? val : '';
      syncUrl();
      render();
    });
    let tm;
    search.addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(() => { st.q = search.value.trim(); syncUrl(); render(); }, 150); });
    sort.addEventListener('change', () => { st.sort = sort.value; syncUrl(); render(); });

    render();
  });
})();
