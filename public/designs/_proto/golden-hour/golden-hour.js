/*
 * Golden Hour (prototype). Everything on screen is drawn live: a physically
 * based sky (three.js Sky: Rayleigh and Mie scattering), a sea that reflects
 * it, and the couple's names cast in gold and lit by the sun. The sun sits
 * where it really will be over the venue on the wedding day, worked out from
 * the date, the time and the venue's latitude and longitude. Scrolling walks
 * through the day; it stops at golden hour, before the sun goes down.
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

/* ------------------------------ the sun ------------------------------ */

/** the sun's altitude and azimuth (radians; azimuth from north, clockwise) at a moment, for a place */
function sunAt(ms, lat, lon) {
  const rad = Math.PI / 180;
  const d = ms / 86400000 - 10957.5; // days since J2000.0
  const g = (357.529 + 0.98560028 * d) * rad;
  const q = 280.459 + 0.98564736 * d;
  const L = (q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * rad;
  const e = (23.439 - 0.00000036 * d) * rad;
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L));
  const dec = Math.asin(Math.sin(e) * Math.sin(L));
  const gmst = (18.697374558 + 24.06570982441908 * d) % 24;
  const H = (gmst * 15 + lon) * rad - ra;
  const phi = lat * rad;
  const alt = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
  const azSouth = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi));
  return { alt, az: azSouth + Math.PI };
}

/** minutes after local midnight on the wedding day -> UTC milliseconds */
const at = (minutes) => Date.parse(`${WEDDING.date}T00:00:00Z`) + (minutes - WEDDING.utcOffset * 60) * 60000;
const sunMin = (minutes) => sunAt(at(minutes), WEDDING.lat, WEDDING.lon);

