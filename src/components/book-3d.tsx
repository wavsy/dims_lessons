"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer } from "@react-three/drei";
import * as THREE from "three";

// Notebook size in scene units (A5, 1 unit = 10 cm)
const W = 1.48;
const H = 2.1;
const BOARD = 0.016;
const BLOCK = 0.11;
const THICK = BOARD * 2 + BLOCK;

const LEATHER = "#6b3a26";
const GOLD = "#e9c98a";

export type BookCopy = {
  title: string;
  kicker: string;
  date: string;
  rows: [string, string][];
  note: string;
};

function fontFamily(variable: string, fallback: string) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  return value || fallback;
}

function canvasTexture(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext("2d")!);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

// Gold foil: white on transparent, tinted by the material colour.
function coverTexture(copy: BookCopy, display: string) {
  return canvasTexture(1036, 1470, (ctx) => {
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 7;
    ctx.strokeRect(50, 50, 936, 1370);
    ctx.lineWidth = 2;
    ctx.strokeRect(66, 66, 904, 1338);
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.font = `44px ${display}`;
    ctx.letterSpacing = "12px";
    ctx.fillText(copy.kicker.toUpperCase(), 518, 560);
    ctx.fillRect(458, 610, 120, 3);
    ctx.letterSpacing = "0px";
    const words = copy.title.split(" ");
    const lines = words.length > 2 ? [words.slice(0, -2).join(" "), words.slice(-2).join(" ")] : words;
    const size = Math.min(170, 900 / Math.max(...lines.map((line) => line.length)) * 1.9);
    ctx.font = `500 ${size}px ${display}`;
    lines.forEach((line, i) => ctx.fillText(line, 518, 780 + i * size * 0.95));
  });
}

