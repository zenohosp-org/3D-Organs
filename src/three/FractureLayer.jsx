import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useSceneStore } from '../store/useSceneStore';
import { extractPart } from './atlasLoader';
import { buildFracture, fragmentTransform, disposeFracture } from './fracture';
import { TISSUE_PRESETS } from './materials';

/* ===================================================================
   FRACTURE LAYER
   -------------------------------------------------------------------
   Renders the fractured bone as separate fragments in place of the
   intact one. The intact bone is hidden from the merged anatomy mesh by
   its part flag (see AnatomyMesh / partMaterial), so there is never a
   moment where both an unbroken femur and its fragments are on screen.

   THE REDUCTION ANIMATION

   `phase` flips between 'injury' and 'repair', and the fragments move
   between displaced and anatomical over about half a second. That
   animation is the single most useful thing in the whole feature: a
   patient watching the pieces slide back into place understands "we put
   it back and hold it there" immediately, in a way that two static
   images side by side never quite achieve.

   It is driven imperatively in useFrame rather than through React
   state, because a spring animating at 60 fps through a store would
   re-render the entire panel tree sixty times a second for no reason.
   =================================================================== */

const REDUCTION_SPEED = 2.6; // ~0.4 s to travel the full displacement

export default function FractureLayer({ mergedGeometry }) {
  const fracture = useSceneStore((s) => s.fracture);
  const phase = useSceneStore((s) => s.phase);
  const xray = useSceneStore((s) => s.xray);
  const tissueOpacity = useSceneStore((s) => s.tissueOpacity);

  const groupRef = useRef();
  // Current animated reduction: 1 = fully displaced (injury), 0 = reduced.
  const amountRef = useRef(phase === 'injury' ? 1 : 0);

  /* Build the fragments. Rebuilt only when the bone, the pattern or the
     level changes — NOT when displacement changes, since displacement is
     a transform applied to finished geometry. */
  const built = useMemo(() => {
    if (!fracture || !mergedGeometry) return null;
    const bone = extractPart(mergedGeometry, fracture.partIndex);
    if (!bone) return null;
    const result = buildFracture(bone, fracture.pattern, fracture.level);
    bone.dispose();
    return result;
  }, [mergedGeometry, fracture?.partIndex, fracture?.pattern, fracture?.level]);

  useEffect(() => () => disposeFracture(built), [built]);

  const material = useMemo(() => {
    const preset = TISSUE_PRESETS.cortical;
    return new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(preset.color),
      roughness: preset.roughness,
      metalness: 0,
      sheen: preset.sheen,
      sheenColor: new THREE.Color(preset.sheenColor),
      sheenRoughness: 0.6,
      clearcoat: preset.clearcoat,
      clearcoatRoughness: preset.clearcoatRoughness,
      ior: 1.39,
      envMapIntensity: 0.85,
      // Fragments are cut open, so their interior faces are real
      // geometry the camera can see into. DoubleSide stops the break
      // surface reading as a hole.
      side: THREE.DoubleSide,
      transparent: true,
    });
  }, []);

  useEffect(() => {
    const o = xray ? 0.32 : tissueOpacity;
    material.opacity = o;
    material.depthWrite = o >= 0.99;
    material.needsUpdate = true;
  }, [material, xray, tissueOpacity]);

  useEffect(() => () => material.dispose(), [material]);

  /* Animate reduction, and write the fragment matrices directly. */
  useFrame((_, delta) => {
    if (!built || !groupRef.current) return;
    const target = phase === 'injury' ? 1 : 0;
    const cur = amountRef.current;

    if (Math.abs(cur - target) > 0.0005) {
      const step = Math.min(1, delta * REDUCTION_SPEED);
      amountRef.current = cur + (target - cur) * step;
    } else if (cur !== target) {
      amountRef.current = target;
    } else if (!groupRef.current.userData.dirty) {
      return; // settled and nothing changed — skip the matrix work
    }
    groupRef.current.userData.dirty = false;
    applyTransforms();
  });

  const applyTransforms = () => {
    const group = groupRef.current;
    if (!group || !built) return;
    const displacement = fracture?.displacement ?? {};
    built.fragments.forEach((frag, i) => {
      const child = group.children[i];
      if (!child) return;
      if (!frag.mobile) {
        child.matrix.identity();
        child.matrixAutoUpdate = false;
        child.matrixWorldNeedsUpdate = true;
        return;
      }
      const m = fragmentTransform(frag, built, displacement, amountRef.current);
      child.matrix.copy(m);
      child.matrixAutoUpdate = false;
      child.matrixWorldNeedsUpdate = true;
    });
  };

  // Displacement edits must land immediately, not wait for the spring.
  useEffect(() => {
    if (groupRef.current) groupRef.current.userData.dirty = true;
  }, [fracture?.displacement, built]);

  if (!built) return null;

  return (
    <group ref={groupRef}>
      {built.fragments.map((frag, i) => (
        <mesh
          key={i}
          geometry={frag.geometry}
          material={material}
          castShadow
          receiveShadow
        />
      ))}
    </group>
  );
}
