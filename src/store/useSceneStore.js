import { create } from 'zustand';
import { IMPLANT_CATALOG, defaultParams } from '../data/implants';

/* ===================================================================
   SCENE STORE
   -------------------------------------------------------------------
   Split deliberately into two halves:

   * PLAN state — the implants a clinician has placed, their sizes,
     materials and transforms. This is the document. It is serialisable,
     it is what gets saved against a patient, and it is what undo/redo
     operates on.

   * VIEW state — which region is loaded, what is hidden, x-ray on or
     off, camera preset. This is how the plan is being looked at, not
     the plan itself, so it is deliberately OUTSIDE the undo stack:
     nothing is more irritating than pressing Ctrl+Z to take back a
     screw position and having it un-hide the arterial tree instead.

   GPU objects (geometry, data textures) never live in the store. They
   are held by the scene and keyed by part index, because putting a
   BufferGeometry behind a reactive setter invites accidental clones of
   a 60 MB buffer.
   =================================================================== */

const HISTORY_LIMIT = 60;

const newId = () =>
  globalThis.crypto?.randomUUID?.() ?? `imp_${Math.random().toString(36).slice(2, 10)}`;

/** Snapshot of just the plan — what undo restores. */
const planOf = (s) => ({
  implants: s.implants,
  selectedImplantId: s.selectedImplantId,
  fracture: s.fracture,
});

