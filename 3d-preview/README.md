# EliteHub 3D preview

A 3D product catalogue (modelled on VirtualThreads' products page), a 3D
customization window, and an Amazon-style "Your Account" page with folders for
saved 3D previews. Everything lives in this folder; no existing EliteHub
file is changed.

```
3d-preview/
  products.html        3D product catalogue: categories, search, sort, hover to see the back
  customizer.html      3D studio (the customization window)
  account.html         "Your Account" tiles + Your 3D previews + your existing orders/details/sign-in
  css/preview3d.css    styles, built on css/style.css (gold tokens, .btn, .studio-*, .swatch…)
  assets/products/     catalogue renders (<id>.jpg and <id>-alt.jpg for the hover view)
  js/catalogue.js      catalogue page
  js/customizer.js     3D studio UI
  js/previews.js       Your 3D previews: folders, search, sort, move, rename, delete
  js/store.js          where previews and folders are saved (IndexedDB, per account)
  js/studio/           the 3D engine (three.js 0.160.0 from jsDelivr)
    catalog.js         the product list: categories, prices link, default colours (no three.js)
    studio.js          scene, lights, camera, print layers, PNG + video export
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
Because of that, links inside these pages are written from the root too
(`3d-preview/account.html#previews`, not `#previews`).

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

- **Start**: upload a 3D mockup (.glb, .gltf, .obj, .stl, .fbx, up to 50 MB), or
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
- **Export**: PNG up to 4K (square, landscape, portrait, transparent), a
  self-contained 3D mockup (.glb), design details (.json), and 360° video
  (.mp4 in Chrome/Safari, .webm elsewhere).
- **Save**: to Your account › Your 3D previews, optionally into a folder.
- **Add to bag** (any orderable product in a catalogue colour): uses `EH.cart.add` exactly
  like the 2D studio. The bag thumbnail is the 3D render; `EH.files` gets
  `print:<id>` (the artwork), `preview:<id>` and `3d:<id>` (the full 3D setup),
  so checkout and the order's "Print file" / "Preview" buttons work unchanged.

Keyboard: Delete removes the selected print (Design tab), Ctrl/Cmd+S saves,
arrow keys move between tabs.

URL options: `customizer.html?template=<product id>` (tee, longsleeve, tank, crewneck,
hoodie, mug, phonecase, tote, cushion, frame), `?start=upload`, `?id=<saved preview>`.
Catalogue: `products.html?category=sweats&q=hood&orderable=1`.

## Where previews are stored

Saved previews stay in the browser's IndexedDB (`elitehub-3d-previews`).
For a signed-in user, saving a preview also syncs its GLB mockup, PNG preview,
JSON design details and metadata to that user's Firebase Storage and Firestore.
At checkout the purchased 3D design and order reference are saved to Firebase;
the GLB and design details can be downloaded again from order details.

Each preview is tagged with the signed-in Firebase uid (or "guest"), and lists
only show the current person's previews. If someone saved previews before
signing in, the account page offers to add them to their account.

The account's saved-preview list and folders remain device-local. Firebase
stores individual synced/purchased customization files under
`users/{uid}/customizations/{id}`; it does not sync the preview list or folders.

## Main site integration

The existing site's Customize Now, product personalization, shop and account links
open the 3D studio. The old customize.html path remains as a compatibility
redirect; it maps former product, color, artwork and text parameters into the
3D customizer. Bag items created by the 3D studio link back to the 3D customizer.
## Browser support

Any browser with WebGL 2 (Chrome, Edge, Firefox, Safari 15+). Video recording
needs MediaRecorder (Chrome, Edge, Firefox, Safari 17+); the button explains
when it isn't available. Motion respects "reduce motion".

## Changing the garments

The garments are generated, not downloaded models, so there are no licence
issues. Edit `BASE` / `GARMENTS` at the top of `tools/build_garments.py` (length,
width, sleeve angle, ribbing, hood, pocket…) and run
`python tools/build_garments.py` (or `python tools/build_garments.py hoodie`)
to rewrite `js/studio/garments/*.js`.
