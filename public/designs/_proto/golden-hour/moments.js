/*
 * The day happens: each moment of the couple's schedule is something that
 * happens in the scene, not a block of text.
 *   the ceremony   rose petals drift across, catching the sunlight
 *   the aperitivo  streams of golden bubbles rise toward the sun
 *   the dinner     strings of festoon lights, brighter as the light softens
 *   the first dance  petals swirl around the gold names at sunset
 * Everything lives in front of the camera (its children), so it stays framed
 * on a phone and on a laptop.
 */
import * as THREE from "three";

const rand = (a, b) => a + Math.random() * (b - a);

/** how much of the view is visible at a distance in front of the camera */
function frame(camera, d) {
  const h = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * d;
  return { hw: h * camera.aspect, hh: h };
}

export function createMoments({ camera, mobile }) {
  const root = new THREE.Group();
  camera.add(root);

  /* ------------------------------ petals ------------------------------ */
  const PETALS = mobile ? 110 : 180;
  // a rose petal: rounded at the top, narrowing to the base, cupped
  const outline = new THREE.Shape();
  outline.moveTo(0, -0.22);
  outline.bezierCurveTo(0.12, -0.18, 0.2, 0.0, 0.17, 0.12);
  outline.bezierCurveTo(0.14, 0.22, 0.05, 0.24, 0, 0.2);
  outline.bezierCurveTo(-0.05, 0.24, -0.14, 0.22, -0.17, 0.12);
  outline.bezierCurveTo(-0.2, 0.0, -0.12, -0.18, 0, -0.22);
  const petalGeo = new THREE.ShapeGeometry(outline, 10);
  {
    const p = petalGeo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, (p.getX(i) ** 2) * 3.2 - (p.getY(i) + 0.22) * 0.12);
    petalGeo.computeVertexNormals();
  }
  // velvet: a soft sheen at the edges, as real petals have
  const petalMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, roughness: 0.62, metalness: 0, sheen: 1, sheenRoughness: 0.45, sheenColor: new THREE.Color(0xffc4cf),
    side: THREE.DoubleSide, transparent: true, opacity: 0, emissive: 0x2a0610, emissiveIntensity: 0.5,
  });
  const petals = new THREE.InstancedMesh(petalGeo, petalMat, PETALS);
  petals.frustumCulled = false;
  const PALETTE = [0xa30f33, 0xc8264d, 0xe05b7a, 0xf0a0b2, 0x7e0b26, 0xd83a5f];
  const pState = Array.from({ length: PETALS }, (_, i) => {
    petals.setColorAt(i, new THREE.Color(PALETTE[i % PALETTE.length]));
    return { x: 0, y: 0, z: 0, vx: 0, vy: 0, rx: rand(0, 6), ry: rand(0, 6), rz: rand(0, 6), spin: rand(0.6, 1.8), phase: rand(0, 6.28), a: rand(0, 6.28), r: rand(5, 11), h: rand(-1, 9), s: rand(0.9, 1.5), alive: false };
  });
  root.add(petals);

  /* ------------------------------ bubbles ------------------------------ */
  const BUBBLES = mobile ? 150 : 220;
  const bubbleTex = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d");
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, "rgba(255,250,235,.15)"); gr.addColorStop(0.62, "rgba(255,240,200,.25)");
    gr.addColorStop(0.8, "rgba(255,236,190,.95)"); gr.addColorStop(0.92, "rgba(255,225,170,.3)"); gr.addColorStop(1, "rgba(255,220,160,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    g.fillStyle = "rgba(255,255,255,.95)"; g.beginPath(); g.arc(24, 22, 5, 0, 6.3); g.fill(); // the glint
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const bubbleGeo = new THREE.BufferGeometry();
  const bPos = new Float32Array(BUBBLES * 3);
  const bState = Array.from({ length: BUBBLES }, () => ({ v: rand(0.8, 2.2), wob: rand(0, 6.28), lane: 0 }));
  bubbleGeo.setAttribute("position", new THREE.BufferAttribute(bPos, 3));
  const bubbleMat = new THREE.PointsMaterial({ map: bubbleTex, size: mobile ? 0.15 : 0.13, sizeAttenuation: true, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, color: new THREE.Color(1.5, 1.05, 0.45), toneMapped: false });
  const bubbles = new THREE.Points(bubbleGeo, bubbleMat);
  bubbles.frustumCulled = false;
  root.add(bubbles);

  /* ------------------------------ festoon lights ------------------------------ */
  const festoons = new THREE.Group();
  root.add(festoons);
  const wireMat = new THREE.LineBasicMaterial({ color: 0x2b2118, transparent: true, opacity: 0 });
  const bulbMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0, 0, 0), transparent: true, opacity: 0, toneMapped: false });
  const bulbGeo = new THREE.SphereGeometry(1, 10, 8);
  function buildFestoons() {
    festoons.clear();
    // three strings at different depths, sagging across the top of the view
    [[9, 0.86, 0.5], [14, 0.74, 0.65], [22, 0.62, 0.9]].forEach(([d, yFrac, sagFrac]) => {
      const { hw, hh } = frame(camera, d);
      const x0 = -hw * 1.15, x1 = hw * 1.15, y = hh * yFrac, sag = hh * 0.12 * sagFrac + 0.2;
      const pts = [];
      for (let i = 0; i <= 40; i++) {
        const t = i / 40, x = x0 + (x1 - x0) * t;
        pts.push(new THREE.Vector3(x, y - sag * (1 - (2 * t - 1) ** 2), -d));
      }
      festoons.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wireMat));
      const n = Math.max(8, Math.round((x1 - x0) / (d * 0.07)));
      for (let i = 1; i < n; i++) {
        const t = i / n, x = x0 + (x1 - x0) * t;
        const b = new THREE.Mesh(bulbGeo, bulbMat);
        b.position.set(x, y - sag * (1 - (2 * t - 1) ** 2) - d * 0.006, -d);
        b.scale.setScalar(d * 0.0055);
        festoons.add(b);
      }
    });
  }

  /* ------------------------------ each frame ------------------------------ */
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  const PD = 12; // petals fall through a slab about this far in front of the camera

  return {
    root,
    resize() { buildFestoons(); },
    /**
     * w: how strongly each moment is happening (0..1)
     *   petals, bubbles, lights, dance; namesAt: where the gold names are, in camera space
     */
    update(dt, t, w, namesAt, low, reduced) {
      const { hw, hh } = frame(camera, PD);
      const step = reduced ? 0 : dt;

      /* petals: falling across the view for the ceremony; circling the names for the first dance */
      const petalOn = Math.max(w.petals, w.dance);
      petalMat.opacity += (Math.min(1, petalOn * 1.2) - petalMat.opacity) * Math.min(1, dt * 2.5);
      petals.visible = petalMat.opacity > 0.01;
      if (petals.visible) {
        pState.forEach((p, i) => {
          if (w.dance > w.petals) {
            // around the names, slowly, in a loose ring
            p.a += step * (0.35 + p.s * 0.15);
            const tx = namesAt.x + Math.cos(p.a) * p.r, ty = namesAt.y + p.h + Math.sin(t * 0.5 + p.phase) * 0.6, tz = namesAt.z + Math.sin(p.a) * p.r * 0.6;
            p.x += (tx - p.x) * Math.min(1, dt * 0.8); p.y += (ty - p.y) * Math.min(1, dt * 0.8); p.z += (tz - p.z) * Math.min(1, dt * 0.8);
          } else {
            if (!p.alive || p.y < -hh * 1.3) { // drop in again from above, anywhere across
              p.x = rand(-hw * 1.2, hw * 1.2); p.y = p.alive ? hh * 1.25 : rand(-hh, hh * 1.25); p.z = -PD + rand(-5, 5);
              p.vx = rand(-0.25, 0.35); p.vy = rand(0.55, 1.1); p.alive = true;
            }
            p.x += (p.vx + Math.sin(t * 0.9 + p.phase) * 0.35) * step;
            p.y -= p.vy * step;
          }
          p.rx += p.spin * step * 0.9; p.ry += p.spin * step * 0.6; p.rz += p.spin * step * 0.4;
          q.setFromEuler(e.set(p.rx, p.ry, p.rz));
          m4.compose(v.set(p.x, p.y, p.z), q, sc.setScalar(p.s));
          petals.setMatrixAt(i, m4);
        });
        petals.instanceMatrix.needsUpdate = true;
      }

      /* bubbles: rising in loose streams toward the sun */
      bubbleMat.opacity += (Math.min(1, (w.bubbles + w.dance * 0.35) * 1.1) - bubbleMat.opacity) * Math.min(1, dt * 2);
      bubbles.visible = bubbleMat.opacity > 0.01;
      if (bubbles.visible) {
        // streams, as from glasses: narrow columns of tiny bubbles rising toward the sun
        const lanes = 6;
        bState.forEach((b, i) => {
          const k = i * 3;
          if (bPos[k + 1] === 0 && bPos[k] === 0 || bPos[k + 1] > hh * 1.3) {
            b.lane = (i % lanes) / (lanes - 1) - 0.5;
            bPos[k] = b.lane * hw * 1.7 + rand(-0.12, 0.12);
            bPos[k + 1] = bPos[k + 1] === 0 ? rand(-hh * 1.2, hh) : -hh * 1.25;
            bPos[k + 2] = -PD + rand(-4, 4);
          }
          bPos[k + 1] += b.v * step * 1.4;
          bPos[k] += Math.sin(t * 3.1 + b.wob) * 0.05 * step;
        });
        bubbleGeo.attributes.position.needsUpdate = true;
      }

      /* the lights: on for dinner and after, warmer and brighter as the light goes */
      const lightOn = w.lights;
      // the wires step back when the names return for the first dance, so nothing crosses them; the bulbs stay
      wireMat.opacity = lightOn * 0.8 * (1 - 0.85 * w.dance);
      bulbMat.opacity = lightOn;
      const glow = lightOn * (1 + low * 1.6);
      bulbMat.color.setRGB(4.2 * glow, 2.7 * glow, 1.2 * glow); // bright enough to bloom
      festoons.visible = lightOn > 0.01;
    },
  };
}
