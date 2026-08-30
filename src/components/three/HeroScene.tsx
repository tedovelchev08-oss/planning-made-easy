import React, { createContext, useContext, useLayoutEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, RoundedBox, Sparkles } from "@react-three/drei";
import * as THREE from "three";

/* ------------------------------------------------------------------ */

const SceneCtx = createContext<{ reduced: boolean; lite: boolean }>({ reduced: false, lite: false });

/** wrapper that bobs + slowly spins its children */
function F({
  p, amp = 0.16, speed = 1, spin = 0.06, phase = 0, children,
}: { p: [number, number, number]; amp?: number; speed?: number; spin?: number; phase?: number; children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  const { reduced } = useContext(SceneCtx);
  useFrame((s, delta) => {
    if (reduced || !ref.current) return;
    const t = s.clock.elapsedTime * speed + phase;
    ref.current.position.y = p[1] + Math.sin(t) * amp;
    ref.current.rotation.y += spin * delta;
  });
  return (
    <group ref={ref} position={p}>
      {children}
    </group>
  );
}

/**
 * Scales the whole installation to the viewport. On narrow/portrait screens the
 * camera pulls back so nothing dominates or crops — objects become ambient
 * accents instead of one oversized block filling the phone.
 */
function CameraRig({ z }: { z: number }) {
  const { camera } = useThree();
  useLayoutEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    cam.position.z = z;
    cam.updateProjectionMatrix();
  }, [camera, z]);
  return null;
}

/* ------------------------------ materials ------------------------------ */

function GoldMat() {
  return <meshStandardMaterial color="#D9B45B" metalness={0.92} roughness={0.28} />;
}
function CeramicMat({ color }: { color: string }) {
  return <meshStandardMaterial color={color} roughness={0.85} metalness={0.02} />;
}
function SatinMat({ color }: { color: string }) {
  return <meshPhysicalMaterial color={color} roughness={0.42} sheen={1} sheenColor="#FFF3F5" sheenRoughness={0.5} />;
}

/* ------------------------------ objects ------------------------------ */

function GlassSlab() {
  const ref = useRef<THREE.Group>(null);
  const { reduced } = useContext(SceneCtx);
  useFrame((s, delta) => {
    if (reduced || !ref.current) return;
    ref.current.rotation.y = THREE.MathUtils.damp(ref.current.rotation.y, s.pointer.x * 0.13, 2.4, delta);
    ref.current.rotation.x = THREE.MathUtils.damp(ref.current.rotation.x, -s.pointer.y * 0.09, 2.4, delta);
  });
  return (
    <group ref={ref}>
      <RoundedBox args={[3.56, 4.56, 0.1]} radius={0.22} smoothness={4} position={[0, 0, -0.12]}>
        <meshStandardMaterial color="#F3DFA6" emissive="#6b5518" emissiveIntensity={0.28} metalness={0.92} roughness={0.2} />
      </RoundedBox>
      <RoundedBox args={[3.36, 4.36, 0.3]} radius={0.18} smoothness={5}>
        <meshPhysicalMaterial
          color="#FFF9F1" transmission={0.93} thickness={1.15} roughness={0.15} ior={1.45}
          clearcoat={1} clearcoatRoughness={0.18} attenuationColor="#FFE4EA" attenuationDistance={4.5}
        />
      </RoundedBox>
    </group>
  );
}

function Rings({ linked = true }: { linked?: boolean }) {
  return (
    <group>
      <mesh rotation={[1.1, 0.3, 0]}>
        <torusGeometry args={[0.52, 0.075, 24, 64]} />
        <GoldMat />
      </mesh>
      {linked && (
        <mesh position={[0.42, -0.1, 0.1]} rotation={[1.4, -0.5, 0.3]}>
          <torusGeometry args={[0.52, 0.075, 24, 64]} />
          <GoldMat />
        </mesh>
      )}
    </group>
  );
}

