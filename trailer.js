/* Didi's Dogs — 3D scroll intro.
   Scroll walks the camera around a polished Airstream-style trailer, ends
   facing the service window, then zooms through the window into the site.
   Everything (shape, panel seams, rivets, decals) is generated in code, so
   the only download is three.js r128 (three.min.js, global THREE). */
(function () {
  "use strict";

  var intro = document.getElementById("intro");
  var canvas = document.getElementById("trailerCanvas");
  if (!intro || !canvas || !window.THREE) { if (intro) intro.classList.add("nogl"); return; }

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var small = Math.min(window.innerWidth, window.innerHeight) < 700;
  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false });
  } catch (e) { intro.classList.add("nogl"); return; }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small ? 1.75 : 1.5));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  var BLUE = "#1f7fd1", BLUE_DARK = "#1f5fa8", RED = "#c8333a", CREAM = "#faf6ef";

  var scene = new THREE.Scene();
  scene.background = new THREE.Color(CREAM);
  scene.fog = new THREE.Fog(CREAM, 24, 60);
  var camera = new THREE.PerspectiveCamera(36, 1, 0.03, 200);

  /* ---------- helpers ---------- */
  var textTextures = [];   // redrawn once web fonts arrive
  function canvasTex(w, h, draw, isText) {
    var c = document.createElement("canvas"); c.width = w; c.height = h;
    draw(c.getContext("2d"), w, h);
    var t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    if (isText) textTextures.push([t, draw]);
    return t;
  }
  function box(w, h, d, mat) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); }
  function put(parent, mesh, x, y, z) { mesh.position.set(x, y, z); parent.add(mesh); return mesh; }
  function shadowy(m) { m.castShadow = true; m.receiveShadow = true; return m; }

  /* ---------- environment: sky, tree line, pavement, sun ----------
     This is what the chrome reflects, so it decides how real it looks. */
  (function env() {
    var tex = canvasTex(1024, 512, function (g, w, h) {
      var grad = g.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0.00, "#5f93d1");
      grad.addColorStop(0.30, "#bcd5ef");
      grad.addColorStop(0.46, "#eef3f7");
      grad.addColorStop(0.50, "#d7dadb");
      grad.addColorStop(0.505, "#8c877d");
      grad.addColorStop(0.60, "#b3ada2");
      grad.addColorStop(1.00, "#6d685f");
      g.fillStyle = grad; g.fillRect(0, 0, w, h);
      // tree line: irregular soft green bumps just above the horizon
      var seed = 7;
      function rnd() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
      for (var i = 0; i < 70; i++) {
        var x = rnd() * w, r = 10 + rnd() * 24, y = h * 0.5 - r * (0.3 + rnd() * 0.4);
        g.fillStyle = "rgba(" + (96 + rnd() * 30 | 0) + "," + (112 + rnd() * 26 | 0) + "," + (104 + rnd() * 20 | 0) + ",0.55)";
        g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      }
      g.fillStyle = "#7d8681"; g.fillRect(0, h * 0.492, w, h * 0.01);
      // a few buildings / bright gaps for variety in the reflections
      g.fillStyle = "rgba(235,238,240,0.9)"; g.fillRect(610, h * 0.38, 60, h * 0.12);
      g.fillStyle = "rgba(200,206,212,0.9)"; g.fillRect(680, h * 0.41, 30, h * 0.09);
      // sun
      var s = g.createRadialGradient(240, 120, 0, 240, 120, 60);
      s.addColorStop(0, "rgba(255,255,255,1)"); s.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = s; g.fillRect(150, 40, 180, 160);
    });
    tex.mapping = THREE.EquirectangularReflectionMapping;
    var pm = new THREE.PMREMGenerator(renderer);
    pm.compileEquirectangularShader();
    scene.environment = pm.fromEquirectangular(tex).texture;
    pm.dispose();
  })();

  scene.add(new THREE.HemisphereLight(0xffffff, 0xb6ae9f, 0.5));
  var sun = new THREE.DirectionalLight(0xfff6e8, 1.1);
  sun.position.set(-5, 11, 7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(small ? 1024 : 2048, small ? 1024 : 2048);
  sun.shadow.camera.left = -7; sun.shadow.camera.right = 7;
  sun.shadow.camera.top = 7; sun.shadow.camera.bottom = -7;
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 30;
  sun.shadow.bias = -0.0006; sun.shadow.radius = 4;
  scene.add(sun);

  /* ---------- materials ---------- */
  var steel = new THREE.MeshStandardMaterial({ color: 0xd9dcdf, metalness: 0.95, roughness: 0.28 });
  var brushed = new THREE.MeshStandardMaterial({ color: 0xc9cdd1, metalness: 0.9, roughness: 0.42 });
  var white = new THREE.MeshStandardMaterial({ color: 0xf7f7f5, metalness: 0, roughness: 0.4 });
  var dark = new THREE.MeshStandardMaterial({ color: 0x1c1e22, metalness: 0.3, roughness: 0.7, envMapIntensity: 0.3 });
  var rubber = new THREE.MeshStandardMaterial({ color: 0x0d0d0d, roughness: 0.92, envMapIntensity: 0.12 });
  var rimMat = new THREE.MeshStandardMaterial({ color: 0xf2f2f0, metalness: 0.2, roughness: 0.35 });
  var redLens = new THREE.MeshStandardMaterial({ color: 0xb3121b, emissive: 0x5a0508, roughness: 0.2, metalness: 0.1 });
  var amberLens = new THREE.MeshStandardMaterial({ color: 0xf2a114, emissive: 0x6a3d00, roughness: 0.2 });

  var trailer = new THREE.Group();
  scene.add(trailer);

  /* ---------- body shape ----------
     A loaf with Airstream proportions: sides that bow out, a round roof,
     a nearly flat floor, and bullet-shaped ends that curve in both
     directions. The same math is reused to stick decals onto the skin. */
  var L = 5.7, HALF_W = 1.16, Y0 = 0.6, H = 2.36, END = 1.35;
  var N_TOP = 2.5, N_BOT = 5.0;

  function endT(x) { return Math.max(0, (Math.abs(x) - (L / 2 - END)) / END); }
  function plan(t) { return Math.pow(1 - Math.pow(t, 2.3), 1 / 2.3); }      // width scale
  function elev(t) { return Math.pow(1 - Math.pow(t, 1.9), 1 / 1.9); }      // height scale
  function sectionAt(x) {
    var t = endT(x);
    var yBot = Y0 + 0.32 * (1 - Math.sqrt(Math.max(0, 1 - t * t)));
    var yTop = Y0 + 0.5 + (H - 0.5) * elev(t);
    yTop = Math.max(yTop, yBot + 0.001);
    return { c: (yTop + yBot) / 2, hh: (yTop - yBot) / 2, w: HALF_W * plan(t) };
  }
  function sgnPow(v, e) { return (v < 0 ? -1 : 1) * Math.pow(Math.abs(v), e); }
  // point on the skin for length position x and angle phi around the section
  function skin(x, phi) {
    var s = sectionAt(x), sp = Math.sin(phi), cp = Math.cos(phi);
    var n = sp >= 0 ? N_TOP : N_BOT;
    return [x, s.c + s.hh * sgnPow(sp, 2 / n), s.w * sgnPow(cp, 2 / n)];
  }
  // how far out the skin is (z) at length x and height y, on the +z side
  function surfaceZ(x, y) {
    var s = sectionAt(x);
    var k = Math.max(-1, Math.min(1, (y - s.c) / s.hh));
    var n = k >= 0 ? N_TOP : N_BOT;
    var sp = Math.pow(Math.abs(k), n / 2);
    var cp = Math.sqrt(Math.max(0, 1 - sp * sp));
    return s.w * Math.pow(cp, 2 / n);
  }

  // panel seams + rivet rows, used as a bump map and a faint colour map
  var SEG_U = 160, SEG_V = 96;
  var panelBump = canvasTex(2048, 1024, function (g, w, h) {
    g.fillStyle = "#808080"; g.fillRect(0, 0, w, h);
    var panels = 11;
    g.lineWidth = 3;
    for (var i = 1; i < panels; i++) {           // vertical seams along the length
      var x = (i / panels) * w;
      g.strokeStyle = "#5a5a5a"; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke();
      g.fillStyle = "#b8b8b8";
      for (var y = 6; y < h; y += 22) { g.beginPath(); g.arc(x + 9, y, 3, 0, Math.PI * 2); g.fill(); }
    }
    [0.12, 0.27, 0.38, 0.62, 0.73, 0.88].forEach(function (v) {   // horizontal seams around
      var y = v * h;
      g.strokeStyle = "#5a5a5a"; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke();
      g.fillStyle = "#b8b8b8";
      for (var x = 8; x < w; x += 24) { g.beginPath(); g.arc(x, y + 8, 3, 0, Math.PI * 2); g.fill(); }
    });
  });
  panelBump.encoding = THREE.LinearEncoding;
  var chrome = new THREE.MeshStandardMaterial({
    color: 0xf4f6f8, metalness: 1, roughness: 0.07,
    bumpMap: panelBump, bumpScale: 0.0035
  });

  (function body() {
    var pos = [], uv = [], idx = [];
    for (var i = 0; i <= SEG_U; i++) {
      // bunch samples toward the ends where the curvature is
      var u = i / SEG_U, uu = 0.5 - 0.5 * Math.cos(Math.PI * u);
      var x = -L / 2 + L * (0.55 * uu + 0.45 * u);
      for (var j = 0; j <= SEG_V; j++) {
        var phi = (j / SEG_V) * Math.PI * 2;
        var p = skin(x, phi);
        pos.push(p[0], p[1], p[2]);
        uv.push((x + L / 2) / L, j / SEG_V);
      }
    }
    for (i = 0; i < SEG_U; i++) {
      for (var j2 = 0; j2 < SEG_V; j2++) {
        var a = i * (SEG_V + 1) + j2, b = a + SEG_V + 1;
        idx.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    trailer.add(shadowy(new THREE.Mesh(geo, chrome)));
  })();

  // a flat sheet that hugs the skin on the +z (or -z) side, for decals
  function conformed(x0, x1, y0, y1, side, lift, mat, segX, segY) {
    segX = segX || 40; segY = segY || 24;
    var geo = new THREE.PlaneGeometry(x1 - x0, y1 - y0, segX, segY);
    var p = geo.attributes.position;
    for (var i = 0; i < p.count; i++) {
      var x = (x0 + x1) / 2 + p.getX(i), y = (y0 + y1) / 2 + p.getY(i);
      var px = side > 0 ? x : -x;   // mirror so text reads correctly on the far side
      p.setXYZ(i, px, y, side * (surfaceZ(px, y) + lift));
    }
    geo.computeVertexNormals();
    var m = new THREE.Mesh(geo, mat);
    trailer.add(m);
    return m;
  }
  function decalMat(tex) {
    return new THREE.MeshStandardMaterial({
      map: tex, transparent: true, roughness: 0.35, metalness: 0.0,
      polygonOffset: true, polygonOffsetFactor: -2
    });
  }

  /* ---------- service window (+z side) ---------- */
  var WIN_Y = 2.12, WIN_W = 3.1, WIN_H = 1.12;
  var WIN_Z = surfaceZ(0, WIN_Y);

  // frame, sliding glass and the two blue menu boards, drawn as one panel
  var windowTex = canvasTex(1536, 560, function (g, w, h) {
    g.clearRect(0, 0, w, h);
    g.fillStyle = "#f6f6f4"; g.fillRect(0, 0, w, h);                  // white frame
    g.fillStyle = "#d9dbdd"; g.fillRect(14, 14, w - 28, h - 28);
    // menu boards
    [[40, 470], [w - 510, 470]].forEach(function (b) {
      g.fillStyle = "#2b86d6"; g.fillRect(b[0], 40, b[1], h - 80);
      g.fillStyle = "#ffffff"; g.fillRect(b[0] + 70, 80, b[1] - 140, h - 160);
      g.fillStyle = BLUE_DARK; g.textAlign = "center";
      g.font = "bold 46px 'Bebas Neue', Impact, sans-serif";
      g.fillText("ROMANIAN", b[0] + b[1] / 2, 140);
      g.fillStyle = "#8e98a8";
      for (var i = 0; i < 9; i++) g.fillRect(b[0] + 110, 175 + i * 30, b[1] - 220, 9);
    });
    // aluminium mullions
    g.fillStyle = "#b9bdc2"; g.fillRect(510, 20, 14, h - 40); g.fillRect(w - 524, 20, 14, h - 40);
    // the opening itself is a separate high-res sheet
    g.fillStyle = "#111"; g.fillRect(524, 20, w - 1048, h - 40);
  }, true);
  conformed(-WIN_W / 2, WIN_W / 2, WIN_Y - WIN_H / 2, WIN_Y + WIN_H / 2, 1, 0.012,
    new THREE.MeshStandardMaterial({ map: windowTex, roughness: 0.3, metalness: 0.05,
      polygonOffset: true, polygonOffsetFactor: -2 }));

  // interior seen through the open window (sharp, because we zoom into it)
  var interiorTex = canvasTex(1024, 900, function (g, w, h) {
    var grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "#3a332a"); grad.addColorStop(1, "#14120f");
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    // stainless back wall panels
    g.fillStyle = "rgba(255,255,255,0.05)";
    for (var i = 0; i < 6; i++) g.fillRect(i * 175 + 10, 120, 150, 520);
    // heat lamps with warm pools of light
    [290, 734].forEach(function (x) {
      var r = g.createRadialGradient(x, 210, 0, x, 260, 420);
      r.addColorStop(0, "rgba(255,190,110,0.85)"); r.addColorStop(1, "rgba(255,190,110,0)");
      g.fillStyle = r; g.fillRect(0, 0, w, h);
      g.fillStyle = "#cfd2d5"; g.fillRect(x - 4, 0, 8, 120);
      g.beginPath(); g.moveTo(x - 60, 200); g.lineTo(x + 60, 200); g.lineTo(x + 26, 110); g.lineTo(x - 26, 110); g.fill();
      g.fillStyle = "#ffe2b3"; g.fillRect(x - 40, 196, 80, 8);
    });
    // menu board on the back wall
    g.fillStyle = BLUE_DARK; g.fillRect(150, 330, 724, 130);
    g.fillStyle = "#ffffff"; g.textAlign = "center";
    g.font = "84px 'Bebas Neue', Impact, sans-serif"; g.fillText("ORDER HERE", 512, 425);
    // counter with condiment bottles
    g.fillStyle = "#c9cdd2"; g.fillRect(0, 790, w, 110);
    g.fillStyle = "#e9ecef"; g.fillRect(0, 790, w, 10);
    var cols = ["#e8b41c", "#c8333a", "#e8b41c", "#6b3417", "#c8333a", "#3f8f3a"];
    cols.forEach(function (c, k) {
      var x = 300 + k * 72;
      g.fillStyle = c; g.fillRect(x, 640, 48, 150);
      g.fillStyle = "rgba(255,255,255,0.35)"; g.fillRect(x + 8, 650, 8, 130);
      g.fillStyle = "#f2f2f2"; g.fillRect(x + 14, 606, 20, 36);
    });
  }, true);
  var OPEN_W = WIN_W * (1 - 1048 / 1536), OPEN_H = WIN_H * (520 / 560);
  conformed(-OPEN_W / 2, OPEN_W / 2, WIN_Y - OPEN_H / 2, WIN_Y + OPEN_H / 2, 1, 0.016,
    new THREE.MeshBasicMaterial({ map: interiorTex, toneMapped: false,
      polygonOffset: true, polygonOffsetFactor: -4 }), 20, 16);

  // stainless serving shelf
  shadowy(put(trailer, box(WIN_W + 0.1, 0.045, 0.34, brushed), 0, WIN_Y - WIN_H / 2 - 0.03, WIN_Z + 0.15));
  // awning: white panel, striped fascia, two support arms
  var awning = shadowy(put(trailer, box(WIN_W + 0.15, 0.04, 0.62, white), 0, WIN_Y + WIN_H / 2 + 0.14, surfaceZ(0, WIN_Y + 0.7) + 0.28));
  awning.rotation.x = 0.16;
  var stripeTex = canvasTex(1024, 48, function (g, w, h) {
    for (var i = 0; i < 40; i++) {
      g.fillStyle = i % 2 ? "#ffffff" : "#2b86d6";
      g.fillRect(i * (w / 40), 0, w / 40, h);
    }
  });
  var fascia = new THREE.Mesh(new THREE.PlaneGeometry(WIN_W + 0.15, 0.13),
    new THREE.MeshStandardMaterial({ map: stripeTex, roughness: 0.5 }));
  fascia.position.set(0, WIN_Y + WIN_H / 2 + 0.085, awning.position.z + 0.31);
  trailer.add(fascia);
  [-1, 1].forEach(function (s) {
    var arm = put(trailer, box(0.025, 0.025, 0.62, steel), s * (WIN_W / 2 - 0.05), WIN_Y + WIN_H / 2 - 0.05, WIN_Z + 0.27);
    arm.rotation.x = -0.55;
  });

  // ROMANIAN lettering under the window
  conformed(-1.35, 1.35, 1.0, 1.58, 1, 0.006, decalMat(canvasTex(1400, 300, function (g, w, h) {
    g.clearRect(0, 0, w, h); g.textAlign = "center";
    g.fillStyle = BLUE; g.font = "250px 'Bebas Neue', Impact, sans-serif";
    g.fillText("ROMANIAN", w / 2, 235);
    g.fillStyle = RED; g.font = "70px Lobster, cursive";
    g.fillText("Chicago", w / 2 + 300, 292);
  }, true)));

  /* ---------- far side (-z): script logo, door ---------- */
  conformed(-2.0, 2.0, 1.25, 2.75, -1, 0.006, decalMat(canvasTex(1400, 520, function (g, w, h) {
    g.clearRect(0, 0, w, h); g.textAlign = "center";
    g.fillStyle = "#2b9be8"; g.font = "300px Lobster, cursive";
    g.fillText("Romanian", w / 2, 300);
    g.lineWidth = 46; g.strokeStyle = "#2b9be8"; g.lineCap = "round";
    g.beginPath(); g.moveTo(440, 430); g.bezierCurveTo(700, 360, 950, 470, 1280, 380); g.stroke();
  }, true)), 60, 30);

  /* ---------- roof ---------- */
  var roofY = sectionAt(0).c + sectionAt(0).hh;
  shadowy(put(trailer, new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.32, 0.3, 40), steel), -0.75, roofY + 0.1, 0));
  shadowy(put(trailer, new THREE.Mesh(new THREE.SphereGeometry(0.29, 40, 14, 0, Math.PI * 2, 0, Math.PI / 2), steel), -0.75, roofY + 0.25, 0));
  shadowy(put(trailer, new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.12, 16), steel), -0.75, roofY + 0.5, 0));
  var ac = shadowy(put(trailer, box(0.78, 0.26, 0.66, white), 0.6, roofY + 0.1, 0));
  ac.geometry = new THREE.BoxGeometry(0.78, 0.26, 0.66, 1, 1, 1);
  shadowy(put(trailer, box(0.6, 0.03, 0.5, new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.8 })), 0.6, roofY + 0.245, 0));
  // clearance lights along the roof edge
  [-1.6, 1.6].forEach(function (x) {
    [-1, 1].forEach(function (s) {
      put(trailer, box(0.08, 0.04, 0.04, amberLens), x, roofY - 0.12, s * (surfaceZ(x, roofY - 0.12) + 0.01));
    });
  });

  /* ---------- rear (+x): tail lights, bumper ---------- */
  var rearX = L / 2 - 0.2;
  [-1, 1].forEach(function (s) {
    var z = s * 0.62;
    put(trailer, new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.04, 20), redLens), rearX - 0.02, Y0 + 0.42, z)
      .rotation.z = Math.PI / 2;
  });
  shadowy(put(trailer, box(0.14, 0.12, 1.9, steel), L / 2 - 0.05, Y0 - 0.02, 0));

  /* ---------- chassis, fenders, wheels ---------- */
  shadowy(put(trailer, box(L - 1.8, 0.12, 1.3, dark), 0, Y0 - 0.02, 0));
  var AXLES = [-0.43, 0.43];
  [-1, 1].forEach(function (side) {
    // fender skirt over the wheels
    var f = put(trailer, box(1.75, 0.06, 0.32, brushed), 0, Y0 + 0.02, side * (HALF_W - 0.16));
    shadowy(f);
    AXLES.forEach(function (x) {
      var wheel = new THREE.Group();
      var tire = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.25, 40), rubber);
      tire.rotation.x = Math.PI / 2; wheel.add(shadowy(tire));
      var side2 = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.05, 10, 40), rubber);
      side2.position.z = 0.12; wheel.add(side2);
      var rim = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.02, 32), rimMat);
      rim.rotation.x = Math.PI / 2; rim.position.z = 0.13; wheel.add(rim);
      var hub = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.09, 0.07, 20), steel);
      hub.rotation.x = Math.PI / 2; hub.position.z = 0.16; wheel.add(hub);
      for (var k = 0; k < 5; k++) {
        var a = k / 5 * Math.PI * 2;
        var nut = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.03, 8), steel);
        nut.rotation.x = Math.PI / 2; nut.position.set(Math.cos(a) * 0.11, Math.sin(a) * 0.11, 0.15);
        wheel.add(nut);
      }
      wheel.position.set(x, 0.35, side * (HALF_W - 0.2));
      if (side < 0) wheel.rotation.y = Math.PI;
      trailer.add(wheel);
    });
  });
  // wheel chocks (yellow), like in the photos
  var chockMat = new THREE.MeshStandardMaterial({ color: 0xf2c418, roughness: 0.6 });
  shadowy(put(trailer, box(0.22, 0.1, 0.16, chockMat), -0.86, 0.05, HALF_W - 0.2));
  shadowy(put(trailer, box(0.22, 0.1, 0.16, chockMat), 0.86, 0.05, HALF_W - 0.2));
  // corner leveling stands
  [[-L / 2 + 0.75, 1], [-L / 2 + 0.75, -1], [L / 2 - 0.6, 1], [L / 2 - 0.6, -1]].forEach(function (c) {
    shadowy(put(trailer, box(0.05, Y0 - 0.02, 0.05, dark), c[0], (Y0 - 0.02) / 2, c[1] * 0.6));
  });

  /* ---------- tongue (front, -x): A-frame, jack, coupler, generator ---------- */
  [-1, 1].forEach(function (s) {
    var bar = shadowy(box(1.55, 0.09, 0.09, dark));
    bar.position.set(-L / 2 - 0.55, 0.58, s * 0.36);
    bar.rotation.y = s * 0.42;
    trailer.add(bar);
  });
  shadowy(put(trailer, box(0.34, 0.13, 0.17, dark), -L / 2 - 1.35, 0.57, 0));
  shadowy(put(trailer, new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 10), steel), -L / 2 - 1.5, 0.6, 0));
  shadowy(put(trailer, new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.8, 14), steel), -L / 2 - 0.95, 0.42, 0.12));
  shadowy(put(trailer, new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.04, 16), dark), -L / 2 - 0.95, 0.02, 0.12));
  var gen = shadowy(put(trailer, box(0.62, 0.62, 1.05, brushed), -L / 2 - 0.42, 0.98, 0));
  conformedBoxLabel();
  function conformedBoxLabel() {
    var lbl = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.24), decalMat(canvasTex(300, 140, function (g, w, h) {
      g.fillStyle = "#2b86d6"; g.fillRect(0, 0, w, h);
      g.fillStyle = "#fff"; g.textAlign = "center";
      g.font = "78px 'Bebas Neue', Impact, sans-serif"; g.fillText("ROMANIAN", w / 2, 98);
    }, true)));
    lbl.position.set(gen.position.x - 0.312, 1.08, 0); lbl.rotation.y = -Math.PI / 2;
    trailer.add(lbl);
    // vent grille on the generator
    var gr = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.18), new THREE.MeshStandardMaterial({
      map: canvasTex(200, 72, function (g, w, h) {
        g.fillStyle = "#9da2a7"; g.fillRect(0, 0, w, h);
        g.fillStyle = "#3a3d41";
        for (var y = 8; y < h; y += 12) for (var x = 8; x < w; x += 12) { g.beginPath(); g.arc(x, y, 3, 0, 6.3); g.fill(); }
      }), metalness: 0.6, roughness: 0.5 }));
    gr.position.set(gen.position.x, 0.98, 0.531);
    trailer.add(gr);
  }

  /* ---------- ground ---------- */
  var ground = new THREE.Mesh(new THREE.CircleGeometry(70, 72),
    new THREE.MeshStandardMaterial({ color: 0xe6dfd1, roughness: 0.95, metalness: 0 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  // soft contact shadow right under the body (shadow maps alone look too crisp)
  var contact = new THREE.Mesh(new THREE.PlaneGeometry(L + 1.2, 3.0),
    new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false,
      map: canvasTex(256, 128, function (g, w, h) {
        var r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
        r.addColorStop(0, "rgba(0,0,0,0.55)"); r.addColorStop(0.6, "rgba(0,0,0,0.25)"); r.addColorStop(1, "rgba(0,0,0,0)");
        g.save(); g.scale(1, 0.5); g.translate(0, h / 2); g.fillStyle = r; g.fillRect(0, -h / 2, w, h * 2); g.restore();
      }) }));
  contact.rotation.x = -Math.PI / 2; contact.position.set(-0.3, 0.005, 0);
  scene.add(contact);

  // redraw text textures once the web fonts have loaded
  if (document.fonts && document.fonts.load) {
    Promise.all([
      document.fonts.load("80px 'Bebas Neue'"),
      document.fonts.load("80px Lobster")
    ]).then(function () {
      textTextures.forEach(function (pair) {
        var c = pair[0].image;
        pair[1](c.getContext("2d"), c.width, c.height);
        pair[0].needsUpdate = true;
      });
      last = -1;
    }).catch(function () {});
  }

  /* ---------- camera path driven by scroll ---------- */
  var tTitle = document.getElementById("tTitle"), tMid = document.getElementById("tMid"),
      tEnd = document.getElementById("tEnd"), tHint = document.getElementById("tHint"),
      tFade = document.getElementById("tFade");

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function seg(p, a, b) { return clamp((p - a) / (b - a), 0, 1); }
  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function band(p, a, b, c, d) { return Math.min(seg(p, a, b), 1 - seg(p, c, d)); }

  var radius = 9, BASE_FOV = 36, last = -1;
  function resize() {
    var w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // back off far enough that the whole trailer (about 8.6 m with the
    // tongue) fits across the screen, portrait phones included
    var hfov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(BASE_FOV / 2)) * camera.aspect);
    radius = Math.max(9, 4.0 / Math.tan(hfov / 2) + 0.4);
    camera.updateProjectionMatrix();
    last = -1;
  }
  window.addEventListener("resize", resize);

  function targetProgress() {
    var r = intro.getBoundingClientRect();
    var total = r.height - window.innerHeight;
    return total > 0 ? clamp(-r.top / total, 0, 1) : 0;
  }

  var p = targetProgress();
  var look = new THREE.Vector3();
  var OPEN_Z = surfaceZ(0, WIN_Y) + 0.016;

  function place(p) {
    // 1) walk around: front corner of the far side, past the back,
    //    finishing square-on to the service window.
    var a = ease(seg(p, 0, 0.62));
    var theta = THREE.MathUtils.degToRad(225 * (1 - a));
    var h = 2.6 - 0.5 * a;
    var cx = Math.sin(theta) * radius, cz = Math.cos(theta) * radius;
    var lx = -0.3 * (1 - a), ly = 1.55 + 0.45 * a, lz = 0;

    // 2) push in through the window
    var z = Math.pow(seg(p, 0.66, 0.97), 2.2);
    cx = cx * (1 - z);
    h = h + (WIN_Y - h) * z;
    cz = cz + (OPEN_Z + 0.1 - cz) * z;
    lx = lx * (1 - z);
    ly = ly + (WIN_Y - ly) * z;
    lz = lz + (OPEN_Z - 1 - lz) * z;

    camera.position.set(cx, h, cz);
    camera.fov = BASE_FOV - 8 * z;
    camera.updateProjectionMatrix();
    look.set(lx, ly, lz);
    camera.lookAt(look);

    tTitle.style.opacity = 1 - seg(p, 0.04, 0.12);
    tHint.style.opacity = 1 - seg(p, 0.02, 0.08);
    tMid.style.opacity = band(p, 0.2, 0.28, 0.4, 0.48);
    tEnd.style.opacity = band(p, 0.5, 0.56, 0.66, 0.72);
    tFade.style.opacity = seg(p, 0.86, 0.99);
  }

  var visible = true;
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (e) { visible = e[0].isIntersecting; }).observe(intro);
  }

  function frame() {
    requestAnimationFrame(frame);
    if (!visible) return;
    var tp = targetProgress();
    p = reduce ? tp : p + (tp - p) * 0.12;
    if (Math.abs(p - last) < 0.00005) return;   // nothing moved, skip the render
    last = p;
    place(p);
    renderer.render(scene, camera);
  }

  resize();
  place(p);
  renderer.render(scene, camera);
  frame();
})();
