/* ===================================================================
   IMPLANT CATALOGUE
   -------------------------------------------------------------------
   Each entry describes a class of hardware plus the parameters a
   surgeon actually chooses it by. Ranges below are the real clinical
   envelopes for each device — a 4.5 mm cortical screw genuinely does
   come in 10-110 mm lengths, and a femoral IM nail genuinely is
   300-460 mm — so the sliders cannot dial in a size that does not
   exist. That constraint is the point: a planner that lets you place a
   700 mm nail is a toy.

   `params` drives the properties panel generically, so adding a device
   here is the whole job — no UI change required.

   All lengths are millimetres. Angles are degrees.
   =================================================================== */

/** @typedef {{key:string,label:string,min:number,max:number,step:number,unit:string,default:number}} ParamSpec */

export const IMPLANT_CATALOG = [
  /* ---------------- Fixation: screws ---------------- */
  {
    id: 'cortical-screw',
    kind: 'screw',
    category: 'Screws',
    label: 'Cortical screw',
    blurb: 'Fine-pitch, fully threaded. Diaphyseal fixation through two cortices.',
    defaultMaterial: 'titanium',
    params: [
      { key: 'length', label: 'Length', min: 10, max: 110, step: 1, unit: 'mm', default: 40 },
      { key: 'diameter', label: 'Thread Ø', min: 1.5, max: 6.5, step: 0.1, unit: 'mm', default: 4.5 },
      { key: 'headDiameter', label: 'Head Ø', min: 3, max: 12, step: 0.1, unit: 'mm', default: 8 },
      { key: 'pitch', label: 'Pitch', min: 0.6, max: 3, step: 0.05, unit: 'mm', default: 1.75 },
    ],
  },
  {
    id: 'cancellous-screw',
    kind: 'screw',
    category: 'Screws',
    label: 'Cancellous screw',
    blurb: 'Coarse pitch, partially threaded. Metaphyseal and epiphyseal purchase.',
    defaultMaterial: 'titanium',
    params: [
      { key: 'length', label: 'Length', min: 20, max: 130, step: 1, unit: 'mm', default: 65 },
      { key: 'diameter', label: 'Thread Ø', min: 3, max: 8, step: 0.1, unit: 'mm', default: 6.5 },
      { key: 'headDiameter', label: 'Head Ø', min: 4, max: 14, step: 0.1, unit: 'mm', default: 9 },
      { key: 'pitch', label: 'Pitch', min: 1.5, max: 4, step: 0.05, unit: 'mm', default: 2.75 },
    ],
  },
  {
    id: 'cannulated-screw',
    kind: 'screw',
    category: 'Screws',
    label: 'Cannulated screw',
    blurb: 'Hollow core, placed over a guidewire. Femoral neck and hindfoot.',
    defaultMaterial: 'titanium',
    fixed: { cannulated: true },
    params: [
      { key: 'length', label: 'Length', min: 30, max: 130, step: 1, unit: 'mm', default: 85 },
      { key: 'diameter', label: 'Thread Ø', min: 3, max: 8, step: 0.1, unit: 'mm', default: 7.3 },
      { key: 'headDiameter', label: 'Head Ø', min: 5, max: 14, step: 0.1, unit: 'mm', default: 10 },
      { key: 'pitch', label: 'Pitch', min: 1.5, max: 4, step: 0.05, unit: 'mm', default: 2.75 },
    ],
  },
  {
    id: 'pedicle-screw',
    kind: 'screw',
    category: 'Spinal',
    label: 'Pedicle screw',
    blurb: 'Polyaxial tulip head. Posterior thoracolumbar instrumentation.',
    defaultMaterial: 'titanium',
    fixed: { headStyle: 'tulip' },
    params: [
      { key: 'length', label: 'Length', min: 25, max: 60, step: 1, unit: 'mm', default: 45 },
      { key: 'diameter', label: 'Thread Ø', min: 4, max: 8.5, step: 0.5, unit: 'mm', default: 6.5 },
      { key: 'headDiameter', label: 'Tulip Ø', min: 8, max: 16, step: 0.5, unit: 'mm', default: 12 },
      { key: 'pitch', label: 'Pitch', min: 1.5, max: 3.5, step: 0.05, unit: 'mm', default: 2.6 },
    ],
  },

  /* ---------------- Fixation: plates & wires ---------------- */
  {
    id: 'locking-plate',
    kind: 'plate',
    category: 'Plates',
    label: 'Locking compression plate',
    blurb: 'Pre-contoured, threaded holes. Angular-stable diaphyseal fixation.',
    defaultMaterial: 'titanium',
    fixed: { locking: true },
    params: [
      { key: 'holes', label: 'Holes', min: 2, max: 16, step: 1, unit: '', default: 8 },
      { key: 'length', label: 'Length', min: 40, max: 300, step: 2, unit: 'mm', default: 130 },
      { key: 'width', label: 'Width', min: 6, max: 22, step: 0.5, unit: 'mm', default: 12 },
      { key: 'thickness', label: 'Thickness', min: 1.5, max: 6, step: 0.1, unit: 'mm', default: 3.2 },
      { key: 'contour', label: 'Contour', min: 0, max: 0.3, step: 0.005, unit: '', default: 0.1 },
    ],
  },
  {
    id: 'recon-plate',
    kind: 'plate',
    category: 'Plates',
    label: 'Reconstruction plate',
    blurb: 'Notched, hand-bendable in three planes. Pelvis and clavicle.',
    defaultMaterial: 'stainless',
    fixed: { locking: false },
    params: [
      { key: 'holes', label: 'Holes', min: 3, max: 20, step: 1, unit: '', default: 10 },
      { key: 'length', label: 'Length', min: 50, max: 260, step: 2, unit: 'mm', default: 150 },
      { key: 'width', label: 'Width', min: 6, max: 16, step: 0.5, unit: 'mm', default: 10 },
      { key: 'thickness', label: 'Thickness', min: 1.5, max: 4.5, step: 0.1, unit: 'mm', default: 2.8 },
      { key: 'contour', label: 'Contour', min: 0, max: 0.35, step: 0.005, unit: '', default: 0.16 },
    ],
  },
  {
    id: 'im-nail',
    kind: 'nail',
    category: 'Nails & rods',
    label: 'Intramedullary nail',
    blurb: 'Load-sharing, anterior bow. Femoral and tibial shaft fractures.',
    defaultMaterial: 'titanium',
    params: [
      { key: 'length', label: 'Length', min: 160, max: 460, step: 5, unit: 'mm', default: 360 },
      { key: 'proximal', label: 'Proximal Ø', min: 8, max: 16, step: 0.5, unit: 'mm', default: 11 },
      { key: 'distal', label: 'Distal Ø', min: 7, max: 14, step: 0.5, unit: 'mm', default: 9 },
      { key: 'lockHoles', label: 'Lock holes', min: 0, max: 6, step: 1, unit: '', default: 4 },
      { key: 'curvature', label: 'Anterior bow', min: 0, max: 0.1, step: 0.002, unit: '', default: 0.03 },
    ],
  },
  {
    id: 'spinal-rod',
    kind: 'nail',
    category: 'Spinal',
    label: 'Spinal rod',
    blurb: 'Contoured rod seated in pedicle-screw tulips.',
    defaultMaterial: 'cobaltChrome',
    fixed: { lockHoles: 0 },
    params: [
      { key: 'length', label: 'Length', min: 40, max: 500, step: 5, unit: 'mm', default: 180 },
      { key: 'proximal', label: 'Rod Ø', min: 3.5, max: 6.35, step: 0.05, unit: 'mm', default: 5.5 },
      { key: 'distal', label: 'Distal Ø', min: 3.5, max: 6.35, step: 0.05, unit: 'mm', default: 5.5 },
      { key: 'curvature', label: 'Sagittal contour', min: 0, max: 0.2, step: 0.004, unit: '', default: 0.05 },
    ],
  },
  {
    id: 'k-wire',
    kind: 'wire',
    category: 'Nails & rods',
    label: 'K-wire / Steinmann pin',
    blurb: 'Provisional or definitive percutaneous fixation.',
    defaultMaterial: 'stainless',
    params: [
      { key: 'length', label: 'Length', min: 40, max: 300, step: 5, unit: 'mm', default: 150 },
      { key: 'diameter', label: 'Ø', min: 0.8, max: 5, step: 0.1, unit: 'mm', default: 2 },
    ],
  },

  /* ---------------- Arthroplasty ---------------- */
  {
    id: 'femoral-stem',
    kind: 'stem',
    category: 'Arthroplasty',
    label: 'Femoral stem',
    blurb: 'Tapered wedge stem with modular head. Total hip arthroplasty.',
    defaultMaterial: 'titanium',
    params: [
      { key: 'length', label: 'Stem length', min: 90, max: 220, step: 5, unit: 'mm', default: 140 },
      { key: 'neckAngle', label: 'Neck-shaft angle', min: 118, max: 145, step: 1, unit: '°', default: 132 },
      { key: 'headDiameter', label: 'Head Ø', min: 22, max: 44, step: 1, unit: 'mm', default: 32 },
      { key: 'offset', label: 'Offset', min: 28, max: 56, step: 1, unit: 'mm', default: 40 },
    ],
  },

  /* ---------------- Spinal interbody ---------------- */
  {
    id: 'interbody-cage',
    kind: 'cage',
    category: 'Spinal',
    label: 'Interbody cage',
    blurb: 'Lordotic, teethed endplates, central graft window.',
    defaultMaterial: 'peek',
    params: [
      { key: 'length', label: 'Length', min: 18, max: 40, step: 1, unit: 'mm', default: 26 },
      { key: 'width', label: 'Width', min: 8, max: 22, step: 1, unit: 'mm', default: 11 },
      { key: 'height', label: 'Height', min: 6, max: 18, step: 0.5, unit: 'mm', default: 9 },
      { key: 'lordosis', label: 'Lordosis', min: 0, max: 20, step: 1, unit: '°', default: 6 },
      { key: 'teeth', label: 'Teeth', min: 3, max: 12, step: 1, unit: '', default: 7 },
    ],
  },

  /* ---------------- Bone graft ---------------- */
  {
    id: 'graft-block',
    kind: 'graft',
    category: 'Bone graft',
    label: 'Structural graft block',
    blurb: 'Tricortical autograft or allograft block.',
    defaultMaterial: 'corticalGraft',
    fixed: { shape: 'block' },
    params: [
      { key: 'length', label: 'Length', min: 8, max: 60, step: 1, unit: 'mm', default: 25 },
      { key: 'width', label: 'Width', min: 5, max: 40, step: 1, unit: 'mm', default: 15 },
      { key: 'height', label: 'Height', min: 4, max: 40, step: 1, unit: 'mm', default: 12 },
    ],
  },
  {
    id: 'graft-strut',
    kind: 'graft',
    category: 'Bone graft',
    label: 'Strut graft',
    blurb: 'Cortical strut for augmentation alongside fixation.',
    defaultMaterial: 'corticalGraft',
    fixed: { shape: 'strut' },
    params: [
      { key: 'length', label: 'Length', min: 20, max: 160, step: 2, unit: 'mm', default: 70 },
      { key: 'width', label: 'Ø', min: 5, max: 30, step: 1, unit: 'mm', default: 14 },
      { key: 'height', label: 'Height', min: 4, max: 30, step: 1, unit: 'mm', default: 14 },
    ],
  },
  {
    id: 'graft-wedge',
    kind: 'graft',
    category: 'Bone graft',
    label: 'Opening wedge graft',
    blurb: 'Wedge for corrective osteotomy gap filling.',
    defaultMaterial: 'cancellousGraft',
    fixed: { shape: 'wedge' },
    params: [
      { key: 'length', label: 'Length', min: 10, max: 60, step: 1, unit: 'mm', default: 28 },
      { key: 'width', label: 'Base', min: 5, max: 40, step: 1, unit: 'mm', default: 18 },
      { key: 'height', label: 'Height', min: 4, max: 30, step: 1, unit: 'mm', default: 12 },
    ],
  },

  /* ---------------- Cranio-maxillofacial ---------------- */
  {
    id: 'cmf-mesh',
    kind: 'mesh',
    category: 'Cranio-maxillofacial',
    label: 'Titanium mesh',
    blurb: 'Trimmable mesh for orbital floor and cranial defects.',
    defaultMaterial: 'titaniumPolished',
    params: [
      { key: 'length', label: 'Length', min: 15, max: 120, step: 1, unit: 'mm', default: 45 },
      { key: 'width', label: 'Width', min: 15, max: 120, step: 1, unit: 'mm', default: 40 },
      { key: 'thickness', label: 'Thickness', min: 0.2, max: 1.5, step: 0.05, unit: 'mm', default: 0.6 },
      { key: 'cell', label: 'Cell size', min: 2, max: 12, step: 0.5, unit: 'mm', default: 6 },
    ],
  },
];

