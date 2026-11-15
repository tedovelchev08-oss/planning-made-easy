/*
 * Golden Hour (prototype). The invitation is the couple's wedding day, told
 * through the sun. Everything on screen is drawn live: a physically based
 * sky (three.js Sky: Rayleigh and Mie scattering), a sea that reflects it,
 * the couple's names cast in gold and lit by the sun, and the sun's real
 * path across the sky that day, with each moment of the day placed on it.
 * The sun's position comes from the date, the time and the venue's latitude
 * and longitude. Scrolling walks through the day and stops at golden hour,
 * before the sun goes down.
 */
import * as THREE from "three";
import { Sky } from "./vendor/Sky.js";
import { Water } from "./vendor/Water.js";
import { FontLoader } from "./vendor/FontLoader.js";
import { TextGeometry } from "./vendor/TextGeometry.js";

/* the couple's details: in the real design these come from the planner */
const WEDDING = {
  names: ["Maya", "Theo"],
  date: "2027-09-02",
  utcOffset: 2, // Europe/Rome in September
  lat: 40.6496, lon: 14.6118, // Villa Cimbrone, Ravello
  place: "Ravello",
};

/* ?skip=1 jumps the opening (for checking; reduced motion does the same for guests who ask for it) */
const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches || new URLSearchParams(location.search).has("skip");
const $ = (id) => document.getElementById(id);
const D2R = Math.PI / 180;

/* ------------------------------ the sun ------------------------------ */

/** the sun's altitude and azimuth (radians; azimuth from north, clockwise) at a moment, for a place */
function sunAt(ms, lat, lon) {
  const d = ms / 86400000 - 10957.5; // days since J2000.0
  const g = (357.529 + 0.98560028 * d) * D2R;
  const q = 280.459 + 0.98564736 * d;
  const L = (q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * D2R;
  const e = (23.439 - 0.00000036 * d) * D2R;
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L));
  const dec = Math.asin(Math.sin(e) * Math.sin(L));
  const gmst = (18.697374558 + 24.06570982441908 * d) % 24;
  const H = (gmst * 15 + lon) * D2R - ra;
  const phi = lat * D2R;
  const alt = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
  const azSouth = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi));
  return { alt, az: azSouth + Math.PI };
}

/** minutes after local midnight on the wedding day -> UTC milliseconds */
const at = (minutes) => Date.parse(`${WEDDING.date}T00:00:00Z`) + (minutes - WEDDING.utcOffset * 60) * 60000;
const sunMin = (minutes) => sunAt(at(minutes), WEDDING.lat, WEDDING.lon);

/** a direction in the world: north is -z, east is +x, up is +y */
const dirOf = (alt, az, out = new THREE.Vector3()) => out.set(Math.cos(alt) * Math.sin(az), Math.sin(alt), -Math.cos(alt) * Math.cos(az));

/** sunrise and sunset (the sun's upper edge on the horizon), to the minute */
function riseAndSet() {
  const limb = -0.833 * D2R;
  let rise = null, set = null;
  for (let m = 0; m < 1440; m++) {
    const a = sunMin(m).alt, b = sunMin(m + 1).alt;
    if (rise === null && a < limb && b >= limb) rise = m + 1;
    if (a >= limb && b < limb) set = m;
  }
  return { rise, set };
}
const { rise: SUNRISE, set: SUNSET } = riseAndSet();
const hhmm = (m) => { const r = Math.round(m); return `${String(Math.floor(r / 60)).padStart(2, "0")}:${String(r % 60).padStart(2, "0")}`; };

document.querySelectorAll("[data-sunrise]").forEach((el) => { el.textContent = hhmm(SUNRISE); });
document.querySelectorAll("[data-sunset]").forEach((el) => { el.textContent = hhmm(SUNSET); });

