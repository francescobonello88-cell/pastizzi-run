/* Pastizzi Run — 3D Malta scooter game (Three.js r128) */
(function () {
  "use strict";

  /* fail loudly and visibly, before anything else runs */
  function fatal(msg) {
    document.title = "ERR: " + msg;
    var t = document.getElementById("toast");
    if (t) { t.textContent = "Error: " + msg; t.classList.add("show"); t.style.background = "rgba(150,20,20,.92)"; }
    var lm = document.getElementById("loadMsg");
    if (lm) lm.textContent = "ERROR: " + msg;
    window.__lastError = msg;
  }
  window.addEventListener("error", function (ev) { fatal((ev && ev.message) || "unknown script error"); });
  if (typeof THREE === "undefined") { fatal("three.js did not load"); return; }

  var app = document.getElementById("app");
  var renderer = new THREE.WebGLRenderer({ antialias: window.devicePixelRatio < 2, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  app.appendChild(renderer.domElement);

  var scene = new THREE.Scene();
  var SKY_TOP = 0x3f7fbf, SKY_HORIZON = 0xd9e7f2;
  scene.fog = new THREE.Fog(0xcfe0ee, 180, 620);
  scene.background = new THREE.Color(0xcfe0ee);

  var camera = new THREE.PerspectiveCamera(64, window.innerWidth / window.innerHeight, 0.4, 1400);
  camera.position.set(0, 8, 14);

  var sun = new THREE.DirectionalLight(0xfff3d6, 1.15);
  sun.position.set(120, 170, 60);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  var sc = sun.shadow.camera;
  sc.near = 40; sc.far = 420; sc.left = -110; sc.right = 110; sc.top = 110; sc.bottom = -110;
  scene.add(sun);
  scene.add(sun.target);
  scene.add(new THREE.HemisphereLight(0xbfd8f0, 0xa08b63, 0.85));
  var fill = new THREE.DirectionalLight(0x9fc4e8, 0.35);
  fill.position.set(-90, 70, -110);
  scene.add(fill);

  /* sky dome */
  (function sky() {
    var g = new THREE.SphereGeometry(900, 24, 16);
    var m = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color(SKY_TOP) }, bottom: { value: new THREE.Color(SKY_HORIZON) } },
      vertexShader: "varying float h; void main(){ h = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader: "uniform vec3 top; uniform vec3 bottom; varying float h; void main(){ float t = clamp(h*1.1+0.15,0.0,1.0); gl_FragColor = vec4(mix(bottom, top, t),1.0); }"
    });
    scene.add(new THREE.Mesh(g, m));
  })();

  /* ---------- procedural textures ---------- */
  function cvs(size) {
    var c = document.createElement("canvas");
    c.width = c.height = size;
    return { c: c, x: c.getContext("2d") };
  }
  function noiseTex(base, spots, alpha, size) {
    var t = cvs(size || 256), x = t.x;
    x.fillStyle = base; x.fillRect(0, 0, t.c.width, t.c.height);
    for (var i = 0; i < (spots || 2400); i++) {
      var a = (alpha || 0.06) * Math.random();
      x.fillStyle = "rgba(0,0,0," + a.toFixed(3) + ")";
      var s = 1 + Math.random() * 2.4;
      x.fillRect(Math.random() * t.c.width, Math.random() * t.c.height, s, s);
    }
    var tex = new THREE.CanvasTexture(t.c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }
  function stoneTex() {
    var t = cvs(256), x = t.x;
    x.fillStyle = "#dcc9a4"; x.fillRect(0, 0, 256, 256);
    for (var r = 0; r < 8; r++) {
      for (var c2 = 0; c2 < 5; c2++) {
        var off = (r % 2) * 26;
        var w = 44 + Math.random() * 6, h = 26 + Math.random() * 3;
        var px = c2 * 52 + off - 20, py = r * 32 + 2;
        var shade = 208 + Math.random() * 26;
        x.fillStyle = "rgb(" + shade + "," + (shade - 22) + "," + (shade - 58) + ")";
        x.fillRect(px, py, w, h);
        x.strokeStyle = "rgba(120,100,70,.28)"; x.lineWidth = 1;
        x.strokeRect(px, py, w, h);
      }
    }
    var tex = new THREE.CanvasTexture(t.c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }
  function roadTex() {
    var t = cvs(256), x = t.x;
    x.fillStyle = "#3d3f42"; x.fillRect(0, 0, 256, 256);
    for (var i = 0; i < 5000; i++) {
      var v = 40 + Math.random() * 44;
      x.fillStyle = "rgba(" + v + "," + v + "," + (v + 3) + ",.5)";
      x.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
    }
    x.fillStyle = "rgba(240,236,220,.85)";
    for (var y = 8; y < 256; y += 64) x.fillRect(124, y, 8, 34);
    var tex = new THREE.CanvasTexture(t.c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }
  var TEX = { stone: stoneTex(), road: roadTex(), rock: noiseTex("#cbb894", 3000, .07, 256), sand: noiseTex("#e6d6b4", 2600, .05, 256) };

  /* ---------- deterministic RNG ---------- */
  var seed = 20260115;
  function rnd() { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; }
  function rr(a, b) { return a + rnd() * (b - a); }

  var LOOP_LEN = 1;
  var COLLIDERS = [];               // {minX,maxX,minZ,maxZ}
  function addCollider(cx, cz, w, d, pad) {
    pad = pad || 0;
    COLLIDERS.push({ minX: cx - w / 2 - pad, maxX: cx + w / 2 + pad, minZ: cz - d / 2 - pad, maxZ: cz + d / 2 + pad });
  }

  /* ---------- sea + land ---------- */
  var seaGeo = new THREE.PlaneGeometry(2400, 2400, 48, 48);
  var seaMat = new THREE.MeshStandardMaterial({ color: 0x2b6f9e, roughness: 0.28, metalness: 0.12, transparent: true, opacity: 0.96 });
  var sea = new THREE.Mesh(seaGeo, seaMat);
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = 0;
  sea.receiveShadow = false;
  scene.add(sea);

  var landGeo = new THREE.CircleGeometry(330, 72);
  var landMat = new THREE.MeshStandardMaterial({ map: TEX.rock, color: 0xd8c6a2, roughness: 0.95 });
  TEX.rock.repeat.set(26, 26);
  var land = new THREE.Mesh(landGeo, landMat);
  land.rotation.x = -Math.PI / 2;
  land.position.y = 0.35;
  land.receiveShadow = true;
  scene.add(land);

  /* rocky coastline ring so the island edge is not a flat cut */
  (function coast() {
    var g = new THREE.TorusGeometry(326, 5.5, 6, 96);
    var m = new THREE.MeshStandardMaterial({ color: 0xbda888, roughness: 1 });
    var t = new THREE.Mesh(g, m);
    t.rotation.x = Math.PI / 2;
    t.position.y = 1.1;
    t.castShadow = false; t.receiveShadow = true;
    scene.add(t);
  })();

  /* ---------- ring road ---------- */
  var ctrl = [];
  for (var i = 0; i < 16; i++) {
    var a = (i / 16) * Math.PI * 2;
    var r = 205 + Math.sin(a * 3) * 26 + Math.cos(a * 5) * 16;
    ctrl.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
  }
  var curve = new THREE.CatmullRomCurve3(ctrl, true, "catmullrom", 0.5);
  var N = 260;
  var pts = curve.getSpacedPoints(N);
  LOOP_LEN = Math.max(1, curve.getLength());

  var ROAD_HALF = 7.5;
  function ribbon(inner, outer, y, tex, repeatV) {
    var pos = [], uv = [], idx = [], dist = 0;
    for (var i = 0; i <= N; i++) {
      var p = pts[i % N];
      var pn = pts[(i + 1) % N];
      var t = new THREE.Vector3().subVectors(pn, p).normalize();
      var nx = -t.z, nz = t.x;
      if (i > 0) dist += p.distanceTo(pts[(i - 1) % N]);
      pos.push(p.x + nx * inner, y, p.z + nz * inner, p.x + nx * outer, y, p.z + nz * outer);
      var v = dist / (repeatV || 6);
      uv.push(0, v, 1, v);
      if (i < N) {
        var b = i * 2;
        idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
      }
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    var m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92 });
    var mesh = new THREE.Mesh(g, m);
    mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  }

  TEX.road.repeat.set(1, 1);
  ribbon(-ROAD_HALF, ROAD_HALF, 0.42, TEX.road, 9);

  var walkMat = new THREE.MeshStandardMaterial({ color: 0xcbc3b0, roughness: 0.95 });
  ribbon(ROAD_HALF, ROAD_HALF + 2.6, 0.5, null, 1).material = walkMat;
  ribbon(-ROAD_HALF - 2.6, -ROAD_HALF, 0.5, null, 1).material = walkMat;

  /* ---------- landmarks ---------- */
  var CHURCH_I = 52, HARBOUR_I = 150;
  function sampleInfo(i) {
    var p = pts[i % N], pn = pts[(i + 1) % N];
    var t = new THREE.Vector3().subVectors(pn, p).normalize();
    return { p: p, n: new THREE.Vector3(-t.z, 0, t.x), t: t };
  }
  var churchInfo = sampleInfo(CHURCH_I);
  var churchPos = churchInfo.p.clone().add(churchInfo.n.clone().multiplyScalar(26));
  var harbourInfo = sampleInfo(HARBOUR_I);

  /* ---------- buildings ---------- */
  var stoneMat = new THREE.MeshStandardMaterial({ map: TEX.stone, roughness: 0.9, color: 0xffffff });
  TEX.stone.repeat.set(2, 2);
  var boxGeo = new THREE.BoxGeometry(1, 1, 1);
  boxGeo.translate(0, 0.5, 0);

  var bodies = [], roofs = [], domes = [];
  function placeBuilding(cx, cz, w, h, d, rotY) {
    bodies.push({ x: cx, z: cz, w: w, h: h, d: d, rot: rotY || 0 });
    roofs.push({ x: cx, z: cz, w: w, h: h, d: d, rot: rotY || 0 });
    if (rnd() > 0.72) domes.push({ x: cx, z: cz, y: h + 0.4, r: Math.min(w, d) * 0.2 });
    addCollider(cx, cz, w, d, 0.4);
  }

  for (var i = 0; i < N; i += 3) {
    var info = sampleInfo(i);
    if (Math.abs(i - CHURCH_I) < 6 || Math.abs(i - HARBOUR_I) < 7) continue;
    for (var side = -1; side <= 1; side += 2) {
      if (rnd() > 0.86) continue;
      var off = ROAD_HALF + 4.5 + rnd() * 20;
      var cx = info.p.x + info.n.x * off * side + rr(-3, 3);
      var cz = info.p.z + info.n.z * off * side + rr(-3, 3);
      if (Math.hypot(cx, cz) > 300) continue;
      var w = rr(7, 15), d = rr(7, 15), h = rr(5, 12);
      if (rnd() > 0.9) h += rr(3, 6);
      placeBuilding(cx, cz, w, h, d, Math.atan2(info.t.x, info.t.z));
    }
  }

  var bodyMesh = new THREE.InstancedMesh(boxGeo, stoneMat, bodies.length);
  bodyMesh.castShadow = true; bodyMesh.receiveShadow = true;
  var roofMesh = new THREE.InstancedMesh(boxGeo, new THREE.MeshStandardMaterial({ color: 0xc4242c, roughness: 0.85 }), roofs.length);
  var domeMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0xe4e2d6, roughness: 0.6 }), Math.max(1, domes.length));
  var dummy = new THREE.Object3D();
  bodies.forEach(function (b, idx) {
    dummy.position.set(b.x, 0.5, b.z);
    dummy.rotation.set(0, b.rot, 0);
    dummy.scale.set(b.w, b.h, b.d);
    dummy.updateMatrix();
    bodyMesh.setMatrixAt(idx, dummy.matrix);
  });
  roofs.forEach(function (b, idx) {
    dummy.position.set(b.x, 0.5 + b.h, b.z);
    dummy.rotation.set(0, b.rot, 0);
    dummy.scale.set(b.w + 0.9, 0.5, b.d + 0.9);
    dummy.updateMatrix();
    roofMesh.setMatrixAt(idx, dummy.matrix);
  });
  domes.forEach(function (d, idx) {
    dummy.position.set(d.x, d.y + 0.5, d.z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(d.r, d.r * 0.9, d.r);
    dummy.updateMatrix();
    domeMesh.setMatrixAt(idx, dummy.matrix);
  });
  if (domes.length === 0) {
    dummy.position.set(0, -50, 0); dummy.rotation.set(0,0,0); dummy.scale.set(0.001,0.001,0.001);
    dummy.updateMatrix(); domeMesh.setMatrixAt(0, dummy.matrix);
  }
  bodyMesh.instanceMatrix.needsUpdate = true;
  roofMesh.instanceMatrix.needsUpdate = true;
  domeMesh.instanceMatrix.needsUpdate = true;
  scene.add(bodyMesh, roofMesh, domeMesh);

  /* ---------- church ---------- */
  (function church() {
    var g = new THREE.Group();
    var wallM = new THREE.MeshStandardMaterial({ map: TEX.stone, color: 0xf2e6cc, roughness: 0.85 });
    var base = new THREE.Mesh(new THREE.BoxGeometry(22, 15, 26), wallM);
    base.position.y = 7.5; base.castShadow = true; base.receiveShadow = true;
    g.add(base);
    var drum = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 6, 18), wallM);
    drum.position.y = 18; drum.castShadow = true;
    g.add(drum);
    var dome = new THREE.Mesh(new THREE.SphereGeometry(8, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0xdfdccb, roughness: 0.55, metalness: 0.08 }));
    dome.position.y = 21; dome.castShadow = true;
    g.add(dome);
    var crossM = new THREE.MeshStandardMaterial({ color: 0x8f8a78, roughness: 0.7 });
    var c1 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 3, 0.5), crossM); c1.position.y = 30.4;
    var c2 = new THREE.Mesh(new THREE.BoxGeometry(2, 0.5, 0.5), crossM); c2.position.y = 30.9;
    g.add(c1, c2);
    g.position.copy(churchPos);
    g.rotation.y = Math.atan2(churchInfo.t.x, churchInfo.t.z);
    scene.add(g);
    addCollider(churchPos.x, churchPos.z, 22, 26, 0.6);
    addCollider(churchPos.x, churchPos.z, 22, 26, 0.6);
  })();

  /* ---------- palms ---------- */
  (function palms() {
    var trunkGeo = new THREE.CylinderGeometry(0.34, 0.5, 7, 6);
    trunkGeo.translate(0, 3.5, 0);
    var trunkMat = new THREE.MeshStandardMaterial({ color: 0x8a6a4a, roughness: 0.95 });
    var frondGeo = new THREE.PlaneGeometry(6, 1.6, 4, 1);
    frondGeo.translate(2.6, 0, 0);
    var frondMat = new THREE.MeshStandardMaterial({ color: 0x3f7d43, roughness: 0.9, side: THREE.DoubleSide });
    var spots = [];
    for (var i = 0; i < N; i += 11) {
      var info = sampleInfo(i);
      for (var s = -1; s <= 1; s += 2) {
        if (rnd() > 0.5) continue;
        var off = ROAD_HALF + 13 + rnd() * 12;
        spots.push({ x: info.p.x + info.n.x * off * s, z: info.p.z + info.n.z * off * s, r: rnd() * 6.28 });
      }
    }
    var trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, spots.length);
    var fronds = new THREE.InstancedMesh(frondGeo, frondMat, spots.length * 6);
    trunks.castShadow = true;
    var d2 = new THREE.Object3D(), k = 0;
    spots.forEach(function (p, idx) {
      d2.position.set(p.x, 0.4, p.z); d2.rotation.set(0, p.r, 0); d2.scale.set(1, 1, 1); d2.updateMatrix();
      trunks.setMatrixAt(idx, d2.matrix);
      for (var f = 0; f < 6; f++) {
        d2.position.set(p.x, 7.2, p.z);
        d2.rotation.set(0, p.r + f * (Math.PI / 3), -0.35 + rnd() * 0.12);
        d2.updateMatrix();
        fronds.setMatrixAt(k++, d2.matrix);
      }
      addCollider(p.x, p.z, 1.2, 1.2, 0);
    });
    trunks.instanceMatrix.needsUpdate = true; fronds.instanceMatrix.needsUpdate = true;
    scene.add(trunks, fronds);
  })();

  /* ---------- low stone walls ---------- */
  (function walls() {
    var geo = new THREE.BoxGeometry(6, 1.1, 0.6);
    var mat = new THREE.MeshStandardMaterial({ map: TEX.stone, color: 0xe7dcc4, roughness: 0.95 });
    var items = [];
    for (var i = 0; i < N; i += 2) {
      if (rnd() > 0.35) continue;
      var info = sampleInfo(i);
      var s = rnd() > 0.5 ? 1 : -1;
      var off = ROAD_HALF + 3.4;
      items.push({
        x: info.p.x + info.n.x * off * s, z: info.p.z + info.n.z * off * s,
        rot: Math.atan2(info.t.x, info.t.z) + Math.PI / 2
      });
    }
    var mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, items.length));
    mesh.castShadow = true; mesh.receiveShadow = true;
    var d3 = new THREE.Object3D();
    items.forEach(function (it, idx) {
      d3.position.set(it.x, 0.95, it.z); d3.rotation.set(0, it.rot, 0); d3.scale.set(1, 1, 1); d3.updateMatrix();
      mesh.setMatrixAt(idx, d3.matrix);
      addCollider(it.x, it.z, 6, 0.8, 0);
    });
    mesh.instanceMatrix.needsUpdate = true;
    scene.add(mesh);
  })();

  /* ---------- street lights ---------- */
  (function lamps() {
    var poleGeo = new THREE.CylinderGeometry(0.16, 0.2, 8, 6); poleGeo.translate(0, 4, 0);
    var poleMat = new THREE.MeshStandardMaterial({ color: 0x394a5a, roughness: 0.7, metalness: 0.3 });
    var bulbGeo = new THREE.SphereGeometry(0.5, 8, 6);
    var bulbMat = new THREE.MeshStandardMaterial({ color: 0xfff0c0, emissive: 0xffcf80, emissiveIntensity: 0.9 });
    var spots = [];
    for (var i = 0; i < N; i += 13) {
      var info = sampleInfo(i);
      var s = (i / 13) % 2 === 0 ? 1 : -1;
      var off = ROAD_HALF + 2.9;
      spots.push({ x: info.p.x + info.n.x * off * s, z: info.p.z + info.n.z * off * s });
    }
    var poles = new THREE.InstancedMesh(poleGeo, poleMat, spots.length);
    var bulbs = new THREE.InstancedMesh(bulbGeo, bulbMat, spots.length);
    poles.castShadow = true;
    var d4 = new THREE.Object3D();
    spots.forEach(function (p, idx) {
      d4.position.set(p.x, 0.5, p.z); d4.rotation.set(0, 0, 0); d4.updateMatrix();
      poles.setMatrixAt(idx, d4.matrix);
      d4.position.set(p.x, 8.4, p.z); d4.updateMatrix();
      bulbs.setMatrixAt(idx, d4.matrix);
      addCollider(p.x, p.z, 0.9, 0.9, 0);
    });
    poles.instanceMatrix.needsUpdate = true; bulbs.instanceMatrix.needsUpdate = true;
    scene.add(poles, bulbs);
  })();

  /* ---------- harbour boats ---------- */
  (function boats() {
    var hullMat = new THREE.MeshStandardMaterial({ color: 0xf2f4f6, roughness: 0.6 });
    var trimMat = new THREE.MeshStandardMaterial({ color: 0x2a5d8f, roughness: 0.5 });
    var seaPoint = harbourInfo.p.clone().add(harbourInfo.n.clone().multiplyScalar(52));
    for (var i = 0; i < 7; i++) {
      var g = new THREE.Group();
      var hull = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.1, 8), hullMat);
      hull.position.y = 0.5; g.add(hull);
      var stripe = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.28, 8.1), trimMat);
      stripe.position.y = 1.0; g.add(stripe);
      var cabin = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.4, 2.6), trimMat);
      cabin.position.set(0, 1.6, -1.2); g.add(cabin);
      g.position.set(seaPoint.x + rr(-26, 26), 0.1, seaPoint.z + rr(-26, 26));
      g.rotation.y = rnd() * 6.28;
      g.traverse(function (o) { if (o.isMesh) { o.castShadow = true; } });
      scene.add(g);
    }
  })();

  /* ---------- traffic ---------- */
  var CARS = [];
  (function traffic() {
    var colors = [0xd94b4b, 0x2f6fb3, 0xf0f1f3, 0x38393d, 0xe0a92c, 0x3f8a5c];
    for (var i = 0; i < 12; i++) {
      var g = new THREE.Group();
      var bodyM = new THREE.MeshStandardMaterial({ color: colors[i % colors.length], roughness: 0.45, metalness: 0.35 });
      var body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.85, 4.1), bodyM);
      body.position.y = 0.85; g.add(body);
      var roof = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.7, 2.1), new THREE.MeshStandardMaterial({ color: 0x223040, roughness: 0.25, metalness: 0.5 }));
      roof.position.set(0, 1.55, -0.15); g.add(roof);
      var wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.24, 10);
      var wheelMat = new THREE.MeshStandardMaterial({ color: 0x1b1d21, roughness: 0.9 });
      [[-0.85, 1.25], [0.85, 1.25], [-0.85, -1.35], [0.85, -1.35]].forEach(function (w) {
        var wh = new THREE.Mesh(wheelGeo, wheelMat);
        wh.rotation.z = Math.PI / 2;
        wh.position.set(w[0], 0.36, w[1]);
        g.add(wh);
      });
      g.traverse(function (o) { if (o.isMesh) o.castShadow = true; });
      scene.add(g);
      CARS.push({ g: g, u: i / 12, mps: rr(9, 16), lane: (i % 2 ? 1 : -1) * 3.4, half: { w: 2.2, d: 4.6 } });
    }
  })();

  /* ---------- scooter + rider ---------- */
  var scooter = new THREE.Group();
  (function buildScooter() {
    var bodyM = new THREE.MeshStandardMaterial({ color: 0xf4f6f8, roughness: 0.4, metalness: 0.35 });
    var accentM = new THREE.MeshStandardMaterial({ color: 0xd8372f, roughness: 0.5 });
    var darkM = new THREE.MeshStandardMaterial({ color: 0x24262b, roughness: 0.8 });
    var chromeM = new THREE.MeshStandardMaterial({ color: 0xa8b4c0, roughness: 0.25, metalness: 0.8 });

    var deck = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.13, 1.55), bodyM);
    deck.position.set(0, 0.36, 0);
    scooter.add(deck);

    var apron = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.62, 0.34), accentM);
    apron.position.set(0, 0.7, 0.72);
    apron.rotation.x = -0.16;
    scooter.add(apron);

    var stem = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 1.0, 8), chromeM);
    stem.position.set(0, 1.0, 0.9);
    stem.rotation.x = 0.2;
    scooter.add(stem);

    var bar = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.07, 0.07), darkM);
    bar.position.set(0, 1.46, 0.83);
    scooter.add(bar);
    [-0.34, 0.34].forEach(function (x) {
      var grip = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.14, 8), darkM);
      grip.rotation.z = Math.PI / 2;
      grip.position.set(x, 1.46, 0.83);
      scooter.add(grip);
    });

    var wGeo = new THREE.CylinderGeometry(0.31, 0.31, 0.14, 14);
    [1.02, -0.86].forEach(function (z) {
      var w = new THREE.Mesh(wGeo, darkM);
      w.rotation.z = Math.PI / 2;
      w.position.set(0, 0.31, z);
      scooter.add(w);
      var hub = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.16, 10), chromeM);
      hub.rotation.z = Math.PI / 2;
      hub.position.set(0, 0.31, z);
      scooter.add(hub);
    });

    var headlight = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0xfff6d0, emissive: 0xffe9a8, emissiveIntensity: 1.4 }));
    headlight.position.set(0, 1.28, 0.92);
    scooter.add(headlight);

    /* rider */
    var shirtM = new THREE.MeshStandardMaterial({ color: 0x2f6fb3, roughness: 0.85 });
    var skinM = new THREE.MeshStandardMaterial({ color: 0xd8a882, roughness: 0.7 });
    var legM = new THREE.MeshStandardMaterial({ color: 0x2b3a4a, roughness: 0.9 });

    var torso = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.27, 0.62, 10), shirtM);
    torso.position.set(0, 1.32, -0.06);
    torso.rotation.x = 0.22;
    scooter.add(torso);

    var head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), skinM);
    head.position.set(0, 1.74, 0.04);
    scooter.add(head);

    var helmet = new THREE.Mesh(new THREE.SphereGeometry(0.19, 12, 10, 0, Math.PI * 2, 0, Math.PI / 1.7), accentM);
    helmet.position.set(0, 1.76, 0.04);
    scooter.add(helmet);

    [-1, 1].forEach(function (s) {
      var arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.56), shirtM);
      arm.position.set(s * 0.26, 1.4, 0.42);
      arm.rotation.x = -0.42;
      scooter.add(arm);

      var leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.5, 0.16), legM);
      leg.position.set(s * 0.16, 0.62, -0.2);
      scooter.add(leg);

      var foot = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.09, 0.28), darkM);
      foot.position.set(s * 0.16, 0.4, -0.1);
      scooter.add(foot);
    });

    scooter.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  })();
  scene.add(scooter);

  /* ---------- player physics ---------- */
  var START = sampleInfo(4);
  var player = {
    pos: START.p.clone().add(START.n.clone().multiplyScalar(-2.5)).setY(0.42),
    heading: Math.atan2(START.t.x, START.t.z),
    speed: 0, steer: 0, maxSpeed: 15.5, crashAt: 0, distance: 0, lean: 0
  };

  var keys = { left: false, right: false };
  function setSteer(on, left) {
    if (left) keys.left = on; else keys.right = on;
    player.steer = (keys.left ? -1 : 0) + (keys.right ? 1 : 0);
  }
  window.addEventListener("keydown", function (e) {
    if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") setSteer(true, true);
    if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") setSteer(true, false);
  });
  window.addEventListener("keyup", function (e) {
    if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") setSteer(false, true);
    if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") setSteer(false, false);
  });

  function bindHold(el, left) {
    if (!el) return;
    var on = function (e) { e.preventDefault(); el.classList.add("active"); setSteer(true, left); };
    var off = function (e) { if (e) e.preventDefault(); el.classList.remove("active"); setSteer(false, left); };
    el.addEventListener("pointerdown", on);
    el.addEventListener("pointerup", off);
    el.addEventListener("pointerleave", off);
    el.addEventListener("pointercancel", off);
  }
  bindHold(document.getElementById("btnLeft"), true);
  bindHold(document.getElementById("btnRight"), false);

  /* ---------- pickups: pastizzi ---------- */
  var pastizzGeo = new THREE.TorusGeometry(0.42, 0.2, 8, 14);
  var pastizzMat = new THREE.MeshStandardMaterial({ color: 0xf0c169, roughness: 0.6, emissive: 0x6b4a12, emissiveIntensity: 0.35 });
  var PICKUPS = [];
  function makePastizz() {
    var g = new THREE.Group();
    var m = new THREE.Mesh(pastizzGeo, pastizzMat);
    m.rotation.x = Math.PI / 2;
    m.castShadow = true;
    g.add(m);
    var halo = new THREE.Mesh(new THREE.RingGeometry(0.7, 0.95, 20),
      new THREE.MeshBasicMaterial({ color: 0xffd479, transparent: true, opacity: 0.5, side: THREE.DoubleSide }));
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = -0.28;
    g.add(halo);
    g.position.y = 1.1;
    return g;
  }

  /* ---------- goal beacon ---------- */
  var goal = new THREE.Group();
  (function buildGoal() {
    var beam = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 26, 18, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x64e0b0, transparent: true, opacity: 0.22, side: THREE.DoubleSide }));
    beam.position.y = 13;
    goal.add(beam);
    var ring = new THREE.Mesh(new THREE.RingGeometry(2.6, 3.1, 26),
      new THREE.MeshBasicMaterial({ color: 0x64e0b0, transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.5;
    goal.add(ring);
    goal.visible = false;
    scene.add(goal);
  })();

  /* ---------- game state ---------- */
  var STAGES = ["BAKERY", "FISHERMAN", "CHURCH", "HARBOUR", "VALLETTA GATE"];
  var NEEDED = 6;
  var game = {
    running: false, round: 1, picked: 0, time: 90, best: 0,
    goalPos: null, goalActive: false, toastUntil: 0, shake: 0
  };
  try { game.best = Number(localStorage.getItem("pastizzi.best") || 0); } catch (e) {}

  var HUD = {
    speed: document.getElementById("speed"),
    picked: document.getElementById("picked"),
    needed: document.getElementById("needed"),
    time: document.getElementById("time"),
    stage: document.getElementById("stageName"),
    dist: document.getElementById("distTxt"),
    fill: document.getElementById("progFill"),
    toast: document.getElementById("toast"),
    minimap: document.getElementById("minimap")
  };
  HUD.needed.textContent = NEEDED;

  function toast(msg, ms) {
    HUD.toast.textContent = msg;
    HUD.toast.classList.add("show");
    game.toastUntil = performance.now() + (ms || 1400);
  }

  function clearPickups() {
    PICKUPS.forEach(function (p) { scene.remove(p.g); });
    PICKUPS = [];
  }

  function spawnRound() {
    clearPickups();
    game.picked = 0;
    game.goalActive = false;
    goal.visible = false;
    HUD.stage.textContent = STAGES[(game.round - 1) % STAGES.length];
    game.time = Math.max(45, 92 - (game.round - 1) * 6);

    /* pickups spread over the next stretch of road ahead of the player */
    var base = player.distance / 1;
    var used = {};
    for (var i = 0; i < NEEDED; i++) {
      var idx = Math.floor(rr(6, N - 6));
      var guard = 0;
      while (used[idx] && guard++ < 40) idx = Math.floor(rr(6, N - 6));
      used[idx] = true;
      var info = sampleInfo(idx);
      var g = makePastizz();
      var laneOff = rr(-2.4, 2.4);
      g.position.set(info.p.x + info.n.x * laneOff, 1.05, info.p.z + info.n.z * laneOff);
      scene.add(g);
      PICKUPS.push({ g: g, x: g.position.x, z: g.position.z, got: false });
    }
    HUD.picked.textContent = "0";
  }

  function activateGoal() {
    var idx = Math.floor(rr(0, N - 1));
    var info = sampleInfo(idx);
    game.goalPos = new THREE.Vector3(info.p.x + info.n.x * 1.5, 0.5, info.p.z + info.n.z * 1.5);
    goal.position.copy(game.goalPos);
    goal.visible = true;
    game.goalActive = true;
    toast("Pastizzi ready — get to the marker!", 1800);
  }

  function endGame() {
    game.running = false;
    var score = game.round - 1;
    if (score > game.best) {
      game.best = score;
      try { localStorage.setItem("pastizzi.best", String(score)); } catch (e) {}
    }
    var el = document.getElementById("center");
    if (el) {
      el.style.opacity = "1";
      el.innerHTML = "<h1>Time up</h1><p>You delivered " + score + " round" + (score === 1 ? "" : "s") + ".<br>Best: " + game.best + "</p>" +
        '<button id="againBtn" style="margin-top:18px;background:linear-gradient(135deg,#ffcf5c,#ff9f1c);color:#20140a;border:0;border-radius:999px;padding:14px 34px;font-size:16px;font-weight:800">Ride again</button>';
      var btn = document.getElementById("againBtn");
      if (btn) btn.onclick = startGame;
    }
  }

  function startGame() {
    var el = document.getElementById("center");
    if (el) { el.style.opacity = "0"; }
    var ss = document.getElementById("startScreen");
    if (ss) ss.style.display = "none";
    player.pos.copy(START.p).add(START.n.clone().multiplyScalar(-2.5)).setY(0.42);
    player.heading = Math.atan2(START.t.x, START.t.z);
    player.speed = 0; player.steer = 0; player.distance = 0;
    game.round = 1; game.running = true;
    spawnRound();
    toast("Collect 6 pastizzi", 1600);
  }

  /* ---------- collisions ---------- */
  var lastCrash = 0;
  function crash(msg) {
    var now = performance.now();
    if (now - lastCrash < 800) return;
    lastCrash = now;
    player.speed *= 0.15;
    game.time = Math.max(0, game.time - 3);
    game.shake = 0.7;
    toast(msg || "Crash! +3s", 1200);
  }

  function hitsWorld(x, z) {
    var r = 0.8;
    for (var i = 0; i < COLLIDERS.length; i++) {
      var c = COLLIDERS[i];
      if (x + r > c.minX && x - r < c.maxX && z + r > c.minZ && z - r < c.maxZ) return true;
    }
    return false;
  }

  /* ---------- camera ---------- */
  var camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), tmpV = new THREE.Vector3();

  function updateCamera(dt) {
    var back = new THREE.Vector3(Math.sin(player.heading), 0, Math.cos(player.heading)).multiplyScalar(-8.2);
    var want = player.pos.clone().add(back).add(new THREE.Vector3(0, 4.1, 0));
    camPos.lerp(want, Math.min(1, dt * 4.2));
    camera.position.copy(camPos);
    if (game.shake > 0) {
      camera.position.x += (Math.random() - 0.5) * game.shake * 0.6;
      camera.position.y += (Math.random() - 0.5) * game.shake * 0.5;
      game.shake = Math.max(0, game.shake - dt * 2.2);
    }
    tmpV.copy(player.pos).add(new THREE.Vector3(Math.sin(player.heading) * 6, 1.6, Math.cos(player.heading) * 6));
    camLook.lerp(tmpV, Math.min(1, dt * 5));
    camera.lookAt(camLook);
    var fovTarget = 64 + Math.min(14, (player.speed / player.maxSpeed) * 14);
    camera.fov += (fovTarget - camera.fov) * Math.min(1, dt * 3);
    camera.updateProjectionMatrix();
  }

  /* ---------- minimap ---------- */
  var mm = HUD.minimap.getContext("2d");
  function drawMinimap() {
    var S = 264, C = S / 2, scale = (S / 2 - 12) / 330;
    mm.clearRect(0, 0, S, S);
    mm.save();
    mm.translate(C, C);
    mm.fillStyle = "rgba(38,86,120,.55)";
    mm.beginPath(); mm.arc(0, 0, 330 * scale, 0, 6.2832); mm.fill();
    mm.strokeStyle = "rgba(255,255,255,.22)"; mm.lineWidth = 1.5;
    mm.beginPath(); mm.arc(0, 0, 330 * scale, 0, 6.2832); mm.stroke();
    mm.strokeStyle = "rgba(255,255,255,.5)"; mm.lineWidth = 2.4;
    mm.beginPath();
    for (var i = 0; i <= N; i += 2) {
      var p = pts[i % N];
      var x = p.x * scale, z = p.z * scale;
      if (i === 0) mm.moveTo(x, z); else mm.lineTo(x, z);
    }
    mm.closePath(); mm.stroke();
    PICKUPS.forEach(function (p) {
      if (p.got) return;
      mm.fillStyle = "#ffcf5c";
      mm.beginPath(); mm.arc(p.x * scale, p.z * scale, 3.4, 0, 6.2832); mm.fill();
    });
    if (game.goalActive && game.goalPos) {
      mm.fillStyle = "#64e0b0";
      mm.beginPath(); mm.arc(game.goalPos.x * scale, game.goalPos.z * scale, 5, 0, 6.2832); mm.fill();
    }
    mm.save();
    mm.translate(player.pos.x * scale, player.pos.z * scale);
    mm.rotate(-player.heading);
    mm.fillStyle = "#ff5f56";
    mm.beginPath(); mm.moveTo(0, -7); mm.lineTo(5, 6); mm.lineTo(0, 3); mm.lineTo(-5, 6); mm.closePath(); mm.fill();
    mm.restore();
    mm.restore();
  }

  /* ---------- HUD ---------- */
  function updateHUD() {
    HUD.speed.textContent = String(Math.round(player.speed * 3.6));
    HUD.picked.textContent = String(game.picked);
    HUD.time.textContent = String(Math.max(0, Math.ceil(game.time)));
    var target = game.goalActive && game.goalPos ? game.goalPos : nearestPickup();
    if (target) {
      var d = Math.hypot(target.x - player.pos.x, target.z - player.pos.z);
      HUD.dist.textContent = Math.round(d) + " m";
      HUD.fill.style.width = Math.max(4, Math.min(100, 100 - (d / 260) * 100)) + "%";
    } else {
      HUD.dist.textContent = "—";
      HUD.fill.style.width = "0%";
    }
    if (game.toastUntil && performance.now() > game.toastUntil) {
      HUD.toast.classList.remove("show");
      game.toastUntil = 0;
    }
  }
  function nearestPickup() {
    var best = null, bd = 1e9;
    PICKUPS.forEach(function (p) {
      if (p.got) return;
      var d = Math.hypot(p.x - player.pos.x, p.z - player.pos.z);
      if (d < bd) { bd = d; best = p; }
    });
    return best;
  }

  /* ---------- traffic ---------- */
  function updateTraffic(dt) {
    CARS.forEach(function (c) {
      c.u = (c.u + (c.mps * dt) / LOOP_LEN) % 1;
      var idx = Math.floor(c.u * N) % N;
      var info = sampleInfo(idx);
      var nx = info.n.x * c.lane, nz = info.n.z * c.lane;
      c.g.position.set(info.p.x + nx, 0.42, info.p.z + nz);
      c.g.rotation.y = Math.atan2(info.t.x, info.t.z);
      c.x = c.g.position.x; c.z = c.g.position.z;
    });
  }

  /* ---------- main loop ---------- */
  var last = performance.now();
  var acc = 0;

  function frame(now) {
    var dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    if (game.running) {
      player.speed += (game.running ? 6.4 : 0) * dt;
      if (player.speed > player.maxSpeed) player.speed = player.maxSpeed;

      var grip = Math.min(1, Math.abs(player.speed) / 4.5);
      player.heading += player.steer * 1.75 * dt * grip;

      var prevX = player.pos.x, prevZ = player.pos.z;
      player.pos.x += Math.sin(player.heading) * player.speed * dt;
      player.pos.z += Math.cos(player.heading) * player.speed * dt;
      player.distance += player.speed * dt;

      if (hitsWorld(player.pos.x, player.pos.z)) {
        player.pos.x = prevX; player.pos.z = prevZ;
        crash("Brick wall! +3s");
      }

      for (var ci = 0; ci < CARS.length; ci++) {
        var c = CARS[ci];
        if (c.x == null) continue;
        if (Math.hypot(c.x - player.pos.x, c.z - player.pos.z) < 2.5) {
          player.pos.x = prevX; player.pos.z = prevZ;
          crash("Hit traffic! +3s");
          break;
        }
      }

      PICKUPS.forEach(function (p) {
        if (p.got) return;
        if (Math.hypot(p.x - player.pos.x, p.z - player.pos.z) < 2.1) {
          p.got = true;
          scene.remove(p.g);
          game.picked++;
          HUD.picked.textContent = String(game.picked);
          if (game.picked >= NEEDED) activateGoal();
          else toast("Pastizz " + game.picked + "/" + NEEDED, 900);
        }
      });

      if (game.goalActive && game.goalPos) {
        if (Math.hypot(game.goalPos.x - player.pos.x, game.goalPos.z - player.pos.z) < 4.5) {
          game.round++;
          toast("Delivered! Round " + game.round, 1500);
          spawnRound();
        }
      }

      game.time -= dt;
      if (game.time <= 0) { game.time = 0; endGame(); }
    } else {
      player.speed *= 0.985;
    }

    /* scooter transform */
    scooter.position.copy(player.pos);
    player.lean += ((player.steer * -0.4 * Math.min(1, player.speed / 8)) - player.lean) * Math.min(1, dt * 6);
    scooter.rotation.set(0, player.heading, 0, "YXZ");
    scooter.rotation.z = player.lean;
    scooter.position.y = 0.42 + Math.sin(now / 110) * 0.012;

    /* world life */
    sea.position.y = Math.sin(now / 2600) * 0.1;
    if (game.goalActive) {
      goal.rotation.y += dt * 0.8;
      var pulse = 1 + Math.sin(now / 260) * 0.07;
      goal.scale.set(pulse, 1, pulse);
    }
    PICKUPS.forEach(function (p, i) {
      if (!p.got) {
        p.g.rotation.y += dt * 1.8;
        p.g.position.y = 1.05 + Math.sin(now / 400 + i) * 0.16;
      }
    });

    updateTraffic(dt);
    updateCamera(dt);

    sun.position.set(player.pos.x + 110, 165, player.pos.z + 55);
    sun.target.position.set(player.pos.x, 0, player.pos.z);
    sun.target.updateMatrixWorld();

    if (game.running) updateHUD();
    drawMinimap();

    renderer.render(scene, camera);
    if (DEBUG_TITLE && (now | 0) % 500 === 0) {
      document.title = "DBG run=" + game.running + " cars=" + CARS.length + " colliders=" + COLLIDERS.length +
        " pos=" + player.pos.x.toFixed(0) + "," + player.pos.z.toFixed(0) + " calls=" + renderer.info.render.calls;
    }
    requestAnimationFrame(frame);
  }

  var DEBUG_TITLE = /[?&]debug=1/.test(location.search);

  /* ---------- error trap ---------- */
  window.addEventListener("error", function (ev) {
    var t = document.getElementById("toast");
    if (t && ev && ev.message) {
      t.textContent = "Error: " + ev.message;
      t.classList.add("show");
      t.style.background = "rgba(150,20,20,.9)";
      window.__lastError = ev.message;
    }
  });

  /* ---------- resize + boot ---------- */
  window.addEventListener("resize", function () {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  camPos.copy(player.pos).add(new THREE.Vector3(0, 4.2, -8.2));
  camLook.copy(player.pos);
  camera.position.copy(camPos);
  camera.lookAt(camLook);

  var lm = document.getElementById("loadMsg");
  if (lm) lm.style.display = "none";
  var sb = document.getElementById("startBtn");
  if (sb) sb.onclick = startGame;

  requestAnimationFrame(frame);
})();
