import * as THREE from 'three';

/* ===================================================================
   MATERIAL LIBRARY
   -------------------------------------------------------------------
   Two families, deliberately kept apart because they are lit by
   different physics:

   TISSUE  — dielectric, wet, and translucent. Real organs are lit
             largely by light that enters the surface, scatters
             through a few millimetres of vascular tissue, and leaves
             somewhere else. Full subsurface scattering is far too
             expensive for a 60 fps clinical viewer, so each tissue
             material approximates it with three cheap terms:
               * `sheen` in a warm blood tone for the soft rim glow
                 that scattered light produces at grazing angles,
               * `clearcoat` for the serous wet film every fresh
                 specimen carries, which is a genuinely separate
                 specular lobe from the tissue underneath,
               * `attenuationColor` + light `transmission` on the
                 thin structures (lung, vessel) that really do pass
                 light through their edges.

   HARDWARE — implant stock. Titanium, steel, cobalt-chrome, PEEK and
             zirconia are simple by comparison: metalness is 0 or 1
             with nothing in between, and the whole read comes from
             the roughness value, which is why the numbers below are
             matched to real surface finishes rather than picked for
             looks (see ROUGHNESS notes on each entry).
   =================================================================== */

/** Shared cache — materials are immutable here, so one instance per
 *  preset serves every mesh and keeps the draw-call state changes low. */
const cache = new Map();

function build(key, factory) {
  if (!cache.has(key)) cache.set(key, factory());
  return cache.get(key);
}

/* -------------------------------------------------------------------
   Tissue presets
   ------------------------------------------------------------------- */

export const TISSUE_PRESETS = {
  myocardium: {
    label: 'Myocardium',
    color: '#8f2f2b',
    roughness: 0.44,
    sheenColor: '#ff6b5e',
    sheen: 0.85,
    clearcoat: 0.55,
    clearcoatRoughness: 0.28,
  },
  lung: {
    label: 'Pulmonary tissue',
    color: '#c8767c',
    roughness: 0.62,
    sheenColor: '#ffb4b0',
    sheen: 1.0,
    clearcoat: 0.22,
    clearcoatRoughness: 0.45,
    transmission: 0.14,
    thickness: 1.4,
    attenuationColor: '#b0454b',
  },
  hepatic: {
    label: 'Hepatic parenchyma',
    color: '#6b2b24',
    roughness: 0.38,
    sheenColor: '#c9564a',
    sheen: 0.7,
    clearcoat: 0.7,
    clearcoatRoughness: 0.2,
  },
  renal: {
    label: 'Renal cortex',
    color: '#8a3b2e',
    roughness: 0.4,
    sheenColor: '#e0705c',
    sheen: 0.75,
    clearcoat: 0.6,
    clearcoatRoughness: 0.25,
  },
  gastric: {
    label: 'Gastric wall',
    color: '#bb8570',
    roughness: 0.55,
    sheenColor: '#f0b49c',
    sheen: 0.9,
    clearcoat: 0.4,
    clearcoatRoughness: 0.35,
  },
  neural: {
    label: 'Neural tissue',
    color: '#cdb0a6',
    roughness: 0.66,
    sheenColor: '#f2d9d0',
    sheen: 0.8,
    clearcoat: 0.3,
    clearcoatRoughness: 0.4,
  },
  vessel: {
    label: 'Vasculature',
    color: '#9e3340',
    roughness: 0.35,
    sheenColor: '#ff7a7a',
    sheen: 0.9,
    clearcoat: 0.75,
    clearcoatRoughness: 0.18,
    transmission: 0.1,
    thickness: 0.6,
    attenuationColor: '#7d1f2a',
  },
  cortical: {
    label: 'Cortical bone',
    // Fresh cortical bone is a warm off-white, not the bleached grey of
    // a teaching skeleton — specimens read closer to old ivory.
    color: '#e3d9c2',
    roughness: 0.52,
    sheenColor: '#fff6e2',
    sheen: 0.4,
    clearcoat: 0.25,
    clearcoatRoughness: 0.4,
  },
  cancellous: {
    label: 'Cancellous bone',
    color: '#d6c6a6',
    roughness: 0.78,
    sheenColor: '#f5e9cf',
    sheen: 0.3,
    clearcoat: 0.08,
    clearcoatRoughness: 0.6,
  },
  cartilage: {
    label: 'Cartilage',
    color: '#dfe6e3',
    roughness: 0.3,
    sheenColor: '#ffffff',
    sheen: 0.5,
    clearcoat: 0.6,
    clearcoatRoughness: 0.2,
    transmission: 0.25,
    thickness: 0.8,
    attenuationColor: '#b9cfc8',
  },
};

/* -------------------------------------------------------------------
   Hardware presets
   ------------------------------------------------------------------- */

export const HARDWARE_PRESETS = {
  titanium: {
    label: 'Titanium (Ti-6Al-4V)',
    color: '#9aa0a6',
    metalness: 1,
    // Anodised/blasted orthopaedic titanium is deliberately matte —
    // it scatters theatre light instead of throwing a mirror glare.
    roughness: 0.42,
    swatch: '#a8aeb4',
  },
  titaniumPolished: {
    label: 'Titanium — polished',
    color: '#b6bcc2',
    metalness: 1,
    roughness: 0.16,
    swatch: '#c3c9cf',
  },
  stainless: {
    label: 'Stainless steel 316L',
    color: '#c9ced4',
    metalness: 1,
    roughness: 0.12,
    swatch: '#d6dbe0',
  },
  cobaltChrome: {
    label: 'Cobalt-chrome',
    color: '#d8dde2',
    metalness: 1,
    // CoCr bearing surfaces are lapped to a near-mirror finish; this is
    // the shiniest thing that will ever appear in the scene.
    roughness: 0.06,
    swatch: '#e2e7ec',
  },
  peek: {
    label: 'PEEK polymer',
    color: '#d8cfae',
    metalness: 0,
    roughness: 0.55,
    swatch: '#ddd5bb',
  },
  zirconia: {
    label: 'Zirconia ceramic',
    color: '#f2f0ec',
    metalness: 0,
    roughness: 0.14,
    clearcoat: 0.9,
    swatch: '#f6f5f2',
  },
  hydroxyapatite: {
    label: 'HA-coated',
    color: '#e6ddc8',
    metalness: 0,
    roughness: 0.82,
    swatch: '#ebe3d2',
  },
  corticalGraft: {
    label: 'Cortical bone graft',
    color: '#e3d9c2',
    metalness: 0,
    roughness: 0.52,
    swatch: '#e8dfcb',
  },
  cancellousGraft: {
    label: 'Cancellous graft',
    color: '#d6c6a6',
    metalness: 0,
    roughness: 0.8,
    swatch: '#dccfb3',
  },
};

export function hardwareMaterial(presetKey) {
  const p = HARDWARE_PRESETS[presetKey] ?? HARDWARE_PRESETS.titanium;
  return build(`hw:${presetKey}`, () =>
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(p.color),
      metalness: p.metalness,
      roughness: p.roughness,
      clearcoat: p.clearcoat ?? 0,
      clearcoatRoughness: 0.1,
      // Metal has no diffuse term at all, so an implant is *entirely* a
      // reflection of its environment. Without a strong env map it reads
      // as flat grey plastic — hence the boost above 1 for the metals.
      envMapIntensity: p.metalness ? 1.35 : 0.9,
    })
  );
}