function Envelope() {
  return (
    <group rotation={[0.1, -0.25, 0.22]}>
      <RoundedBox args={[1.5, 1.05, 0.05]} radius={0.03} smoothness={3}>
        <meshPhysicalMaterial color="#FFFBF4" roughness={0.5} transparent opacity={0.94} />
      </RoundedBox>
      <mesh position={[0, 0.26, 0.03]} rotation={[0, 0, Math.PI]}>
        <coneGeometry args={[0.74, 0.5, 3, 1]} />
        <meshStandardMaterial color="#FFF1F3" roughness={0.6} flatShading />
      </mesh>
      <mesh position={[0, -0.05, 0.045]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.13, 0.13, 0.03, 24]} />
        <GoldMat />
      </mesh>
      <mesh position={[-0.35, -0.32, 0.035]}>
        <boxGeometry args={[0.5, 0.035, 0.005]} />
        <CeramicMat color="#8A7A80" />
      </mesh>
      <mesh position={[-0.25, -0.4, 0.035]}>
        <boxGeometry args={[0.3, 0.035, 0.005]} />
        <CeramicMat color="#C4B6BC" />
      </mesh>
    </group>
  );
}

function CalendarCard() {
  return (
    <group rotation={[0.05, 0.3, -0.14]}>
      <RoundedBox args={[1.15, 1.4, 0.06]} radius={0.05} smoothness={3}>
        <CeramicMat color="#FFF6E9" />
      </RoundedBox>
      <mesh position={[0, 0.52, 0.012]}>
        <boxGeometry args={[1.15, 0.3, 0.065]} />
        <SatinMat color="#FFB5C2" />
      </mesh>
      {[-0.3, 0.3].map((x) => (
        <mesh key={x} position={[x, 0.66, 0]}>
          <torusGeometry args={[0.07, 0.018, 12, 24]} />
          <GoldMat />
        </mesh>
      ))}
      {[[-0.3, 0.12], [0, 0.12], [0.3, 0.12], [-0.3, -0.18], [0, -0.18], [0.3, -0.18]].map(([x, y], i) => (
        <mesh key={i} position={[x, y, 0.036]}>
          <boxGeometry args={[0.14, 0.14, 0.012]} />
          <CeramicMat color={i === 4 ? "#D4AF37" : "#E3D9E8"} />
        </mesh>
      ))}
    </group>
  );
}

function Peony({ scale = 1 }: { scale?: number }) {
  const petals = useMemo(
    () => Array.from({ length: 7 }).map((_, i) => {
      const a = (i / 7) * Math.PI * 2;
      return { x: Math.cos(a) * 0.3, y: Math.sin(a) * 0.3, z: 0.05, r: a };
    }), []);
  return (
    <group scale={scale}>
      {petals.map((pt, i) => (
        <mesh key={i} position={[pt.x, pt.y, pt.z]} rotation={[0.4, 0, pt.r]}>
          <sphereGeometry args={[0.26, 16, 12]} />
          <SatinMat color={i % 2 ? "#FFC3CE" : "#FFAEC0"} />
        </mesh>
      ))}
      <mesh position={[0, 0, 0.24]}>
        <sphereGeometry args={[0.2, 16, 12]} />
        <SatinMat color="#FFD9E0" />
      </mesh>
      <mesh position={[0, 0, 0.32]}>
        <icosahedronGeometry args={[0.1, 0]} />
        <GoldMat />
      </mesh>
      <mesh position={[-0.42, -0.4, -0.1]} rotation={[0, 0, 0.7]} scale={[1, 1.6, 0.35]}>
        <sphereGeometry args={[0.22, 12, 10]} />
        <CeramicMat color="#8FB585" />
      </mesh>
    </group>
  );
}

