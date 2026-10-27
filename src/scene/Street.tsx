import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { MODEL_PATHS } from "../models.ts";
import { SIGNAL_LINES, POLE_OFFSET, FINISH_X } from "../sim/constants.ts";
import { mulberry32 } from "../sim/signals.ts";
import { StaticCar } from "./Car.tsx";

// The road is 60 m tiles centred on x = k * 60, so tile k (and everything laid out inside it) is "chunk k".
const CHUNK = 60;
export const chunkOf = (x: number) => Math.floor((x + CHUNK / 2) / CHUNK);
const WORLD_END = FINISH_X + 90;

// Building widths (m) as modelled in blender/scripts/50_buildings.py - used only for layout spacing.
const BUILDING_W = [18, 15, 12, 21, 15, 18];
const PAINTS = ["#c9ccd1", "#f1f2f4", "#1b2a49", "#2f3a2f", "#7a8088", "#8c1c13"];
const poleXs = SIGNAL_LINES.map((l) => l + POLE_OFFSET);
const nearSignal = (x: number, r = 9) => poleXs.some((p) => Math.abs(p - x) < r);

interface BuildingSpot { key: string; x: number; z: number; idx: number; flip: boolean }
interface TreeSpot { key: string; x: number; z: number; s: number; r: number }
interface LampSpot { key: string; x: number; flip: boolean }
interface CarSpot { key: string; x: number; paint: string }

/** Deterministic street layout, generated once. */
function useLayout() {
  return useMemo(() => {
    const rnd = mulberry32(2024);
    const buildings: BuildingSpot[] = [];
    for (const side of [-1, 1] as const) {
      let cursor = -50;
      while (cursor < WORLD_END) {
        const idx = Math.floor(rnd() * BUILDING_W.length);
        const w = BUILDING_W[idx];
        buildings.push({ key: `b${side}${buildings.length}`, x: cursor + w / 2, z: side * (7.1 + rnd() * 2.2), idx, flip: side === 1 });
        cursor += w + 1.2 + rnd() * 3;
      }
    }
    const trees: TreeSpot[] = [];
    for (let x = -40; x < WORLD_END; x += 12) for (const side of [-1, 1]) {
      const tx = x + (rnd() - 0.5) * 3;
      if (nearSignal(tx, 7)) continue;
      trees.push({ key: `t${side}${x}`, x: tx, z: side * (5.5 + rnd() * 0.4), s: 0.85 + rnd() * 0.45, r: rnd() * 6.28 });
    }
    const lamps: LampSpot[] = [];
    for (let i = 0, x = -30; x < WORLD_END; x += 30, i++) {
      if (nearSignal(x, 5)) { continue; }
      lamps.push({ key: `l${i}`, x, flip: i % 2 === 0 });
    }
    const cars: CarSpot[] = [];
    for (let x = 60; x < WORLD_END; x += 70 + rnd() * 50) {
      if (nearSignal(x, 30)) continue;
      cars.push({ key: `c${x | 0}`, x, paint: PAINTS[Math.floor(rnd() * PAINTS.length)] });
    }
    return { buildings, trees, lamps, cars };
  }, []);
}

/** Re-renders (rarely) when the player enters a new 60 m chunk; per-frame work is just the integer compare. */
export function useChunk(getX: () => number) {
  const [chunk, setChunk] = useState(() => chunkOf(getX()));
  const get = useRef(getX); get.current = getX;
  useFrame(() => { const c = chunkOf(get.current()); setChunk((prev) => (prev === c ? prev : c)); });
  return chunk;
}

