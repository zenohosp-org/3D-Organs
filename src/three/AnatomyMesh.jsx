import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useSceneStore } from '../store/useSceneStore';
import { classifyTissue } from '../data/anatomy';
import { TISSUE_PRESETS } from './materials';
import {
  createPartTextures,
  applyPartShading,
  setPartColor,
  setPartFlags,
} from './partMaterial';

/* ===================================================================
   ANATOMY MESH
   -------------------------------------------------------------------
   One mesh, one draw call, N independently controllable structures.
   See partMaterial.js for how the per-part lookup works.

   The component's job is to keep the two lookup textures in sync with
   the store, and to translate raycast hits back into part indices.
   =================================================================== */

const _color = new THREE.Color();

export default function AnatomyMesh({ geometry, parts, onPick }) {
  const hiddenParts = useSceneStore((s) => s.hiddenParts);
  const tissueOverrides = useSceneStore((s) => s.tissueOverrides);
  const selectedPart = useSceneStore((s) => s.selectedPart);
  const hoveredPart = useSceneStore((s) => s.hoveredPart);
  const xray = useSceneStore((s) => s.xray);
  const tissueOpacity = useSceneStore((s) => s.tissueOpacity);
  const setHovered = useSceneStore((s) => s.setHovered);
  const fracturedPart = useSceneStore((s) => s.fracture?.partIndex ?? -1);

  /* ---- Lookup textures, sized to this part list ---- */
  const partStore = useMemo(() => createPartTextures(parts.length), [parts]);

  /* ---- The material. Transparency is a structural property of the
     material (it changes the render path), so x-ray gets its own
     material instance rather than a mutated flag on a shared one. ---- */
  const material = useMemo(() => {
    const m = new THREE.MeshPhysicalMaterial({
      // Base colour is white: the real colour arrives per-part from the
      // lookup texture and is MULTIPLIED into this. Any tint here would
      // contaminate every structure.
      color: 0xffffff,
      vertexColors: false,
      roughness: 0.5,
      metalness: 0,
      sheen: 0.6,
      sheenColor: new THREE.Color('#ff8a7a'),
      sheenRoughness: 0.65,
      clearcoat: 0.45,
      clearcoatRoughness: 0.3,
      ior: 1.39,
      envMapIntensity: 0.9,
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: true,
    });
    applyPartShading(m, partStore);
    return m;
  }, [partStore]);

  useEffect(() => () => material.dispose(), [material]);

  /* ---- Colour table: rebuilt only when the parts or the doctor's
     tissue overrides change, not every frame. ---- */
  useEffect(() => {
    parts.forEach((part, i) => {
      const key = tissueOverrides[i] ?? classifyTissue(part);
      const preset = TISSUE_PRESETS[key] ?? TISSUE_PRESETS.gastric;
      _color.set(preset.color);
      // A little deterministic per-part value jitter. Real tissue is
      // never one flat colour across forty structures, and without this
      // the arterial tree reads as a single moulded plastic object.
      // Seeded off the part id so it is stable across reloads.
      let h = 0;
      for (let c = 0; c < part.id.length; c++) h = (h * 31 + part.id.charCodeAt(c)) | 0;
      const jitter = 1 + ((h % 100) / 100 - 0.5) * 0.14;
      _color.multiplyScalar(jitter);
      setPartColor(partStore, i, _color, 1);
    });
  }, [parts, tissueOverrides, partStore]);

  /* ---- Flags: visibility, hover, selection ---- */
  useEffect(() => {
    parts.forEach((_, i) => {
      setPartFlags(partStore, i, {
        // The fractured bone is drawn by FractureLayer as separate
        // fragments, so the intact original must go — otherwise an
        // unbroken femur sits inside its own fragments.
        visible: hiddenParts.has(i) || i === fracturedPart ? 0 : 1,
        hover: hoveredPart === i ? 1 : 0,
        selected: selectedPart === i ? 1 : 0,
      });
    });
  }, [parts, hiddenParts, hoveredPart, selectedPart, partStore, fracturedPart]);

  /* ---- X-ray / global opacity ---- */
  useEffect(() => {
    const o = xray ? 0.26 : tissueOpacity;
    material.opacity = o;
    // Writing depth on a translucent shell makes structures behind it
    // vanish, which defeats the whole point of an x-ray view.
    material.depthWrite = o >= 0.99;
    material.needsUpdate = true;
  }, [xray, tissueOpacity, material]);

  const handleMove = (e) => {
    e.stopPropagation();
    const idx = indexFromEvent(e, geometry);
    if (idx >= 0 && !hiddenParts.has(idx)) setHovered(idx);
    else setHovered(-1);
  };

  const handleOut = () => setHovered(-1);

  const handleClick = (e) => {
    e.stopPropagation();
    const idx = indexFromEvent(e, geometry);
    if (idx >= 0 && !hiddenParts.has(idx)) onPick?.(idx, e);
  };

  return (
    <mesh
      geometry={geometry}
      material={material}
      castShadow
      receiveShadow
      onPointerMove={handleMove}
      onPointerOut={handleOut}
      onClick={handleClick}
    />
  );
}

/** Raycast hit -> part index, via the aPartIndex attribute on the
 *  first vertex of the hit face. */
function indexFromEvent(e, geometry) {
  const face = e.face;
  if (!face) return -1;
  const attr = geometry.getAttribute('aPartIndex');
  if (!attr) return -1;
  return attr.getX(face.a);
}
