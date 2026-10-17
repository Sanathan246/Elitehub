# EliteHub 3D preview

A 3D product catalogue (modelled on VirtualThreads' products page), a 3D
customization window, and an account page for orders and delivery details.
Customers can export a GLB or attach their design to an order; the studio does
not offer a saved-preview library.

```
3d-preview/
  products.html        3D product catalogue: categories, search, sort, hover to see the back
  customizer.html      3D studio (the customization window)
  account.html         "Your Account" tiles + existing orders/details/sign-in
  css/preview3d.css    styles, built on css/style.css (gold tokens, .btn, .studio-*, .swatch…)
  assets/products/     catalogue renders (<id>.jpg and <id>-alt.jpg for the hover view)
  js/catalogue.js      catalogue page
  js/customizer.js     3D studio UI
  js/studio/           the 3D engine (three.js 0.160.0 from jsDelivr)
    catalog.js         the product list: categories, prices link, default colours (no three.js)
    studio.js          scene, lights, camera, print layers, GLB export
    models.js          product builders (mug, phone case, tote, cushion, frame), file loaders
    textures.js        kraft board, backdrops, text rendering
    garments/*.js      generated garment meshes, loaded only when opened (~350–500 KB each)
  tools/build_garments.py   regenerates the garments (Python: numpy, scikit-image, fast-simplification)
```

## Try it

Put the `3d-preview` folder in the project root (next to `index.html`) and open
it through any local server, the same way you run the rest of the site:

```
npx serve .
# then open http://localhost:3000/3d-preview/products.html
#           http://localhost:3000/3d-preview/customizer.html
#       and http://localhost:3000/3d-preview/account.html
```

Opening the HTML file directly from disk (file://) will not work, because
browsers block ES modules there. Netlify and Firebase Hosting serve it as-is.

Both pages start with `<base href="../">`, so the shared header, footer, cart,
Firebase sign-in, `assets/` and `css/style.css` all resolve from the site root.
Because of that, links inside these pages are written from the root too.

## The 3D products

| Product | Category | Orders as (js/mockups.js) |
|---|---|---|
| Oversized tee | T-shirts & tops | tshirt |
| Long-sleeve tee | T-shirts & tops | preview only |
| Tank top | T-shirts & tops | preview only |
| Crewneck sweatshirt | Hoodies & sweatshirts | preview only |
| Hoodie | Hoodies & sweatshirts | hoodie |
| Ceramic mug | Accessories | mug |
| Phone case | Accessories | phonecase (with phone model) |
| Tote bag | Accessories | tote |
| Cushion | Home & living | cushion (16 or 18 in) |
| Framed poster | Home & living | frame (A4 or A3) |

Colours, sizes, phone models and prices come from `EH.types` in `js/mockups.js`,
so the 3D pages follow your shop. To make a preview-only garment orderable, add a
type for it in `js/mockups.js` and set its `shop` in `js/studio/catalog.js`.

The catalogue renders in `assets/products/` were made with the studio itself
(mid-grey backdrop, front view plus a second angle for hover). If you change a
product's default colour, re-render its two images.

## What the 3D studio does

- **Start**: upload a 3D mockup (.glb, .gltf, .obj, .stl, .fbx, up to 20 MB), or
  start from any of the 10 products (also reachable from the catalogue).
- **Design**: add artwork (PNG, JPG, WEBP, SVG) or text in the site's fonts.
  New prints land on the side you're looking at; drag them across the model or
  snap them to a print position (front centre, left chest, back, sleeves…).
  Drag a selected print's edge handles to stretch one way, or its corner
  handles to resize both dimensions together. Artwork can be stretched up to
  20× its starting size.
  Image backgrounds can be removed with the in-browser MODNet AI tool; the
  original image remains available to restore.
- **Finish**: tee and mug colours come from `EH.types` / `EH.colors` in
  `js/mockups.js`, so they match the shop. Custom colours are allowed for
  previews but can't be ordered.
- **Scene**: Studio dark (matches the reference video), Midnight, Studio light,
  Stone, transparent or any colour; three lighting setups; turntable.
- **Export**: a self-contained, high-quality 3D mockup (.glb) with model, finish,
  and artwork embedded.
- **Add to bag**: catalogue products use the current shop price. Uploaded models can
  be ordered as an existing store product. Before adding the cart item, the studio
  saves a customized GLB, the original uploaded file, a preview and design details
  in browser storage. At checkout, the GLB, uploaded source model, preview, and
  design details are saved in order-specific Firestore records. Deploy
  `firestore.rules` separately because Netlify publishes only the website files.

Keyboard: Delete removes the selected print (Design tab); arrow keys move between tabs.

URL options: `customizer.html?template=<product id>` (tee, longsleeve, tank, crewneck,
hoodie, mug, phonecase, tote, cushion, frame), `?start=upload`.
Catalogue: `products.html?category=sweats&q=hood&orderable=1`.

## Custom orders

Adding a customized 3D product to the bag stores its high-quality GLB, original
uploaded model when applicable, preview image, and order details for checkout.
The order's customization files are uploaded under `users/{uid}/customizations/{id}`
and can be downloaded from the order details. The studio does not store a separate
customer preview library.

## Main site integration

The existing site's Customize Now, product personalization, shop and account links
open the 3D studio. The old customize.html path remains as a compatibility
redirect; it maps former product, color, artwork and text parameters into the
3D customizer. Bag items created by the 3D studio link back to the 3D customizer.
## Browser support

Any browser with WebGL 2 (Chrome, Edge, Firefox, Safari 15+). Motion respects
"reduce motion". High-quality GLB export and order file uploads require a modern
browser with enough available memory and storage for the selected model.

## Changing the garments

The garments are generated, not downloaded models, so there are no licence
issues. Edit `BASE` / `GARMENTS` at the top of `tools/build_garments.py` (length,
width, sleeve angle, ribbing, hood, pocket…) and run
`python tools/build_garments.py` (or `python tools/build_garments.py hoodie`)
to rewrite `js/studio/garments/*.js`.