function ArchBackdrop() {
  return (
    <group>
      <mesh rotation={[0, 0, 0]}>
        <torusGeometry args={[2.9, 0.05, 12, 72, Math.PI]} />
        <CeramicMat color="#F1E2CE" />
      </mesh>
      {[-2.9, 2.9].map((x) => (
        <mesh key={x} position={[x, -1.35, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 2.7, 12]} />
          <CeramicMat color="#F1E2CE" />
        </mesh>
      ))}
      {[...Array(7)].map((_, i) => {
        const a = (i / 6) * Math.PI;
        return (
          <mesh key={i} position={[Math.cos(a) * 2.9, Math.sin(a) * 2.9, 0.05]} scale={0.9}>
            <sphereGeometry args={[0.09, 10, 8]} />
            <SatinMat color={i % 2 ? "#FFC3CE" : "#E8DCF2"} />
          </mesh>
        );
      })}
    </group>
  );
}

function Cake() {
  return (
    <group>
      <mesh position={[0, -0.42, 0]}>
        <cylinderGeometry args={[0.62, 0.66, 0.36, 28]} />
        <CeramicMat color="#FFF3E4" />
      </mesh>
      <mesh position={[0, -0.05, 0]}>
        <cylinderGeometry args={[0.46, 0.5, 0.34, 28]} />
        <SatinMat color="#FFE9EE" />
      </mesh>
      <mesh position={[0, 0.28, 0]}>
        <cylinderGeometry args={[0.3, 0.34, 0.3, 24]} />
        <CeramicMat color="#FFF3E4" />
      </mesh>
      <mesh position={[0, 0.5, 0]}>
        <sphereGeometry args={[0.07, 12, 10]} />
        <GoldMat />
      </mesh>
      <mesh position={[0, -0.22, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.5, 0.028, 10, 40]} />
        <SatinMat color="#A8C5A0" />
      </mesh>
    </group>
  );
}

function MusicNote() {
  return (
    <group rotation={[0, 0.4, 0.2]}>
      <mesh scale={[1, 0.8, 1]}>
        <sphereGeometry args={[0.15, 14, 12]} />
        <GoldMat />
      </mesh>
      <mesh position={[0.12, 0.36, 0]}>
        <cylinderGeometry args={[0.022, 0.022, 0.72, 10]} />
        <CeramicMat color="#332B31" />
      </mesh>
      <mesh position={[0.26, 0.66, 0]} rotation={[0, 0, -0.5]}>
        <boxGeometry args={[0.3, 0.07, 0.02]} />
        <CeramicMat color="#332B31" />
      </mesh>
    </group>
  );
}

function HeartGem({ color = "#FFAEC0" }: { color?: string }) {
  const geo = useMemo(() => {
    const s = new THREE.Shape();
    const x = 0, y = 0;
    s.moveTo(x + 0.25, y + 0.25);
    s.bezierCurveTo(x + 0.25, y + 0.25, x + 0.2, y, x, y);
    s.bezierCurveTo(x - 0.3, y, x - 0.3, y + 0.35, x - 0.3, y + 0.35);
    s.bezierCurveTo(x - 0.3, y + 0.55, x - 0.1, y + 0.77, x + 0.25, y + 0.95);
    s.bezierCurveTo(x + 0.6, y + 0.77, x + 0.8, y + 0.55, x + 0.8, y + 0.35);
    s.bezierCurveTo(x + 0.8, y + 0.35, x + 0.8, y, x + 0.5, y);
    s.bezierCurveTo(x + 0.35, y, x + 0.25, y + 0.25, x + 0.25, y + 0.25);
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.14, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.02, bevelSegments: 2, curveSegments: 12 });
    g.center();
    return g;
  }, []);
  return (
    <mesh geometry={geo} scale={0.62}>
      <SatinMat color={color} />
    </mesh>
  );
}

function CeramicBlob({ color, squash = 1 }: { color: string; squash?: number }) {
  return (
    <mesh scale={[1, squash, 1]}>
      <icosahedronGeometry args={[0.42, 0]} />
      <meshStandardMaterial color={color} roughness={0.9} flatShading />
    </mesh>
  );
}

/* ------------------------------ petals & bubbles ------------------------------ */

interface PetalState { x: number; y: number; z: number; vx: number; vy: number; phase: number; spin: number; s: number }

