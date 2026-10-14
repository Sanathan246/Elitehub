/* =====================================================================
   EliteHub — focused product customization workspace
   ===================================================================== */
(() => {
  const EH = window.EH;
  if (!EH) return;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const MAX_ART_BYTES = 15 * 1024 * 1024;
  const state = { product: null, options: null, artwork: null, quantity: 1, renderToken: 0 };

  EH.ready(init);

  function init() {
    renderFilters();
    renderProducts();
    bindEvents();
    const params = EH.params;
    const product = EH.getProduct(params.get('id')) || chooseInitialProduct(params);
    selectProduct(product || EH.products[0], { scroll: false });
    updateArtworkUI();
  }

  function chooseInitialProduct(params) {
    const type = params.get('product');
    const color = params.get('color');
    return EH.products.find((p) => p.type === type && (!color || p.color === color)) || EH.products.find((p) => p.type === type);
  }

  function renderFilters() {
    const filters = [{ id: 'all', name: 'All products' }, ...EH.categories];
    $('#categoryFilters').innerHTML = filters.map((item, index) => `<button type="button" class="studio-filter${index === 0 ? ' active' : ''}" data-category="${EH.esc(item.id)}" aria-pressed="${index === 0}">${EH.esc(item.name)}</button>`).join('');
  }

  function filteredProducts() {
    const category = $('.studio-filter.active')?.dataset.category || 'all';
    const query = ($('#productSearch').value || '').trim().toLowerCase();
    return EH.products.filter((product) => {
      const categoryMatch = category === 'all' || EH.productCategory(product) === category;
      const type = EH.types[product.type];
      const text = `${product.name} ${type.label} ${type.short} ${product.description || ''}`.toLowerCase();
      return categoryMatch && (!query || text.includes(query));
    });
  }

  function renderProducts() {
    const products = filteredProducts();
    $('#productCount').textContent = `${products.length} ${products.length === 1 ? 'product' : 'products'}`;
    $('#productGrid').innerHTML = products.length ? products.map((product) => {
      const selected = state.product && state.product.id === product.id;
      const T = EH.types[product.type];
      return `<article class="studio-product-card${selected ? ' selected' : ''}">
        <button type="button" class="studio-product-choice" data-product-select="${EH.esc(product.id)}" aria-pressed="${!!selected}" aria-label="Select ${EH.esc(product.name)}">
          <span class="studio-product-image">${EH.productSVG(product, product.color, 'studio-product-mockup')}<span class="studio-select-mark">${EH.icon('check')}</span></span>
          <span class="studio-product-meta"><span><b>${EH.esc(product.name)}</b><small>${EH.esc(T.label)}</small></span><strong>${EH.money(product.price)}</strong></span>
        </button>
        <button type="button" class="studio-card-upload" data-product-upload="${EH.esc(product.id)}">${EH.icon('upload')} Upload design</button>
      </article>`;
    }).join('') : '<div class="studio-no-products"><span>⌕</span><b>No products found</b><p>Try another name or category.</p></div>';
  }

  function selectProduct(product, options = {}) {
    if (!product) return;
    state.product = product;
    state.options = EH.defaultOptions(product.type, product.color);
    const type = EH.types[product.type];
    if (!type.colors.includes(state.options.color)) state.options.color = type.colors[0];
    $('#selectedProductName').textContent = product.name;
    $('#selectedProductType').textContent = type.label;
    $('#viewerProductName').textContent = type.label;
    $('#previewCaption').textContent = `${type.label} · front-view mockup`;
    $('#selectedProductPrice').textContent = EH.money(product.price);
    $('#selectedProductThumb').innerHTML = EH.productSVG(product, state.options.color, 'studio-selected-mockup');
    const optionRoot = $('#productOptions');
    optionRoot.innerHTML = EH.optionsHTML(product.type, state.options);
    EH.bindOptions(optionRoot, state.options, () => {
      renderProductDetails();
      renderStaticPreview();
    });
    renderProducts();
    renderProductDetails();
    renderStaticPreview();
    updateWorkflow();
    if (options.openUpload) $('#artFileInput').click();
  }

  function unitPrice() {
    return Number(state.product?.price || 0) + EH.sizeAdd(state.product?.type, state.options?.size);
  }

  function renderProductDetails() {
    if (!state.product) return;
    const total = unitPrice() * state.quantity;
    $('#selectedProductPrice').textContent = EH.money(unitPrice());
    $('#studioSubtotal').textContent = EH.money(total);
    $('#studioQty').value = state.quantity;
    $('#selectedProductThumb').innerHTML = EH.productSVG(state.product, state.options.color, 'studio-selected-mockup');
    const needsArtwork = !state.artwork && !state.product.design;
    $('#addCartBtn').disabled = needsArtwork;
    $('#addCartHint').textContent = needsArtwork ? 'Add artwork to continue.' : state.artwork ? 'Your custom artwork is ready.' : 'Using the product’s original design.';
  }

  function bindEvents() {
    $('#categoryFilters').addEventListener('click', (event) => {
      const button = event.target.closest('[data-category]');
      if (!button) return;
      $$('.studio-filter').forEach((item) => {
        const active = item === button;
        item.classList.toggle('active', active);
        item.setAttribute('aria-pressed', String(active));
      });
      renderProducts();
    });
    $('#productSearch').addEventListener('input', renderProducts);
    $('#productGrid').addEventListener('click', (event) => {
      const uploadButton = event.target.closest('[data-product-upload]');
      if (uploadButton) {
        const product = EH.getProduct(uploadButton.dataset.productUpload);
        if (product) selectProduct(product, { openUpload: true });
        return;
      }
      const choice = event.target.closest('[data-product-select]');
      if (choice) selectProduct(EH.getProduct(choice.dataset.productSelect));
    });

    const input = $('#artFileInput'), dropzone = $('#artDropzone');
    input.addEventListener('change', () => { if (input.files[0]) handleWorkspaceFile(input.files[0]); input.value = ''; });
    ['dragenter', 'dragover'].forEach((name) => dropzone.addEventListener(name, (event) => { event.preventDefault(); dropzone.classList.add('drag'); }));
    ['dragleave', 'drop'].forEach((name) => dropzone.addEventListener(name, (event) => { event.preventDefault(); dropzone.classList.remove('drag'); }));
    dropzone.addEventListener('drop', (event) => { if (event.dataTransfer.files[0]) handleWorkspaceFile(event.dataTransfer.files[0]); });
    dropzone.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); input.click(); } });
    $('#removeArtBtn').addEventListener('click', clearArtwork);

    $('#eliteForm').addEventListener('submit', (event) => {
      event.preventDefault();
      const input = $('#eliteInput');
      const idea = input.value.trim();
      if (!idea) return;
      input.value = '';
      guideWithElite(idea);
    });
    $('.studio-elite-prompts').addEventListener('click', (event) => {
      const prompt = event.target.closest('[data-elite-prompt]');
      if (prompt) guideWithElite(prompt.dataset.elitePrompt);
    });
    $('#studioQty').addEventListener('change', (event) => {
      state.quantity = Math.max(1, Math.min(20, Number.parseInt(event.target.value, 10) || 1));
      renderProductDetails();
    });
    $('.studio-qty').addEventListener('click', (event) => {
      const button = event.target.closest('[data-qty]');
      if (!button) return;
      state.quantity = Math.max(1, Math.min(20, state.quantity + Number(button.dataset.qty)));
      renderProductDetails();
    });
    $('#addCartBtn').addEventListener('click', addToBag);
    $('#resetBtn').addEventListener('click', resetStudio);
  }

  function setStatus(element, message, stateName = '') {
    element.textContent = message;
    element.dataset.state = stateName;
  }

  function validateArtwork(file) {
    if (file.size > MAX_ART_BYTES) return 'This file is larger than 15 MB. Export a smaller version and try again.';
    const extension = file.name.split('.').pop().toLowerCase();
    const mimeByExtension = { png: ['image/png'], jpg: ['image/jpeg', 'image/jpg'], jpeg: ['image/jpeg', 'image/jpg'], webp: ['image/webp'], svg: ['image/svg+xml'] };
    if (!mimeByExtension[extension]) return 'That format is not supported. Use PNG, JPG, WEBP or SVG artwork.';
    if (file.type && !mimeByExtension[extension].includes(file.type.toLowerCase())) return 'The file extension and format do not match. Save artwork as PNG, JPG, WEBP or SVG and try again.';
    return '';
  }

  function handleWorkspaceFile(file) {
    handleArtwork(file);
  }

  async function handleArtwork(file) {
    const status = $('#artUploadStatus');
    const validation = validateArtwork(file);
    if (validation) return setStatus(status, validation, 'error');
    setStatus(status, 'Checking your artwork…');
    try {
      let dataUrl;
      if (/\.svg$/i.test(file.name)) dataUrl = await readSanitizedSvg(file);
      else dataUrl = await readDataUrl(file);
      const image = await loadImage(dataUrl);
      if (!image.naturalWidth || !image.naturalHeight) throw new Error('This file does not contain a readable image. Export a fresh copy and try again.');
      if (image.naturalWidth > 40000 || image.naturalHeight > 40000 || image.naturalWidth * image.naturalHeight > 40000000) throw new Error('This image is too large to preview. Resize it to under 40 megapixels and upload again.');
      state.artwork = { dataUrl, name: file.name, size: file.size, width: image.naturalWidth, height: image.naturalHeight };
      const lowResolution = image.naturalWidth < 1500;
      setStatus(status, lowResolution ? `Artwork added (${image.naturalWidth} × ${image.naturalHeight} px). For the sharpest print, use at least 1500 px wide.` : `Artwork checked · ${image.naturalWidth} × ${image.naturalHeight} px · ready to preview.`, lowResolution ? 'warning' : 'success');
      updateArtworkUI();
      renderStaticPreview();
    } catch (error) {
      setStatus(status, error.message || 'We could not read that artwork. Try exporting it as a PNG.', 'error');
    }
  }

  function readDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('We could not read that file. Try choosing it again.'));
      reader.readAsDataURL(file);
    });
  }

  async function readSanitizedSvg(file) {
    const source = await file.text();
    const documentSvg = new DOMParser().parseFromString(source, 'image/svg+xml');
    const root = documentSvg.documentElement;
    if (documentSvg.querySelector('parsererror') || !root || root.localName.toLowerCase() !== 'svg') throw new Error('This SVG could not be opened. Re-export it as a valid SVG or PNG.');
    root.querySelectorAll('script,foreignObject,iframe,object,embed').forEach((node) => node.remove());
    root.querySelectorAll('style').forEach((node) => { if (/@import|url\s*\(/i.test(node.textContent)) node.remove(); });
    [root, ...root.querySelectorAll('*')].forEach((node) => Array.from(node.attributes).forEach((attribute) => {
      const name = attribute.name.toLowerCase(), value = attribute.value.trim();
      if (name.startsWith('on')) node.removeAttribute(attribute.name);
      if ((name === 'href' || name.endsWith(':href')) && value && !value.startsWith('#') && !value.startsWith('data:image/')) node.removeAttribute(attribute.name);
      if (name === 'style' && /url\s*\(/i.test(value)) node.removeAttribute(attribute.name);
    }));
    return EH.svgToDataURL(new XMLSerializer().serializeToString(root));
  }

  function loadImage(url) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('This file does not contain a readable image. Export a fresh copy as PNG, JPG, WEBP or SVG.'));
      image.src = url;
    });
  }

  function productDesignSource() {
    const design = state.product.design && EH.artwork(state.product.design, { ink: EH.color.inkFor(EH.colors[state.options.color]?.hex || '#17151b') });
    return design ? EH.svgToDataURL(design) : '';
  }

  async function renderStaticPreview() {
    if (!state.product) return;
    const token = ++state.renderToken;
    try {
      const imageUrl = await makeProductMockup(state.artwork ? state.artwork.dataUrl : productDesignSource());
      if (token === state.renderToken && imageUrl) {
        const preview = $('#staticPreview');
        preview.src = imageUrl;
        preview.hidden = false;
        preview.alt = `${state.product.name} ${EH.colors[state.options.color].name} 2D mockup`;
      }
    } catch (error) {
      if (token === state.renderToken) $('#previewCaption').textContent = 'Preview could not be prepared. Try another artwork file.';
    }
  }

  async function makeProductMockup(source) {
    const product = state.product, type = EH.types[product.type];
    const [base, overlay, artwork] = await Promise.all([
      loadImage(EH.svgToDataURL(EH.mockup(product.type, { color: state.options.color, layer: 'base', px: 1200 }))),
      loadImage(EH.svgToDataURL(EH.mockup(product.type, { color: state.options.color, layer: 'overlay', px: 1200 }))),
      source ? loadImage(source) : Promise.resolve(null)
    ]);
    const canvas = document.createElement('canvas');
    const outputSize = 1200;
    canvas.width = canvas.height = outputSize;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('A 2D drawing surface is unavailable.');
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';

    // Keep every product comfortably framed while preserving its real front-view proportions.
    const previewZoom = { tshirt: 1.03, hoodie: 1.02, mug: 1.32, phonecase: 1.05, cushion: 1.30, tote: 1.08, frame: 1.10 };
    const zoom = previewZoom[product.type] || 1;
    const ratio = outputSize / 400;
    context.save();
    context.translate(outputSize / 2, outputSize / 2);
    context.scale(zoom, zoom);
    context.translate(-outputSize / 2, -outputSize / 2);
    context.drawImage(base, 0, 0, outputSize, outputSize);
    if (artwork) {
      const p = type.print;
      const maxW = p.w * .83, maxH = p.h * .83;
      const scale = Math.min(maxW / artwork.naturalWidth, maxH / artwork.naturalHeight);
      const w = artwork.naturalWidth * scale, h = artwork.naturalHeight * scale;
      context.save();
      context.beginPath(); context.rect(p.x * ratio, p.y * ratio, p.w * ratio, p.h * ratio); context.clip();
      context.drawImage(artwork, (p.x + (p.w - w) / 2) * ratio, (p.y + (p.h - h) / 2) * ratio, w * ratio, h * ratio);
      context.restore();
    }
    context.drawImage(overlay, 0, 0, outputSize, outputSize);
    context.restore();
    return canvas.toDataURL('image/png');
  }

  function updateArtworkUI() {
    const card = $('#uploadedFileCard');
    card.hidden = !state.artwork;
    if (state.artwork) {
      $('#uploadedFileName').textContent = state.artwork.name;
      $('#uploadedFileSize').textContent = state.artwork.size >= 1024 * 1024
        ? `${(state.artwork.size / (1024 * 1024)).toFixed(1)} MB`
        : `${Math.max(1, Math.round(state.artwork.size / 1024))} KB`;
    }
    renderProductDetails();
    updateWorkflow();
  }

  function updateWorkflow() {
    const active = state.artwork ? 2 : (state.product ? 1 : 0);
    $$('.studio-steps li').forEach((step, index) => {
      step.classList.toggle('complete', index < active);
      step.classList.toggle('current', index === active);
    });
  }

  function guideWithElite(idea) {
    const messages = $('#eliteMessages');
    const userMessage = document.createElement('p');
    userMessage.className = 'studio-elite-message user';
    userMessage.textContent = idea;
    messages.append(userMessage);

    const normalized = idea.toLowerCase();
    const productTerms = {
      tshirt: ['tee', 't-shirt', 'shirt', 'top'],
      hoodie: ['hoodie', 'sweatshirt'],
      mug: ['mug', 'cup', 'coffee'],
      phonecase: ['phone case', 'case'],
      cushion: ['cushion', 'pillow'],
      tote: ['tote', 'bag'],
      frame: ['poster', 'frame', 'wall art', 'print']
    };
    const requestedType = Object.keys(productTerms).find((type) => productTerms[type].some((term) => normalized.includes(term)));
    const words = normalized.split(/[^a-z0-9]+/).filter((word) => word.length > 2);
    const recommended = EH.products.reduce((best, product) => {
      let score = requestedType === product.type ? 8 : 0;
      const searchable = `${product.name} ${product.description || ''} ${product.tags.join(' ')}`.toLowerCase();
      words.forEach((word) => { if (searchable.includes(word)) score += word.length > 5 ? 2 : 1; });
      return score > best.score ? { product, score } : best;
    }, { product: state.product || EH.products[0], score: -1 }).product;

    let colorName = '';
    const colorWords = [
      ['black', ['black', 'dark']],
      ['white', ['white']],
      ['beige', ['beige', 'cream', 'neutral', 'sand']],
      ['navy', ['navy', 'blue']],
      ['maroon', ['maroon', 'red', 'wine']],
      ['olive', ['olive', 'green']],
      ['lavender', ['lavender', 'purple', 'lilac']],
      ['natural', ['natural', 'canvas']]
    ];
    const requestedColor = colorWords.find(([, terms]) => terms.some((term) => normalized.includes(term)));
    const typeColors = EH.types[recommended.type].colors;
    const color = requestedColor && typeColors.includes(requestedColor[0]) ? requestedColor[0] : '';
    selectProduct(recommended);
    if (color) {
      const swatch = $(`[data-color="${color}"]`, $('#productOptions'));
      if (swatch) swatch.click();
      colorName = EH.colors[color].name;
    }

    const reply = document.createElement('p');
    reply.className = 'studio-elite-message';
    reply.textContent = `I’d start with ${recommended.name}${colorName ? ` in ${colorName.toLowerCase()}` : ''}. It’s selected for you — you can still change the product, colour or size anytime.`;
    messages.append(reply);
    messages.scrollTop = messages.scrollHeight;
  }

  function clearArtwork() {
    state.artwork = null;
    updateArtworkUI();
    setStatus($('#artUploadStatus'), 'Artwork removed. Add a file to preview your custom print.');
    renderStaticPreview();
  }

  async function addToBag() {
    if (!EH.requireSize($('#productOptions'), state.product.type, state.options)) return;
    const button = $('#addCartBtn');
    button.disabled = true;
    button.innerHTML = `${EH.icon('sparkles')} Preparing your custom product…`;
    try {
      const productPreview = await makeProductMockup(state.artwork ? state.artwork.dataUrl : productDesignSource());
      const customId = EH.uid();
      const summary = state.artwork
        ? `${state.artwork.name} · ${state.artwork.width} × ${state.artwork.height} px`
        : 'EliteHub original design';
      const accepted = EH.cart.add({
        custom: true, customId, productId: state.product.id, name: state.product.name,
        type: state.product.type, color: state.options.color, size: state.options.size, model: state.options.model,
        qty: state.quantity, price: unitPrice(), image: productPreview, summary
      });
      if (!accepted) return;
      if (state.artwork) EH.files.put(`print:${customId}`, state.artwork.dataUrl).catch(() => {});
      EH.files.put(`preview:${customId}`, productPreview).catch(() => {});
      EH.toast(`${state.product.name} added to your bag`, { action: { label: 'View bag', onClick: EH.openCart } });
    } catch (error) {
      EH.toast('We could not prepare your product preview. Try uploading your artwork again.', { type: 'error' });
    } finally {
      button.innerHTML = `${EH.icon('bag')} Add custom design to bag`;
      renderProductDetails();
    }
  }

  function resetStudio() {
    clearArtwork();
    state.quantity = 1;
    setStatus($('#artUploadStatus'), 'Transparent PNGs give the cleanest print.');
    $('#productSearch').value = '';
    $$('.studio-filter').forEach((filter) => { filter.classList.remove('active'); filter.setAttribute('aria-pressed', 'false'); });
    const all = $('[data-category="all"]'); all.classList.add('active'); all.setAttribute('aria-pressed', 'true');
    renderProducts();
    selectProduct(EH.products[0], { scroll: false });
    $('#studioQty').value = '1';
  }
})();
