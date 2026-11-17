/* T1ER ONE concept page: the clips answer to the cursor.
   1. hero   the athlete stands in shadow, the cursor is a light, a click unlocks her
   2. shift  she walks at you; the cursor moves the line between her office and her gym (a range input does the same)
   3. kit    cursor wipes each product photo to its second view
   4. join   a spotlight follows the cursor over the emblem clip */
(function () {
  "use strict";

  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
  var fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
  var calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  var play = function (v) { var p = v.play(); if (p && p.catch) p.catch(function () {}); };

  /* run fn(visible) as an element enters and leaves the screen */
  function watch(el, fn, threshold) {
    if (!("IntersectionObserver" in window)) { fn(true); return; }
    new IntersectionObserver(function (es) { fn(es[0].isIntersecting); }, { threshold: threshold || 0.25 }).observe(el);
  }

  /* ---------- 0. gate: fly through the red 1 ---------- */
  var gate = $(".gate");
  var gMask = $(".gate__mask", gate), gOne = $(".gate__one", gate), gVid = $(".gate__video", gate);
  var gGlow = $(".gate__glow", gate);
  var smoothstep = function (a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  var G = { p: 0, smax: 40, mx: 0, my: 0, ax: 0, ay: 0, seen: true, ticking: false };
  var RED = [227, 6, 19];

  /* Find the stem of the 1: draw the glyph in the same font on a canvas and take the widest
     solid run across its lower half. Returns its centre and width as fractions of the glyph's advance. */
  function stem(el) {
    var cs = getComputedStyle(el), fs = parseFloat(cs.fontSize);
    var guess = { cx: 0.6, w: 0.3 };
    try {
      var c = document.createElement("canvas"), x = c.getContext("2d");
      var W = Math.ceil(fs * 1.4), H = Math.ceil(fs * 1.4);
      c.width = W; c.height = H;
      if ("fontStretch" in x) x.fontStretch = "expanded";
      x.font = cs.fontWeight + " " + fs + "px " + cs.fontFamily;
      x.textBaseline = "alphabetic";
      x.fillText("1", 0, H * 0.85);
      var adv = x.measureText("1").width, d = x.getImageData(0, 0, W, H).data;
      var y = Math.round(H * 0.85 - fs * 0.3), best = [0, 0], run = -1;   // a row well below the flag
      for (var i = 0; i <= W; i++) {
        var on = i < W && d[(y * W + i) * 4 + 3] > 128;
        if (on && run < 0) run = i;
        if (!on && run >= 0) { if (i - run > best[1] - best[0]) best = [run, i]; run = -1; }
      }
      if (adv > 0 && best[1] > best[0]) return { cx: (best[0] + best[1]) / 2 / adv, w: (best[1] - best[0]) / adv };
    } catch (e) {}
    return guess;
  }
  function gateMeasure() {             // aim the zoom at the middle of the 1's stem, and scale until the stem covers the screen
    gate.style.setProperty("--s", 1);
    var word = $(".gate__word", gate);           // fit the wordmark to 92% of the screen width
    word.style.fontSize = "10vw";
    var ww = word.getBoundingClientRect().width;
    if (ww) word.style.fontSize = (10 * innerWidth * 0.92 / ww).toFixed(3) + "vw";
    gate.style.setProperty("--wh", word.getBoundingClientRect().height.toFixed(1) + "px");
    var m = gMask.getBoundingClientRect(), o = gOne.getBoundingClientRect(), st = stem(gOne);
    gate.style.setProperty("--ox", (o.left - m.left + o.width * st.cx).toFixed(1) + "px");
    gate.style.setProperty("--oy", (o.top - m.top + o.height * 0.6).toFixed(1) + "px");
    G.smax = Math.max(innerWidth, innerHeight) * 2.2 / Math.max(6, o.width * st.w);
    gateDraw();
  }
  function gateDraw() {
    var p = calm ? 0 : G.p;
    var e = smoothstep(0, 0.62, p);
    var k = 1 - e;                      // parallax fades out as the zoom takes over
    gate.style.setProperty("--s", Math.pow(G.smax, e).toFixed(4));
    gate.style.setProperty("--vs", (1.22 - 0.22 * e).toFixed(4));
    gate.style.setProperty("--mo", (1 - smoothstep(0.36, 0.52, p)).toFixed(3));
    gate.style.setProperty("--go", (1 - smoothstep(0, 0.3, p)).toFixed(3));
    gate.style.setProperty("--co", (1 - smoothstep(0, 0.06, p)).toFixed(3));
    gate.style.setProperty("--to", (calm ? 1 : smoothstep(0.6, 0.76, p)).toFixed(3));
    gate.style.setProperty("--mx", (G.mx * k).toFixed(3));
    gate.style.setProperty("--my", (G.my * k).toFixed(3));
    var w = smoothstep(0.04, 0.4, p);   // the red 1 turns white, so the film shows true colour once it fills the screen
    gOne.style.color = "rgb(" + RED.map(function (c) { return Math.round(c + (255 - c) * w); }).join(",") + ")";
  }
  function gateTick() {
    var r = gate.getBoundingClientRect();
    G.p = clamp(-r.top / Math.max(1, r.height - innerHeight), 0, 1);
    G.mx += (G.ax - G.mx) * 0.08;
    G.my += (G.ay - G.my) * 0.08;
    gateDraw();
    if (G.seen && (Math.abs(G.ax - G.mx) + Math.abs(G.ay - G.my) > 0.001)) requestAnimationFrame(gateTick);
    else G.ticking = false;
  }
  function gateWake() { if (!G.ticking) { G.ticking = true; requestAnimationFrame(gateTick); } }
  addEventListener("scroll", gateWake, { passive: true });
  addEventListener("resize", gateMeasure);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(gateMeasure);
  gateMeasure();
  if (fine && !calm) {
    gate.addEventListener("pointermove", function (e) {
      G.ax = (e.clientX / innerWidth) * 2 - 1;
      G.ay = (e.clientY / innerHeight) * 2 - 1;
      gGlow.style.setProperty("--gx", ((e.clientX / innerWidth) * 100).toFixed(1) + "%");
      gGlow.style.setProperty("--gy", ((e.clientY / innerHeight) * 100).toFixed(1) + "%");
      gateWake();
    });
    gate.addEventListener("pointerleave", function () { G.ax = G.ay = 0; gateWake(); });
  }
  watch(gate, function (seen) { G.seen = seen; if (seen) { play(gVid); gateWake(); } else gVid.pause(); }, 0);

  /* ---------- 1. hero ---------- */
  /* The athlete is cut out of her clip. Each source video carries the picture in its top half and
     the cut-out mask in its bottom half; a small shader puts them together on a canvas.
     Locked, she is a shadow with a red edge and only the light under the cursor shows her in colour.
     A click unlocks the whole figure: full colour, full speed, and the headline word fills in. */
  var hero = $(".hero");
  var glow = $(".hero__glow", hero);
  var figure = $(".figure", hero);
  var canvas = $("canvas", figure);
  var modes = $$(".mode", hero);
  var vids = {};
  $$("video", figure).forEach(function (v) { vids[v.dataset.mode] = v; });
  var heroSeen = true, open = false, inHero = false, looping = false;
  var S = { mx: 0.5, my: 0.55, tx: 0.5, ty: 0.55, k: 0, g: 0, px: 0, py: 0, ax: 0, ay: 0 };

  function initGL(cv) {
    var gl = null;
    try { gl = cv.getContext("webgl", { premultipliedAlpha: true, antialias: false }); } catch (e) {}
    if (!gl) return null;
    var vsrc = "attribute vec2 p;varying vec2 v;void main(){v=p*.5+.5;gl_Position=vec4(p,0.,1.);}";
    var fsrc = [
      "precision mediump float;",
      "varying vec2 v;",
      "uniform sampler2D t;",
      "uniform vec2 m;",          // the light, in canvas coordinates (0..1, y up)
      "uniform float k,g,time,asp;",   // unlocked 0..1, glitch 0..1, seconds, canvas height / width
      "float A(vec2 u){u=clamp(u,vec2(0.,.006),vec2(1.,.994));return texture2D(t,vec2(u.x,u.y*.5)).r;}",
      "vec3 C(vec2 u){u=clamp(u,vec2(0.,.006),vec2(1.,.994));return texture2D(t,vec2(u.x,.5+u.y*.5)).rgb;}",
      "float ring(vec2 u,float r){float s=0.;for(int i=0;i<12;i++){float a=float(i)*.5236;s+=A(u+vec2(cos(a)*r,sin(a)*r/asp));}return s/12.;}",
      "void main(){",
      "  vec2 u=v;",
      "  float band=floor(u.y*26.+time*40.);",
      "  float n=fract(sin(band*91.7)*43758.5);",
      "  u.x+=(n-.5)*.3*g*step(.55,n);",                       // switching clips: slices jump sideways
      "  float a=smoothstep(.25,.75,A(u));",
      "  float sp=.014*g;",
      "  vec3 c=vec3(C(u+vec2(sp,0.)).r,C(u).g,C(u-vec2(sp,0.)).b);",
      "  float near=ring(u,.006), mid=ring(u,.016);",
      "  float rim=clamp((a-near)*4.,0.,1.);",                 // a thin line of backlight on her outline
      "  float spill=clamp((a-mid)*1.6,0.,1.)*(1.-rim);",       // softer red light wrapping round the edges
      "  float halo=0.;",
      "  vec3 red=vec3(1.,.06,.1);",
      "  float l=dot(c,vec3(.3,.6,.1));",
      "  vec3 dark=vec3(l*l)*.22+red*(rim*1.5+spill*.45);",
      "  vec2 d=u-m;d.y*=asp;",
      "  float dist=length(d);",
      "  float r=.36;",
      "  float lit=max(1.-smoothstep(r*.45,r,dist),k);",
      "  vec3 col=mix(dark,c,lit);",
      "  float gl=halo*.55*(1.-lit*.75);",
      "  gl_FragColor=vec4(col*a+red*gl*(1.-a),a+(1.-a)*gl);",
      "}"
    ].join("\n");
    function sh(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; }
    var pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, vsrc));
    gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fsrc));
    gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return null;
    gl.useProgram(pr);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(pr, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));   // nothing until a frame arrives
    var U = {};
    ["m", "k", "g", "time", "asp"].forEach(function (n) { U[n] = gl.getUniformLocation(pr, n); });
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    return {
      size: function () {
        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        var w = Math.round(cv.clientWidth * dpr), h = Math.round(cv.clientHeight * dpr);
        if (w && h && (cv.width !== w || cv.height !== h)) { cv.width = w; cv.height = h; gl.viewport(0, 0, w, h); }
      },
      draw: function (video, time) {
        if (video && video.readyState >= 2) {
          try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video); } catch (e) {}
        }
        gl.uniform2f(U.m, S.mx, S.my);
        gl.uniform1f(U.k, S.k);
        gl.uniform1f(U.g, S.g);
        gl.uniform1f(U.time, time % 100);
        gl.uniform1f(U.asp, cv.height / Math.max(1, cv.width));
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
    };
  }
  var scene = initGL(canvas);
  if (!scene) hero.classList.add("no-gl");

  function clip() { return vids[hero.dataset.mode]; }
  function pace() {                       // locked she moves in slow motion, unlocked at full speed
    Object.keys(vids).forEach(function (m) {
      var v = vids[m];
      if (m !== hero.dataset.mode || !heroSeen || (calm && !open)) { v.pause(); return; }
      v.playbackRate = open ? 1 : 0.4;
      play(v);
    });
  }
  function setOpen(on) {
    open = on;
    hero.classList.toggle("is-open", on);
    figure.setAttribute("aria-pressed", on);
    pace();
  }
  /* switching campaigns: the athlete fades down and out, the clip changes in the dark, the new one fades up */
  var nextMode = null, swapTimer = 0;
  function setMode(mode) {
    modes.forEach(function (b) {
      var on = b.dataset.mode === mode;
      b.classList.toggle("is-on", on);
      b.setAttribute("aria-pressed", on);
    });
    nextMode = mode;
    if (swapTimer) return;                      // a swap is already under way; it will pick up the latest choice
    if (hero.dataset.mode === mode) return;
    if (calm) { apply(); return; }
    hero.classList.add("is-switching");
    swapTimer = setTimeout(apply, 280);
    function apply() {
      swapTimer = 0;
      if (hero.dataset.mode !== nextMode) {
        hero.dataset.mode = nextMode;
        var v = clip(); try { v.currentTime = 0; } catch (e) {}
        pace();
        wake();
      }
      requestAnimationFrame(function () { hero.classList.remove("is-switching"); });
    }
  }

  function heroFrame(t) {
    if (!heroSeen) { looping = false; return; }
    requestAnimationFrame(heroFrame);
    var time = t / 1000;
    if (!inHero && !calm) {               // nobody is steering: the light drifts over her by itself
      S.tx = 0.5 + 0.24 * Math.sin(time * 0.8);
      S.ty = 0.55 + 0.27 * Math.sin(time * 0.57 + 1);
    }
    S.mx += (S.tx - S.mx) * 0.14;
    S.my += (S.ty - S.my) * 0.14;
    S.k += ((open ? 1 : 0) - S.k) * 0.075;
    S.g = Math.max(0, S.g - 0.045);
    S.px += (S.ax - S.px) * 0.07;
    S.py += (S.ay - S.py) * 0.07;
    hero.style.setProperty("--px", S.px.toFixed(3));
    hero.style.setProperty("--py", S.py.toFixed(3));
    if (scene) { scene.size(); scene.draw(clip(), time); }
  }
  function wake() { if (!looping && heroSeen) { looping = true; requestAnimationFrame(heroFrame); } }

  /* hovering only moves the light; a click (or tap, or Enter) unlocks her, another locks her again */
  figure.addEventListener("click", function () { setOpen(!open); figure.dataset.cur = open ? "Lock" : "Unlock"; });
  figure.addEventListener("keydown", function (e) { if (e.key === "Escape" && open) figure.click(); });
  modes.forEach(function (b) {
    var go = function () { setMode(b.dataset.mode); };
    b.addEventListener("pointerenter", function (e) { if (e.pointerType === "mouse") go(); });
    b.addEventListener("click", go);
    b.addEventListener("focus", go);
  });

  hero.addEventListener("pointermove", function (e) {
    var r = hero.getBoundingClientRect(), c = canvas.getBoundingClientRect();
    var x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    glow.style.setProperty("--gx", (x * 100).toFixed(1) + "%");
    glow.style.setProperty("--gy", (y * 100).toFixed(1) + "%");
    inHero = true;
    S.tx = (e.clientX - c.left) / c.width;
    S.ty = 1 - (e.clientY - c.top) / c.height;
    if (fine && !calm) { S.ax = x * 2 - 1; S.ay = y * 2 - 1; }
  });
  hero.addEventListener("pointerleave", function () { inHero = false; S.ax = S.ay = 0; });

  var intro = !fine;                      // on touch screens she unlocks by herself after a moment in shadow
  watch(hero, function (seen) {
    heroSeen = seen;
    pace();
    wake();
    if (seen && intro) { intro = false; setTimeout(function () { if (!open) figure.click(); }, 1800); }
  }, 0.2);

  /* ---------- 2. shift: her office and her gym, split by a line that follows the cursor ---------- */
  /* She walks straight at the camera in the kit, cut out of a green-screen clip (picture on top,
     mask below, as in the hero). Left of the line is the office and she is lit cool and flat;
     right of it is the gym and she is lit warm with a red edge. The line runs through her too. */
  var shift = $(".shift");
  var stage = $(".shift__stage", shift);
  var walker = $(".walker", shift);
  var wCanvas = $("canvas", walker), wVid = $("video", walker);
  var range = $("input[type=range]", shift);
  var D = { want: 0.5, have: 0.5, seen: false, looping: false, touched: false, demo: null };

  function initWalker(cv) {
    var gl = null;
    try { gl = cv.getContext("webgl", { premultipliedAlpha: true, antialias: false }); } catch (e) {}
    if (!gl) return null;
    var vsrc = "attribute vec2 p;varying vec2 v;void main(){v=p*.5+.5;gl_Position=vec4(p,0.,1.);}";
    var fsrc = [
      "precision mediump float;",
      "varying vec2 v;",
      "uniform sampler2D t;",
      "uniform float d,asp;",       // the line, in canvas x (0..1); canvas height / width
      "float A(vec2 u){u=clamp(u,vec2(0.,.004),vec2(1.,.996));return texture2D(t,vec2(u.x,u.y*.5)).r;}",
      "vec3 C(vec2 u){u=clamp(u,vec2(0.,.004),vec2(1.,.996));return texture2D(t,vec2(u.x,.5+u.y*.5)).rgb;}",
      "float ring(vec2 u,float r){float s=0.;for(int i=0;i<12;i++){float a=float(i)*.5236;s+=A(u+vec2(cos(a)*r,sin(a)*r/asp));}return s/12.;}",
      "void main(){",
      "  float a=smoothstep(.08,.92,(A(v)*2.+A(v+vec2(.002,0.))+A(v-vec2(.002,0.))+A(v+vec2(0.,.0012))+A(v-vec2(0.,.0012)))/6.);",
      "  vec3 c=C(v);",
      "  float l=dot(c,vec3(.3,.6,.1));",
      "  float rim=clamp((a-ring(v,.007))*3.,0.,1.);",
      "  vec3 base=c*mix(.8,1.05,smoothstep(.1,.85,v.y));",                                                  // her own colours, a touch brighter
      "  vec3 office=mix(vec3(l),base,.85)*vec3(.95,.99,1.05)+vec3(.55,.75,1.)*rim*.12;",   // cool office light, pale blue edge
      "  vec3 gym=base*vec3(1.04,.99,.97)+vec3(1.,.12,.14)*rim*.55;",        // warm gym light, red edge
      "  float s=smoothstep(d-.01,d+.01,v.x);",
      "  vec3 col=mix(office,gym,s);",
      "  float seam=exp(-abs(v.x-d)*320.);",
      "  col+=vec3(1.,.55,.55)*seam*.45;",
      "  gl_FragColor=vec4(col*a,a);",
      "}"
    ].join("\n");
    function sh(type, src) { var x = gl.createShader(type); gl.shaderSource(x, src); gl.compileShader(x); return x; }
    var pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, vsrc));
    gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fsrc));
    gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return null;
    gl.useProgram(pr);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(pr, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER].forEach(function (k) { gl.texParameteri(gl.TEXTURE_2D, k, gl.LINEAR); });
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
    var uD = gl.getUniformLocation(pr, "d"), uA = gl.getUniformLocation(pr, "asp");
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    return function (video, d) {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var w = Math.round(cv.clientWidth * dpr), h = Math.round(cv.clientHeight * dpr);
      if (w && h && (cv.width !== w || cv.height !== h)) { cv.width = w; cv.height = h; gl.viewport(0, 0, w, h); }
      if (video.readyState >= 2) { try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video); } catch (e) {} }
      gl.uniform1f(uD, d);
      gl.uniform1f(uA, cv.height / Math.max(1, cv.width));
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };
  }
  var drawWalker = initWalker(wCanvas);
  if (!drawWalker) shift.classList.add("no-gl");

  function shiftFrame() {
    if (!D.seen) { D.looping = false; return; }
    requestAnimationFrame(shiftFrame);
    D.have += (D.want - D.have) * (calm ? 1 : 0.12);
    shift.style.setProperty("--d", D.have.toFixed(4));
    range.value = Math.round(D.have * 1000);
    if (drawWalker) {
      var s = stage.getBoundingClientRect(), c = wCanvas.getBoundingClientRect();
      drawWalker(wVid, (s.left + D.have * s.width - c.left) / Math.max(1, c.width));
    }
  }
  function shiftWake() { if (!D.looping && D.seen) { D.looping = true; requestAnimationFrame(shiftFrame); } }
  function mine() { D.touched = true; if (D.demo) { cancelAnimationFrame(D.demo); D.demo = null; } }

  if (fine) {
    stage.addEventListener("pointermove", function (e) {
      if (e.pointerType !== "mouse") return;
      mine();
      var r = stage.getBoundingClientRect();
      D.want = clamp((e.clientX - r.left) / r.width, 0, 1);
    });
  }
  range.addEventListener("input", function () { mine(); D.want = range.value / 1000; });

  watch(shift, function (seen) {
    D.seen = seen;
    if (seen) { if (!calm) play(wVid); shiftWake(); } else wVid.pause();
    /* the first time it comes into view, sweep the line across once so people see what it does */
    if (!seen || D.touched || D.demo || calm) return;
    var t0 = performance.now();
    (function sweep(t) {
      if (D.touched) return;
      var k = clamp((t - t0 - 300) / 3200, 0, 1);
      D.want = 0.5 + 0.38 * Math.sin(k * Math.PI * 2);
      D.demo = k < 1 ? requestAnimationFrame(sweep) : null;
      if (k === 1) D.touched = true;
    })(t0);
  }, 0.35);

  /* ---------- 3. kit: wipe to the second view ---------- */
  $$(".wipe").forEach(function (w) {
    var open = false;
    var set = function (pct, live) { w.classList.toggle("is-live", !!live); w.style.setProperty("--x", pct + "%"); };
    w.addEventListener("pointermove", function (e) {
      if (e.pointerType !== "mouse") return;
      var r = w.getBoundingClientRect();
      set(clamp(100 - ((e.clientX - r.left) / r.width) * 115, 0, 100), true);   // far right shows the whole second view
    });
    w.addEventListener("pointerleave", function (e) { if (e.pointerType === "mouse") set(100); });
    w.addEventListener("click", function () { if (fine) return; open = !open; set(open ? 0 : 100); });
    w.addEventListener("keydown", function (e) {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault(); open = !open; set(open ? 0 : 100);
    });
  });

  /* colour swatches swap the photo of the shorts */
  var shorts = $("#shorts"), toneName = $(".tones__name");
  var tones = $$(".tones button");
  function setTone(btn) {
    var tone = btn.dataset.tone;
    tones.forEach(function (t) { t.setAttribute("aria-checked", t === btn); });
    toneName.textContent = btn.getAttribute("aria-label");
    var cur = $("img:last-child", shorts);
    var src = "media/shorts-" + tone + "-" + cur.dataset.view + ".jpg";
    var next = new Image();
    next.onload = function () {               // fade the new colour in over the old one once it has loaded
      if (btn.getAttribute("aria-checked") !== "true") return;
      next.alt = cur.alt; next.dataset.view = cur.dataset.view;
      next.style.opacity = 0;
      shorts.appendChild(next);
      requestAnimationFrame(function () { requestAnimationFrame(function () { next.style.opacity = 1; }); });
      setTimeout(function () { $$("img", shorts).forEach(function (im) { if (im !== next) im.remove(); }); }, 500);
    };
    next.src = src;
  }
  tones.forEach(function (btn, i) {
    btn.addEventListener("click", function () { setTone(btn); });
    btn.addEventListener("keydown", function (e) {
      var d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (!d) return;
      var next = tones[(i + d + tones.length) % tones.length];
      next.focus(); setTone(next);
    });
  });

  /* ---------- 4. join: spotlight ---------- */
  var join = $(".join");
  var jv = $("video", join);
  var shade = $(".join__shade", join);
  watch(join, function (seen) { if (seen) play(jv); else jv.pause(); }, 0.2);
  join.addEventListener("pointermove", function (e) {
    var r = join.getBoundingClientRect();
    shade.style.setProperty("--sx", (((e.clientX - r.left) / r.width) * 100).toFixed(1) + "%");
    shade.style.setProperty("--sy", (((e.clientY - r.top) / r.height) * 100).toFixed(1) + "%");
  });

  /* the sign-up form is a mock on this concept page: nothing is sent anywhere */
  var form = $(".form"), note = $(".form__note");
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var input = $("input", form);
    note.textContent = input.checkValidity()
      ? "Concept page: sign-ups aren't switched on yet, so nothing was sent."
      : "Enter an email address like you@email.com.";
  });

  /* ---------- cursor label over the things that react ---------- */
  var cur = $(".cur");
  if (fine && cur) {
    var label = $("span", cur);
    document.addEventListener("pointermove", function (e) {
      cur.style.setProperty("--cx", e.clientX + "px");
      cur.style.setProperty("--cy", e.clientY + "px");
      var hit = e.target.closest ? e.target.closest("[data-cur]") : null;
      if (hit) label.textContent = hit.dataset.cur;
      cur.classList.toggle("is-on", !!hit);
    }, { passive: true });
    document.addEventListener("pointerleave", function () { cur.classList.remove("is-on"); });
  }
})();