export const IMPLANT_CATEGORIES = [
  ...new Set(IMPLANT_CATALOG.map((c) => c.category)),
];

export function defaultParams(def) {
  const p = { ...(def.fixed ?? {}) };
  def.params.forEach((spec) => {
    p[spec.key] = spec.default;
  });
  return p;
}

export function catalogEntry(id) {
  return IMPLANT_CATALOG.find((c) => c.id === id) ?? null;
}

/** One-line size summary, e.g. "45 × 6.5 mm" — used in the plan list. */
export function describeImplant(implant) {
  const def = catalogEntry(implant.catalogId);
  if (!def) return '';
  const p = implant.params;
  switch (implant.kind) {
    case 'screw':
      return `${p.length} × ${p.diameter} mm`;
    case 'plate':
      return `${p.holes} holes · ${p.length} mm`;
    case 'nail':
      return `${p.length} × ${p.proximal} mm`;
    case 'wire':
      return `${p.length} × ${p.diameter} mm`;
    case 'cage':
      return `${p.length} × ${p.width} × ${p.height} mm · ${p.lordosis}°`;
    case 'stem':
      return `${p.length} mm · ${p.neckAngle}° · Ø${p.headDiameter}`;
    case 'graft':
      return `${p.length} × ${p.width} × ${p.height} mm`;
    case 'mesh':
      return `${p.length} × ${p.width} mm`;
    default:
      return '';
  }
}