/* each section of the page is a moment of the day */
const GOLDEN = SUNSET - 13; // golden hour, still bright: never night
function minutesOf(tag) {
  if (tag === "hero") return SUNRISE + 22;
  if (tag === "sunset") return SUNSET - 4;
  if (tag === "golden") return GOLDEN;
  const [h, m] = tag.split(":").map(Number);
  return h * 60 + m;
}
/* the moments that sit on the sun's path */
const MOMENTS = [...document.querySelectorAll(".gh-moment")].map((el) => minutesOf(el.dataset.at));

/* ------------------------------ the scene ------------------------------ */

const canvas = $("gh-sky");
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
} catch {
  document.documentElement.classList.add("gh-no-webgl", "gh-risen");
  throw new Error("no WebGL: the still sky stands in");
}
const mobile = Math.min(window.innerWidth, window.innerHeight) < 700;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1.6 : 2));
renderer.toneMapping = THREE.NeutralToneMapping; // keeps the blue of a midday sky
renderer.toneMappingExposure = 0.5;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, 1, 1, 20000);
/* the camera and the names turn together to face the sun; the sky, the sea and the sun's path stay true to the compass */
const rig = new THREE.Group();
rig.add(camera);
scene.add(rig);

const sky = new Sky();
sky.scale.setScalar(10000);
const su = sky.material.uniforms;
su.mieDirectionalG.value = 0.86;
scene.add(sky);

/* the sea: clear Mediterranean blue, fine calm ripples, a clean reflection */
const water = new Water(new THREE.PlaneGeometry(10000, 10000), {
  textureWidth: mobile ? 512 : 1024,
  textureHeight: mobile ? 512 : 1024,
  waterNormals: new THREE.TextureLoader().load("assets/waternormals.jpg", (t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; }),
  sunDirection: new THREE.Vector3(),
  sunColor: 0xfff4dc,
  waterColor: 0x0d6e93,
  distortionScale: 0.9,
  fog: false,
});
water.material.uniforms.size.value = 3.2;
/* the sea's own colour: a clear turquoise-to-sapphire glaze over the reflected sky, stronger at midday
   (a pale midday sky would otherwise reflect as grey) and lighter at the golden ends of the day */
water.material.uniforms.seaTint = { value: new THREE.Color(0x2a9fc4) };
water.material.uniforms.seaMix = { value: 0.5 };
water.material.fragmentShader = water.material.fragmentShader
  .replace("uniform float alpha;", "uniform float alpha;\nuniform vec3 seaTint;\nuniform float seaMix;")
  .replace("vec3 outgoingLight = albedo;", "vec3 outgoingLight = mix( albedo, albedo * seaTint * 1.9, seaMix );");
water.material.needsUpdate = true;
water.rotation.x = -Math.PI / 2;
scene.add(water);

/* the sky lights the gold: an environment map made from the sky, refreshed as the sun moves */
const pmrem = new THREE.PMREMGenerator(renderer);
const envScene = new THREE.Scene();
let envTarget = null, envSunKey = "", envAt = -1e9;
function refreshEnvironment(force = false) {
  const key = sunDir.toArray().map((v) => v.toFixed(2)).join(",");
  if (key === envSunKey) return;
  const now = performance.now();
  if (!force && now - envAt < 250) return; // a few milliseconds each: at most four times a second
  envAt = now;
  envSunKey = key;
  envScene.add(sky);
  if (envTarget) envTarget.dispose();
  envTarget = pmrem.fromScene(envScene);
  scene.add(sky);
  scene.environment = envTarget.texture;
}

const sunLight = new THREE.DirectionalLight(0xfff0d8, 2.2);
scene.add(sunLight);
/* metal facing the viewer mirrors the sky behind them: a warm fill from the viewer's side, as a photographer would bounce it */
const fill = new THREE.DirectionalLight(0xffe2b0, 2.2);
fill.position.set(-6, 10, 30);
rig.add(fill);
scene.add(new THREE.HemisphereLight(0xfff3dc, 0x5d8fb0, 0.8));

/* ------------------------------ the sun's glow ------------------------------ */