/** `hero`: skip the camera-side (+Z) of the street, so a side-on tracking shot from behind it isn't blocked by trees and signs. */
export function Street({ getX, hero = false }: { getX: () => number; hero?: boolean }) {
  const chunk = useChunk(getX);
  const { buildings, trees, lamps, cars } = useLayout();
  const lo = chunk - 1, hi = chunk + 4;
  const inRange = (x: number) => { const c = chunkOf(x); return c >= lo && c <= hi; };
  const tiles = [];
  for (let k = Math.max(0, lo); k <= Math.min(hi, chunkOf(WORLD_END)); k++) tiles.push(k);

  return (
    <group>
      {tiles.map((k) => <RoadTile key={k} x={k * CHUNK} />)}
      {buildings.filter((b) => inRange(b.x) && !(hero && b.z > 0)).map((b) => <Building key={b.key} spot={b} />)}
      {trees.filter((t) => inRange(t.x) && !(hero && t.z > 0)).map((t) => <Tree key={t.key} spot={t} />)}
      {lamps.filter((l) => inRange(l.x) && !(hero && !l.flip)).map((l) => <StreetLight key={l.key} spot={l} />)}
      {cars.filter((c) => inRange(c.x)).map((c) => <StaticCar key={c.key} position={[c.x, 0, -2.85]} paint={c.paint} />)}
    </group>
  );
}

function RoadTile({ x }: { x: number }) {
  const { scene } = useGLTF(MODEL_PATHS.road);
  const obj = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.receiveShadow = true; } });
    return c;
  }, [scene]);
  return <primitive object={obj} position={[x, 0, 0]} />;
}

function Building({ spot: { x, z, idx, flip } }: { spot: BuildingSpot }) {
  const { scene } = useGLTF(MODEL_PATHS.buildings);
  // The compressor bakes a quantisation offset into each node's transform, so never overwrite a node's
  // position. Anchor the clone by its bounding box instead: front-centre of the awning side at the origin.
  const inner = useMemo(() => {
    const node = scene.getObjectByName(`Building_${idx}`)!;
    node.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(node);
    const clone = node.clone(true);
    clone.position.x -= (box.min.x + box.max.x) / 2;
    clone.position.y -= box.min.y;
    clone.position.z -= box.max.z;
    return clone;
  }, [scene, idx]);
  return <group position={[x, 0, z]} rotation-y={flip ? Math.PI : 0}><primitive object={inner} /></group>;
}

function Tree({ spot: { x, z, s, r } }: { spot: TreeSpot }) {
  const { scene } = useGLTF(MODEL_PATHS.tree);
  const obj = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) m.castShadow = true; });
    return c;
  }, [scene]);
  return <group position={[x, 0.15, z]} rotation-y={r} scale={s}><primitive object={obj} /></group>;
}

function StreetLight({ spot: { x, flip } }: { spot: LampSpot }) {
  const { scene } = useGLTF(MODEL_PATHS.streetlight);
  const obj = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) m.castShadow = true; });
    return c;
  }, [scene]);
  // arm extends towards three -Z by default (towards the road when standing on the +Z sidewalk)
  return <group position={[x, 0.15, flip ? -6.2 : 6.2]} rotation-y={flip ? Math.PI : 0}><primitive object={obj} /></group>;
}

/** Stop lines, zebra crossings and the finish line, as flat instanced boxes. */
export function RoadMarkings() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const count = SIGNAL_LINES.length * 12 + 1;
  useEffect(() => {
    const m = ref.current!; const d = new THREE.Object3D(); let i = 0;
    const put = (x: number, z: number, sx: number, sz: number) => {
      d.position.set(x, 0.17 - 0.155, z); d.scale.set(sx, 1, sz); d.updateMatrix(); m.setMatrixAt(i++, d.matrix);
    };
    for (const l of SIGNAL_LINES) {
      put(l + 0.2, 0, 0.42, 7);                                        // stop line
      for (let k = 0; k < 11; k++) put(l + 3.4, -3.3 + k * 0.66, 3, 0.4); // zebra stripes (run along x)
    }
    put(FINISH_X + 0.3, 0, 0.8, 7);                                    // finish line
    m.instanceMatrix.needsUpdate = true;
  }, []);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} receiveShadow>
      <boxGeometry args={[1, 0.01, 1]} />
      <meshStandardMaterial color="#ecebe4" roughness={0.65} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
    </instancedMesh>
  );
}