/** sunrise and sunset (the sun's upper edge on the horizon), to the minute */
function riseAndSet() {
  const limb = -0.833 * Math.PI / 180;
  let rise = null, set = null;
  for (let m = 0; m < 1440; m++) {
    const a = sunMin(m).alt, b = sunMin(m + 1).alt;
    if (rise === null && a < limb && b >= limb) rise = m + 1;
    if (a >= limb && b < limb) set = m;
  }
  return { rise, set };
}
const { rise: SUNRISE, set: SUNSET } = riseAndSet();
const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(Math.round(m % 60)).padStart(2, "0")}`;

$("gh-sunset-hour").textContent = hhmm(SUNSET);
$("gh-sunset-line").textContent = `The sun sets at ${hhmm(SUNSET)}. Dance with us after.`;

/* each section of the page is a moment of the day */
const GOLDEN = SUNSET - 24; // golden hour, still bright: never night
function minutesOf(tag) {
  if (tag === "hero") return SUNRISE + 24; // the sun clear of the sea, the light still gold
  if (tag === "sunset") return SUNSET - 6;
  if (tag === "golden") return GOLDEN;
  const [h, m] = tag.split(":").map(Number);
  return h * 60 + m;
}

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
renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1.5 : 2));
renderer.toneMapping = THREE.NeutralToneMapping; // keeps the blue of a midday sky (ACES greys it)
renderer.toneMappingExposure = 0.55;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, 1, 1, 20000);

const sky = new Sky();
sky.scale.setScalar(10000);
const su = sky.material.uniforms;
su.turbidity.value = 6;
su.rayleigh.value = 1.6;
su.mieCoefficient.value = 0.005;
su.mieDirectionalG.value = 0.82;
scene.add(sky);

const water = new Water(new THREE.PlaneGeometry(10000, 10000), {
  textureWidth: mobile ? 256 : 512,
  textureHeight: mobile ? 256 : 512,
  waterNormals: new THREE.TextureLoader().load("assets/waternormals.jpg", (t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; }),
  sunDirection: new THREE.Vector3(),
  sunColor: 0xfff1d6,
  waterColor: 0x0a5c80,
  distortionScale: 2.6,
  fog: false,
});
water.rotation.x = -Math.PI / 2;
scene.add(water);

/* the sky lights the gold: an environment map made from the sky, refreshed as the sun moves */
const pmrem = new THREE.PMREMGenerator(renderer);
const envScene = new THREE.Scene();
let envTarget = null;
let envSunKey = "";
let envAt = -1e9;
function refreshEnvironment(sunVec, force = false) {
  const key = sunVec.toArray().map((v) => v.toFixed(2)).join(",");
  if (key === envSunKey) return;
  // rebuilding the light from the sky costs a few milliseconds: at most four times a second
  const now = performance.now();
  if (!force && now - envAt < 250) return;
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

/* ------------------------------ the names, in gold ------------------------------ */

const gold = new THREE.MeshPhysicalMaterial({
  color: 0xf5c869, metalness: 1, roughness: 0.28, clearcoat: 0.8, clearcoatRoughness: 0.12, envMapIntensity: 1.6,
});
/* metal facing the viewer mirrors the sky behind them: a warm fill from the viewer's side, as a photographer would bounce it */
const fill = new THREE.DirectionalLight(0xffe2b0, 2.4);
fill.position.set(-6, 10, 30);
scene.add(fill);
scene.add(new THREE.HemisphereLight(0xfff3dc, 0x6a8fa8, 0.9));
const names = new THREE.Group();
scene.add(names);

new FontLoader().load("assets/cormorant-light.typeface.json", (font) => {
  const opts = (size) => ({ font, size, depth: size * 0.12, curveSegments: 10, bevelEnabled: true, bevelThickness: size * 0.02, bevelSize: size * 0.012, bevelSegments: 4 });
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

/** the names fill the width of a phone, with a margin, and never more than a laptop needs */
function fitNames() {
  if (!names.children.length) return;
  const box = new THREE.Box3().setFromObject(names);
  const width = box.max.x - box.min.x;
  // measured from where the camera stands for the names, not where it happens to be this frame
  const dist = camFrom.z;
  const viewW = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * dist * camera.aspect;
  names.scale.setScalar(Math.min(1.4, (viewW * 0.78) / (width / names.scale.x)));
}

/* ------------------------------ time of day ------------------------------ */

const sunVec = new THREE.Vector3();
let shownMinutes = SUNRISE + 1; // before the tap: the sun just touching the sea, the sky already glowing (never dark)
let targetMinutes = shownMinutes;
let risen = false;
let namesRise = 0; // 0 under the sea, 1 in place

/* the view looks toward the sun, and lags a little so the sun travels across the frame */
function placeSun(minutes) {
  const { alt, az } = sunMin(minutes);
  const phi = Math.PI / 2 - alt;
  // three's Sky: theta around the up axis; the camera faces -z, so turn the world so the sun sits ahead
  const dayT = THREE.MathUtils.clamp((minutes - SUNRISE) / (SUNSET - SUNRISE), 0, 1);
  const viewAz = az - THREE.MathUtils.degToRad(THREE.MathUtils.lerp(-18, 18, dayT));
  const theta = Math.PI - (az - viewAz);
  sunVec.setFromSphericalCoords(1, phi, theta);
  su.sunPosition.value.copy(sunVec);
  water.material.uniforms.sunDirection.value.copy(sunVec).normalize();
  sunLight.position.copy(sunVec).multiplyScalar(100);
  // low sun: warmer, hazier air
  const low = 1 - THREE.MathUtils.clamp(alt / THREE.MathUtils.degToRad(25), 0, 1);
  // clear Mediterranean air at midday (deep blue), warm haze as the sun gets low
  su.rayleigh.value = 3.6 - low * 0.8;
  su.turbidity.value = 0.8 + low * 6;
  su.mieCoefficient.value = 0.0015 + low * 0.0055;
  // a sun right on the horizon needs more exposure to stay luminous, as a camera would give it
  renderer.toneMappingExposure = 0.31 + Math.pow(low, 3) * 0.75;
  refreshEnvironment(sunVec);

  const altDeg = THREE.MathUtils.radToDeg(alt);
  $("gh-time").textContent = hhmm(minutes);
  $("gh-sunline").textContent = altDeg < 0.5
    ? (minutes < 720 ? `sunrise over ${WEDDING.place} · ${hhmm(SUNRISE)}` : `sunset · ${hhmm(SUNSET)}`)
    : `the sun ${Math.round(altDeg)}° above ${WEDDING.place}`;
}

/* camera: low over the water at the names; lifted toward the sky through the day */
const camFrom = { y: 3.4, z: 26, lookY: 4.2 };
const camSky = { y: 5.5, z: 26, lookY: 11 };
let camMix = 0, camMixTarget = 0;

/* ------------------------------ scrolling ------------------------------ */

const sections = [...document.querySelectorAll(".gh-sec")];
function onScroll() {
  if (!risen) return;
  const mid = window.scrollY + window.innerHeight * 0.55;
  let i = 0;
  sections.forEach((s, k) => { if (s.offsetTop <= mid) i = k; });
  const cur = sections[i], next = sections[i + 1];
  const t0 = minutesOf(cur.dataset.at);
  if (!next) { targetMinutes = t0; }
  else {
    const f = THREE.MathUtils.clamp((mid - cur.offsetTop) / (next.offsetTop - cur.offsetTop), 0, 1);
    targetMinutes = THREE.MathUtils.lerp(t0, minutesOf(next.dataset.at), f);
  }
  // the names hold the stage at the start and at the end (the reply, in golden light)
  const last = sections.length - 1;
  // at the reply they come back higher, above the words (a negative mix lifts them)
  camMixTarget = i === 0 ? THREE.MathUtils.clamp((mid - cur.offsetTop) / cur.offsetHeight, 0, 1) : i === last ? -0.42 : 1;
}
window.addEventListener("scroll", onScroll, { passive: true });

/* ------------------------------ the opening ------------------------------ */

function rise() {
  if (risen) return;
  risen = true;
  document.documentElement.classList.add("gh-risen");
  targetMinutes = minutesOf("hero"); // the sun clears the sea
  if (reduced) { shownMinutes = targetMinutes; namesRise = 1; placeSun(shownMinutes); }
}
$("gh-open").addEventListener("click", rise);

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

window.__gh = { names, camera, scene, renderer }; // prototype only: for checking in the browser
const clock = new THREE.Clock();
placeSun(shownMinutes);
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  // ease toward the moment the page is at: about a second to settle, never a jump
  const ease = reduced ? 1 : 1 - Math.pow(0.04, dt);
  if (Math.abs(targetMinutes - shownMinutes) > 0.05) {
    shownMinutes = reduced ? targetMinutes : shownMinutes + (targetMinutes - shownMinutes) * (risen && namesRise < 1 ? ease * 0.35 : ease);
    placeSun(shownMinutes);
  } else {
    refreshEnvironment(sunVec, true); // settled: the gold gets the exact light
  }
  if (risen && namesRise < 1) namesRise = Math.min(1, namesRise + dt / 3.2);
  camMix += (camMixTarget - camMix) * (reduced ? 1 : 1 - Math.pow(0.05, dt));

  const r = 1 - Math.pow(1 - namesRise, 3);
  // the names rise from the sea at the opening, sink back through the day, and rise again in golden light for the reply
  names.position.set(0, THREE.MathUtils.lerp(-7, 1.6, r) - camMix * 14 + (reduced ? 0 : Math.sin(t * 0.6) * 0.08), 0);
  names.visible = names.position.y > -16;
  names.rotation.y = reduced ? 0 : Math.sin(t * 0.25) * 0.05;
  const lift = Math.max(0, camMix);
  camera.position.set(0, THREE.MathUtils.lerp(camFrom.y, camSky.y, lift), THREE.MathUtils.lerp(camFrom.z, camSky.z, lift));
  camera.lookAt(0, THREE.MathUtils.lerp(camFrom.lookY, camSky.lookY, lift), 0);

  water.material.uniforms.time.value += dt * (reduced ? 0.2 : 0.55);
  renderer.render(scene, camera);
});
