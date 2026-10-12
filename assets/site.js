(function () {
  'use strict';

  const CONFIG = {
    gridX: 160,
    gridY: 80,
    dotFillRatio: 0.11,
    dotMaxPx: 3.5,
    dotMinPx: 0.8,
    dotEdgeAApx: 1.0,
    color: '#1A1A1A',
    waveAmplitude: 0.92,
    waveLength: 1.0,
    idleCycleSeconds: 30,
    pitch: 1.22,
    yaw: 0.14,
    cameraDistance: 13.5,
    textFadeStart: 0.25,
    textFadeEnd: 0.55,
    hoverRadiusPx: 160,
    hoverLift: 1.0,
    hoverFollowSeconds: 0.18,
    hoverInSeconds: 0.25,
    hoverOutSeconds: 1.2,
    maxTiltDeg: 2.5,
    debugPointer: false,

    mobileBreakpoint: 900,
    mobileGridX: 70,
    mobileGridY: 36,
    reducedMotionCycleSeconds: 60,
    maxDevicePixelRatio: 2,
    maxDt: 0.05,
    hoverReferenceWidth: 1200,
    textFadeOpacity: 0.15,
    backgroundColor: '#F2F0EB',

    sheetWidth: 14.4,
    sheetDepth: 10.0,
    sheetSkew: 0.95,
    sheetCenterX: 0.45,
    sheetCenterY: 0.0,
    projectionScale: 1.95,
    projectionOffsetX: 0.10,
    projectionOffsetY: -0.02,

    wave1Amplitude: 0.57,
    wave1X: 0.43,
    wave1Y: 0.26,
    wave1Phase: -0.62,
    wave1Speed: 1.0,
    wave2Amplitude: 0.31,
    wave2X: -0.24,
    wave2Y: 0.47,
    wave2Phase: 1.35,
    wave2Speed: -0.72,
    wave3Amplitude: 0.16,
    wave3X: 0.17,
    wave3Y: 0.15,
    wave3Phase: 2.55,
    wave3Speed: 0.46,
    noiseAmplitude: 0.08,
    noiseScale: 0.17,
    noiseSpeedX: 0.08,
    noiseSpeedY: -0.05,

    opacityNear: 1.0,
    opacityFar: 0.025,
    farFadeStart: 0.38,
    farFadePower: 1.55,
    edgeFadeStart: 0.94,
    edgeFadeAmount: 0.42,
    rightFadeStart: 0.88,

    fallbackDotNearPx: 3.5,
    fallbackDotFarPx: 0.8
  };

  const revealObserver = 'IntersectionObserver' in window
    ? new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) entry.target.classList.add('visible');
        });
      }, { threshold: 0.12 })
    : null;

  document.querySelectorAll('.reveal').forEach(function (el) {
    if (revealObserver) revealObserver.observe(el);
    else el.classList.add('visible');
  });

  let canvas = document.getElementById('wave');
  if (!canvas) return;
  const hero = canvas.closest('.hero-webgl');
  if (!hero) return;

  function applyCanvasStyle(target) {
    Object.assign(target.style, {
      position: 'absolute',
      top: '0',
      height: '100%',
      zIndex: '1',
      pointerEvents: 'none'
    });
  }

  function replaceCanvasSurface() {
    const fresh = document.createElement('canvas');
    fresh.id = 'wave';
    fresh.setAttribute('aria-hidden', 'true');
    applyCanvasStyle(fresh);
    hero.replaceChild(fresh, canvas);
    canvas = fresh;
    return fresh;
  }

  applyCanvasStyle(canvas);


  const prefersReducedMotion = !!(
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
  const isMobile = window.innerWidth < CONFIG.mobileBreakpoint;
  const gridX = isMobile ? CONFIG.mobileGridX : CONFIG.gridX;
  const gridY = isMobile ? CONFIG.mobileGridY : CONFIG.gridY;
  const dotCount = gridX * gridY;
  const spacingX = CONFIG.sheetWidth / Math.max(1, gridX - 1);
  const spacingY = Math.hypot(
    CONFIG.sheetSkew / Math.max(1, gridX - 1),
    CONFIG.sheetDepth / Math.max(1, gridY - 1)
  );
  const dotDiameterWorld = Math.min(spacingX, spacingY) * CONFIG.dotFillRatio;

  let cssWidth = 1;
  let cssHeight = 1;
  let dpr = 1;
  let resizeRenderer = function () {};
  let rendererType = 'Canvas2D';
  let debugRing = null;

  const pointerTarget = { x: 0, y: 0 };
  const pointerSmooth = { x: 0, y: 0 };
  const tiltTarget = { x: 0, y: 0 };
  const tiltSmooth = { x: 0, y: 0 };
  let pointerInitialized = false;
  let hoverTarget = 0;
  let hoverStrength = 0;
  let activeTouchId = null;

  function expSmooth(current, target, timeConstant, dt) {
    const tc = Math.max(0.0001, timeConstant);
    const k = 1 - Math.exp(-dt / tc);
    return current + (target - current) * k;
  }

  function hexToRgb01(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [
      ((n >> 16) & 255) / 255,
      ((n >> 8) & 255) / 255,
      (n & 255) / 255
    ];
  }

  function setPointerFromEvent(event) {
    const rect = hero.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const x = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, event.clientY - rect.top));

    pointerTarget.x = x * dpr;
    pointerTarget.y = y * dpr;

    if (!pointerInitialized) {
      pointerSmooth.x = pointerTarget.x;
      pointerSmooth.y = pointerTarget.y;
      pointerInitialized = true;
    }

    if (!prefersReducedMotion) {
      tiltTarget.x = (x / Math.max(1, rect.width) - 0.5) * 2;
      tiltTarget.y = (y / Math.max(1, rect.height) - 0.5) * 2;
    }
  }

  hero.addEventListener('pointerenter', function (event) {
    setPointerFromEvent(event);
    if (event.pointerType !== 'touch') hoverTarget = 1;
  }, { passive: true });

  hero.addEventListener('pointermove', function (event) {
    if (event.pointerType === 'touch' && activeTouchId !== event.pointerId) return;
    setPointerFromEvent(event);
    if (event.pointerType !== 'touch') hoverTarget = 1;
  }, { passive: true });

  hero.addEventListener('pointerleave', function (event) {
    if (event.pointerType !== 'touch') {
      hoverTarget = 0;
      tiltTarget.x = 0;
      tiltTarget.y = 0;
    }
  }, { passive: true });

  hero.addEventListener('pointerdown', function (event) {
    if (event.pointerType === 'touch') {
      activeTouchId = event.pointerId;
      setPointerFromEvent(event);
      hoverTarget = 1;
    }
  }, { passive: true });

  function endTouch(event) {
    if (event.pointerType === 'touch' && (activeTouchId === null || event.pointerId === activeTouchId)) {
      activeTouchId = null;
      hoverTarget = 0;
      tiltTarget.x = 0;
      tiltTarget.y = 0;
    }
  }

  hero.addEventListener('pointerup', endTouch, { passive: true });
  hero.addEventListener('pointercancel', endTouch, { passive: true });

  if (CONFIG.debugPointer) {
    debugRing = document.createElement('div');
    Object.assign(debugRing.style, {
      position: 'absolute',
      width: '0',
      height: '0',
      border: '1px solid rgba(220, 0, 0, .9)',
      borderRadius: '50%',
      boxSizing: 'border-box',
      pointerEvents: 'none',
      transform: 'translate(-50%, -50%)',
      zIndex: '10'
    });
    hero.appendChild(debugRing);
  }

  function updateCanvasSize() {
    const heroRect = hero.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    cssWidth = Math.max(1, canvasRect.width);
    cssHeight = Math.max(1, heroRect.height);
    dpr = Math.min(window.devicePixelRatio || 1, CONFIG.maxDevicePixelRatio);
    const pixelWidth = Math.max(1, Math.round(cssWidth * dpr));
    const pixelHeight = Math.max(1, Math.round(cssHeight * dpr));

    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
      resizeRenderer(pixelWidth, pixelHeight);
    }

    if (!pointerInitialized) {
      pointerTarget.x = pointerSmooth.x = pixelWidth * 0.72;
      pointerTarget.y = pointerSmooth.y = pixelHeight * 0.56;
    }
  }

  const resizeObserver = 'ResizeObserver' in window
    ? new ResizeObserver(updateCanvasSize)
    : null;
  if (resizeObserver) resizeObserver.observe(hero);
  window.addEventListener('resize', updateCanvasSize, { passive: true });

  function createShader(gl, type, source, label) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader) || '(no shader log)';
      console.error('Valynce wave ' + label + ' shader compile failed:\n' + log + '\n\n' + source);
      gl.deleteShader(shader);
      throw new Error(label + ' shader compile failed: ' + log);
    }
    return shader;
  }

  function createProgram(gl, vertexSource, fragmentSource) {
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource, 'vertex');
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource, 'fragment');
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(program) || '(no program log)';
      console.error('Valynce wave program link failed:\n' + log);
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      throw new Error('program link failed: ' + log);
    }
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    return program;
  }

  function makeShaderSources(webgl2) {
    const header = webgl2 ? '#version 300 es\n' : '';
    const inKeyword = webgl2 ? 'in' : 'attribute';
    const outKeyword = webgl2 ? 'out' : 'varying';
    const fragInKeyword = webgl2 ? 'in' : 'varying';
    const fragOutDecl = webgl2 ? 'out vec4 outColor;\n' : '';
    const fragWrite = webgl2 ? 'outColor' : 'gl_FragColor';

    const vertex = `${header}
precision highp float;

${inKeyword} vec2 aCorner;
${inKeyword} vec3 aInstance;

uniform vec2 uViewportPx;
uniform vec2 uCursorPx;
uniform vec2 uTilt;
uniform float uTimePhase;
uniform float uHoverRadiusPx;
uniform float uHoverStrength;
uniform float uHoverLift;
uniform float uAspect;

${outKeyword} vec2 vLocal;
${outKeyword} float vAlpha;
${outKeyword} float vHover;
${outKeyword} float vDiameterPx;

const float PI = 3.141592653589793;

vec2 rotate2(vec2 v, float a) {
  float c = cos(a);
  float s = sin(a);
  return mat2(c, -s, s, c) * v;
}

vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }
float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                     -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1;
  i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
                  + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy),
                          dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

float terrain(vec2 p) {
  vec2 q = p * ${CONFIG.waveLength.toFixed(6)};
  float w1 = sin(q.x * ${CONFIG.wave1X.toFixed(6)} + q.y * ${CONFIG.wave1Y.toFixed(6)} + ${CONFIG.wave1Phase.toFixed(6)} + uTimePhase * ${CONFIG.wave1Speed.toFixed(6)}) * ${CONFIG.wave1Amplitude.toFixed(6)};
  float w2 = sin(q.x * ${CONFIG.wave2X.toFixed(6)} + q.y * ${CONFIG.wave2Y.toFixed(6)} + ${CONFIG.wave2Phase.toFixed(6)} + uTimePhase * ${CONFIG.wave2Speed.toFixed(6)}) * ${CONFIG.wave2Amplitude.toFixed(6)};
  float w3 = sin(q.x * ${CONFIG.wave3X.toFixed(6)} + q.y * ${CONFIG.wave3Y.toFixed(6)} + ${CONFIG.wave3Phase.toFixed(6)} + uTimePhase * ${CONFIG.wave3Speed.toFixed(6)}) * ${CONFIG.wave3Amplitude.toFixed(6)};
  vec2 nq = q * ${CONFIG.noiseScale.toFixed(6)} + vec2(uTimePhase * ${CONFIG.noiseSpeedX.toFixed(6)}, uTimePhase * ${CONFIG.noiseSpeedY.toFixed(6)});
  float n = snoise(nq) * ${CONFIG.noiseAmplitude.toFixed(6)};
  return (w1 + w2 + w3 + n) * ${CONFIG.waveAmplitude.toFixed(6)};
}

vec3 cameraPoint(vec3 p) {
  float yaw = ${CONFIG.yaw.toFixed(6)} + uTilt.x;
  float pitch = ${CONFIG.pitch.toFixed(6)} + uTilt.y;
  vec2 xy = rotate2(p.xy, yaw);
  vec2 yz = rotate2(vec2(xy.y, p.z), pitch);
  return vec3(xy.x, yz.x, yz.y);
}

vec2 projectNdc(vec3 p, out float depth) {
  vec3 c = cameraPoint(p);
  depth = max(2.0, ${CONFIG.cameraDistance.toFixed(6)} + c.z);
  vec2 ndc = vec2(c.x / depth / max(uAspect, 0.55), c.y / depth) * ${CONFIG.projectionScale.toFixed(6)};
  ndc += vec2(${CONFIG.projectionOffsetX.toFixed(6)}, ${CONFIG.projectionOffsetY.toFixed(6)});
  return ndc;
}

float smootherstep01(float x) {
  x = clamp(x, 0.0, 1.0);
  return x*x*x*(x*(x*6.0 - 15.0) + 10.0);
}

void main() {
  vec2 p = aInstance.xy;
  float h = terrain(p);
  vec3 center = vec3(p, h);

  float e = 0.025;
  float hx = terrain(p + vec2(e, 0.0));
  float hy = terrain(p + vec2(0.0, e));
  vec3 tangentX = normalize(vec3(1.0, 0.0, (hx - h) / e));
  vec3 tangentY0 = normalize(vec3(0.0, 1.0, (hy - h) / e));
  vec3 normal = normalize(cross(tangentX, tangentY0));
  vec3 tangentY = normalize(cross(normal, tangentX));

  float baseDepth;
  vec2 baseNdc = projectNdc(center, baseDepth);
  vec2 basePx = vec2(
    (baseNdc.x * 0.5 + 0.5) * uViewportPx.x,
    (1.0 - (baseNdc.y * 0.5 + 0.5)) * uViewportPx.y
  );

  // Keep hover selection in screen space, based on the undisturbed sheet.
  // Shift the influence center downward by the projected full lift so the
  // raised peak lands visually under the pointer instead of above it.
  float fullLiftDepth;
  vec2 fullLiftNdc = projectNdc(center + vec3(0.0, 0.0, uHoverLift * uHoverStrength), fullLiftDepth);
  vec2 fullLiftPx = vec2(
    (fullLiftNdc.x * 0.5 + 0.5) * uViewportPx.x,
    (1.0 - (fullLiftNdc.y * 0.5 + 0.5)) * uViewportPx.y
  );
  float projectedLiftPx = max(0.0, basePx.y - fullLiftPx.y);
  vec2 hoverCenterPx = uCursorPx + vec2(0.0, projectedLiftPx);

  float distPx = length(basePx - hoverCenterPx);
  float radial = 1.0 - clamp(distPx / max(1.0, uHoverRadiusPx), 0.0, 1.0);
  float hover = uHoverStrength * smootherstep01(radial);

  // Raise the actual fabric along its world-up axis. No camera-facing motion,
  // no dot growth, no spread and no color change.
  center.z += uHoverLift * hover;

  vec3 centerCam = cameraPoint(center);
  float depth = max(2.0, ${CONFIG.cameraDistance.toFixed(6)} + centerCam.z);
  vec2 ndc = vec2(centerCam.x / depth / max(uAspect, 0.55), centerCam.y / depth) * ${CONFIG.projectionScale.toFixed(6)};
  ndc += vec2(${CONFIG.projectionOffsetX.toFixed(6)}, ${CONFIG.projectionOffsetY.toFixed(6)});

  float pxPerWorld = (${CONFIG.projectionScale.toFixed(6)} / max(depth, 0.001)) * (uViewportPx.y * 0.5);
  float depthT = clamp(aInstance.z, 0.0, 1.0);
  float pxCap = mix(${CONFIG.dotMaxPx.toFixed(6)}, ${CONFIG.dotMinPx.toFixed(6)}, depthT);
  float diameter = min(${dotDiameterWorld.toFixed(8)}, pxCap / max(pxPerWorld, 0.001));

  vec3 worldOffset = (tangentX * aCorner.x + tangentY * aCorner.y) * (diameter * 0.5);
  vec3 offsetCam = cameraPoint(worldOffset);
  vec2 offsetNdc = vec2(offsetCam.x / depth / max(uAspect, 0.55), offsetCam.y / depth) * ${CONFIG.projectionScale.toFixed(6)};

  gl_Position = vec4(ndc + offsetNdc, 0.0, 1.0);

  float farT = smoothstep(${CONFIG.farFadeStart.toFixed(6)}, 1.0, depthT);
  float alpha = mix(${CONFIG.opacityNear.toFixed(6)}, ${CONFIG.opacityFar.toFixed(6)}, pow(farT, ${CONFIG.farFadePower.toFixed(6)}));
  float edgeT = smoothstep(${CONFIG.edgeFadeStart.toFixed(6)}, 1.0, abs(aInstance.x - ${CONFIG.sheetCenterX.toFixed(6)}) / (${(CONFIG.sheetWidth * 0.5).toFixed(6)}));
  alpha *= 1.0 - edgeT * ${CONFIG.edgeFadeAmount.toFixed(6)};

  vLocal = aCorner;
  vAlpha = alpha;
  vHover = hover;
  vDiameterPx = diameter * pxPerWorld;
}
`;

    const fragment = `${header}
precision mediump float;

${fragInKeyword} vec2 vLocal;
${fragInKeyword} float vAlpha;
${fragInKeyword} float vHover;
${fragInKeyword} float vDiameterPx;
uniform vec2 uViewportPx;
${fragOutDecl}

void main() {
  float r = length(vLocal);
  if (r > 1.0) discard;
  float aaLocal = clamp(2.0 * ${CONFIG.dotEdgeAApx.toFixed(6)} / max(vDiameterPx, 0.8), 0.08, 0.95);
  float edge = 1.0 - smoothstep(1.0 - aaLocal, 1.0, r);
  float screenX = gl_FragCoord.x / max(1.0, uViewportPx.x);
  float textFade = mix(${CONFIG.textFadeOpacity.toFixed(6)}, 1.0, smoothstep(${CONFIG.textFadeStart.toFixed(6)}, ${CONFIG.textFadeEnd.toFixed(6)}, screenX));
  float rightFade = 1.0 - smoothstep(${CONFIG.rightFadeStart.toFixed(6)}, 1.0, screenX);
  vec3 color = vec3(${hexToRgb01(CONFIG.color).map(function(v){ return v.toFixed(6); }).join(', ')});
  ${fragWrite} = vec4(color, vAlpha * textFade * rightFade * edge);
}
`;

    return { vertex: vertex, fragment: fragment };
  }

  function createWebGLRenderer(preferWebGL2) {
    let gl = null;
    let webgl2 = false;
    let instancingExt = null;

    if (preferWebGL2) {
      gl = canvas.getContext('webgl2', {
        alpha: true,
        antialias: true,
        depth: false,
        premultipliedAlpha: true,
        powerPreference: 'high-performance'
      });
      webgl2 = !!gl;
      if (!gl) throw new Error('WebGL2 unavailable');
    } else {
      gl = canvas.getContext('webgl', {
        alpha: true,
        antialias: true,
        depth: false,
        premultipliedAlpha: true,
        powerPreference: 'high-performance'
      });
      webgl2 = false;
      if (!gl) throw new Error('WebGL1 unavailable');
      instancingExt = gl.getExtension('ANGLE_instanced_arrays');
      if (!instancingExt) throw new Error('ANGLE_instanced_arrays unavailable');
    }

    const sources = makeShaderSources(webgl2);
    const program = createProgram(gl, sources.vertex, sources.fragment);
    gl.useProgram(program);

    const corners = new Float32Array([
      -1, -1,  1, -1,  1,  1,
      -1, -1,  1,  1, -1,  1
    ]);

    const instances = new Float32Array(dotCount * 3);
    let p = 0;
    for (let iy = 0; iy < gridY; iy++) {
      const v = iy / Math.max(1, gridY - 1);
      for (let ix = 0; ix < gridX; ix++) {
        const u = ix / Math.max(1, gridX - 1);
        instances[p++] = (u - 0.5) * CONFIG.sheetWidth + CONFIG.sheetCenterX;
        instances[p++] = (v - 0.5) * CONFIG.sheetDepth + (u - 0.5) * CONFIG.sheetSkew + CONFIG.sheetCenterY;
        instances[p++] = v;
      }
    }

    const cornerLoc = gl.getAttribLocation(program, 'aCorner');
    const instanceLoc = gl.getAttribLocation(program, 'aInstance');
    if (cornerLoc < 0 || instanceLoc < 0) throw new Error('required vertex attributes are missing');

    const cornerBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, cornerBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, corners, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(cornerLoc);
    gl.vertexAttribPointer(cornerLoc, 2, gl.FLOAT, false, 0, 0);

    const instanceBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, instances, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(instanceLoc);
    gl.vertexAttribPointer(instanceLoc, 3, gl.FLOAT, false, 0, 0);

    if (webgl2) {
      gl.vertexAttribDivisor(cornerLoc, 0);
      gl.vertexAttribDivisor(instanceLoc, 1);
    } else {
      instancingExt.vertexAttribDivisorANGLE(cornerLoc, 0);
      instancingExt.vertexAttribDivisorANGLE(instanceLoc, 1);
    }

    const uniformNames = [
      'uViewportPx', 'uCursorPx', 'uTilt', 'uTimePhase', 'uHoverRadiusPx',
      'uHoverStrength', 'uHoverLift', 'uAspect'
    ];
    const uniforms = {};
    uniformNames.forEach(function (name) {
      uniforms[name] = gl.getUniformLocation(program, name);
    });

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.DEPTH_TEST);
    gl.clearColor(0, 0, 0, 0);

    function resize(width, height) {
      gl.viewport(0, 0, width, height);
    }

    function render(state) {
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);
      gl.uniform2f(uniforms.uViewportPx, canvas.width, canvas.height);
      gl.uniform2f(uniforms.uCursorPx, state.cursorX, state.cursorY);
      gl.uniform2f(uniforms.uTilt, state.tiltX, state.tiltY);
      gl.uniform1f(uniforms.uTimePhase, state.phase);
      gl.uniform1f(uniforms.uHoverRadiusPx, state.hoverRadiusPx);
      gl.uniform1f(uniforms.uHoverStrength, state.hoverStrength);
      gl.uniform1f(uniforms.uHoverLift, CONFIG.hoverLift);
      gl.uniform1f(uniforms.uAspect, canvas.width / Math.max(1, canvas.height));

      if (webgl2) gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, dotCount);
      else instancingExt.drawArraysInstancedANGLE(gl.TRIANGLES, 0, 6, dotCount);
    }

    return {
      type: webgl2 ? 'WebGL2' : 'WebGL1',
      resize: resize,
      render: render
    };
  }

  function cpuTerrain(x, y, phase) {
    const qx = x * CONFIG.waveLength;
    const qy = y * CONFIG.waveLength;
    const w1 = Math.sin(qx * CONFIG.wave1X + qy * CONFIG.wave1Y + CONFIG.wave1Phase + phase * CONFIG.wave1Speed) * CONFIG.wave1Amplitude;
    const w2 = Math.sin(qx * CONFIG.wave2X + qy * CONFIG.wave2Y + CONFIG.wave2Phase + phase * CONFIG.wave2Speed) * CONFIG.wave2Amplitude;
    const w3 = Math.sin(qx * CONFIG.wave3X + qy * CONFIG.wave3Y + CONFIG.wave3Phase + phase * CONFIG.wave3Speed) * CONFIG.wave3Amplitude;
    return (w1 + w2 + w3) * CONFIG.waveAmplitude;
  }

  function cpuProject(x, y, z, tiltX, tiltY) {
    const yaw = CONFIG.yaw + tiltX;
    const pitch = CONFIG.pitch + tiltY;
    const cy = Math.cos(yaw);
    const sy = Math.sin(yaw);
    const xr = cy * x - sy * y;
    const yr = sy * x + cy * y;
    const cp = Math.cos(pitch);
    const sp = Math.sin(pitch);
    const y2 = cp * yr - sp * z;
    const z2 = sp * yr + cp * z;
    const depth = Math.max(2, CONFIG.cameraDistance + z2);
    const aspect = canvas.width / Math.max(1, canvas.height);
    const ndcX = xr / depth / Math.max(aspect, 0.55) * CONFIG.projectionScale + CONFIG.projectionOffsetX;
    const ndcY = y2 / depth * CONFIG.projectionScale + CONFIG.projectionOffsetY;
    return {
      x: (ndcX * 0.5 + 0.5) * canvas.width,
      y: (1 - (ndcY * 0.5 + 0.5)) * canvas.height,
      depth: depth
    };
  }

  function createCanvas2DRenderer() {
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) throw new Error('Canvas 2D unavailable');
    const rgb = CONFIG.color;

    function resize() {}

    function render(state) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      for (let iy = gridY - 1; iy >= 0; iy--) {
        const v = iy / Math.max(1, gridY - 1);
        const alphaFar = Math.pow(Math.max(0, (v - CONFIG.farFadeStart) / Math.max(0.001, 1 - CONFIG.farFadeStart)), CONFIG.farFadePower);
        const distanceAlpha = CONFIG.opacityNear + (CONFIG.opacityFar - CONFIG.opacityNear) * alphaFar;
        for (let ix = 0; ix < gridX; ix++) {
          const u = ix / Math.max(1, gridX - 1);
          const x = (u - 0.5) * CONFIG.sheetWidth + CONFIG.sheetCenterX;
          const y = (v - 0.5) * CONFIG.sheetDepth + (u - 0.5) * CONFIG.sheetSkew + CONFIG.sheetCenterY;
          const z0 = cpuTerrain(x, y, state.phase);
          const pr0 = cpuProject(x, y, z0, state.tiltX, state.tiltY);
          const prFullLift = cpuProject(x, y, z0 + CONFIG.hoverLift * state.hoverStrength, state.tiltX, state.tiltY);
          const projectedLiftPx = Math.max(0, pr0.y - prFullLift.y);
          const dx = pr0.x - state.cursorX;
          const dy = pr0.y - (state.cursorY + projectedLiftPx);
          const dist = Math.hypot(dx, dy);
          const q = Math.max(0, 1 - dist / Math.max(1, state.hoverRadiusPx));
          const hover = state.hoverStrength * q*q*q*(q*(q*6 - 15) + 10);
          const pr = cpuProject(x, y, z0 + CONFIG.hoverLift * hover, state.tiltX, state.tiltY);
          const diameterPx = (1 - v) * CONFIG.dotMaxPx + v * CONFIG.dotMinPx;
          const radius = Math.max(0.4, diameterPx * dpr * 0.5);
          const screenX = pr.x / Math.max(1, canvas.width);
          const fadeT = Math.max(0, Math.min(1, (screenX - CONFIG.textFadeStart) / Math.max(0.001, CONFIG.textFadeEnd - CONFIG.textFadeStart)));
          const fade = fadeT * fadeT * (3 - 2 * fadeT);
          const textAlpha = CONFIG.textFadeOpacity + (1 - CONFIG.textFadeOpacity) * fade;
          const rightT = Math.max(0, Math.min(1, (screenX - CONFIG.rightFadeStart) / Math.max(0.001, 1 - CONFIG.rightFadeStart)));
          const rightSmooth = rightT * rightT * (3 - 2 * rightT);
          const rightAlpha = 1 - rightSmooth;
          ctx.globalAlpha = distanceAlpha * textAlpha * rightAlpha;
          ctx.fillStyle = rgb;
          ctx.beginPath();
          ctx.arc(pr.x, pr.y, Math.max(0.5, radius), 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }

    return { type: 'Canvas2D', resize: resize, render: render };
  }

  let renderer = null;

  updateCanvasSize();

  try {
    renderer = createWebGLRenderer(true);
  } catch (webgl2Error) {
    console.error('Valynce wave WebGL2 setup failed.', webgl2Error);
    replaceCanvasSurface();
    updateCanvasSize();
    try {
      renderer = createWebGLRenderer(false);
    } catch (webgl1Error) {
      console.error('Valynce wave WebGL1 setup failed.', webgl1Error);
      replaceCanvasSurface();
      updateCanvasSize();
      try {
        renderer = createCanvas2DRenderer();
      } catch (fallbackError) {
        console.error('Valynce wave Canvas 2D fallback failed.', fallbackError);
        return;
      }
    }
  }

  rendererType = renderer.type;
  resizeRenderer = renderer.resize;
  updateCanvasSize();
  console.log('Valynce wave: ' + rendererType + ' | dots: ' + dotCount);

  const startTime = performance.now();
  let previousTime = startTime;

  function frame(now) {
    try {
      updateCanvasSize();
      const dt = Math.min(CONFIG.maxDt, Math.max(0, (now - previousTime) / 1000));
      previousTime = now;

      pointerSmooth.x = expSmooth(pointerSmooth.x, pointerTarget.x, CONFIG.hoverFollowSeconds, dt);
      pointerSmooth.y = expSmooth(pointerSmooth.y, pointerTarget.y, CONFIG.hoverFollowSeconds, dt);

      const hoverTc = hoverTarget > hoverStrength ? CONFIG.hoverInSeconds : CONFIG.hoverOutSeconds;
      hoverStrength = expSmooth(hoverStrength, hoverTarget, hoverTc, dt);

      if (prefersReducedMotion) {
        tiltSmooth.x = 0;
        tiltSmooth.y = 0;
      } else {
        tiltSmooth.x = expSmooth(tiltSmooth.x, tiltTarget.x, CONFIG.hoverFollowSeconds, dt);
        tiltSmooth.y = expSmooth(tiltSmooth.y, tiltTarget.y, CONFIG.hoverFollowSeconds, dt);
      }

      const cycleSeconds = prefersReducedMotion ? CONFIG.reducedMotionCycleSeconds : CONFIG.idleCycleSeconds;
      const phase = ((now - startTime) / 1000) / cycleSeconds * Math.PI * 2;
      const widthScale = Math.min(1, cssWidth / CONFIG.hoverReferenceWidth);
      const hoverRadiusPx = CONFIG.hoverRadiusPx * widthScale * dpr;
      const effectiveHover = hoverStrength * (prefersReducedMotion ? 0.5 : 1);
      const maxTilt = CONFIG.maxTiltDeg * Math.PI / 180;

      renderer.render({
        phase: phase,
        cursorX: pointerSmooth.x,
        cursorY: pointerSmooth.y,
        hoverRadiusPx: hoverRadiusPx,
        hoverStrength: effectiveHover,
        tiltX: prefersReducedMotion ? 0 : tiltSmooth.x * maxTilt,
        tiltY: prefersReducedMotion ? 0 : tiltSmooth.y * maxTilt
      });

      if (debugRing) {
        debugRing.style.left = (pointerSmooth.x / dpr) + 'px';
        debugRing.style.top = (pointerSmooth.y / dpr) + 'px';
        debugRing.style.width = debugRing.style.height = (hoverRadiusPx * 2 / dpr) + 'px';
        debugRing.style.display = hoverStrength > 0.001 ? 'block' : 'none';
      }
    } catch (error) {
      console.error('Valynce wave frame error:', error);
    } finally {
      requestAnimationFrame(frame);
    }
  }

  requestAnimationFrame(frame);
})();