export const useSceneStore = create((set, get) => ({
  /* ---------------- Atlas / loading ---------------- */
  atlas: null,
  regionId: 'skeleton',
  parts: [],
  loadState: 'idle', // idle | loading | ready | error
  loadProgress: 0,
  loadError: null,

  setAtlas: (atlas) => set({ atlas }),
  // A fracture is keyed by part INDEX into the current region's part
  // list. Changing region renumbers everything, so a stale fracture would
  // silently reattach itself to an unrelated bone. Drop it.
  setRegion: (regionId) =>
    set((s) => (s.regionId === regionId ? {} : { regionId, fracture: null })),
  setLoad: (patch) => set(patch),
  setParts: (parts) =>
    set({
      parts,
      hiddenParts: new Set(),
      selectedPart: -1,
      hoveredPart: -1,
      tissueOverrides: {},
    }),

  /* ---------------- Part-level view state ---------------- */
  hiddenParts: new Set(),
  tissueOverrides: {}, // partIndex -> tissue preset key
  selectedPart: -1,
  hoveredPart: -1,

  setHovered: (i) => {
    if (get().hoveredPart !== i) set({ hoveredPart: i });
  },
  selectPart: (i) => set({ selectedPart: i, selectedImplantId: null }),

  togglePart: (i) =>
    set((s) => {
      const next = new Set(s.hiddenParts);
      next.has(i) ? next.delete(i) : next.add(i);
      return { hiddenParts: next };
    }),

  setPartsHidden: (indices, hidden) =>
    set((s) => {
      const next = new Set(s.hiddenParts);
      indices.forEach((i) => (hidden ? next.add(i) : next.delete(i)));
      return { hiddenParts: next };
    }),

  showAllParts: () => set({ hiddenParts: new Set() }),

  isolatePart: (i) =>
    set((s) => {
      const next = new Set(s.parts.map((_, k) => k));
      next.delete(i);
      return { hiddenParts: next };
    }),

  overrideTissue: (i, preset) =>
    set((s) => ({ tissueOverrides: { ...s.tissueOverrides, [i]: preset } })),

  /* ---------------- Display ---------------- */
  xray: false,
  organFile: null, // optional textured GLB overlaid on the atlas geometry
  // Which textured organs actually exist on this deployment. They are not
  // committed to the repo (unverified licence), so this is probed at
  // startup rather than assumed — see three/organAvailability.js.
  organsAvailable: null, // null = still probing, Set = resolved
  showGrid: true,
  showShadows: true,
  autoRotate: false,
  exposure: 1.0,
  tissueOpacity: 1.0,
  clipEnabled: false,
  clipAxis: 'x',
  clipPosition: 0,

  setDisplay: (patch) => set(patch),
  setOrgansAvailable: (organsAvailable) => set({ organsAvailable }),

  /* ---------------- Consultation ----------------
     `phase` is the spine of the patient conversation: the same plan
     rendered as the injury (fragments displaced, hardware hidden) or as
     the repair (fragments reduced, hardware shown). One toggle tells the
     whole story, which is why it is a first-class piece of state rather
     than a pair of visibility flags. */
  phase: 'repair', // 'injury' | 'repair'
  consultMode: false, // panels hidden, plain language, big model
  layLanguage: false, // plain-English labels even outside consult mode

  setPhase: (phase) => set({ phase }),
  togglePhase: () => set((s) => ({ phase: s.phase === 'injury' ? 'repair' : 'injury' })),
  setConsultMode: (consultMode) =>
    // Consult mode implies plain language: the point of turning the
    // screen toward a patient is that they can read it.
    set((s) => ({ consultMode, layLanguage: consultMode ? true : s.layLanguage })),
  setLayLanguage: (layLanguage) => set({ layLanguage }),

  /* ---------------- Fracture ----------------
     At most one fracture at a time. Modelling several simultaneous
     fractures is a planning feature, and this is a conversation tool —
     a patient following two displaced fragments is already at their
     limit. */
  fracture: null, // { partIndex, partName, pattern, level, displacement }

  setFracture: (fracture) => {
    get().commit();
    set({ fracture });
  },

  updateFracture: (patch, { history = true } = {}) => {
    if (history) get().commit();
    set((s) => (s.fracture ? { fracture: { ...s.fracture, ...patch } } : {}));
  },

  updateDisplacement: (patch) =>
    set((s) =>
      s.fracture
        ? { fracture: { ...s.fracture, displacement: { ...s.fracture.displacement, ...patch } } }
        : {}
    ),

  clearFracture: () => {
    get().commit();
    set({ fracture: null });
  },

  /* ---------------- Implants (the plan) ---------------- */
  implants: [],
  selectedImplantId: null,
  transformMode: 'translate',
  transformSpace: 'world',
  snapEnabled: false,

  past: [],
  future: [],

  /** Push the current plan onto the undo stack before mutating it. */
  commit: () =>
    set((s) => ({
      past: [...s.past, planOf(s)].slice(-HISTORY_LIMIT),
      future: [],
    })),

  addImplant: (catalogId, at = [0, 0, 0]) => {
    const def = IMPLANT_CATALOG.find((c) => c.id === catalogId);
    if (!def) return null;
    get().commit();
    const implant = {
      id: newId(),
      catalogId,
      kind: def.kind,
      label: def.label,
      params: defaultParams(def),
      material: def.defaultMaterial,
      position: [...at],
      rotation: [0, 0, 0],
      scale: 1,
      visible: true,
      locked: false,
      note: '',
      createdAt: Date.now(),
    };
    set((s) => ({
      implants: [...s.implants, implant],
      selectedImplantId: implant.id,
      selectedPart: -1,
    }));
    return implant.id;
  },

  updateImplant: (id, patch, { history = true } = {}) => {
    // Dragging a gizmo fires dozens of updates a second. Those pass
    // history:false and the caller commits ONCE on drag start, so undo
    // steps back over a whole gesture instead of one frame of it.
    if (history) get().commit();
    set((s) => ({
      implants: s.implants.map((im) => (im.id === id ? { ...im, ...patch } : im)),
    }));
  },

  updateImplantParams: (id, patch) => {
    get().commit();
    set((s) => ({
      implants: s.implants.map((im) =>
        im.id === id ? { ...im, params: { ...im.params, ...patch } } : im
      ),
    }));
  },

  removeImplant: (id) => {
    get().commit();
    set((s) => ({
      implants: s.implants.filter((im) => im.id !== id),
      selectedImplantId: s.selectedImplantId === id ? null : s.selectedImplantId,
    }));
  },

  duplicateImplant: (id) => {
    const src = get().implants.find((im) => im.id === id);
    if (!src) return;
    get().commit();
    const copy = {
      ...src,
      id: newId(),
      // Offset the copy so it is visibly a second implant rather than
      // z-fighting with the original.
      position: [src.position[0] + 0.6, src.position[1], src.position[2] + 0.6],
      createdAt: Date.now(),
    };
    set((s) => ({ implants: [...s.implants, copy], selectedImplantId: copy.id }));
  },

  selectImplant: (id) => set({ selectedImplantId: id, selectedPart: -1 }),
  setTransformMode: (transformMode) => set({ transformMode }),
  setTransformSpace: (transformSpace) => set({ transformSpace }),
  setSnap: (snapEnabled) => set({ snapEnabled }),

  clearPlan: () => {
    get().commit();
    set({ implants: [], selectedImplantId: null });
  },

  undo: () =>
    set((s) => {
      if (!s.past.length) return {};
      const prev = s.past[s.past.length - 1];
      return {
        ...prev,
        past: s.past.slice(0, -1),
        future: [planOf(s), ...s.future].slice(0, HISTORY_LIMIT),
      };
    }),

  redo: () =>
    set((s) => {
      if (!s.future.length) return {};
      const next = s.future[0];
      return {
        ...next,
        past: [...s.past, planOf(s)].slice(-HISTORY_LIMIT),
        future: s.future.slice(1),
      };
    }),

  /* ---------------- Persistence ---------------- */
  exportPlan: () => {
    const s = get();
    return {
      format: 'zenohosp.organ3d.plan',
      version: 1,
      savedAt: new Date().toISOString(),
      region: s.regionId,
      fracture: s.fracture,
      implants: s.implants,
    };
  },

  importPlan: (doc) => {
    if (!doc || doc.format !== 'zenohosp.organ3d.plan') {
      throw new Error('Not an Organ 3D plan file.');
    }
    get().commit();
    set({
      implants: Array.isArray(doc.implants) ? doc.implants : [],
      fracture: doc.fracture ?? null,
      selectedImplantId: null,
      regionId: doc.region ?? get().regionId,
    });
  },
}));

/** Convenience selectors — keep component re-renders narrow. */
export const selectedImplant = (s) =>
  s.implants.find((im) => im.id === s.selectedImplantId) ?? null;