// First page: ruled paper with today's list written by hand.
function pageTexture(copy: BookCopy, hand: string) {
  return canvasTexture(1036, 1470, (ctx) => {
    ctx.fillStyle = "#fbf6ec";
    ctx.fillRect(0, 0, 1036, 1470);
    ctx.strokeStyle = "rgba(92,118,164,0.32)";
    ctx.lineWidth = 2;
    for (let y = 230; y < 1470; y += 62) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(1036, y);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(176,72,64,0.55)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(150, 0);
    ctx.lineTo(150, 1470);
    ctx.stroke();

    ctx.fillStyle = "#9a5648";
    ctx.font = `78px ${hand}`;
    ctx.fillText(copy.date, 190, 210);
    copy.rows.forEach(([name, subject], i) => {
      const y = 286 + i * 93;
      if (i === 0) {
        ctx.strokeStyle = "#3f8f5b";
        ctx.lineWidth = 6;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(192, y - 22);
        ctx.lineTo(210, y - 6);
        ctx.lineTo(238, y - 44);
        ctx.stroke();
      } else {
        ctx.strokeStyle = "rgba(44,53,80,0.45)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(214, y - 22, 15, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.font = `68px ${hand}`;
      ctx.fillStyle = "#2c3550";
      ctx.fillText(name, 262, y);
      const nameWidth = ctx.measureText(name).width;
      ctx.fillStyle = "#6b7593";
      ctx.fillText(`· ${subject}`, 282 + nameWidth, y);
    });
    ctx.save();
    ctx.translate(210, 660);
    ctx.rotate(-0.04);
    ctx.fillStyle = "#9a5648";
    ctx.font = `70px ${hand}`;
    ctx.fillText(copy.note, 0, 0);
    ctx.restore();
  });
}

function blankPageTexture() {
  return canvasTexture(518, 735, (ctx) => {
    ctx.fillStyle = "#fbf6ec";
    ctx.fillRect(0, 0, 518, 735);
    ctx.strokeStyle = "rgba(92,118,164,0.3)";
    ctx.lineWidth = 1.5;
    for (let y = 115; y < 735; y += 31) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(518, y);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(176,72,64,0.5)";
    ctx.beginPath();
    ctx.moveTo(75, 0);
    ctx.lineTo(75, 735);
    ctx.stroke();
  });
}

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

function Notebook({ copy, pointer }: { copy: BookCopy; pointer: React.RefObject<{ x: number; y: number }> }) {
  const group = useRef<THREE.Group>(null);
  const hinge = useRef<THREE.Group>(null);
  const leaf = useRef<THREE.Group>(null);
  const leafMaterial = useRef<THREE.MeshStandardMaterial>(null);
  const started = useRef<number | null>(null);

  const textures = useMemo(() => {
    const display = fontFamily("--font-garamond", "Georgia, serif");
    const hand = fontFamily("--font-caveat", "cursive");
    return { cover: coverTexture(copy, display), page: pageTexture(copy, hand), blank: blankPageTexture() };
  }, [copy]);

  useEffect(
    () => () => {
      textures.cover.dispose();
      textures.page.dispose();
      textures.blank.dispose();
    },
    [textures],
  );

  useFrame((state, delta) => {
    const time = state.clock.elapsedTime;
    if (started.current === null) started.current = time;
    const t = time - started.current;

    // Arrive, then the cover swings open
    const arrive = easeInOut(clamp01(t / 1.1));
    const open = easeInOut(clamp01((t - 0.7) / 1.5));
    if (hinge.current) hinge.current.rotation.z = open * (Math.PI + 0.09);

    // A page turns every seven seconds once the book is open
    const cycle = t > 3.4 ? (t - 3.4) % 7 : 0;
    const turn = easeInOut(clamp01(cycle / 1.3));
    if (leaf.current) {
      leaf.current.rotation.z = turn * (Math.PI - 0.02);
      leaf.current.visible = t > 3.4 && turn > 0.01 && cycle < 2.4;
    }
    if (leafMaterial.current) leafMaterial.current.opacity = 1 - clamp01((cycle - 1.6) / 0.8);

    // Idle float plus a tilt towards the pointer
    const g = group.current;
    if (!g) return;
    const p = pointer.current ?? { x: 0, y: 0 };
    const targetX = 0.95 + p.y * 0.14 + Math.sin(time * 0.6) * 0.02;
    const targetY = -0.18 + p.x * 0.3 + Math.sin(time * 0.4) * 0.05;
    const k = 1 - Math.pow(0.002, delta);
    g.rotation.x += (targetX - g.rotation.x) * k;
    g.rotation.y += (targetY - g.rotation.y) * k;
    g.position.y = (1 - arrive) * 0.5 + Math.sin(time * 0.8) * 0.03;
    g.scale.setScalar(0.86 + arrive * 0.14);
  });

  return (
    <group ref={group} rotation={[0.95, -0.18, 0]}>
      {/* Back board, spine and page block on the right half; y is the book's thickness */}
      <mesh position={[W / 2 + 0.015, BOARD / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[W + 0.03, BOARD, H + 0.04]} />
        <meshPhysicalMaterial color={LEATHER} roughness={0.55} clearcoat={0.3} clearcoatRoughness={0.5} />
      </mesh>
      <mesh position={[0.01, THICK / 2, 0]} castShadow>
        <boxGeometry args={[0.05, THICK, H + 0.04]} />
        <meshPhysicalMaterial color={LEATHER} roughness={0.55} clearcoat={0.3} />
      </mesh>
      <mesh position={[W / 2 + 0.01, BOARD + BLOCK / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[W - 0.02, BLOCK, H - 0.03]} />
        <meshStandardMaterial color="#f1e8d8" roughness={0.9} />
      </mesh>
      <mesh position={[W / 2 + 0.01, BOARD + BLOCK + 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[W - 0.02, H - 0.03]} />
        <meshStandardMaterial map={textures.page} roughness={0.85} />
      </mesh>
      <mesh position={[W * 0.62, 0.003, H / 2 + 0.18]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.06, 0.4]} />
        <meshStandardMaterial color="#b23a3c" roughness={0.45} side={THREE.DoubleSide} />
      </mesh>

      {/* Turning leaf, hinged at the spine */}
      <group ref={leaf} position={[0, BOARD + BLOCK + 0.004, 0]} visible={false}>
        <mesh position={[W / 2, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[W - 0.03, H - 0.04]} />
          <meshStandardMaterial ref={leafMaterial} map={textures.blank} roughness={0.85} side={THREE.DoubleSide} transparent />
        </mesh>
      </group>

      {/* Front cover, hinged at the spine */}
      <group ref={hinge} position={[0, THICK - BOARD / 2, 0]}>
        <mesh position={[W / 2 + 0.015, 0, 0]} castShadow receiveShadow>
          <boxGeometry args={[W + 0.03, BOARD, H + 0.04]} />
          <meshPhysicalMaterial color={LEATHER} roughness={0.55} clearcoat={0.3} clearcoatRoughness={0.5} />
        </mesh>
        <mesh position={[W / 2 + 0.015, BOARD / 2 + 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[W + 0.03, H + 0.04]} />
          <meshStandardMaterial
              map={textures.cover}
              color={GOLD}
              metalness={0.75}
              roughness={0.3}
              emissive={GOLD}
              emissiveMap={textures.cover}
              emissiveIntensity={0.35}
              transparent
              alphaTest={0.4}
            />
        </mesh>
        <mesh position={[W / 2 + 0.015, -BOARD / 2 - 0.001, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <planeGeometry args={[W + 0.01, H + 0.02]} />
          <meshStandardMaterial color="#e2d2b6" roughness={0.9} />
        </mesh>
      </group>
    </group>
  );
}

const STAR_VERTEX = /* glsl */ `
  attribute vec3 aBase;
  attribute float aSize;
  attribute float aPhase;
  attribute float aDelay;
  attribute vec3 aColor;
  uniform float uTime;
  uniform float uPixelRatio;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vFlash;

  void main() {
    // Burst out of the open pages, then settle into a slow orbit
    float p = clamp((uTime - aDelay) / 1.8, 0.0, 1.0);
    p = 1.0 - pow(1.0 - p, 3.0);
    float angle = uTime * (0.05 + fract(aPhase * 3.7) * 0.05) + aPhase * 6.2831;
    vec3 base = vec3(aBase.x * cos(angle) - aBase.z * sin(angle), aBase.y, aBase.x * sin(angle) + aBase.z * cos(angle));
    base.y += sin(uTime * 0.6 + aPhase * 12.0) * 0.08;
    vec3 pos = mix(vec3(0.35, 0.05, 0.1), base, p);

    float twinkle = 0.55 + 0.45 * sin(uTime * (1.2 + fract(aPhase * 7.0) * 2.4) + aPhase * 40.0);
    vFlash = pow(max(0.0, sin(uTime * (0.35 + fract(aPhase * 11.0) * 0.5) + aPhase * 90.0)), 24.0);
    vAlpha = smoothstep(0.0, 0.25, p) * twinkle;
    vColor = aColor;

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * uPixelRatio * (1.0 + vFlash * 1.6) * (6.0 / -mv.z);
  }
`;

const STAR_FRAGMENT = /* glsl */ `
  uniform float uGlow;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vFlash;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    // Four-point star: bright core, two thin rays, a soft halo
    float core = exp(-d * d * 220.0);
    float rays = max(0.0, 1.0 - abs(uv.x) * 28.0) * max(0.0, 1.0 - abs(uv.y) * 2.1)
               + max(0.0, 1.0 - abs(uv.y) * 28.0) * max(0.0, 1.0 - abs(uv.x) * 2.1);
    float diag = max(0.0, 1.0 - abs(uv.x - uv.y) * 22.0) * max(0.0, 1.0 - d * 3.4)
               + max(0.0, 1.0 - abs(uv.x + uv.y) * 22.0) * max(0.0, 1.0 - d * 3.4);
    float halo = exp(-d * d * 30.0) * 0.4;
    float shape = core + rays * (0.55 + vFlash) + diag * 0.25 * vFlash + halo * uGlow;
    float a = clamp(shape * vAlpha, 0.0, 1.0);
    if (a < 0.003) discard;
    vec3 color = mix(vColor, vec3(1.0, 0.98, 0.92), clamp(core * 1.4 + vFlash * 0.5, 0.0, 1.0));
    gl_FragColor = vec4(color * a, a);
  }
`;

const STAR_COLORS = ["#f0b14a", "#e6a23c", "#f3d5a0", "#fff1d6", "#f5c46a"];

function Stars({ pointer, dark }: { pointer: React.RefObject<{ x: number; y: number }>; dark: boolean }) {
  const group = useRef<THREE.Group>(null);
  const started = useRef<number | null>(null);

  const shader = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uPixelRatio: { value: 1 }, uGlow: { value: 1 } }), []);

  const geometry = useMemo(() => {
    const count = 90;
    const base = new Float32Array(count * 3);
    const size = new Float32Array(count);
    const phase = new Float32Array(count);
    const delay = new Float32Array(count);
    const color = new Float32Array(count * 3);
    const tint = new THREE.Color();
    let seed = 7;
    const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < count; i++) {
      // A loose shell around the book, wider than tall
      const theta = random() * Math.PI * 2;
      const radius = 1.4 + random() * 1.3;
      base[i * 3] = Math.cos(theta) * radius * 1.25;
      base[i * 3 + 1] = (random() - 0.4) * 2.0;
      base[i * 3 + 2] = Math.sin(theta) * radius * 0.7;
      const hero = i < 9;
      size[i] = hero ? 46 + random() * 26 : 10 + random() * 18;
      phase[i] = random();
      delay[i] = 0.9 + random() * 1.4;
      tint.set(STAR_COLORS[Math.floor(random() * STAR_COLORS.length)]);
      color.set([tint.r, tint.g, tint.b], i * 3);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    geometry.setAttribute("aBase", new THREE.BufferAttribute(base, 3));
    geometry.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
    geometry.setAttribute("aPhase", new THREE.BufferAttribute(phase, 1));
    geometry.setAttribute("aDelay", new THREE.BufferAttribute(delay, 1));
    geometry.setAttribute("aColor", new THREE.BufferAttribute(color, 3));
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 4);
    return geometry;
  }, []);

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame((state, delta) => {
    if (started.current === null) started.current = state.clock.elapsedTime;
    const m = shader.current;
    if (m) {
      m.uniforms.uTime.value = state.clock.elapsedTime - started.current;
      m.uniforms.uPixelRatio.value = state.gl.getPixelRatio();
      m.uniforms.uGlow.value = dark ? 1.6 : 0.8;
    }
    const g = group.current;
    if (!g) return;
    // Parallax: the stars drift against the pointer, so the book reads as nearer
    const p = pointer.current ?? { x: 0, y: 0 };
    const k = 1 - Math.pow(0.01, delta);
    g.rotation.y += (-p.x * 0.18 - g.rotation.y) * k;
    g.rotation.x += (0.25 - p.y * 0.1 - g.rotation.x) * k;
  });

  return (
    <group ref={group}>
      <points geometry={geometry} frustumCulled={false}>
        <shaderMaterial
          ref={shader}
          vertexShader={STAR_VERTEX}
          fragmentShader={STAR_FRAGMENT}
          uniforms={uniforms}
          transparent
          depthWrite={false}
          premultipliedAlpha
          blending={dark ? THREE.AdditiveBlending : THREE.NormalBlending}
        />
      </points>
    </group>
  );
}

export default function Book3D({ copy, onReady }: { copy: BookCopy; onReady?: () => void }) {
  const wrap = useRef<HTMLDivElement>(null);
  const pointer = useRef({ x: 0, y: 0 });
  const [visible, setVisible] = useState(true);
  const [fontsReady, setFontsReady] = useState(false);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const read = () => setDark(root.classList.contains("dark"));
    read();
    const observer = new MutationObserver(read);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let alive = true;
    const display = fontFamily("--font-garamond", "serif");
    const hand = fontFamily("--font-caveat", "cursive");
    Promise.all([document.fonts.load(`500 80px ${display}`), document.fonts.load(`70px ${hand}`)])
      .catch(() => undefined)
      .then(() => alive && setFontsReady(true));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const node = wrap.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    observer.observe(node);

    function onMove(event: PointerEvent) {
      const rect = node!.getBoundingClientRect();
      pointer.current.x = Math.max(-1, Math.min(1, ((event.clientX - rect.left) / rect.width) * 2 - 1));
      pointer.current.y = Math.max(-1, Math.min(1, ((event.clientY - rect.top) / rect.height) * 2 - 1));
    }

    // Five quick taps on the book still start the broom flight
    let taps = 0;
    let lastTap = 0;
    function onTap() {
      const now = performance.now();
      taps = now - lastTap < 1600 ? taps + 1 : 1;
      lastTap = now;
      if (taps >= 5) {
        taps = 0;
        window.dispatchEvent(new Event("lessons:broom"));
      }
    }

    window.addEventListener("pointermove", onMove);
    node.addEventListener("pointerup", onTap);
    return () => {
      observer.disconnect();
      window.removeEventListener("pointermove", onMove);
      node.removeEventListener("pointerup", onTap);
    };
  }, []);

  return (
    <div ref={wrap} className="book3d" aria-hidden="true">
      {fontsReady ? (
        <Canvas
          shadows
          dpr={[1, 2]}
          frameloop={visible ? "always" : "never"}
          camera={{ position: [0, 0.5, 7.4], fov: 30 }}
          gl={{ antialias: true, alpha: true, toneMapping: THREE.NeutralToneMapping }}
          onCreated={() => onReady?.()}
        >
          <ambientLight intensity={0.6} />
          <directionalLight
            position={[-3, 5, 3]}
            intensity={2.8}
            color="#fff3e4"
            castShadow
            shadow-mapSize={[1024, 1024]}
            shadow-bias={-0.0004}
          />
          <Environment resolution={256}>
            <Lightformer form="rect" intensity={2.4} color="#fff0dc" position={[-4, 3, 2]} scale={[4, 3, 1]} />
            <Lightformer form="rect" intensity={1.2} color="#fff6ea" position={[4, 1, 3]} scale={[3, 3, 1]} />
            <Lightformer form="ring" intensity={2} color="#ffd6b0" position={[0, 4, -3]} scale={2} />
          </Environment>
          <Notebook copy={copy} pointer={pointer} />
          <ContactShadows position={[0, -1.25, 0]} opacity={0.3} scale={4.2} blur={2.8} far={2.6} color="#3e2416" />
          <Stars pointer={pointer} dark={dark} />
        </Canvas>
      ) : null}
    </div>
  );
}
