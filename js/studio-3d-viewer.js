/* Original procedural product viewer for the EliteHub studio.
   Each catalog shape is built here so the preview keeps one consistent studio look. */
(() => {
  const THREE = window.THREE;
  if (!THREE || !THREE.OrbitControls) {
    window.StudioProductViewer = null;
    return;
  }

  const colors = {
    black: '#222126', white: '#eeeae4', beige: '#cdbb9b', navy: '#202942',
    maroon: '#55232d', olive: '#4b5038', lavender: '#b5a7cf',
    natural: '#d9cdb4', gold: '#b99a62'
  };
  const reducedMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  let host, renderer, scene, camera, orbit, activeProduct, resizeObserver, animationFrame = 0;
  let visible = false, generation = 0, printTexture = null, fabricTexture = null, showcaseTime = 0;

  const mat = (color, roughness, extra) => new THREE.MeshStandardMaterial({
    color: color || '#fff', roughness: roughness == null ? 0.82 : roughness,
    metalness: 0.01, ...(extra || {})
  });
  const mesh = (geometry, material, x, y, z) => {
    const item = new THREE.Mesh(geometry, material);
    item.position.set(x || 0, y || 0, z || 0);
    item.castShadow = true;
    item.receiveShadow = true;
    return item;
  };

  function makeFabricTexture() {
    if (fabricTexture) return fabricTexture;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 192;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#818181'; ctx.fillRect(0, 0, 192, 192);
    ctx.strokeStyle = 'rgba(255,255,255,.2)'; ctx.lineWidth = 1;
    for (let i = -192; i < 384; i += 6) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + 192, 192); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(i, 192); ctx.lineTo(i + 192, 0); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(0,0,0,.16)';
    for (let i = -192; i < 384; i += 12) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + 192, 192); ctx.stroke();
    }
    for (let i = 0; i < 9000; i++) {
      const v = Math.random() > 0.5 ? 255 : 0;
      ctx.fillStyle = 'rgba(' + v + ',' + v + ',' + v + ',.12)';
      ctx.fillRect(Math.random() * 192, Math.random() * 192, 1, 1);
    }
    fabricTexture = new THREE.CanvasTexture(canvas);
    fabricTexture.wrapS = fabricTexture.wrapT = THREE.RepeatWrapping;
    fabricTexture.repeat.set(12, 14);
    return fabricTexture;
  }

  function clothDrape(x, y) {
    const center = Math.exp(-Math.pow(x / 0.92, 4));
    const body = 0.145 * center * (0.82 + 0.18 * Math.cos((y + 0.16) * 1.75));
    const side = Math.exp(-Math.pow((Math.abs(x) - 0.78) / 0.2, 2));
    const shoulder = Math.exp(-Math.pow((y - 0.62) / 0.34, 2));
    const lower = Math.exp(-Math.pow((y + 1.43) / 0.24, 2));
    const diagonal = Math.exp(-Math.pow((y - 0.5 + Math.abs(x) * 0.38) / 0.17, 2));
    return body
      + 0.031 * Math.sin(y * 3.6 + Math.sin(x * 5.2)) * side
      + 0.022 * Math.sin(x * 5.3 + y * 4.1) * shoulder
      + 0.018 * Math.sin(x * 3.5 + y * 2.2) * lower
      + 0.012 * Math.sin(x * 7.2 + y * 5.5) * diagonal;
  }

  function roundedShape(width, height, radius) {
    const shape = new THREE.Shape();
    const x = -width / 2, y = -height / 2;
    const r = Math.min(radius, width / 2, height / 2);
    shape.moveTo(x + r, y);
    shape.lineTo(x + width - r, y); shape.quadraticCurveTo(x + width, y, x + width, y + r);
    shape.lineTo(x + width, y + height - r); shape.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    shape.lineTo(x + r, y + height); shape.quadraticCurveTo(x, y + height, x, y + height - r);
    shape.lineTo(x, y + r); shape.quadraticCurveTo(x, y, x + r, y);
    return shape;
  }

  function garmentOutline(isHoodie) {
    const shape = new THREE.Shape();
    if (isHoodie) {
      shape.moveTo(-0.52, 1.23); shape.lineTo(-1.02, 1.08); shape.lineTo(-1.48, 0.53);
      shape.lineTo(-1.18, 0.24); shape.lineTo(-0.94, 0.51); shape.lineTo(-0.93, -1.55);
      shape.quadraticCurveTo(0, -1.68, 0.93, -1.55); shape.lineTo(0.94, 0.51);
      shape.lineTo(1.18, 0.24); shape.lineTo(1.48, 0.53); shape.lineTo(1.02, 1.08);
      shape.lineTo(0.52, 1.23); shape.quadraticCurveTo(0, 0.94, -0.52, 1.23);
    } else {
      shape.moveTo(-0.46, 1.31); shape.lineTo(-0.96, 1.13); shape.lineTo(-1.58, 0.55);
      shape.lineTo(-1.18, 0.18); shape.lineTo(-0.94, 0.52); shape.lineTo(-0.95, -1.56);
      shape.quadraticCurveTo(0, -1.69, 0.95, -1.56); shape.lineTo(0.94, 0.52);
      shape.lineTo(1.18, 0.18); shape.lineTo(1.58, 0.55); shape.lineTo(0.96, 1.13);
      shape.lineTo(0.46, 1.31); shape.quadraticCurveTo(0, 0.96, -0.46, 1.31);
    }
    shape.closePath();
    return shape;
  }

  function pointInside(x, y, points) {
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const a = points[i], b = points[j];
      if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) inside = !inside;
    }
    return inside;
  }

  function sculptedSurface(shape, side, relief, baseDepth, rows, columns) {
    const outline = shape.getPoints(48);
    const minX = Math.min.apply(null, outline.map((p) => p.x));
    const maxX = Math.max.apply(null, outline.map((p) => p.x));
    const minY = Math.min.apply(null, outline.map((p) => p.y));
    const maxY = Math.max.apply(null, outline.map((p) => p.y));
    const positions = [], uvs = [], indices = [];
    const dx = (maxX - minX) / columns, dy = (maxY - minY) / rows;
    for (let row = 0; row <= rows; row++) {
      const y = minY + row * dy;
      for (let col = 0; col <= columns; col++) {
        const x = minX + col * dx;
        positions.push(x, y, side * (baseDepth + relief(x, y)));
        uvs.push((x - minX) / (maxX - minX), (y - minY) / (maxY - minY));
      }
    }
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < columns; col++) {
        const a = row * (columns + 1) + col, b = a + 1;
        const d = a + columns + 1, c = d + 1;
        const first = pointInside(minX + (col + 0.34) * dx, minY + (row + 0.34) * dy, outline);
        const second = pointInside(minX + (col + 0.67) * dx, minY + (row + 0.67) * dy, outline);
        if (side > 0) {
          if (first) indices.push(a, b, c);
          if (second) indices.push(a, c, d);
        } else {
          if (first) indices.push(a, c, b);
          if (second) indices.push(a, d, c);
        }
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }

  function extruded(shape, color, depth, bevel, roughness) {
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: depth, bevelEnabled: true, bevelSegments: 4, steps: 1,
      bevelSize: bevel, bevelThickness: bevel, curveSegments: 18
    });
    geometry.translate(0, 0, -depth / 2);
    return mesh(geometry, mat(color, roughness));
  }

  function tube(group, points, material, radius, segments) {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(p[0], p[1], p[2])));
    group.add(mesh(new THREE.TubeGeometry(curve, segments || 40, radius, 8, false), material));
  }

  function addGarment(group, color, isHoodie) {
    const shape = garmentOutline(isHoodie);
    const fabric = mat(color, 0.94, { bumpMap: makeFabricTexture(), bumpScale: 0.024, side: THREE.DoubleSide });
    const bodyCore = extruded(shape, color, 0.15, 0.025, 0.94);
    bodyCore.material.bumpMap = makeFabricTexture();
    bodyCore.material.bumpScale = 0.018;
    group.add(bodyCore);
    const front = mesh(sculptedSurface(shape, 1, clothDrape, 0.108, 92, 86), fabric);
    front.renderOrder = 1;
    const back = mesh(sculptedSurface(shape, -1, clothDrape, 0.108, 92, 86), fabric);
    group.add(front, back);

    const thread = mat(new THREE.Color(color).multiplyScalar(0.77).getStyle(), 0.98, { transparent: true, opacity: 0.42 });
    const stitch = (points, radius, segments) => tube(group, points.map(([x,y]) => [x,y,0.132 + clothDrape(x,y) + 0.022]), thread, radius, segments);
    stitch([[-0.9,-1.48],[-0.58,-1.52],[0,-1.54],[0.58,-1.52],[0.9,-1.48]],0.008,44);
    if (isHoodie) {
      stitch([[-1.33,0.62],[-1.21,0.45],[-1.1,0.31]],0.009,18);
      stitch([[1.33,0.62],[1.21,0.45],[1.1,0.31]],0.009,18);
      const hood = new THREE.Shape();
      hood.moveTo(-0.5,1.2); hood.quadraticCurveTo(-0.62,1.92,0,1.98);
      hood.quadraticCurveTo(0.62,1.92,0.5,1.2); hood.quadraticCurveTo(0,1.47,-0.5,1.2);
      const hoodMesh = extruded(hood, new THREE.Color(color).multiplyScalar(0.84).getStyle(), 0.15, 0.04, 0.92);
      hoodMesh.position.z = -0.05; group.add(hoodMesh);
      const cordMat = mat(new THREE.Color(color).multiplyScalar(0.72).getStyle(), 0.86);
      tube(group, [[-0.13,1.03,0.108+clothDrape(-0.13,1.03)+0.045],[-0.15,0.76,0.108+clothDrape(-0.15,0.76)+0.045],[-0.14,0.53,0.108+clothDrape(-0.14,0.53)+0.045]], cordMat, 0.018, 18);
      tube(group, [[0.13,1.03,0.108+clothDrape(0.13,1.03)+0.045],[0.15,0.76,0.108+clothDrape(0.15,0.76)+0.045],[0.14,0.53,0.108+clothDrape(0.14,0.53)+0.045]], cordMat, 0.018, 18);
      const pocket = mesh(new THREE.BoxGeometry(1.06,0.46,0.045), mat(color,0.98,{bumpMap:makeFabricTexture(),bumpScale:0.018}), 0,-0.88,0.108+clothDrape(0,-0.88)+0.045);
      group.add(pocket);
    } else {
      const collar = mesh(new THREE.TorusGeometry(0.35,0.048,14,48), mat(new THREE.Color(color).multiplyScalar(0.82).getStyle(),0.9), 0,1.26,0.108+clothDrape(0,1.26)+0.035);
      collar.scale.y = 0.68; group.add(collar);
      stitch([[-1.43,0.62],[-1.31,0.48],[-1.2,0.35]],0.008,18);
      stitch([[1.43,0.62],[1.31,0.48],[1.2,0.35]],0.008,18);
    }
  }

  function addMug(group, color) {
    const ceramic = mat(color, 0.2, { metalness: 0.035 });
    const profile = [
      new THREE.Vector2(0,-1.05), new THREE.Vector2(0.68,-1.05),
      new THREE.Vector2(0.77,-0.98), new THREE.Vector2(0.81,0.94),
      new THREE.Vector2(0.78,1.04), new THREE.Vector2(0.69,1.04),
      new THREE.Vector2(0.68,0.93), new THREE.Vector2(0.69,-0.82),
      new THREE.Vector2(0,-0.82)
    ];
    group.add(mesh(new THREE.LatheGeometry(profile,64),ceramic,-0.28,0,0));
    const handleCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.43,0.68,0), new THREE.Vector3(1.08,0.78,0),
      new THREE.Vector3(1.35,0.47,0), new THREE.Vector3(1.36,0.02,0),
      new THREE.Vector3(1.2,-0.47,0), new THREE.Vector3(0.8,-0.64,0),
      new THREE.Vector3(0.43,-0.55,0)
    ]);
    group.add(mesh(new THREE.TubeGeometry(handleCurve,52,0.105,16,false),ceramic));
    const lip = mesh(new THREE.TorusGeometry(0.745,0.028,10,56),mat(new THREE.Color(color).multiplyScalar(0.88).getStyle(),0.2),-0.28,1.015,0);
    lip.rotation.x = Math.PI/2; group.add(lip);
    const foot = mesh(new THREE.TorusGeometry(0.68,0.035,10,56),mat(new THREE.Color(color).multiplyScalar(0.8).getStyle(),0.28),-0.28,-1.01,0);
    foot.rotation.x = Math.PI/2; group.add(foot);
  }

  function addPhoneCase(group, color) {
    const bumperColor = new THREE.Color(color).multiplyScalar(0.72).getStyle();
    const caseBody = extruded(roundedShape(1.68,3.36,0.24),color,0.17,0.075,0.4);
    group.add(caseBody);
    const back = mesh(new THREE.BoxGeometry(1.44,3.06,0.032),mat(color,0.5),0,0,0.123);
    group.add(back);
    const island = mesh(new THREE.BoxGeometry(0.76,0.78,0.08),mat(bumperColor,0.36),-0.34,1.13,0.18);
    group.add(island);
    [[-0.51,1.31],[-0.18,1.31],[-0.51,0.99]].forEach(([x,y]) => {
      const bezel = mesh(new THREE.CylinderGeometry(0.112,0.112,0.06,28),mat('#121318',0.24),x,y,0.24);
      bezel.rotation.x=Math.PI/2; group.add(bezel);
      const lens = mesh(new THREE.CylinderGeometry(0.071,0.071,0.065,28),mat('#34445a',0.12,{metalness:0.2}),x,y,0.288);
      lens.rotation.x=Math.PI/2; group.add(lens);
      const glint = mesh(new THREE.CircleGeometry(0.024,16),mat('#a8bfd2',0.18,{emissive:'#34424f',emissiveIntensity:0.28}),x-0.016,y+0.02,0.323);
      group.add(glint);
    });
    group.add(mesh(new THREE.BoxGeometry(0.055,0.48,0.055),mat(bumperColor,0.42),0.85,0.46,0));
    group.add(mesh(new THREE.BoxGeometry(0.055,0.34,0.055),mat(bumperColor,0.42),-0.85,0.6,0));
  }

  function pillowShape() {
    const shape = new THREE.Shape();
    shape.moveTo(-0.94,0.81); shape.quadraticCurveTo(0,1.06,0.94,0.81);
    shape.quadraticCurveTo(1.17,0,0.94,-0.81); shape.quadraticCurveTo(0,-1.06,-0.94,-0.81);
    shape.quadraticCurveTo(-1.17,0,-0.94,0.81);
    return shape;
  }
  function pillowDome(x,y) {
    const nx=Math.min(1,Math.abs(x)/1.18), ny=Math.min(1,Math.abs(y)/1.08);
    return 0.24*Math.sqrt(Math.max(0,1-nx*nx))*Math.sqrt(Math.max(0,1-ny*ny))
      + 0.018*Math.sin(x*8+y*4)*Math.exp(-Math.abs(x)*1.2);
  }
  function addCushion(group,color) {
    const shape=pillowShape();
    const core=extruded(shape,color,0.28,0.13,0.98);
    core.material.bumpMap=makeFabricTexture(); core.material.bumpScale=0.022; group.add(core);
    const fabric=mat(color,0.96,{bumpMap:makeFabricTexture(),bumpScale:0.024,side:THREE.DoubleSide});
    group.add(mesh(sculptedSurface(shape,1,pillowDome,0.12,66,72),fabric));
    group.add(mesh(sculptedSurface(shape,-1,pillowDome,0.12,66,72),fabric));
    const piping=mat(new THREE.Color(color).multiplyScalar(0.78).getStyle(),0.94);
    const outline=shape.getPoints(90).map((p)=>[p.x,p.y,0.145]);
    tube(group,outline.concat([outline[0]]),piping,0.022,100);
  }

  function toteShape() {
    const shape=new THREE.Shape();
    shape.moveTo(-0.98,0.2); shape.lineTo(0.98,0.2); shape.lineTo(0.91,-1.58);
    shape.quadraticCurveTo(0,-1.7,-0.91,-1.58); shape.closePath();
    return shape;
  }
  function toteDrape(x,y) {
    return 0.06*Math.exp(-Math.pow(x/0.86,4))
      + 0.025*Math.sin(y*4+x*3)*Math.exp(-Math.abs(x)*1.4);
  }
  function addTote(group,color) {
    const shape=toteShape();
    const fabric=mat(color,0.96,{bumpMap:makeFabricTexture(),bumpScale:0.024,side:THREE.DoubleSide});
    const body=extruded(shape,color,0.2,0.045,0.96);
    body.material.bumpMap=makeFabricTexture(); body.material.bumpScale=0.02; group.add(body);
    group.add(mesh(sculptedSurface(shape,1,toteDrape,0.135,64,58),fabric));
    const strap=mat(new THREE.Color(color).multiplyScalar(0.78).getStyle(),0.97,{bumpMap:makeFabricTexture(),bumpScale:0.02});
    const left=new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.55,0.19,0.19),new THREE.Vector3(-0.52,0.85,0.19),
      new THREE.Vector3(-0.34,1.29,0.19),new THREE.Vector3(0,1.43,0.19),
      new THREE.Vector3(0.34,1.29,0.19),new THREE.Vector3(0.52,0.85,0.19),new THREE.Vector3(0.55,0.19,0.19)
    ]);
    group.add(mesh(new THREE.TubeGeometry(left,42,0.068,12,false),strap));
    const seam=mat(new THREE.Color(color).multiplyScalar(0.72).getStyle(),0.99,{transparent:true,opacity:0.35});
    const toteSeam=[[-0.87,0.08],[-0.45,0.02],[0,0],[0.45,0.02],[0.87,0.08]];
    tube(group,toteSeam.map(([x,y])=>[x,y,0.135+toteDrape(x,y)+0.03]),seam,0.008,32);
  }

  function addFrame(group,color) {
    const frameColor=color === 'gold' ? colors.gold : color;
    const trim=mat(frameColor,0.32,{metalness:color === 'gold'?0.46:0.05});
    group.add(mesh(new THREE.BoxGeometry(1.94,2.9,0.15),mat('#171619',0.58),0,0,-0.08));
    group.add(mesh(new THREE.BoxGeometry(1.67,2.62,0.035),mat('#eeeae2',0.91),0,0,0.02));
    const rail=0.14;
    group.add(mesh(new THREE.BoxGeometry(1.94,rail,0.13),trim,0,1.38,0.105));
    group.add(mesh(new THREE.BoxGeometry(1.94,rail,0.13),trim,0,-1.38,0.105));
    group.add(mesh(new THREE.BoxGeometry(rail,2.76,0.13),trim,-0.9,0,0.105));
    group.add(mesh(new THREE.BoxGeometry(rail,2.76,0.13),trim,0.9,0,0.105));
    const shine=mat(new THREE.Color(frameColor).multiplyScalar(1.2).getStyle(),0.28,{metalness:0.22});
    group.add(mesh(new THREE.BoxGeometry(1.69,0.018,0.012),shine,0,1.28,0.174));
  }

  function buildProduct(type,colorName) {
    const group=new THREE.Group();
    const color=colors[colorName] || colorName || colors.white;
    if(type === 'tshirt' || type === 'hoodie') addGarment(group,color,type === 'hoodie');
    else if(type === 'mug') addMug(group,color);
    else if(type === 'phonecase') addPhoneCase(group,color);
    else if(type === 'cushion') addCushion(group,color);
    else if(type === 'tote') addTote(group,color);
    else if(type === 'frame') addFrame(group,color);
    else addGarment(group,color,false);
    return group;
  }

  function fitProduct(object) {
    object.updateMatrixWorld(true);
    const bounds=new THREE.Box3().setFromObject(object);
    const size=bounds.getSize(new THREE.Vector3());
    const height=size.y || Math.max(size.x,size.z);
    if(!Number.isFinite(height) || height <= 0) return;
    const factor=3.26/height;
    const center=bounds.getCenter(new THREE.Vector3());
    object.scale.multiplyScalar(factor);
    object.position.multiplyScalar(factor);
    object.position.sub(center.multiplyScalar(factor));
    object.updateMatrixWorld(true);
  }

  function addPrint(type,print,texture) {
    const printW=print.w/100, printH=print.h/100;
    const aspect=Math.max(0.05,(texture.image && texture.image.width ? texture.image.width : 1)/(texture.image && texture.image.height ? texture.image.height : 1));
    const width=Math.min(printW*0.83,printH*0.83*aspect), height=width/aspect;
    const x=(print.x+print.w/2-200)/100, y=(200-print.y-print.h/2)/100;
    const garment=type === 'tshirt' || type === 'hoodie';
    const material=mat('#fff',type === 'mug'?0.48:0.92,{map:texture,transparent:true,side:THREE.DoubleSide,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
    const geometry=new THREE.PlaneGeometry(width,height,garment?34:(type === 'mug'?42:1),garment?42:1);
    if(garment) {
      const p=geometry.attributes.position;
      for(let i=0;i<p.count;i++) {
        const px=p.getX(i)+x, py=p.getY(i)+y;
        p.setZ(i,0.128+clothDrape(px,py));
      }
      p.needsUpdate=true; geometry.computeVertexNormals();
    } else if(type === 'mug') {
      const p=geometry.attributes.position, radius=0.79, mugCenter=-0.28;
      for(let i=0;i<p.count;i++) {
        const px=p.getX(i), py=p.getY(i);
        const normalized=Math.max(-0.96,Math.min(0.96,(x+px-mugCenter)/radius));
        const angle=Math.asin(normalized);
        p.setXYZ(i,Math.sin(angle)*radius-x,py,Math.cos(angle)*radius+0.018);
      }
      p.needsUpdate=true; geometry.computeVertexNormals();
    }
    const z=garment?0:(type === 'phonecase'?0.22:type === 'cushion'?0.36:type === 'frame'?0.18:0.205);
    return mesh(geometry,material,x,y,z);
  }

  function disposeProduct(object) {
    if(!object) return;
    object.traverse((item) => {
      if(item.geometry) item.geometry.dispose();
      if(item.material) (Array.isArray(item.material)?item.material:[item.material]).forEach((material)=>material.dispose());
    });
  }

  function resize() {
    if(!renderer || !host) return;
    const width=Math.max(1,host.clientWidth), height=Math.max(1,host.clientHeight);
    renderer.setSize(width,height,false);
    camera.aspect=width/height;
    camera.updateProjectionMatrix();
  }

  function animate() {
    if(!visible || !renderer) return;
    animationFrame=requestAnimationFrame(animate);
    if(orbit.autoRotate) {
      showcaseTime+=1/60;
      const offset=camera.position.clone().sub(orbit.target);
      const spherical=new THREE.Spherical().setFromVector3(offset);
      spherical.phi=1.34-0.36*(0.5-0.5*Math.cos(showcaseTime*0.42));
      camera.position.setFromSpherical(spherical).add(orbit.target);
    }
    orbit.update();
    renderer.render(scene,camera);
  }

  function init(mount) {
    if(renderer) {
      if(host !== mount) { host=mount; host.appendChild(renderer.domElement); resize(); }
      return true;
    }
    host=mount;
    try {
      renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1,2));
      if('outputColorSpace' in renderer && THREE.SRGBColorSpace) renderer.outputColorSpace=THREE.SRGBColorSpace;
      else if('outputEncoding' in renderer && THREE.sRGBEncoding) renderer.outputEncoding=THREE.sRGBEncoding;
      renderer.toneMapping=THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure=1.08;
      renderer.domElement.setAttribute('aria-label','Interactive rotating three dimensional product');
      renderer.domElement.tabIndex=0;
      host.appendChild(renderer.domElement);

      scene=new THREE.Scene();
      camera=new THREE.PerspectiveCamera(36,1,0.1,100);
      camera.position.set(0.12,1.18,6.15);
      orbit=new THREE.OrbitControls(camera,renderer.domElement);
      orbit.target.set(0,0,0);
      orbit.enableDamping=true; orbit.dampingFactor=0.075;
      orbit.enablePan=false; orbit.minDistance=3.8; orbit.maxDistance=9;
      orbit.minPolarAngle=0.38; orbit.maxPolarAngle=Math.PI*0.56;
      orbit.autoRotate=!reducedMotion; orbit.autoRotateSpeed=1.1;
      orbit.addEventListener('start',()=>{
        if(!orbit.autoRotate) return;
        orbit.autoRotate=false;
        document.dispatchEvent(new CustomEvent('studio:product-autoplay',{detail:{autoRotate:false}}));
      });

      scene.add(new THREE.HemisphereLight('#f6f3ef','#242328',1.28));
      const key=new THREE.DirectionalLight('#fffdfa',2.12); key.position.set(-3.7,5.2,5.1); scene.add(key);
      const fill=new THREE.DirectionalLight('#d9d5d3',0.72); fill.position.set(4,1.8,4); scene.add(fill);
      const rim=new THREE.DirectionalLight('#e5d9cc',0.92); rim.position.set(3.3,2.8,-3.4); scene.add(rim);

      const shadowCanvas=document.createElement('canvas'); shadowCanvas.width=shadowCanvas.height=128;
      const context=shadowCanvas.getContext('2d');
      const gradient=context.createRadialGradient(64,64,3,64,64,62);
      gradient.addColorStop(0,'rgba(0,0,0,.46)'); gradient.addColorStop(1,'rgba(0,0,0,0)');
      context.fillStyle=gradient; context.fillRect(0,0,128,128);
      const shadow=new THREE.Mesh(new THREE.PlaneGeometry(5.2,3.1),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(shadowCanvas),transparent:true,depthWrite:false}));
      shadow.rotation.x=-Math.PI/2; shadow.position.set(0,-1.75,0); scene.add(shadow);

      resizeObserver=new ResizeObserver(resize); resizeObserver.observe(host);
      resize(); visible=true; animate();
      return true;
    } catch(error) {
      if(renderer) renderer.dispose();
      renderer=null;
      return false;
    }
  }

  function update(options) {
    if(!renderer || !scene || !options) return;
    const type=options.type, color=options.color, print=options.print, textureUrl=options.textureUrl;
    const token=++generation;
    if(activeProduct) {
      scene.remove(activeProduct);
      disposeProduct(activeProduct);
      activeProduct=null;
    }
    if(printTexture) { printTexture.dispose(); printTexture=null; }
    activeProduct=buildProduct(type,color);
    fitProduct(activeProduct);
    scene.add(activeProduct);

    if(textureUrl && print) {
      new THREE.TextureLoader().load(textureUrl,(texture)=>{
        if(token !== generation) { texture.dispose(); return; }
        if('colorSpace' in texture && THREE.SRGBColorSpace) texture.colorSpace=THREE.SRGBColorSpace;
        else if('encoding' in texture && THREE.sRGBEncoding) texture.encoding=THREE.sRGBEncoding;
        texture.anisotropy=renderer.capabilities.getMaxAnisotropy();
        printTexture=texture;
        activeProduct.add(addPrint(type,print,texture));
      },undefined,()=>{});
    }
    orbit.target.set(0,0,0);
    orbit.reset();
    orbit.autoRotate=!reducedMotion;
    orbit.update();
  }

  function setVisible(value) {
    visible=!!value;
    if(visible) { cancelAnimationFrame(animationFrame); animate(); }
    else cancelAnimationFrame(animationFrame);
  }

  function action(name) {
    if(!orbit) return false;
    if(name === 'left' || name === 'right') {
      const offset=camera.position.clone().sub(orbit.target);
      offset.applyAxisAngle(new THREE.Vector3(0,1,0),name === 'left'?-0.42:0.42);
      camera.position.copy(orbit.target).add(offset);
    } else if(name === 'reset') {
      orbit.reset();
      orbit.autoRotate=false;
    } else if(name === 'auto') orbit.autoRotate=!orbit.autoRotate;
    orbit.update();
    return !!orbit.autoRotate;
  }

  window.StudioProductViewer={
    init:init, update:update, setVisible:setVisible, action:action,
    get autoRotate(){return !!(orbit && orbit.autoRotate);}
  };
})();