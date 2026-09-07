import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useGLTF } from '@react-three/drei';
import { useSceneStore } from '../store/useSceneStore';

/* ===================================================================
   TEXTURED ORGAN MODELS
   -------------------------------------------------------------------
   The BodyParts3D atlas is segmentation-derived: geometrically honest,
   but untextured. These four GLBs are photogrammetry-style scans with
   baked PBR texture sets, and they cover exactly what the atlas lacks
   — lung parenchyma, whole liver, solid myocardium.

   Two things are normalised on load, because assets from different
   sources never agree on either:

   SCALE — each model is rescaled so its bounding sphere matches the
           scene's working radius. Without this a liver authored in
           metres and a heart authored in centimetres differ by 100x
           and one of them is invisible.

   COLOUR SPACE — baked base-colour textures must be tagged sRGB or
           they render washed out and slightly green. glTF loaders get
           this right for `map`, but roughness/normal maps must stay
           linear, so the fix has to be selective rather than a blanket
           pass over every texture.
   =================================================================== */

export const ORGAN_MODELS = [
  {
    id: 'heart',
    label: 'Heart',
    file: 'heart.glb',
    hint: 'Textured myocardium — fills the atlas gap (atlas has walls and valves only)',
    radius: 7,
    anchor: /\b(wall of (left |right )?(atrium|ventricle)|cavity of (left|right) (atrium|ventricle))\b/i,
  },
  {
    id: 'lung',
    label: 'Lungs',
    file: 'lung.glb',
    hint: 'Lung parenchyma — absent from the atlas entirely',
    radius: 14,
    anchor: /\b(bronchial tree|main bronchus)\b/i,
  },
  {
    id: 'liver',
    label: 'Liver',
    file: 'liver.glb',
    hint: 'Whole liver with lobes — atlas has biliary tree only',
    radius: 11,
    anchor: /\b(hepatic biliary tree|caudate lobe of liver|gallbladder)\b/i,
  },
  {
    id: 'kidney',
    label: 'Kidney',
    file: 'kidney.glb',
    hint: 'Sectioned kidney showing cortex, medulla and pelvis',
    radius: 6,
    anchor: /^Right kidney$/i,
  },
];

/* Scene units are centimetres (see ATLAS_SCALE in atlasLoader.js), so
   each model is normalised to its real anatomical radius rather than to
   one shared number. A liver and a kidney are not the same size, and
   scaling both to a common radius is exactly the error that makes a
   viewer look like a toy. */
const FALLBACK_RADIUS = 8;

/**
 * Where this organ belongs in the body.
 *
 * A textured mesh carries no body coordinates — it is authored centred
 * on its own origin — so dropping it into the scene puts a liver at the
 * patient's pelvis. The atlas DOES know where each organ lives, so the
 * position is derived from it: take the structures named by the model's
 * `anchor`, and use the centre of their combined bounds.
 *
 * Returns null when the atlas has no matching structure, in which case
 * the caller leaves the model at the origin rather than guessing.
 */
export function organAnchor(atlas, file) {
  const def = ORGAN_MODELS.find((m) => m.file === file);
  if (!atlas || !def?.anchor) return null;
  const hits = atlas.parts.filter((p) => def.anchor.test(p.name));
  if (!hits.length) return null;

  const box = new THREE.Box3();
  const v = new THREE.Vector3();
  hits.forEach((p) => {
    box.expandByPoint(v.fromArray(p.bounds[0]));
    box.expandByPoint(v.fromArray(p.bounds[1]));
  });
  return box.getCenter(new THREE.Vector3());
}

export default function OrganModel({ file, position }) {
  const url = `${import.meta.env.BASE_URL}models/organs/${file}`;
  const { scene } = useGLTF(url);
  const xray = useSceneStore((s) => s.xray);
  const tissueOpacity = useSceneStore((s) => s.tissueOpacity);

  /* Clone so two viewers (or a remount) never mutate the cached GLTF
     that useGLTF hands out by reference. */
  const model = useMemo(() => {
    const root = scene.clone(true);

    root.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.receiveShadow = true;

      // Materials are cloned too — shared material instances would mean
      // toggling x-ray on one organ ghosts every other organ using the
      // same source material.
      const wasArray = Array.isArray(o.material);
      const mats = wasArray ? o.material : [o.material];
      const cloned = mats.map((m) => {
        const c = m.clone();
        if (c.map) c.map.colorSpace = THREE.SRGBColorSpace;
        if (c.emissiveMap) c.emissiveMap.colorSpace = THREE.SRGBColorSpace;
        // Normal / roughness / metalness / AO maps carry DATA, not
        // colour. Tagging them sRGB would visibly flatten the surface.
        [c.normalMap, c.roughnessMap, c.metalnessMap, c.aoMap].forEach((t) => {
          if (t) t.colorSpace = THREE.LinearSRGBColorSpace;
        });
        c.envMapIntensity = 0.9;
        c.side = THREE.FrontSide;
        return c;
      });
      o.material = wasArray ? cloned : cloned[0];
    });

    // Centre on the origin and normalise size.
    const box = new THREE.Box3().setFromObject(root);
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const target = ORGAN_MODELS.find((m) => m.file === file)?.radius ?? FALLBACK_RADIUS;
    if (sphere.radius > 0) {
      const k = target / sphere.radius;
      root.scale.setScalar(k);
      root.position.copy(sphere.center).multiplyScalar(-k);
    }
    return root;
  }, [scene, file]);

  /* X-ray and opacity are applied as an effect rather than baked into
     the clone, so toggling does not rebuild the whole object graph. */
  useEffect(() => {
    const o = xray ? 0.3 : tissueOpacity;
    model.traverse((n) => {
      if (!n.isMesh) return;
      const mats = Array.isArray(n.material) ? n.material : [n.material];
      mats.forEach((m) => {
        m.transparent = o < 0.99;
        m.opacity = o;
        m.depthWrite = o >= 0.99;
        m.needsUpdate = true;
      });
    });
  }, [model, xray, tissueOpacity]);

  useEffect(
    () => () => {
      model.traverse((n) => {
        if (!n.isMesh) return;
        const mats = Array.isArray(n.material) ? n.material : [n.material];
        mats.forEach((m) => m.dispose());
      });
    },
    [model]
  );

  return (
    <group position={position ?? [0, 0, 0]}>
      <primitive object={model} />
    </group>
  );
}

/** Warm the cache for a model the doctor is likely to open next. */
OrganModel.preload = (file) =>
  useGLTF.preload(`${import.meta.env.BASE_URL}models/organs/${file}`);
