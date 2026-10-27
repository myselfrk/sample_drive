import { useRef } from "react";
import * as THREE from "three";
import { Environment as DreiEnv, Lightformer, Sky } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer, SMAA, ToneMapping, Vignette } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";

// Golden-hour sun direction (from the scene towards the sun): low, behind-left of the driving direction.
const SUN = new THREE.Vector3(0.55, 0.42, -0.72).normalize();
const FOG = "#e6c7a3";

/** Sky, golden-hour sun that follows the car (tight shadow frustum), procedural reflections, fog and post. */
export function Atmosphere({ getX }: { getX: () => number }) {
  const sun = useRef<THREE.DirectionalLight>(null);
  const scene = useThree((s) => s.scene);

  useFrame(() => {
    const l = sun.current; if (!l) return;
    const x = getX();
    l.position.set(x + SUN.x * 70, SUN.y * 70, SUN.z * 70);
    l.target.position.set(x, 0, 0); l.target.updateMatrixWorld();
  });

  return (
    <>
      <color attach="background" args={[FOG]} />
      <fog attach="fog" args={[FOG, 70, 330]} />
      <Sky distance={450000} sunPosition={SUN.clone().multiplyScalar(100).toArray()} turbidity={6} rayleigh={1.5} mieCoefficient={0.006} mieDirectionalG={0.85} />
      <hemisphereLight args={["#bcd3ff", "#6b5a48", 0.55]} />
      <directionalLight
        ref={(l) => { sun.current = l; if (l) scene.add(l.target); }}
        color="#ffd6a0" intensity={3.2} castShadow
        shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-normalBias={0.03}
        shadow-camera-left={-22} shadow-camera-right={22} shadow-camera-top={22} shadow-camera-bottom={-22}
        shadow-camera-near={1} shadow-camera-far={160}
      />
      {/* procedural studio-sky reflections: no HDRI download, so it works offline and stays tiny */}
      <DreiEnv resolution={256} frames={1} environmentIntensity={0.9}>
        <Lightformer form="rect" intensity={5} color="#ffd9a8" position={[-8, 4, -9]} scale={[22, 8, 1]} />
        <Lightformer form="rect" intensity={2.2} color="#9ec2ff" position={[0, 9, 0]} rotation-x={Math.PI / 2} scale={[40, 40, 1]} />
        <Lightformer form="rect" intensity={1.4} color="#ffffff" position={[10, 3, 6]} rotation-y={-Math.PI / 2} scale={[18, 4, 1]} />
        <Lightformer form="ring" intensity={2} color="#fff1da" position={[0, 6, 10]} scale={6} />
        {/* ground bounce: gives wheels, rims and lower panels something warm to reflect */}
        <Lightformer form="rect" intensity={0.9} color="#d9c3a5" position={[0, -1.5, 0]} rotation-x={-Math.PI / 2} scale={[40, 40, 1]} />
      </DreiEnv>
    </>
  );
}

export function PostFx() {
  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <Bloom mipmapBlur luminanceThreshold={1.0} luminanceSmoothing={0.2} intensity={0.45} />
      <Vignette eskil={false} offset={0.25} darkness={0.55} />
      <SMAA />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  );
}
