/* Didi's Dogs — 3D scroll intro.
   Scroll walks the camera around a chrome trailer, ends facing the service
   window, then zooms through the window into the site. Uses three.js r128
   (three.min.js, global THREE). */
(function () {
  "use strict";

  var intro = document.getElementById("intro");
  var canvas = document.getElementById("trailerCanvas");
  if (!intro || !canvas || !window.THREE) { if (intro) intro.classList.add("nogl"); return; }

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false });
  } catch (e) { intro.classList.add("nogl"); return; }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  var BLUE = "#1f7fd1", BLUE_DARK = "#1f5fa8", RED = "#c8333a", CREAM = "#faf6ef";

  var scene = new THREE.Scene();
  scene.background = new THREE.Color(CREAM);
  scene.fog = new THREE.Fog(CREAM, 22, 55);

  var camera = new THREE.PerspectiveCamera(38, 1, 0.05, 200);

  /* ---------- helpers ---------- */
  function canvasTex(w, h, draw) {
    var c = document.createElement("canvas"); c.width = w; c.height = h;
    draw(c.getContext("2d"), w, h);
    var t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    t.anisotropy = 4;
    return t;
  }
  function decal(tex, w, h) {
    return new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false }));
  }
  function box(w, h, d, mat) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); }
  function put(parent, mesh, x, y, z) { mesh.position.set(x, y, z); parent.add(mesh); return mesh; }

  /* ---------- environment for chrome reflections ---------- */
  (function env() {
    var tex = canvasTex(512, 256, function (g, w, h) {
      var grad = g.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0.00, "#6f9fd6");
      grad.addColorStop(0.28, "#cfe2f5");
      grad.addColorStop(0.42, "#f4f6f8");
      grad.addColorStop(0.50, "#c3c9cf");   // horizon: light silver on the flat sides
      grad.addColorStop(0.53, "#3e4650");   // dark band the curves pick up
      grad.addColorStop(0.57, "#4a525b");
      grad.addColorStop(0.61, "#a39d91");   // pavement
      grad.addColorStop(1.00, "#5e5a52");
      g.fillStyle = grad; g.fillRect(0, 0, w, h);
      // a few soft light panels so the chrome has highlights
      g.fillStyle = "rgba(255,255,255,0.9)";
      g.fillRect(60, 40, 70, 30); g.fillRect(300, 30, 110, 26); g.fillRect(430, 70, 40, 40);
    });
    tex.mapping = THREE.EquirectangularReflectionMapping;
    var pm = new THREE.PMREMGenerator(renderer);
    pm.compileEquirectangularShader();
    scene.environment = pm.fromEquirectangular(tex).texture;
    pm.dispose();
  })();

  scene.add(new THREE.HemisphereLight(0xffffff, 0xb9b1a3, 0.55));
  var sun = new THREE.DirectionalLight(0xffffff, 0.9);
  sun.position.set(4, 10, 6); scene.add(sun);

  /* ---------- materials ---------- */
  var chrome = new THREE.MeshStandardMaterial({ color: 0xf2f4f7, metalness: 1, roughness: 0.08 });
  var steel = new THREE.MeshStandardMaterial({ color: 0xd6d9dd, metalness: 0.9, roughness: 0.3 });
  var white = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0, roughness: 0.45 });
  var dark = new THREE.MeshStandardMaterial({ color: 0x1b1d22, metalness: 0.2, roughness: 0.8, envMapIntensity: 0.3 });
  var rubber = new THREE.MeshStandardMaterial({ color: 0x0c0c0c, roughness: 0.95, envMapIntensity: 0.15 });
  var blueMat = new THREE.MeshStandardMaterial({ color: 0x2b86d6, roughness: 0.4 });

  var trailer = new THREE.Group();
  scene.add(trailer);

  /* ---------- body: a rounded Airstream-style loaf ---------- */
  var BODY_Y = 0.72;          // bottom of the body
  var HALF_W = 1.1;           // half width (z)
  (function body() {
    var L = 4.6, H = 1.6, rt = 0.75, rb = 0.25;
    var s = new THREE.Shape();
    var x0 = -L / 2, x1 = L / 2, y0 = 0, y1 = H;
    s.moveTo(x0 + rb, y0);
    s.lineTo(x1 - rb, y0);
    s.quadraticCurveTo(x1, y0, x1, y0 + rb);
    s.lineTo(x1, y1 - rt);
    s.bezierCurveTo(x1, y1 - rt * 0.35, x1 - rt * 0.35, y1, x1 - rt, y1);
    s.lineTo(x0 + rt, y1);
    s.bezierCurveTo(x0 + rt * 0.35, y1, x0, y1 - rt * 0.35, x0, y1 - rt);
    s.lineTo(x0, y0 + rb);
    s.quadraticCurveTo(x0, y0, x0 + rb, y0);
    var t = 0.38;
    var geo = new THREE.ExtrudeGeometry(s, {
      depth: HALF_W * 2 - t * 2, bevelEnabled: true, bevelThickness: t, bevelSize: t,
      bevelSegments: 14, curveSegments: 40
    });
    geo.center();
    var m = new THREE.Mesh(geo, chrome);
    m.position.y = BODY_Y + (H + t * 2) / 2;
    trailer.add(m);
  })();
  var BODY_TOP = BODY_Y + 1.6 + 0.76;   // 3.08

  /* ---------- window side (+z) ---------- */
  var FACE = HALF_W + 0.004;
  var WIN_Y = 2.15;                       // centre height of the service window
  var winGroup = new THREE.Group();
  winGroup.position.set(0, 0, FACE);
  trailer.add(winGroup);

  // white frame
  put(winGroup, box(3.0, 1.12, 0.06, white), 0, WIN_Y, 0.03);

  // interior seen through the open window
  var interiorTex = canvasTex(512, 384, function (g, w, h) {
    var grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "#2a2620"); grad.addColorStop(1, "#0f0e0c");
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    // two warm heat lamps
    [150, 362].forEach(function (x) {
      var r = g.createRadialGradient(x, 70, 0, x, 70, 170);
      r.addColorStop(0, "rgba(255,196,120,0.75)"); r.addColorStop(1, "rgba(255,196,120,0)");
      g.fillStyle = r; g.fillRect(0, 0, w, h);
      g.fillStyle = "#d9d9d9";
      g.beginPath(); g.moveTo(x - 26, 70); g.lineTo(x + 26, 70); g.lineTo(x + 10, 30); g.lineTo(x - 10, 30); g.fill();
      g.fillRect(x - 2, 0, 4, 32);
    });
    // back wall menu strip
    g.fillStyle = BLUE_DARK; g.fillRect(40, 150, 432, 60);
    g.fillStyle = "#ffffff"; g.font = "bold 34px 'Bebas Neue', Impact, sans-serif";
    g.textAlign = "center"; g.fillText("ORDER HERE", 256, 193);
    // condiment bottles on the counter
    var cols = ["#e0b21c", "#c8333a", "#e0b21c", "#7a3b1d", "#c8333a"];
    cols.forEach(function (c, i) {
      g.fillStyle = c; g.fillRect(170 + i * 36, 290, 22, 70);
      g.fillStyle = "#eee"; g.fillRect(176 + i * 36, 276, 10, 16);
    });
    g.fillStyle = "#cfd3d8"; g.fillRect(0, 356, w, 28);
  });
  var opening = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.9),
    new THREE.MeshBasicMaterial({ map: interiorTex, toneMapped: false }));
  opening.position.set(0, WIN_Y, 0.065);
  winGroup.add(opening);

  // blue menu boards either side
  function menuBoard() {
    return canvasTex(256, 320, function (g, w, h) {
      g.fillStyle = "#2b86d6"; g.fillRect(0, 0, w, h);
      g.fillStyle = "#ffffff"; g.fillRect(24, 22, w - 48, h - 44);
      g.fillStyle = BLUE_DARK; g.textAlign = "center";
      g.font = "bold 40px 'Bebas Neue', Impact, sans-serif"; g.fillText("ROMANIAN", w / 2, 70);
      g.fillStyle = "#9aa3b2";
      for (var i = 0; i < 7; i++) g.fillRect(56, 100 + i * 26, w - 112, 8);
    });
  }
  [-0.95, 0.95].forEach(function (x) {
    var b = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.92),
      new THREE.MeshBasicMaterial({ map: menuBoard(), toneMapped: false }));
    b.position.set(x, WIN_Y, 0.065);
    winGroup.add(b);
  });

  // serving shelf
  put(winGroup, box(3.1, 0.05, 0.32, steel), 0, WIN_Y - 0.6, 0.16);

  // awning with blue/white stripe fascia
  var stripeTex = canvasTex(512, 32, function (g, w, h) {
    for (var i = 0; i < 32; i++) {
      g.fillStyle = i % 2 ? "#ffffff" : "#2b86d6";
      g.fillRect(i * 16, 0, 16, h);
    }
  });
  var awning = box(3.1, 0.05, 0.55, white);
  awning.position.set(0, WIN_Y + 0.66, 0.26);
  awning.rotation.x = 0.12;
  winGroup.add(awning);
  var fascia = new THREE.Mesh(new THREE.PlaneGeometry(3.1, 0.12),
    new THREE.MeshBasicMaterial({ map: stripeTex, toneMapped: false }));
  fascia.position.set(0, WIN_Y + 0.6, 0.545);
  winGroup.add(fascia);

  // ROMANIAN lettering under the window
  var wordTex = canvasTex(1024, 256, function (g, w, h) {
    g.textAlign = "center";
    g.fillStyle = BLUE;
    g.font = "200px 'Bebas Neue', Impact, sans-serif";
    g.fillText("ROMANIAN", w / 2, 190);
    g.fillStyle = RED;
    g.font = "64px Lobster, cursive";
    g.fillText("Chicago", w / 2 + 230, 240);
  });
  var word = decal(wordTex, 2.5, 0.62);
  word.position.set(0, 1.25, 0.01);
  winGroup.add(word);

  /* ---------- far side (-z): big script logo ---------- */
  var scriptTex = canvasTex(1024, 360, function (g, w, h) {
    g.textAlign = "center";
    g.fillStyle = "#2b9be8";
    g.font = "230px Lobster, cursive";
    g.fillText("Romanian", w / 2, 220);
    g.lineWidth = 34; g.strokeStyle = "#2b9be8"; g.lineCap = "round";
    g.beginPath(); g.moveTo(330, 300); g.bezierCurveTo(520, 250, 700, 330, 920, 270); g.stroke();
  });
  var script = decal(scriptTex, 3.8, 1.34);
  script.position.set(0, 1.95, -FACE);
  script.rotation.y = Math.PI;
  trailer.add(script);

  /* ---------- roof ---------- */
  var hood = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.26, 32), steel);
  hood.position.set(-0.7, BODY_TOP + 0.1, 0);
  trailer.add(hood);
  var cap = new THREE.Mesh(new THREE.SphereGeometry(0.27, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), steel);
  cap.position.set(-0.7, BODY_TOP + 0.23, 0);
  trailer.add(cap);
  put(trailer, box(0.75, 0.24, 0.62, white), 0.55, BODY_TOP + 0.08, 0);

  /* ---------- chassis, wheels, tongue ---------- */
  put(trailer, box(4.8, 0.12, 1.8, dark), 0, BODY_Y - 0.04, 0);
  [-0.42, 0.42].forEach(function (x) {
    [-1, 1].forEach(function (side) {
      var tire = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.24, 32), rubber);
      tire.rotation.x = Math.PI / 2;
      tire.position.set(x, 0.34, side * (HALF_W - 0.2));
      trailer.add(tire);
      var rim = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.02, 24), white);
      rim.rotation.x = Math.PI / 2;
      rim.position.set(x, 0.34, side * (HALF_W - 0.2 + 0.125));
      trailer.add(rim);
    });
  });
  // A-frame tongue toward the front (-x)
  [-1, 1].forEach(function (side) {
    var bar = box(1.45, 0.08, 0.08, dark);
    bar.position.set(-3.25, 0.62, side * 0.38);
    bar.rotation.y = side * 0.4;
    trailer.add(bar);
  });
  put(trailer, box(0.3, 0.12, 0.16, dark), -3.95, 0.6, 0);
  var jack = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.75, 12), steel);
  jack.position.set(-3.5, 0.38, 0); trailer.add(jack);
  // stainless generator box on the tongue
  var gen = box(0.62, 0.6, 1.0, steel);
  gen.position.set(-3.05, 1.0, 0); trailer.add(gen);
  var genLabel = decal(canvasTex(256, 128, function (g, w, h) {
    g.fillStyle = "#2b86d6"; g.fillRect(0, 0, w, h);
    g.fillStyle = "#fff"; g.textAlign = "center";
    g.font = "64px 'Bebas Neue', Impact, sans-serif"; g.fillText("ROMANIAN", w / 2, 86);
  }), 0.5, 0.25);
  genLabel.position.set(-3.364, 1.08, 0); genLabel.rotation.y = -Math.PI / 2;
  trailer.add(genLabel);

  /* ---------- ground + soft shadow ---------- */
  var ground = new THREE.Mesh(new THREE.CircleGeometry(60, 64),
    new THREE.MeshStandardMaterial({ color: 0xe9e2d4, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; scene.add(ground);
  var shadowTex = canvasTex(256, 128, function (g, w, h) {
    var r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    r.addColorStop(0, "rgba(0,0,0,0.45)"); r.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = r; g.fillRect(0, 0, w, h);
  });
  var shadow = new THREE.Mesh(new THREE.PlaneGeometry(9, 3.6),
    new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.set(-0.4, 0.01, 0);
  scene.add(shadow);

  // redraw text textures once the web fonts have loaded
  if (document.fonts && document.fonts.load) {
    Promise.all([
      document.fonts.load("80px 'Bebas Neue'"),
      document.fonts.load("80px Lobster")
    ]).then(function () {
      [interiorTex, wordTex, scriptTex].forEach(function (t) { t.needsUpdate = true; });
      rebuildText();
    }).catch(function () {});
  }
  function rebuildText() {
    var redraws = [
      [wordTex, function (g, w, h) {
        g.clearRect(0, 0, w, h); g.textAlign = "center";
        g.fillStyle = BLUE; g.font = "200px 'Bebas Neue', Impact, sans-serif";
        g.fillText("ROMANIAN", w / 2, 190);
        g.fillStyle = RED; g.font = "64px Lobster, cursive";
        g.fillText("Chicago", w / 2 + 230, 240);
      }],
      [scriptTex, function (g, w, h) {
        g.clearRect(0, 0, w, h); g.textAlign = "center";
        g.fillStyle = "#2b9be8"; g.font = "230px Lobster, cursive";
        g.fillText("Romanian", w / 2, 220);
        g.lineWidth = 34; g.strokeStyle = "#2b9be8"; g.lineCap = "round";
        g.beginPath(); g.moveTo(330, 300); g.bezierCurveTo(520, 250, 700, 330, 920, 270); g.stroke();
      }]
    ];
    redraws.forEach(function (r) {
      var c = r[0].image; r[1](c.getContext("2d"), c.width, c.height); r[0].needsUpdate = true;
    });
  }

  /* ---------- camera path driven by scroll ---------- */
  var tTitle = document.getElementById("tTitle"), tMid = document.getElementById("tMid"),
      tEnd = document.getElementById("tEnd"), tHint = document.getElementById("tHint"),
      tFade = document.getElementById("tFade");

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function seg(p, a, b) { return clamp((p - a) / (b - a), 0, 1); }
  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function band(p, a, b, c, d) { return Math.min(seg(p, a, b), 1 - seg(p, c, d)); }

  var radius = 9;
  function resize() {
    var w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // back the camera off far enough that the whole trailer (about 8.5 m
    // with the tongue) fits across the screen, portrait phones included
    var hfov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect);
    radius = Math.max(9, 4.1 / Math.tan(hfov / 2) + 0.5);
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", resize);

  function targetProgress() {
    var r = intro.getBoundingClientRect();
    var total = r.height - window.innerHeight;
    return total > 0 ? clamp(-r.top / total, 0, 1) : 0;
  }

  var p = targetProgress();
  var look = new THREE.Vector3();
  var WIN_Z = FACE + 0.065;

  function place(p) {
    // 1) walk around: start at the front corner of the far side, sweep past
    //    the back, finish square-on to the service window.
    var a = ease(seg(p, 0, 0.62));
    var theta = THREE.MathUtils.degToRad(225 * (1 - a));
    var h = 2.7 - 0.55 * a;
    var cx = Math.sin(theta) * radius, cz = Math.cos(theta) * radius;
    var lx = 0, ly = 1.75 + 0.4 * a, lz = 0;

    // 2) push in through the window
    var z = Math.pow(seg(p, 0.66, 0.97), 2.2);
    cx = cx * (1 - z);
    h = h + (WIN_Y - h) * z;
    cz = cz + (WIN_Z + 0.12 - cz) * z;
    ly = ly + (WIN_Y - ly) * z;
    lz = lz + (WIN_Z - 1 - lz) * z;

    camera.position.set(cx, h, cz);
    camera.fov = 38 - 10 * z;
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
    place(p);
    renderer.render(scene, camera);
  }

  resize();
  place(p);
  renderer.render(scene, camera);
  frame();

  // test hook: lets a script jump straight to a point in the intro
  window.__didiSetProgress = function (v) { p = v; place(v); renderer.render(scene, camera); };
})();