function PetalField({ count }: { count: number }) {
  const { reduced } = useContext(SceneCtx);
  const group = useRef<THREE.Group>(null);
  const petals = useMemo<PetalState[]>(
    () => Array.from({ length: count }).map((_, i) => ({
      x: (Math.random() - 0.5) * 11,
      y: (Math.random() - 0.5) * 6.4,
      z: (Math.random() - 0.5) * 3 + 0.8,
      vx: 0, vy: 0,
      phase: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 1.4,
      s: 0.32 + Math.random() * 0.3,
    })), [count]);
  const geo = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.bezierCurveTo(0.5, 0.18, 0.5, 0.82, 0, 1);
    s.bezierCurveTo(-0.5, 0.82, -0.5, 0.18, 0, 0);
    return new THREE.ShapeGeometry(s, 10);
  }, []);

  useFrame((state, delta) => {
    if (reduced || !group.current) return;
    const cam = state.camera as THREE.PerspectiveCamera;
    const halfH = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * cam.position.z;
    const halfW = halfH * cam.aspect;
    const px = state.pointer.x * halfW;
    const py = state.pointer.y * halfH;
    const t = state.clock.elapsedTime;
    const d = Math.min(delta, 0.05);

    group.current.children.forEach((child, i) => {
      const p = petals[i];
      if (!p) return;
      // cursor repulsion
      const dx = p.x - px;
      const dy = p.y - py;
      const dist2 = dx * dx + dy * dy;
      if (dist2 < 2.6) {
        const dist = Math.sqrt(dist2) || 0.001;
        const f = ((2.6 - dist2) / 2.6) * 2.4;
        p.vx += (dx / dist) * f * d * 10;
        p.vy += (dy / dist) * f * d * 10;
      }
      p.vx *= 0.94; p.vy *= 0.94;
      p.x += p.vx * d; p.y += p.vy * d;
      // gentle drift home + sway
      p.x += Math.sin(t * 0.4 + p.phase) * 0.0016;
      p.y += Math.cos(t * 0.33 + p.phase) * 0.0014;
      child.position.set(p.x, p.y + Math.sin(t * 0.9 + p.phase) * 0.12, p.z);
      child.rotation.set(Math.sin(t * 0.6 + p.phase) * 0.5, t * p.spin * 0.25, Math.cos(t * 0.5 + p.phase) * 0.6);
    });
  });

  return (
    <group ref={group}>
      {petals.map((p, i) => (
        <mesh key={i} geometry={geo} scale={p.s} position={[p.x, p.y, p.z]}>
          <meshPhysicalMaterial
            color={i % 3 === 0 ? "#FFD3DC" : i % 3 === 1 ? "#FFB5C2" : "#F8E3D8"}
            roughness={0.5} side={THREE.DoubleSide} sheen={0.8} sheenColor="#FFF0F2"
          />
        </mesh>
      ))}
    </group>
  );
}

function Bubbles({ count }: { count: number }) {
  const { reduced } = useContext(SceneCtx);
  const group = useRef<THREE.Group>(null);
  const seeds = useMemo(
    () => Array.from({ length: count }).map(() => ({
      x: (Math.random() - 0.5) * 11,
      y: (Math.random() - 0.5) * 7,
      z: (Math.random() - 0.5) * 3 - 0.4,
      speed: 0.25 + Math.random() * 0.5,
      r: 0.04 + Math.random() * 0.07,
      phase: Math.random() * Math.PI * 2,
    })), [count]);

  useFrame((state, delta) => {
    if (reduced || !group.current) return;
    const t = state.clock.elapsedTime;
    const d = Math.min(delta, 0.05);
    group.current.children.forEach((child, i) => {
      const b = seeds[i];
      if (!b) return;
      child.position.y += b.speed * d;
      if (child.position.y > 4) child.position.y = -4;
      child.position.x = b.x + Math.sin(t * 0.8 + b.phase) * 0.22;
    });
  });

  return (
    <group ref={group}>
      {seeds.map((b, i) => (
        <mesh key={i} position={[b.x, b.y, b.z]}>
          <sphereGeometry args={[b.r, 12, 10]} />
          <meshPhysicalMaterial color="#FFF6E8" transmission={0.85} roughness={0.08} thickness={0.4} ior={1.2} />
        </mesh>
      ))}
    </group>
  );
}

