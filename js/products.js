/* =====================================================================
   EliteHub — Product catalogue
   Add, remove or edit products here. Fields:
     id        unique, used in the URL (product.html?id=...)
     type      tshirt | hoodie | mug | phonecase | cushion | tote | frame
     design    artwork id from js/mockups.js
     color     default colour shown
     price     selling price (₹)   mrp: original price (optional, shows a strike-through)
     tags      trending | bestseller | new
   ===================================================================== */
(function () {
  const EH = (window.EH = window.EH || {});

  EH.categories = [
    { id: 'clothing',    name: 'Clothing',      blurb: 'Wear Your Story',          feature: { type: 'hoodie', design: 'astronaut', color: 'black' } },
    { id: 'accessories', name: 'Accessories',   blurb: 'Small Things, Big Vibes',  feature: { type: 'mug', design: 'good-vibes', color: 'white' } },
    { id: 'phone-cases', name: 'Phone Cases',   blurb: 'Protect Your Style',       feature: { type: 'phonecase', design: 'mountain-line', color: 'black' } },
    { id: 'home-living', name: 'Home & Living', blurb: 'Make It Personal',         feature: { type: 'cushion', design: 'lake-scene', color: 'white' } }
  ];

  EH.products = [
    { id: 'abstract-mind-tee',   name: 'Abstract Mind',      type: 'tshirt',    design: 'abstract-mind', color: 'black', price: 999,  mrp: 1299, tags: ['trending', 'bestseller'],
      description: 'A burst of colour and calm. Our heavyweight oversized tee carries a vivid abstract print that stays sharp wash after wash.' },
    { id: 'better-days-hoodie',  name: 'Better Days Hoodie', type: 'hoodie',    design: 'better-days',   color: 'white', subtitle: 'Classic Fit', price: 1499, mrp: 1899, tags: ['trending'],
      description: 'Brushed-fleece comfort with an optimistic hand-lettered print. Classic fit, kangaroo pocket and a lined hood.' },
    { id: 'butterfly-effect-tee', name: 'Butterfly Effect',  type: 'tshirt',    design: 'butterfly',     color: 'black', price: 999,  mrp: 1299, tags: ['trending', 'new'],
      description: 'Small changes, big impact. A luminous butterfly print on a drop-shoulder oversized tee.' },
    { id: 'motivation-mug',      name: 'Motivation Mug',     type: 'mug',       design: 'dream-plan',    color: 'black', price: 599,  mrp: 749,  tags: ['trending', 'bestseller'],
      description: 'Start every morning with intent. Premium 330 ml ceramic mug, microwave and dishwasher safe.' },
    { id: 'galaxy-vibes-case',   name: 'Galaxy Vibes',       type: 'phonecase', design: 'galaxy',        color: 'black', price: 699,  mrp: 899,  tags: ['trending'],
      description: 'A slim, shock-absorbing case with a celestial print and raised edges to protect screen and camera.' },
    { id: 'mountain-soul-tee',   name: 'Mountain Soul',      type: 'tshirt',    design: 'mountain-soul', color: 'white', price: 999,  mrp: 1299, tags: ['trending', 'new'],
      description: 'For those who belong to the peaks. A sunset mountain scene printed in rich, vibrant colour.' },
    { id: 'lost-in-space-hoodie', name: 'Lost in Space',     type: 'hoodie',    design: 'astronaut',     color: 'black', price: 1599, mrp: 1999, tags: ['bestseller'],
      description: 'Drift away in our softest hoodie, featuring a meditating astronaut floating among the stars.' },
    { id: 'good-vibes-mug',      name: 'Good Vibes Only',    type: 'mug',       design: 'good-vibes',    color: 'white', price: 549,  mrp: 699,  tags: ['bestseller'],
      description: 'Glossy white ceramic mug with a brush-script print. The perfect everyday pick-me-up or gift.' },
    { id: 'mountain-line-case',  name: 'Mountain Line',      type: 'phonecase', design: 'mountain-line', color: 'black', price: 699,  mrp: 899,  tags: ['new'],
      description: 'Minimal line-art peaks under a crescent moon. Matte finish, precise cut-outs and wireless-charging friendly.' },
    { id: 'serene-lake-cushion', name: 'Serene Lake',        type: 'cushion',   design: 'lake-scene',    color: 'white', price: 899,  mrp: 1149, tags: ['new'],
      description: 'Bring the calm of the mountains home. Soft velvet-touch cushion cover with insert included.' },
    { id: 'dream-create-tee',    name: 'Dream Create Wear',  type: 'tshirt',    design: 'dream-create',  color: 'black', price: 1099, mrp: 1399, tags: ['bestseller'],
      description: 'Our signature statement tee. A crown, a mantra and premium 240 GSM combed cotton.' },
    { id: 'elite-crest-hoodie',  name: 'Elite Crest',        type: 'hoodie',    design: 'elite-crest',   color: 'black', price: 1799, mrp: 2299, tags: ['new'],
      description: 'The EliteHub crest in metallic-gold tones on a heavyweight black hoodie. Understated luxury.' },
    { id: 'stay-golden-tote',    name: 'Stay Golden',        type: 'tote',      design: 'stay-golden',   color: 'natural', price: 649, mrp: 799,  tags: ['new'],
      description: 'A sturdy 12 oz canvas tote with a retro sunset print. Roomy enough for laptop, books and more.' },
    { id: 'moon-phases-poster',  name: 'Moon Phases',        type: 'frame',     design: 'moon-phases',   color: 'black', price: 1199, mrp: 1499, tags: [],
      description: 'Museum-grade print in a ready-to-hang frame. A gentle reminder to trust the timing.' },
    { id: 'galaxy-cushion',      name: 'Galaxy Dreams',      type: 'cushion',   design: 'galaxy',        color: 'black', price: 899,  mrp: 1149, tags: [],
      description: 'A cosmic accent for your sofa or bed. Velvet-touch cover with a hidden zip and insert.' },
    { id: 'butterfly-case',      name: 'Butterfly Effect',   type: 'phonecase', design: 'butterfly',     color: 'white', price: 699,  mrp: 899,  tags: [],
      description: 'Luminous wings on a clean white case. Slim, grippy and drop tested.' },
    { id: 'mountain-soul-poster', name: 'Mountain Soul',     type: 'frame',     design: 'mountain-soul', color: 'gold',  price: 1299, mrp: 1599, tags: ['bestseller'],
      description: 'A golden-hour mountain scene, printed on archival paper and framed in brushed gold.' },
    { id: 'good-vibes-tote',     name: 'Good Vibes Only',    type: 'tote',      design: 'good-vibes',    color: 'black', price: 599,  mrp: 749,  tags: [],
      description: 'An everyday black canvas tote with a bold brush-script print.' },
    { id: 'better-days-tee',     name: 'Better Days',        type: 'tshirt',    design: 'better-days',   color: 'beige', price: 899,  mrp: 1199, tags: [],
      description: 'Optimism you can wear. Hand-lettered print on a soft beige oversized tee.' },
    { id: 'abstract-mind-mug',   name: 'Abstract Mind',      type: 'mug',       design: 'abstract-mind', color: 'white', price: 599,  mrp: 749,  tags: [],
      description: 'Our best-selling abstract print, now on a glossy ceramic mug.' }
  ];

  /* material & care details shown on product pages, per product type */
  EH.typeDetails = {
    tshirt:    { specs: ['100% combed cotton, 240 GSM heavyweight', 'Oversized drop-shoulder fit', 'Pre-shrunk, bio-washed fabric', 'Vibrant, crack-resistant print'], care: 'Machine wash cold, inside out. Do not iron directly on the print. Line dry for best results.' },
    hoodie:    { specs: ['Cotton-rich fleece, 320 GSM', 'Brushed, ultra-soft interior', 'Lined hood with drawstrings', 'Ribbed cuffs, hem & kangaroo pocket'], care: 'Machine wash cold, inside out. Tumble dry low. Do not iron on the print.' },
    mug:       { specs: ['Premium ceramic, 330 ml (11 oz)', 'Glossy finish, full-colour print', 'Microwave & dishwasher safe', 'Lead-free and food safe'], care: 'Dishwasher safe. Avoid abrasive scrubbers to keep the print looking new.' },
    phonecase: { specs: ['Hard polycarbonate back with flexible TPU edges', 'Raised lip protects screen & camera', 'Precise cut-outs for ports & buttons', 'Wireless-charging friendly'], care: 'Wipe clean with a soft, damp cloth.' },
    cushion:   { specs: ['Velvet-touch polyester cover', 'Concealed zip closure', 'Soft fibre insert included', 'Print on front, solid back'], care: 'Remove insert. Cover can be hand washed or machine washed cold on gentle.' },
    tote:      { specs: ['12 oz natural cotton canvas', 'Reinforced, stitched handles', 'Roomy 38 × 42 cm body', 'Fits a 14" laptop'], care: 'Spot clean or hand wash cold. Line dry.' },
    frame:     { specs: ['Archival matte paper, 250 GSM', 'Wooden frame with shatter-resistant acrylic', 'Includes white mount', 'Ready to hang'], care: 'Dust with a dry, soft cloth.' }
  };

  /* trending order shown on the home page (matches the design) */
  EH.trendingOrder = ['abstract-mind-tee', 'better-days-hoodie', 'butterfly-effect-tee', 'motivation-mug', 'galaxy-vibes-case', 'mountain-soul-tee'];

  EH.getProduct = (id) => EH.products.find((p) => p.id === id);
  EH.productSubtitle = (p) => p.subtitle || (EH.types[p.type] ? EH.types[p.type].label : '');
  EH.productCategory = (p) => (EH.types[p.type] ? EH.types[p.type].category : '');
  EH.productSVG = (p, color, cls) => EH.mockup(p.type, { color: color || p.color, design: p.design, className: cls || 'mock', label: p.name });
})();
