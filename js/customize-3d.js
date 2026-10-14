/* Interactive product viewer for the design studio. The artwork texture is
   exported from the existing print area, so it stays in sync with the editor. */
(() => {
  const THREE = window.THREE;
  if (!THREE || !THREE.OrbitControls) {
    window.EliteHub3D = null;
    document.dispatchEvent(new CustomEvent('elitehub:3d-ready'));
    return;
  }
  // Older Three.js builds default to interpreting hex material colors as
  // linear values. Enable sRGB conversion so product swatches retain their
  // intended color under the preview lighting.
  if (THREE.ColorManagement) THREE.ColorManagement.enabled = true;
  const colors = {
    black: '#17151b', white: '#f2efea', beige: '#d6c3a1', navy: '#1f2746',
    maroon: '#5c1d28', olive: '#4d5136', lavender: '#b8a7d9', natural: '#e7dbc3', gold: '#c9a35a'
  };
  let host, renderer, scene, camera, orbit, product, resizeObserver, frame = 0;
  let visible = false, generation = 0, liveTexture = null, liveGarmentTexture = null, fabricBumpTexture = null;
  let uploadedModel = null, uploadedModelName = '';
  const material = (color, roughness = 0.76, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.02, ...extra });
  const mesh = (geometry, mat, x = 0, y = 0, z = 0) => {
    const item = new THREE.Mesh(geometry, mat);
    item.position.set(x, y, z);
    item.castShadow = true;
    item.receiveShadow = true;
    return item;
  };

  function roundedRect(width, height, radius) {
    const s = new THREE.Shape();
    const x = -width / 2, y = -height / 2, r = Math.min(radius, width / 2, height / 2);
    s.moveTo(x + r, y); s.lineTo(x + width - r, y); s.quadraticCurveTo(x + width, y, x + width, y + r);
    s.lineTo(x + width, y + height - r); s.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    s.lineTo(x + r, y + height); s.quadraticCurveTo(x, y + height, x, y + height - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    return s;
  }

  function extruded(shape, color, depth = 0.16, bevel = 0.045, roughness = 0.8) {
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth, bevelEnabled: true, bevelSegments: 3, steps: 1,
      bevelSize: bevel, bevelThickness: bevel, curveSegments: 12
    });
    geometry.translate(0, 0, -depth / 2);
    return mesh(geometry, material(color, roughness));
  }

  function makeFabricBump() {
    if (fabricBumpTexture) return fabricBumpTexture;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const context = canvas.getContext('2d');
    context.fillStyle = '#808080'; context.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 13000; i++) {
      const x = Math.random() * 256, y = Math.random() * 256;
      const light = Math.random() > 0.5;
      context.fillStyle = light ? 'rgba(255,255,255,.13)' : 'rgba(0,0,0,.13)';
      context.fillRect(x, y, 1, light ? 2 : 1);
    }
    context.globalAlpha = 0.14;
    context.strokeStyle = '#333'; context.lineWidth = 1;
    for (let p = -256; p < 512; p += 7) {
      context.beginPath(); context.moveTo(p, 0); context.lineTo(p + 256, 256); context.stroke();
      context.beginPath(); context.moveTo(p, 256); context.lineTo(p + 256, 0); context.stroke();
    }
    fabricBumpTexture = new THREE.CanvasTexture(canvas);
    fabricBumpTexture.wrapS = fabricBumpTexture.wrapT = THREE.RepeatWrapping;
    fabricBumpTexture.repeat.set(16, 18);
    fabricBumpTexture.anisotropy = renderer ? renderer.capabilities.getMaxAnisotropy() : 4;
    return fabricBumpTexture;
  }

  function clothRelief(x, y) {
    const torso = Math.exp(-Math.pow(x / 1.04, 4));
    const dome = 0.15 * torso * (0.84 + 0.16 * Math.cos((y + 0.1) * 1.8));
    const sideFold = Math.exp(-Math.pow((Math.abs(x) - 0.78) / 0.19, 2));
    const shoulderFold = Math.exp(-Math.pow((y - 0.58) / 0.3, 2));
    const hemFold = Math.exp(-Math.pow((y + 1.48) / 0.18, 2));
    const softFolds = 0.019 * Math.sin(y * 3.8 + Math.sin(x * 5.2)) * sideFold
      + 0.012 * Math.sin(x * 5.4 + y * 4.1) * shoulderFold
      + 0.011 * Math.sin(x * 3.5 + y * 2.1) * hemFold;
    return dome + softFolds;
  }

  function pointInPolygon(x, y, points) {
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const a = points[i], b = points[j];
      if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) inside = !inside;
    }
    return inside;
  }

  function garmentPanel(shape, side) {
    const outline = shape.getPoints(24);
    const minX = Math.min(...outline.map((p) => p.x)), maxX = Math.max(...outline.map((p) => p.x));
    const minY = Math.min(...outline.map((p) => p.y)), maxY = Math.max(...outline.map((p) => p.y));
    const columns = 76, rows = 78, positions = [], uvs = [], indices = [];
    const dx = (maxX - minX) / columns, dy = (maxY - minY) / rows;
    for (let row = 0; row <= rows; row++) {
      const y = minY + row * dy;
      for (let col = 0; col <= columns; col++) {
        const x = minX + col * dx;
        positions.push(x, y, side * (0.104 + clothRelief(x, y)));
        uvs.push((x + 2) / 4, (y + 2) / 4);
      }
    }
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < columns; col++) {
        const a = row * (columns + 1) + col, b = a + 1, d = a + columns + 1, c = d + 1;
        const ax = minX + (col + 1 / 3) * dx, ay = minY + (row + 1 / 3) * dy;
        const bx = minX + (col + 2 / 3) * dx, by = minY + (row + 2 / 3) * dy;
        const firstInside = pointInPolygon(ax, ay, outline), secondInside = pointInPolygon(bx, by, outline);
        if (side > 0) {
          if (firstInside) indices.push(a, b, c);
          if (secondInside) indices.push(a, c, d);
        } else {
          if (firstInside) indices.push(a, c, b);
          if (secondInside) indices.push(a, d, c);
        }
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices); geometry.computeVertexNormals();
    return geometry;
  }

  function addGarmentShell(group, shape, color, type) {
    group.add(extruded(shape, color, 0.16, 0.02, 0.9));
    const bumpMap = makeFabricBump();
    const front = material('#fff', 0.91, { bumpMap, bumpScale: 0.018, transparent: true, alphaTest: 0.015, side: THREE.FrontSide });
    const back = material(color, 0.93, { bumpMap, bumpScale: 0.022, side: THREE.FrontSide });
    const frontMesh = mesh(garmentPanel(shape, 1), front);
    frontMesh.userData.garmentFront = true;
    frontMesh.renderOrder = 1;
    const backMesh = mesh(garmentPanel(shape, -1), back);
    backMesh.userData.garmentBack = true;
    group.add(frontMesh, backMesh);
    if (window.EH?.mockup && window.EH?.svgToDataURL) {
      const svg = window.EH.mockup(type, { color, layer: 'full', px: 1024 });
      liveGarmentTexture = new THREE.TextureLoader().load(window.EH.svgToDataURL(svg), (texture) => {
        if ('colorSpace' in texture && THREE.SRGBColorSpace) texture.colorSpace = THREE.SRGBColorSpace;
        else if ('encoding' in texture && THREE.sRGBEncoding) texture.encoding = THREE.sRGBEncoding;
        texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
        const activeFront = product && product.getObjectById(frontMesh.id);
        if (activeFront && activeFront.material) { activeFront.material.map = texture; activeFront.material.needsUpdate = true; }
      });
    }
  }

  function garmentShape(isHoodie) {
    const s = new THREE.Shape();
    if (isHoodie) {
      s.moveTo(-0.53, 1.23); s.lineTo(-0.99, 1.08); s.lineTo(-1.47, 0.53);
      s.lineTo(-1.17, 0.25); s.lineTo(-0.94, 0.53); s.lineTo(-0.93, -1.55);
      s.quadraticCurveTo(0, -1.68, 0.93, -1.55); s.lineTo(0.94, 0.53);
      s.lineTo(1.17, 0.25); s.lineTo(1.47, 0.53); s.lineTo(0.99, 1.08);
      s.lineTo(0.53, 1.23); s.quadraticCurveTo(0, 0.91, -0.53, 1.23);
    } else {
      s.moveTo(-0.42, 1.46); s.quadraticCurveTo(0, 1.02, 0.42, 1.46);
      s.lineTo(0.95, 1.28); s.lineTo(1.58, 0.53); s.lineTo(1.18, 0.18);
      s.lineTo(0.94, 0.52); s.lineTo(0.95, -1.56); s.quadraticCurveTo(0, -1.68, -0.95, -1.56);
      s.lineTo(-0.94, 0.52); s.lineTo(-1.18, 0.18); s.lineTo(-1.58, 0.53);
      s.lineTo(-0.95, 1.28); s.closePath();
    }
    return s;
  }

  function addHoodieDetails(group, bodyColor) {
    const hood = new THREE.Shape();
    hood.moveTo(-0.54, 1.2); hood.quadraticCurveTo(-0.62, 1.92, 0, 1.98);
    hood.quadraticCurveTo(0.62, 1.92, 0.54, 1.2); hood.quadraticCurveTo(0, 1.48, -0.54, 1.2);
    const hoodMesh = extruded(hood, new THREE.Color(bodyColor).multiplyScalar(0.82).getStyle(), 0.14, 0.04);
    hoodMesh.position.z = -0.01; group.add(hoodMesh);
    const cordMat = material(new THREE.Color(bodyColor).getStyle(), 0.65);
    [-0.13, 0.13].forEach((x) => {
      const cord = mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.55, 8), cordMat, x, 0.93, 0.122 + clothRelief(x, 0.93));
      group.add(cord);
    });
    const pocket = mesh(new THREE.BoxGeometry(1.05, 0.48, 0.035), material(bodyColor, 0.95), 0, -0.88, 0.132 + clothRelief(0, -0.88));
    group.add(pocket);
  }

  function addProductBody(type, color) {
    const group = new THREE.Group();
    const c = colors[color] || color || colors.black;
    if (type === 'tshirt' || type === 'hoodie') {
      addGarmentShell(group, garmentShape(type === 'hoodie'), c, type);
      if (type === 'hoodie') addHoodieDetails(group, c);
      else group.add(mesh(new THREE.TorusGeometry(0.31, 0.045, 12, 40), material(new THREE.Color(c).multiplyScalar(0.82).getStyle(), 0.82), 0, 1.27, 0.122 + clothRelief(0, 1.27)));
    } else if (type === 'mug') {
      const mug = mesh(new THREE.CylinderGeometry(0.78, 0.84, 2.18, 48, 1), material(c, 0.2, { metalness: 0.08 }), -0.28, 0, 0);
      group.add(mug);
      group.add(mesh(new THREE.TorusGeometry(0.47, 0.09, 12, 40), material(c, 0.24), 0.63, 0.02, 0));
      const rim = mesh(new THREE.TorusGeometry(0.73, 0.025, 8, 40), material(new THREE.Color(c).multiplyScalar(0.78).getStyle(), 0.2), -0.28, 1.09, 0);
      rim.rotation.x = Math.PI / 2; group.add(rim);
    } else if (type === 'phonecase') {
      group.add(extruded(roundedRect(1.58, 3.3, 0.2), c, 0.16, 0.09, 0.38));
      group.add(mesh(new THREE.BoxGeometry(0.72, 0.72, 0.075), material(new THREE.Color(c).multiplyScalar(0.65).getStyle(), 0.38), -0.34, 1.13, 0.23));
      [[-0.5, 1.31], [-0.18, 1.31], [-0.5, 0.99]].forEach(([x, y]) => {
        const ring = mesh(new THREE.CylinderGeometry(0.105, 0.105, 0.055, 24), material('#17151b', 0.24), x, y, 0.31);
        ring.rotation.x = Math.PI / 2; group.add(ring);
        const lens = mesh(new THREE.CylinderGeometry(0.064, 0.064, 0.06, 24), material('#28374f', 0.14, { metalness: 0.25 }), x, y, 0.37);
        lens.rotation.x = Math.PI / 2; group.add(lens);
      });
    } else if (type === 'cushion') {
      const shape = new THREE.Shape();
      shape.moveTo(-1.02, 0.82); shape.quadraticCurveTo(0, 1.06, 1.02, 0.82);
      shape.quadraticCurveTo(1.22, 0, 1.02, -0.82); shape.quadraticCurveTo(0, -1.06, -1.02, -0.82);
      shape.quadraticCurveTo(-1.22, 0, -1.02, 0.82);
      group.add(extruded(shape, c, 0.36, 0.18, 0.98));
    } else if (type === 'tote') {
      const bag = new THREE.Shape();
      bag.moveTo(-1, 0.22); bag.lineTo(1, 0.22); bag.lineTo(0.94, -1.62); bag.quadraticCurveTo(0, -1.72, -0.94, -1.62); bag.closePath();
      group.add(extruded(bag, c, 0.18, 0.045, 0.95));
      const handleCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.55, 0.16, 0), new THREE.Vector3(-0.53, 0.86, 0),
        new THREE.Vector3(-0.31, 1.33, 0), new THREE.Vector3(0, 1.48, 0),
        new THREE.Vector3(0.31, 1.33, 0), new THREE.Vector3(0.53, 0.86, 0), new THREE.Vector3(0.55, 0.16, 0)
      ]);
      group.add(mesh(new THREE.TubeGeometry(handleCurve, 32, 0.075, 10, false), material(new THREE.Color(c).multiplyScalar(0.78).getStyle(), 0.9)));
    } else if (type === 'frame') {
      const outer = material(c, 0.32, { metalness: color === 'gold' ? 0.52 : 0.06 });
      group.add(mesh(new THREE.BoxGeometry(1.9, 2.85, 0.16), outer));
      const matboard = mesh(new THREE.BoxGeometry(1.66, 2.61, 0.035), material('#f3efe7', 0.88), 0, 0, 0.105);
      group.add(matboard);
      const edge = 0.13, frameMat = outer;
      group.add(mesh(new THREE.BoxGeometry(1.9, edge, 0.11), frameMat, 0, 1.36, 0.13));
      group.add(mesh(new THREE.BoxGeometry(1.9, edge, 0.11), frameMat, 0, -1.36, 0.13));
      group.add(mesh(new THREE.BoxGeometry(edge, 2.72, 0.11), frameMat, -0.885, 0, 0.13));
      group.add(mesh(new THREE.BoxGeometry(edge, 2.72, 0.11), frameMat, 0.885, 0, 0.13));
    }
    return group;
  }

  function createPrintMesh(type, printRect, texture) {
    const w = printRect.w / 100, h = printRect.h / 100;
    const x = (printRect.x + printRect.w / 2 - 200) / 100;
    const y = (200 - printRect.y - printRect.h / 2) / 100;
    const mat = new THREE.MeshStandardMaterial({ map: texture, transparent: true, side: THREE.DoubleSide, depthWrite: false, toneMapped: true, roughness: type === 'mug' ? 0.48 : 0.91, metalness: 0, polygonOffset: true, polygonOffsetFactor: -1 });
    let geometry = new THREE.PlaneGeometry(w, h, type === 'mug' ? 40 : (type === 'tshirt' || type === 'hoodie' ? 34 : 1), type === 'tshirt' || type === 'hoodie' ? 44 : 1);
    let z = 0.23;
    if (type === 'tshirt' || type === 'hoodie') {
      const p = geometry.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const px = p.getX(i) + x, py = p.getY(i) + y;
        p.setZ(i, 0.119 + clothRelief(px, py) + 0.012);
      }
      p.needsUpdate = true; geometry.computeVertexNormals(); z = 0;
    } else if (type === 'mug') {
      const radius = 0.78;
      const p = geometry.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const px = p.getX(i), py = p.getY(i), a = px / radius;
        p.setXYZ(i, Math.sin(a) * radius, py, Math.cos(a) * radius + 0.012);
      }
      p.needsUpdate = true; geometry.computeVertexNormals(); z = 0;
    } else if (type === 'phonecase') z = 0.235;
    else if (type === 'cushion') z = 0.27;
    else if (type === 'frame') z = 0.16;
    else if (type === 'tote') z = 0.2;
    return mesh(geometry, mat, x, y, z);
  }

  function resize() {
    if (!renderer || !host) return;
    const width = Math.max(1, host.clientWidth), height = Math.max(1, host.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function animate() {
    if (!visible || !renderer) return;
    frame = requestAnimationFrame(animate);
    orbit.update();
    renderer.render(scene, camera);
  }

  function init(mount) {
    if (renderer) { if (host !== mount) { host = mount; host.appendChild(renderer.domElement); resize(); } return true; }
    host = mount;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      if ('outputColorSpace' in renderer && THREE.SRGBColorSpace) renderer.outputColorSpace = THREE.SRGBColorSpace;
      else if ('outputEncoding' in renderer && THREE.sRGBEncoding) renderer.outputEncoding = THREE.sRGBEncoding;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1;
      renderer.domElement.setAttribute('aria-label', 'Interactive three dimensional product preview');
      renderer.domElement.tabIndex = 0;
      host.appendChild(renderer.domElement);
      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(33, 1, 0.1, 100);
      camera.position.set(0.12, 0.82, 6.9);
      orbit = new THREE.OrbitControls(camera, renderer.domElement);
      orbit.target.set(0, 0.02, 0);
      orbit.enableDamping = true; orbit.dampingFactor = 0.075;
      orbit.enablePan = false; orbit.minDistance = 4.1; orbit.maxDistance = 9.5;
      orbit.minPolarAngle = 0.45; orbit.maxPolarAngle = Math.PI * 0.58;
      scene.add(new THREE.HemisphereLight('#fff5e8', '#302b38', 1.15));
      const key = new THREE.DirectionalLight('#fff0dc', 1.85); key.position.set(-3.5, 5, 5); scene.add(key);
      const fill = new THREE.DirectionalLight('#ded7ef', 0.62); fill.position.set(4, 1.5, 4); scene.add(fill);
      const rim = new THREE.DirectionalLight('#c8a77c', 0.72); rim.position.set(3, 2.5, -3); scene.add(rim);
      const glow = document.createElement('canvas'); glow.width = glow.height = 128;
      const ctx = glow.getContext('2d');
      const radial = ctx.createRadialGradient(64, 64, 3, 64, 64, 62);
      radial.addColorStop(0, 'rgba(0,0,0,.42)'); radial.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = radial; ctx.fillRect(0, 0, 128, 128);
      const shadow = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 2.5), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(glow), transparent: true, depthWrite: false }));
      shadow.rotation.x = -Math.PI / 2; shadow.position.set(0, -1.85, 0); scene.add(shadow);
      resizeObserver = new ResizeObserver(resize); resizeObserver.observe(host);
      resize();
      return true;
    } catch (error) {
      if (renderer) renderer.dispose();
      renderer = null;
      return false;
    }
  }

  function loadModel(file) {
    return new Promise((resolve) => {
      if (!THREE.GLTFLoader) return resolve({ ok: false, message: 'The 3D model loader is unavailable. Refresh and try again.' });
      if (!file || !/\.glb$/i.test(file.name)) return resolve({ ok: false, message: 'Choose a .GLB 3D model file.' });
      if (file.size > 25 * 1024 * 1024) return resolve({ ok: false, message: 'That model is larger than 25 MB.' });

      file.arrayBuffer().then((data) => {
        const loader = new THREE.GLTFLoader();
        loader.parse(data, '', (gltf) => {
          const model = new THREE.Group();
          model.add(gltf.scene);
          const originalBounds = new THREE.Box3().setFromObject(model);
          const originalSize = originalBounds.getSize(new THREE.Vector3());
          const longest = Math.max(originalSize.x, originalSize.y, originalSize.z);
          if (!Number.isFinite(longest) || longest <= 0) return resolve({ ok: false, message: 'That file does not contain a visible 3D model.' });

          model.scale.setScalar(3.2 / longest);
          model.updateMatrixWorld(true);
          const bounds = new THREE.Box3().setFromObject(model);
          model.position.sub(bounds.getCenter(new THREE.Vector3()));
          model.updateMatrixWorld(true);
          uploadedModel = model;
          uploadedModelName = file.name;
          resolve({ ok: true, name: file.name });
        }, () => resolve({ ok: false, message: 'Could not open this GLB. Use a single model file with textures included.' }));
      }).catch(() => resolve({ ok: false, message: 'Could not read that model file.' }));
    });
  }

  function clearModel() {
    uploadedModel = null;
    uploadedModelName = '';
  }

  function makeUploadedModel() {
    const model = uploadedModel.clone(true);
    model.userData.uploadedModel = true;
    model.traverse((item) => {
      if (!item.isMesh || !item.material) return;
      item.material = Array.isArray(item.material) ? item.material.map((m) => m.clone()) : item.material.clone();
    });
    return model;
  }

  function addArtworkToUploadedModel(print, texture) {
    const bounds = new THREE.Box3().setFromObject(product);
    const size = bounds.getSize(new THREE.Vector3());
    const aspect = Math.max(0.1, print.w / print.h);
    const height = Math.min(size.y * 0.56, (size.x * 0.72) / aspect);
    const width = height * aspect;
    const scale = Math.max(0.001, Math.abs(product.scale.x));
    const artwork = new THREE.Mesh(
      new THREE.PlaneGeometry(width / scale, height / scale),
      new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -1 })
    );
    artwork.userData.printArtwork = true;
    product.updateMatrixWorld(true);
    const center = bounds.getCenter(new THREE.Vector3());
    center.z = bounds.max.z + 0.012;
    artwork.position.copy(product.worldToLocal(center));
    artwork.renderOrder = 2;
    product.add(artwork);
  }

  function update({ type, color, print, textureUrl }) {
    if (!renderer || !scene) return;
    const token = ++generation;
    if (product) {
      scene.remove(product);
      const uploaded = !!product.userData.uploadedModel;
      product.traverse((item) => {
        if (item.geometry && (!uploaded || item.userData.printArtwork)) item.geometry.dispose();
        if (item.material) (Array.isArray(item.material) ? item.material : [item.material]).forEach((m) => m.dispose());
      });
    }
    if (liveGarmentTexture) { liveGarmentTexture.dispose(); liveGarmentTexture = null; }
    product = uploadedModel ? makeUploadedModel() : addProductBody(type, color);
    scene.add(product);
    new THREE.TextureLoader().load(textureUrl, (texture) => {
      if (token !== generation) { texture.dispose(); return; }
      if ('colorSpace' in texture && THREE.SRGBColorSpace) texture.colorSpace = THREE.SRGBColorSpace;
      else if ('encoding' in texture && THREE.sRGBEncoding) texture.encoding = THREE.sRGBEncoding;
      texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
      if (liveTexture) liveTexture.dispose();
      liveTexture = texture;
      if (product.userData.uploadedModel) addArtworkToUploadedModel(print, texture);
      else product.add(createPrintMesh(type, print, texture));
    });
    orbit.target.set(0, type === 'phonecase' ? -0.02 : 0.02, 0);
    resize();
  }

  function setVisible(value) {
    visible = !!value;
    if (visible) { cancelAnimationFrame(frame); animate(); }
    else cancelAnimationFrame(frame);
  }
  function action(name) {
    if (!orbit) return;
    if (name === 'left' || name === 'right') {
      const offset = camera.position.clone().sub(orbit.target);
      offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), name === 'left' ? -0.42 : 0.42);
      camera.position.copy(orbit.target).add(offset);
    }
    if (name === 'reset') { orbit.reset(); orbit.autoRotate = false; }
    if (name === 'auto') orbit.autoRotate = !orbit.autoRotate;
    orbit.update();
    return !!orbit.autoRotate;
  }

  window.EliteHub3D = { init, update, setVisible, action, loadModel, clearModel, get uploadedModelName() { return uploadedModelName; } };
  document.dispatchEvent(new CustomEvent('elitehub:3d-ready'));
})();