/* ------------------------------ parallax rig ------------------------------ */

function Parallax({ factor, children }: { factor: number; children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  const { reduced } = useContext(SceneCtx);
  useFrame((s, delta) => {
    if (reduced || !ref.current) return;
    ref.current.position.x = THREE.MathUtils.damp(ref.current.position.x, s.pointer.x * factor, 2.6, delta);
    ref.current.position.y = THREE.MathUtils.damp(ref.current.position.y, s.pointer.y * factor * 0.6, 2.6, delta);
    ref.current.rotation.y = THREE.MathUtils.damp(ref.current.rotation.y, s.pointer.x * factor * 0.04, 2.6, delta);
  });
  return <group ref={ref}>{children}</group>;
}

function KeyLight() {
  const ref = useRef<THREE.PointLight>(null);
  const { reduced } = useContext(SceneCtx);
  useFrame((s, delta) => {
    if (reduced || !ref.current) return;
    ref.current.position.x = THREE.MathUtils.damp(ref.current.position.x, s.pointer.x * 5, 1.8, delta);
    ref.current.position.y = THREE.MathUtils.damp(ref.current.position.y, s.pointer.y * 3 + 3, 1.8, delta);
  });
  return <pointLight ref={ref} position={[0, 3, 5]} intensity={26} color="#FFF2DD" distance={30} />;
}

/* ------------------------------ scene ------------------------------ */

function Scene({ offsetX, offsetY }: { offsetX: number; offsetY: number }) {
  const { lite } = useContext(SceneCtx);
  return (
    <>
      <CameraRig z={lite ? 16.5 : 11} />
      <ambientLight intensity={0.85} color="#FFF6EA" />
      <directionalLight position={[5, 7, 6]} intensity={1.6} color="#FFFFFF" />
      <pointLight position={[-7, 2, 4]} intensity={20} color="#FFB5C2" distance={26} />
      <pointLight position={[7, -3, 3]} intensity={16} color="#C9B8E8" distance={26} />
      <KeyLight />

      <Environment resolution={32} frames={1}>
        <group>
          <mesh scale={24}>
            <boxGeometry />
            <meshBasicMaterial color="#FFF0DC" side={THREE.BackSide} />
          </mesh>
          <mesh position={[7, 5, 3]} scale={[5, 5, 1]}>
            <planeGeometry />
            <meshBasicMaterial color="#FFD3DC" />
          </mesh>
          <mesh position={[-7, 3, 2]} scale={[4, 4, 1]}>
            <planeGeometry />
            <meshBasicMaterial color="#DCD0F2" />
          </mesh>
          <mesh position={[0, -6, 4]} scale={[8, 3, 1]}>
            <planeGeometry />
            <meshBasicMaterial color="#E4EFD9" />
          </mesh>
          <mesh position={[0, 7, 2]} scale={[10, 3, 1]}>
            <planeGeometry />
            <meshBasicMaterial color="#FFFDF4" />
          </mesh>
        </group>
      </Environment>

      {/* background layer */}
      <Parallax factor={0.25}>
        <group position={[offsetX, offsetY - 0.15, -3.4]}>
          <ArchBackdrop />
        </group>
        {!lite && (
          <F p={[-4.8, -1.7, -2.2]} amp={0.1} speed={0.6} spin={0.02}>
            <Cake />
          </F>
        )}
        {!lite && (
          <F p={[5.1, 2.3, -2]} amp={0.12} speed={0.7} phase={1.4}>
            <MusicNote />
          </F>
        )}
        <F p={[-3.4, 2.8, -2.4]} amp={0.1} speed={0.55} phase={2.2}>
          <Peony scale={0.85} />
        </F>
        <F p={[5.5, -2.6, -1.6]} amp={0.1} speed={0.5} phase={3}>
          <CeramicBlob color="#C9B8E8" squash={0.8} />
        </F>
        <Sparkles count={lite ? 26 : 55} scale={[13, 7, 5]} position={[0, 0, -2]} size={lite ? 1.6 : 2.2} speed={0.25} opacity={0.5} color="#E9C46A" />
      </Parallax>

      {/* mid layer */}
      <Parallax factor={0.6}>
        <F p={[-4, 1.35, -0.3]} amp={0.17} speed={0.8} spin={0.12} phase={0.6}>
          <Rings />
        </F>
        <F p={[3.8, 1.75, -0.1]} amp={0.15} speed={0.7} phase={1.8}>
          <Envelope />
        </F>
        <F p={[-4.4, -1.3, 0.5]} amp={0.14} speed={0.75} phase={2.6}>
          <CalendarCard />
        </F>
        <F p={[4.7, 0.1, -0.7]} amp={0.16} speed={0.85} spin={0.05} phase={0.9}>
          <Peony scale={1.05} />
        </F>
        <F p={[-5.4, 0.1, 0.7]} amp={0.2} speed={0.9} spin={0.2} phase={1.1}>
          <HeartGem />
        </F>
        <F p={[2.9, -2.7, 0.75]} amp={0.18} speed={0.8} spin={-0.16} phase={2}>
          <HeartGem color="#E8B7C4" />
        </F>
        <F p={[0.9, 3, -0.5]} amp={0.15} speed={0.75} spin={0.14} phase={3.4}>
          <HeartGem color="#D8C8EE" />
        </F>
        <F p={[-2.3, -2.8, 0.6]} amp={0.12} speed={0.6} spin={0.08}>
          <CeramicBlob color="#A8C5A0" squash={1.25} />
        </F>
        <Sparkles count={lite ? 18 : 36} scale={[12, 6.5, 4]} position={[0, 0, 0.5]} size={1.5} speed={0.3} opacity={0.45} color="#FFC9D2" />
      </Parallax>

      {/* glass slab (anchored to overlay card) — kept in front of the mid layer
          so floating objects slide behind it, never through it. On phones the
          full-size slab is dropped (it reads as one brown block); the HTML
          planner card carries the glass material there instead. */}
      {!lite && (
        <Parallax factor={0.42}>
          <group position={[offsetX, offsetY, 1.25]}>
            <GlassSlab />
          </group>
        </Parallax>
      )}

      {/* foreground */}
      <Parallax factor={1}>
        <PetalField count={lite ? 8 : 16} />
        <Bubbles count={lite ? 8 : 14} />
        <F p={[5.9, -0.6, 1.5]} amp={0.2} speed={1} spin={0.2} phase={1.3}>
          <Rings linked={false} />
        </F>
        <Sparkles count={lite ? 10 : 20} scale={[12, 6, 3]} position={[0, 0, 2]} size={2.6} speed={0.35} opacity={0.6} color="#F5DFA0" />
      </Parallax>
    </>
  );
}

/* ------------------------------ boundary & export ------------------------------ */

class SceneBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? null : this.props.children; }
}

export default function HeroScene({ lite, reduced, offsetX, offsetY }: { lite: boolean; reduced: boolean; offsetX: number; offsetY: number }) {
  return (
    <SceneBoundary>
      <Canvas
        dpr={lite ? [1, 1.5] : [1, 1.75]}
        camera={{ position: [0, 0, 11], fov: 37 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        frameloop={reduced ? "demand" : "always"}
        style={{ position: "absolute", inset: 0 }}
        aria-hidden="true"
      >
        <SceneCtx.Provider value={{ reduced, lite }}>
          <Scene offsetX={offsetX} offsetY={offsetY} />
        </SceneCtx.Provider>
      </Canvas>
    </SceneBoundary>
  );
}
