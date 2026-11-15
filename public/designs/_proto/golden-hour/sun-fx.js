/*
 * The sun as a lens sees it: a glow that spills over what's near it (bloom),
 * shafts of light breaking around the gold names (screen-space light rays
 * toward the sun), a lens flare, and a few soft clouds lit from the sun's
 * side. All drawn live; nothing here is a picture.
 */
import * as THREE from "three";
import { EffectComposer } from "./vendor/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "./vendor/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "./vendor/jsm/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "./vendor/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "./vendor/jsm/postprocessing/OutputPass.js";
import { Lensflare, LensflareElement } from "./vendor/jsm/objects/Lensflare.js";

/* ------------------------------ light rays ------------------------------ */

/* light marched from each pixel toward the sun: bright sky leaks through the gaps between the letters */
const RayShader = {
  uniforms: {
    tDiffuse: { value: null },
    tOcc: { value: null },
    sunUv: { value: new THREE.Vector2(0.5, 0.5) },
    strength: { value: 0 },
    threshold: { value: 1.2 },
    decay: { value: 0.955 },
    density: { value: 0.9 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    #define SAMPLES __SAMPLES__
    uniform sampler2D tDiffuse;
    uniform sampler2D tOcc;
    uniform vec2 sunUv;
    uniform float strength, threshold, decay, density;
    varying vec2 vUv;
    void main() {
      vec3 base = texture2D(tDiffuse, vUv).rgb;
      if (strength <= 0.001) { gl_FragColor = vec4(base, 1.0); return; }
      vec2 delta = (vUv - sunUv) * density / float(SAMPLES);
      vec2 uv = vUv;
      float illum = 1.0;
      vec3 acc = vec3(0.0);
      for (int i = 0; i < SAMPLES; i++) {
        uv -= delta;
        vec3 s = texture2D(tOcc, clamp(uv, 0.001, 0.999)).rgb;
        float l = max(dot(s, vec3(0.299, 0.587, 0.114)) - threshold, 0.0);
        acc += s * min(l, 4.0) * illum;
        illum *= decay;
      }
      gl_FragColor = vec4(base + acc * strength / float(SAMPLES), 1.0);
    }`,
};

/* ------------------------------ textures drawn in code ------------------------------ */

function canvasTex(w, h, draw) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const radial = (stops) => canvasTex(256, 256, (g) => {
  const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  stops.forEach(([o, c]) => gr.addColorStop(o, c));
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
});

/** soft cumulus, from layered value noise: light on top, a little shade underneath, flat-ish base */
function cloudTexture(seed) {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const N = 64, grid = Array.from({ length: N * N }, rnd);
  const at = (x, y) => grid[((y % N + N) % N) * N + ((x % N + N) % N)];
  const smooth = (t) => t * t * (3 - 2 * t);
  const noise = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = smooth(x - xi), yf = smooth(y - yi);
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
  };
  return canvasTex(256, 128, (g, w, h) => {
    const img = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let v = 0, amp = 0.55, f = 1 / 24;
      for (let o = 0; o < 5; o++) { v += noise(x * f, y * f * 1.6) * amp; amp *= 0.5; f *= 2; }
      const nx = (x / w - 0.5) * 2, ny = (y / h - 0.62) * 2.4;
      const shape = 1 - Math.min(1, nx * nx + Math.max(ny, -0.6) * Math.max(ny, -0.6) * 1.4); // a lens of cloud, flatter below
      const a = Math.max(0, Math.min(1, (v * shape - 0.28) * 3.2));
      const lit = 1 - (y / h) * 0.35; // lighter on top
      const i = (y * w + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255 * lit;
      img.data[i + 3] = 255 * a;
    }
    g.putImageData(img, 0, 0);
  });
}

/* ------------------------------ the whole thing ------------------------------ */

export function createSunFx({ renderer, scene, camera, mobile, dirOf, sunMin, SUNRISE, SUNSET, D2R, occluders, hidden }) {
  /* the light rays are traced through a second, small view of the scene where the names are solid black and the sea is
     hidden, and so is the sky: only the sun shines in it, so light streams from the sun alone, through the gaps between
     the letters, the way sunlight breaks around an object */
  const occTarget = new THREE.WebGLRenderTarget(256, 256, { type: THREE.HalfFloatType });
  const black = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const swapped = new Map();
  function renderOcclusion() {
    occluders.forEach((g) => g.traverse((o) => { if (o.isMesh) { swapped.set(o, o.material); o.material = black; } }));
    const off = [...hidden, clouds];
    const was = off.map((o) => o.visible);
    off.forEach((o) => { o.visible = false; });
    const bg = scene.background;
    scene.background = null;
    const env = scene.environment;
    renderer.setRenderTarget(occTarget);
    renderer.clear();
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    scene.environment = env;
    scene.background = bg;
    off.forEach((o, i) => { o.visible = was[i]; });
    swapped.forEach((m, o) => { o.material = m; });
    swapped.clear();
  }
  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.addPass(new RenderPass(scene, camera));

  const rays = new ShaderPass({ ...RayShader, fragmentShader: RayShader.fragmentShader.replace("__SAMPLES__", mobile ? "26" : "40") });
  rays.uniforms.tOcc.value = occTarget.texture;
  composer.addPass(rays);
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.65, 1.15);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  /* the flare: a chain of soft circles and rings across the screen, on a light at the sun */
  const flareLight = new THREE.PointLight(0xffffff, 0, 1);
  const flare = new Lensflare();
  const ring = radial([[0, "rgba(255,255,255,0)"], [0.78, "rgba(255,255,255,0)"], [0.86, "rgba(255,240,215,.55)"], [0.94, "rgba(255,255,255,0)"], [1, "rgba(255,255,255,0)"]]);
  const disc = radial([[0, "rgba(255,245,225,.55)"], [0.7, "rgba(255,230,200,.25)"], [1, "rgba(255,230,200,0)"]]);
  // faint and small: a hint of a lens, never a light show
  [[disc, 34, 0.32, 0.22], [ring, 70, 0.5, 0.12], [disc, 22, 0.66, 0.18], [disc, 56, 0.9, 0.1]]
    .forEach(([t, size, dist, k]) => flare.addElement(new LensflareElement(t, size, dist, new THREE.Color(k, k * 0.86, k * 0.7))));
  flareLight.add(flare);
  scene.add(flareLight);

  /* clouds near where the sun rises and sets, lit pink and gold from below (none at midday: the sky is clear) */
  const clouds = new THREE.Group();
  scene.add(clouds);
  const sunAzAt = (m) => sunMin(m).az;
  const placements = [
    [SUNRISE + 10, -18, 4, 1500], [SUNRISE + 10, 22, 7, 1100], [SUNRISE + 60, -35, 12, 900],
    [SUNSET - 10, 20, 5, 1600], [SUNSET - 10, -25, 9, 1100], [SUNSET - 70, 35, 13, 900],
  ];
  placements.forEach(([m, dAz, alt, size], k) => {
    const mat = new THREE.SpriteMaterial({ map: cloudTexture(1234 + k * 977), transparent: true, depthWrite: false, opacity: 0.9, fog: false });
    const sp = new THREE.Sprite(mat);
    sp.position.copy(dirOf(alt * D2R, sunAzAt(m) + dAz * D2R)).multiplyScalar(3900);
    sp.scale.set(size, size * 0.42, 1);
    clouds.add(sp);
  });

  const sunWorld = new THREE.Vector3();
  const ndc = new THREE.Vector3();
  let quality = 1; // drops on a phone that can't keep up
  /* tuned by eye: strong enough to feel the sun, never enough to wash out the words */
  const T = { rays: 1.4, rayThreshold: 0.12, bloom: 0.5, bloomThreshold: 5 };

  return {
    render() { if (rays.uniforms.strength.value > 0.001) renderOcclusion(); composer.render(); },
    setSize(w, h) {
      composer.setSize(w, h);
      bloom.resolution.set(w / 2, h / 2);
      const pr = renderer.getPixelRatio() * (mobile ? 0.4 : 0.5);
      occTarget.setSize(Math.round(w * pr), Math.round(h * pr));
    },
    /** follow the sun: rays and flare strongest low in the sky and on screen; clouds take its colour */
    update(sunDir, sunAlt, low, flareBoost) {
      sunWorld.copy(sunDir).multiplyScalar(4000);
      flareLight.position.copy(sunWorld);
      ndc.copy(sunWorld).project(camera);
      const onScreen = ndc.z < 1 && Math.abs(ndc.x) < 1.3 && Math.abs(ndc.y) < 1.3;
      rays.uniforms.sunUv.value.set((ndc.x + 1) / 2, (ndc.y + 1) / 2);
      const edge = onScreen ? 1 - THREE.MathUtils.smoothstep(Math.max(Math.abs(ndc.x), Math.abs(ndc.y)), 0.7, 1.3) : 0;
      rays.uniforms.strength.value = quality * edge * T.rays * (0.6 + low * 0.4);
      rays.uniforms.threshold.value = T.rayThreshold;
      bloom.strength = T.bloom + flareBoost * 0.5;
      bloom.threshold = T.bloomThreshold;
      flare.visible = onScreen && quality > 0.5;
      // clouds: white at midday, peach and rose underneath when the sun is low
      clouds.children.forEach((c) => {
        // brighter than the sky behind them, as clouds in sunlight are: white high noon, peach and rose when low
        const k = 2.6 - low * 0.9;
        c.material.color.setRGB(k, k * (0.95 - low * 0.14), k * (0.9 - low * 0.3));
        c.material.opacity = 0.7 + low * 0.2;
      });
    },
    tune: T,
    clouds,
    lowerQuality() { quality = 0.35; composer.setPixelRatio(1); },
  };
}
