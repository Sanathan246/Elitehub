/* EliteHub — home page */
(function () {
  const EH = window.EH;

  EH.ready(() => {
    const C = EH.config;

    /* hero visual */
    const hv = document.getElementById('heroVisual');
    hv.outerHTML = C.heroImage
      ? `<img class="hero-photo" src="${C.heroImage}" alt="${EH.esc(C.brandName)} custom print">`
      : EH.mockup('tshirt', { color: 'black', design: 'dream-create', className: 'hero-tee', label: 'EliteHub Dream Create Wear oversized tee' });

    /* collections */
    document.getElementById('collectionGrid').innerHTML = EH.categories.map((c, i) => `
      <a class="c-card reveal d${i + 1}" href="shop.html?cat=${c.id}">
        <div class="c-inner">
          <div class="c-media">${EH.mockup(c.feature.type, { color: c.feature.color, design: c.feature.design })}</div>
          <div class="c-label"><div><strong>${c.name}</strong><span>${c.blurb}</span></div>${EH.icon('arrow')}</div>
        </div>
      </a>`).join('');

    /* trending */
    document.getElementById('trendingGrid').innerHTML = EH.trendingOrder.map((id, i) => EH.productCard(EH.getProduct(id), i)).join('');

    /* live customise demo */
    const scene = EH.designs['mountain-soul'].render({ u: 'demoScene', fill: true });
    const textIn = document.getElementById('demoText');
    const tee = document.getElementById('demoTee');
    const isImage = (value) => typeof value === 'string' && /^data:image\/(png|jpe?g|webp|gif);base64,/i.test(value);
    let img = null;
    try { img = sessionStorage.getItem('eh_demo_img'); } catch (e) { /* ignore */ }
    if (!isImage(img)) img = null;
    const draw = () => {
      const txt = EH.esc(textIn.value.trim());
      const art = img
        ? `<image href="${EH.esc(img)}" x="32" y="6" width="136" height="136" preserveAspectRatio="xMidYMid slice"/>`
        : `<svg x="32" y="6" width="136" height="136" viewBox="0 0 200 200">${scene}</svg>`;
      tee.innerHTML = EH.mockup('tshirt', {
        color: 'black',
        content: `${art}<text x="104" y="174" transform="rotate(-8 100 160)" font-family="'Great Vibes', cursive" font-size="${txt.length > 11 ? 38 : 50}" fill="#f6efe6" text-anchor="middle">${txt}</text>`
      });
      const cta = document.getElementById('demoCta');
      const studioParams = new URLSearchParams({ template: 'tee', color: 'black' });
      if (img) studioParams.set('demo', '1');
      else studioParams.set('design', 'mountain-soul');
      if (textIn.value.trim()) studioParams.set('text', textIn.value.trim());
      cta.href = '3d-preview/customizer.html?' + studioParams.toString();
    };
    if (img) document.getElementById('demoThumb').innerHTML = `<img src="${EH.esc(img)}" alt="">`;
    textIn.addEventListener('input', draw);
    const file = document.getElementById('demoFile');
    document.getElementById('demoUpload').addEventListener('click', () => file.click());
    file.addEventListener('change', async () => {
      try {
        img = await EH.readImage(file.files[0], 900);
        let stored = false;
        try { sessionStorage.setItem('eh_demo_img', img); stored = true; } catch (e) { /* too big for session storage */ }
        if (!stored) {
          // Hand it to the 3D studio through IndexedDB instead, so "Customize Now" still carries it over.
          try { sessionStorage.removeItem('eh_demo_img'); } catch (e) { /* ignore */ }
          await EH.files.put('demo:image', img);
        }
        document.getElementById('demoThumb').innerHTML = `<img src="${EH.esc(img)}" alt="">`;
        document.getElementById('demoPill').textContent = 'Image uploaded';
        draw();
      } catch (err) { EH.toast(err.message, { type: 'error' }); }
      file.value = '';
    });
    draw();

    EH.reveal();
  });
})();