/** a soft radial light, drawn once into a small canvas */
function glowTexture(stops) {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  stops.forEach(([o, col]) => grad.addColorStop(o, col));
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const glowMat = (tex, opacity) => new THREE.SpriteMaterial({ map: tex, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
const SKY_R = 4200;
const sunCore = new THREE.Sprite(glowMat(glowTexture([[0, "rgba(255,253,245,1)"], [0.18, "rgba(255,246,222,.95)"], [0.32, "rgba(255,214,150,.35)"], [1, "rgba(255,190,110,0)"]]), 1));
const sunHalo = new THREE.Sprite(glowMat(glowTexture([[0, "rgba(255,226,170,.55)"], [0.35, "rgba(255,196,120,.18)"], [1, "rgba(255,170,90,0)"]]), 0.9));
sunCore.scale.setScalar(520);
sunHalo.scale.setScalar(2600);
scene.add(sunHalo, sunCore);

/* ------------------------------ the sun's path ------------------------------ */

/* the line the sun really draws across the sky that day, from sunrise to sunset, and a point of light at each moment */
const pathGroup = new THREE.Group();
scene.add(pathGroup);
const pathMat = new THREE.MeshBasicMaterial({ color: 0xfff1cc, transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
{
  const pts = [];
  for (let m = SUNRISE; m <= SUNSET; m += 3) {
    const { alt, az } = sunMin(m);
    if (alt > -0.3 * D2R) pts.push(dirOf(alt, az).multiplyScalar(SKY_R - 40));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  pathGroup.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 400, 6, 6, false), pathMat));
}
const beadTex = glowTexture([[0, "rgba(255,252,240,1)"], [0.22, "rgba(255,236,190,.9)"], [0.45, "rgba(255,210,140,.25)"], [1, "rgba(255,200,120,0)"]]);
const beads = MOMENTS.map((m) => {
  const { alt, az } = sunMin(m);
  const s = new THREE.Sprite(glowMat(beadTex, 0));
  s.position.copy(dirOf(alt, az).multiplyScalar(SKY_R - 60));
  s.scale.setScalar(150);
  s.userData.minutes = m;
  pathGroup.add(s);
  return s;
});
let pathShow = 0; // fades in once the day has begun

/* ------------------------------ the names, in gold ------------------------------ */

const gold = new THREE.MeshPhysicalMaterial({
  color: 0xf5c869, metalness: 1, roughness: 0.24, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.7,
});
const names = new THREE.Group();
rig.add(names);

new FontLoader().load("assets/cormorant-light.typeface.json", (font) => {
  const opts = (size) => ({ font, size, depth: size * 0.12, curveSegments: 12, bevelEnabled: true, bevelThickness: size * 0.02, bevelSize: size * 0.012, bevelSegments: 5 });
  const line = (text, size) => {
    const g = new TextGeometry(text, opts(size));
    g.computeBoundingBox();
    g.translate(-(g.boundingBox.max.x + g.boundingBox.min.x) / 2, 0, 0);
    return new THREE.Mesh(g, gold);
  };
  const a = line(WEDDING.names[0], 3.2);
  const amp = line("&", 1.4);
  const b = line(WEDDING.names[1], 3.2);
  // the ampersand sits in its own space between the names, set slightly forward so it catches the light
  a.position.y = 4.2;
  amp.position.set(0, 2.55, 0.4);
  b.position.y = 0;
  names.add(a, amp, b);
  fitNames();
});

const CAM = { y: 3.2, z: 26, lookY: 4.4 };
/** the names fill the width of a phone, with a margin, and never more than a laptop needs */
function fitNames() {
  if (!names.children.length) return;
  const s = names.scale.x;
  names.scale.setScalar(1);
  names.updateMatrixWorld(true);
  const box = new THREE.Box3();
  names.children.forEach((m) => { m.geometry.computeBoundingBox(); box.union(m.geometry.boundingBox.clone().translate(m.position)); });
  names.scale.setScalar(s);
  const width = box.max.x - box.min.x;
  const viewW = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * CAM.z * camera.aspect;
  names.scale.setScalar(Math.min(1.35, (viewW * 0.78) / width));
}

/* ------------------------------ time of day ------------------------------ */

const sunDir = new THREE.Vector3();
let shownMinutes = SUNRISE + 1; // before the tap: the sun just touching the sea, the sky already glowing (never dark)
let targetMinutes = shownMinutes;
let risen = false;
let namesRise = 0; // 0 under the sea, 1 in place
let sunAlt = 0, sunAz = 0;

function placeSun(minutes) {
  ({ alt: sunAlt, az: sunAz } = sunMin(minutes));
  dirOf(sunAlt, sunAz, sunDir);
  su.sunPosition.value.copy(sunDir);
  water.material.uniforms.sunDirection.value.copy(sunDir);
  sunLight.position.copy(sunDir).multiplyScalar(100);
  sunCore.position.copy(sunDir).multiplyScalar(SKY_R - 80);
  sunHalo.position.copy(sunDir).multiplyScalar(SKY_R - 100);

  // clear Mediterranean air at midday (deep blue), warm haze as the sun gets low
  const low = 1 - THREE.MathUtils.clamp(sunAlt / (25 * D2R), 0, 1);
  su.rayleigh.value = 3.2 - low * 0.6;
  su.turbidity.value = 0.9 + low * 5.5;
  su.mieCoefficient.value = 0.0015 + low * 0.0055;
  // a sun right on the horizon needs more exposure to stay luminous, as a camera would give it
  renderer.toneMappingExposure = 0.33 + Math.pow(low, 3) * 0.72;
  // the glow: warm and wide near the horizon, small and white high up
  sunHalo.material.color.setRGB(1, 0.86 + (1 - low) * 0.14, 0.7 + (1 - low) * 0.3);
  sunHalo.userData.size = 1800 + low * 1600;
  sunCore.scale.setScalar(360 + low * 260);
  water.material.uniforms.seaMix.value = 0.22 + (1 - low) * 0.5;
  refreshEnvironment();

  beads.forEach((b) => { b.userData.near = Math.abs(b.userData.minutes - minutes) < 20; });

  const altDeg = sunAlt / D2R;
  $("gh-time").textContent = hhmm(minutes);
  $("gh-sunline").textContent = altDeg < 0.6
    ? (minutes < 720 ? `sunrise over ${WEDDING.place}` : `sunset over ${WEDDING.place}`)
    : `the sun ${Math.round(altDeg)}° above ${WEDDING.place}`;
}

/* ------------------------------ scrolling ------------------------------ */

const sections = [...document.querySelectorAll(".gh-sec")];
let lift = 0, liftTarget = 0; // 0: low at the names; 1: looking up along the sun's path; negative: the names lifted above the reply
function onScroll() {
  // scrolling always works: scrolling before the tap starts the day too
  if (!risen) { if (window.scrollY > 30) rise(); return; }
  // the moment follows the words being read, about the middle of the screen; at the very top it is the opening
  const lead = window.innerHeight * 0.45;
  const anchor = window.scrollY + lead;
  let i = 0;
  sections.forEach((s, k) => { if (s.offsetTop <= anchor) i = k; });
  const cur = sections[i], next = sections[i + 1];
  const t0 = minutesOf(cur.dataset.at);
  const f = !next ? 0 : i === 0
    ? THREE.MathUtils.clamp(window.scrollY / (next.offsetTop - lead), 0, 1)
    : THREE.MathUtils.clamp((anchor - cur.offsetTop) / (next.offsetTop - cur.offsetTop), 0, 1);
  targetMinutes = next ? THREE.MathUtils.lerp(t0, minutesOf(next.dataset.at), f) : t0;
  const last = sections.length - 1;
  liftTarget = i === 0 ? f : i === last ? -0.42 : 1;
}
window.addEventListener("scroll", onScroll, { passive: true });

/* ------------------------------ the opening ------------------------------ */

function rise() {
  if (risen) return;
  risen = true;
  document.documentElement.classList.add("gh-risen");
  targetMinutes = minutesOf("hero");
  if (reduced) { shownMinutes = targetMinutes; namesRise = 1; pathShow = 1; placeSun(shownMinutes); }
  onScroll();
}
$("gh-open").addEventListener("click", rise);

/* the reply: a yes is answered by the sun */
let flare = 0;
document.querySelector(".gh-yes").addEventListener("click", () => {
  flare = 1;
  document.querySelector(".gh-reply").classList.add("gh-said-yes");
});

/* ------------------------------ the loop ------------------------------ */

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = w < h ? 58 : 42;
  camera.updateProjectionMatrix();
  fitNames();
}
window.addEventListener("resize", resize);
resize();

window.__gh = { names, camera, rig }; // prototype only: for checking in the browser
const clock = new THREE.Clock();
const lookAt = new THREE.Vector3();
placeSun(shownMinutes);
refreshEnvironment(true);

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  const ease = (rate) => (reduced ? 1 : 1 - Math.pow(rate, dt));

  // the time of day eases toward where the page is: about a second to settle, slower while the sun first rises
  if (Math.abs(targetMinutes - shownMinutes) > 0.05) {
    shownMinutes = reduced ? targetMinutes : shownMinutes + (targetMinutes - shownMinutes) * ease(namesRise < 1 && risen ? 0.5 : 0.04);
    placeSun(shownMinutes);
  } else {
    refreshEnvironment(true); // settled: the gold gets the exact light
  }
  if (risen && namesRise < 1) namesRise = Math.min(1, namesRise + dt / 3.4);
  if (risen && pathShow < 1) pathShow = Math.min(1, pathShow + dt / 4);
  lift += (liftTarget - lift) * ease(0.05);
  flare = Math.max(0, flare - dt * 0.6);

  // the view faces the sun, with the sun a little to one side, drifting across the frame through the day
  const dayT = THREE.MathUtils.clamp((shownMinutes - SUNRISE) / (SUNSET - SUNRISE), 0, 1);
  rig.rotation.y = -(sunAz + THREE.MathUtils.lerp(7, -7, dayT) * D2R);
  const up = Math.max(0, lift);
  // looking up along the path far enough to keep the sun in the upper part of the screen
  const pitch = up * THREE.MathUtils.clamp((sunAlt / D2R) * 0.82 - 9, 0, 42) * D2R;
  camera.position.set(0, CAM.y + up * 1.6, CAM.z);
  lookAt.set(0, THREE.MathUtils.lerp(CAM.lookY, camera.position.y + Math.tan(pitch) * CAM.z, up), 0);
  rig.updateMatrixWorld();
  camera.lookAt(rig.localToWorld(lookAt.clone()));

  // the names rise from the sea at the opening, sink back through the day, and rise again in golden light for the reply
  const r = 1 - Math.pow(1 - namesRise, 3);
  names.position.set(0, THREE.MathUtils.lerp(-15, 1.6, r) - lift * 15 + (reduced ? 0 : Math.sin(t * 0.6) * 0.07), 0);
  names.rotation.y = reduced ? 0 : Math.sin(t * 0.22) * 0.045;
  names.visible = names.position.y > -24;

  // the path and its moments: the one nearest the sun glows brightest
  pathMat.opacity = 0.62 * pathShow;
  beads.forEach((b) => {
    const want = (b.userData.near ? 1 : 0.55) * pathShow;
    b.material.opacity += (want - b.material.opacity) * ease(0.02);
    b.scale.setScalar(b.userData.near ? 230 : 150);
  });
  sunHalo.material.opacity = 0.85 + flare * 0.6;
  sunHalo.scale.setScalar((sunHalo.userData.size || 2600) * (1 + flare * 0.5));

  water.material.uniforms.time.value += dt * (reduced ? 0.15 : 0.4);
  renderer.render(scene, camera);
});
