import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/* ===================================================================
   PARAMETRIC HARDWARE
   -------------------------------------------------------------------
   Implants are generated from surgeon-facing parameters (length and
   diameter in millimetres, hole count, thread pitch) rather than
   shipped as fixed meshes. That is how hardware is actually chosen in
   theatre — off a size chart — so a planner who needs a 45 x 4.5 mm
   cortical screw can dial exactly that instead of scaling a 30 mm mesh
   by 1.5 and quietly making the thread pitch wrong too.

   UNITS: one scene unit is one centimetre. Every catalogue dimension
   below is in millimetres and passes through MM on the way in, so the
   numbers in the UI stay the numbers on the implant packaging.
   =================================================================== */

export const MM = 0.1; // 1 mm expressed in scene units (cm)

/* -------------------------------------------------------------------
   Helix support
   ------------------------------------------------------------------- */

/** A cylindrical helix, used as the sweep path for screw threads.
 *  Extending THREE.Curve (rather than approximating with stacked rings)
 *  is what makes a screw read as a screw when the camera comes close:
 *  the thread is genuinely continuous and genuinely handed. */
class HelixCurve extends THREE.Curve {
  constructor(radius, height, turns) {
    super();
    this.radius = radius;
    this.height = height;
    this.turns = turns;
  }
  getPoint(t, target = new THREE.Vector3()) {
    const a = 2 * Math.PI * this.turns * t;
    return target.set(
      this.radius * Math.cos(a),
      this.height * (t - 0.5),
      this.radius * Math.sin(a)
    );
  }
}

/** Thread as a swept tube. `crest` is the tube radius, so the thread's
 *  major diameter is 2 * (pathRadius + crest). */
function threadGeometry(pathRadius, length, pitch, crest) {
  const turns = Math.max(1, Math.round(length / pitch));
  const curve = new HelixCurve(pathRadius, length, turns);
  // ~24 path samples per turn keeps the helix smooth without exploding
  // the vertex count on a 60 mm nail thread.
  const tubular = Math.min(1400, Math.max(48, turns * 24));
  return new THREE.TubeGeometry(curve, tubular, crest, 7, false);
}

/* -------------------------------------------------------------------
   Builders — each returns a single merged BufferGeometry, centred on
   the origin and pointing +Y, so the transform gizmo behaves
   predictably no matter which implant is selected.
   ------------------------------------------------------------------- */

function buildScrew({ length = 40, diameter = 4.5, headDiameter = 8, pitch = 1.75, cannulated = false, headStyle = 'countersunk' }) {
  const L = length * MM;
  const coreR = (diameter * MM) / 2 * 0.68; // core is ~68% of major dia
  const crest = (diameter * MM) / 2 - coreR;
  const headR = (headDiameter * MM) / 2;
  const headH = headR * 0.9;
  const tipH = coreR * 2.4;
  const shaftH = L - tipH;

  const parts = [];

  // Core shank
  const core = new THREE.CylinderGeometry(coreR, coreR, shaftH, 28, 1, true);
  core.translate(0, shaftH / 2, 0);
  parts.push(core);

  // Helical thread along the shank
  const th = threadGeometry(coreR + crest * 0.45, shaftH * 0.92, pitch * MM, crest * 0.62);
  th.translate(0, shaftH * 0.46, 0);
  parts.push(th);

  // Self-tapping tip
  const tip = new THREE.ConeGeometry(coreR, tipH, 28);
  tip.rotateX(Math.PI);
  tip.translate(0, -tipH / 2, 0);
  parts.push(tip);

  // Head
  if (headStyle === 'countersunk') {
    const head = new THREE.CylinderGeometry(headR, coreR * 1.05, headH, 32);
    head.translate(0, shaftH + headH / 2, 0);
    parts.push(head);
  } else {
    const head = new THREE.CylinderGeometry(headR, headR, headH, 32);
    head.translate(0, shaftH + headH / 2, 0);
    parts.push(head);
  }
  // Drive recess — a shallow hex pocket. Modelled as an inset prism
  // rather than a boolean subtraction: at planning zoom it reads
  // identically and costs no CSG.
  const recess = new THREE.CylinderGeometry(headR * 0.5, headR * 0.5, headH * 0.35, 6);
  recess.translate(0, shaftH + headH * 0.86, 0);
  parts.push(recess);

  // Cannulation channel (visual lip at both ends)
  if (cannulated) {
    const bore = new THREE.CylinderGeometry(coreR * 0.3, coreR * 0.3, L * 1.02, 16, 1, true);
    bore.translate(0, shaftH / 2, 0);
    parts.push(bore);
  }

  const g = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  g.translate(0, -L / 2 + tipH / 2, 0); // centre on origin
  g.computeVertexNormals();
  return g;
}

function buildPlate({ holes = 6, length = 90, width = 12, thickness = 3, contour = 0.12, locking = true }) {
  const L = length * MM;
  const W = width * MM;
  const T = thickness * MM;
  const parts = [];

  // The body is built from segments arced along X so the plate is
  // pre-contoured, the way anatomic plates ship — a dead-flat bar never
  // sits on a real diaphysis.
  const segs = Math.max(12, holes * 4);
  const shape = new THREE.Shape();
  shape.absarc(0, 0, W / 2, -Math.PI / 2, Math.PI / 2, false);
  shape.lineTo(-0.0001, W / 2);
  shape.absarc(0, 0, W / 2, Math.PI / 2, (3 * Math.PI) / 2, false);

  for (let i = 0; i < segs; i++) {
    const t0 = i / segs;
    const x = (t0 - 0.5) * L;
    const sag = contour * L * (0.25 - (t0 - 0.5) * (t0 - 0.5)) * 4;
    const seg = new THREE.BoxGeometry(L / segs + 0.002, T, W);
    seg.translate(x + L / segs / 2, -sag, 0);
    parts.push(seg);
  }

  // Screw holes — raised collars, countersunk, locking if specified.
  for (let i = 0; i < holes; i++) {
    const t0 = holes === 1 ? 0.5 : i / (holes - 1);
    const x = (t0 - 0.5) * L * 0.86;
    const sag = contour * L * (0.25 - (t0 - 0.5) * (t0 - 0.5)) * 4;
    const rOuter = W * 0.34;
    const collar = new THREE.CylinderGeometry(rOuter, rOuter * 0.92, T * 1.35, 24, 1, true);
    collar.translate(x, -sag, 0);
    parts.push(collar);
    if (locking) {
      const ring = new THREE.TorusGeometry(rOuter * 0.86, T * 0.16, 8, 24);
      ring.rotateX(Math.PI / 2);
      ring.translate(x, -sag + T * 0.6, 0);
      parts.push(ring);
    }
  }

  const g = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  g.computeVertexNormals();
  return g;
}

function buildNail({ length = 340, proximal = 11, distal = 9, lockHoles = 4, curvature = 0.04 }) {
  const L = length * MM;
  const rP = (proximal * MM) / 2;
  const rD = (distal * MM) / 2;
  const parts = [];

  // An IM nail has an anterior bow; approximate it by stacking short
  // frusta along a shallow arc rather than using one straight cylinder.
  const segs = 40;
  for (let i = 0; i < segs; i++) {
    const t0 = i / segs;
    const t1 = (i + 1) / segs;
    const r0 = rP + (rD - rP) * t0;
    const r1 = rP + (rD - rP) * t1;
    const y0 = (t0 - 0.5) * L;
    const bow = curvature * L * (0.25 - (t0 - 0.5) * (t0 - 0.5)) * 4;
    const seg = new THREE.CylinderGeometry(r1, r0, L / segs + 0.001, 24, 1, true);
    seg.translate(bow, y0 + L / segs / 2, 0);
    parts.push(seg);
  }

  // Rounded distal tip
  const tip = new THREE.SphereGeometry(rD, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  tip.rotateX(Math.PI);
  tip.translate(curvature * L * 0, -L / 2, 0);
  parts.push(tip);

  // Locking-bolt holes, alternating transverse / oblique
  for (let i = 0; i < lockHoles; i++) {
    const fromDistal = i < lockHoles / 2;
    const t0 = fromDistal ? 0.06 + i * 0.07 : 0.94 - (i - Math.floor(lockHoles / 2)) * 0.07;
    const y = (t0 - 0.5) * L;
    const bow = curvature * L * (0.25 - (t0 - 0.5) * (t0 - 0.5)) * 4;
    const r = rP + (rD - rP) * t0;
    const hole = new THREE.CylinderGeometry(r * 0.42, r * 0.42, r * 2.6, 16, 1, true);
    hole.rotateZ(Math.PI / 2);
    if (!fromDistal) hole.rotateY(Math.PI / 4);
    hole.translate(bow, y, 0);
    parts.push(hole);
  }

  const g = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  g.computeVertexNormals();
  return g;
}

function buildWire({ length = 150, diameter = 2, tip = 'trocar' }) {
  const L = length * MM;
  const r = (diameter * MM) / 2;
  const parts = [];
  const shaft = new THREE.CylinderGeometry(r, r, L * 0.94, 20, 1, true);
  shaft.translate(0, L * 0.03, 0);
  parts.push(shaft);
  const point =
    tip === 'trocar'
      ? new THREE.ConeGeometry(r, r * 5, 3)
      : new THREE.ConeGeometry(r, r * 4, 20);
  point.rotateX(Math.PI);
  point.translate(0, -L / 2 + r * 2, 0);
  parts.push(point);
  const g = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  g.computeVertexNormals();
  return g;
}

function buildCage({ length = 26, width = 11, height = 9, lordosis = 6, teeth = 7 }) {
  const L = length * MM;
  const W = width * MM;
  const H = height * MM;
  const parts = [];

  // Bullet-nosed body with a graft window through the middle.
  const wall = W * 0.22;
  const rails = [
    [0, 0, W / 2 - wall / 2],
    [0, 0, -W / 2 + wall / 2],
  ];
  rails.forEach(([x, y, z]) => {
    const rail = new THREE.BoxGeometry(L, H, wall);
    rail.translate(x, y, z);
    parts.push(rail);
  });
  [-1, 1].forEach((s) => {
    const end = new THREE.BoxGeometry(L * 0.16, H, W);
    end.translate((s * L) / 2 - (s * L * 0.16) / 2, 0, 0);
    parts.push(end);
  });

  // Anti-migration teeth on both endplates.
  for (let i = 0; i < teeth; i++) {
    const x = (i / (teeth - 1) - 0.5) * L * 0.8;
    [1, -1].forEach((s) => {
      const tooth = new THREE.ConeGeometry(W * 0.1, H * 0.16, 4);
      if (s < 0) tooth.rotateX(Math.PI);
      tooth.rotateY(Math.PI / 4);
      tooth.translate(x, (s * H) / 2, 0);
      parts.push(tooth);
    });
  }

  const g = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  // Lordotic taper: interbody cages are wedges, not blocks.
  const pos = g.attributes.position;
  const rad = (lordosis * Math.PI) / 180;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    pos.setY(i, y + Math.tan(rad) * x * (y > 0 ? 0.5 : -0.5));
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

function buildGraft({ length = 25, width = 15, height = 12, shape = 'block' }) {
  const L = length * MM;
  const W = width * MM;
  const H = height * MM;
  let g;
  if (shape === 'wedge') {
    g = new THREE.CylinderGeometry(W / 2, W / 2, L, 3, 1);
    g.rotateZ(Math.PI / 2);
  } else if (shape === 'strut') {
    g = new THREE.CylinderGeometry(W / 2, W / 2, L, 20, 1);
    g.rotateZ(Math.PI / 2);
  } else {
    g = new THREE.BoxGeometry(L, H, W, 2, 2, 2);
  }
  // Graft is harvested, not machined — perturb the surface so it never
  // reads as a CAD primitive sitting next to real anatomy.
  const pos = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = Math.sin(v.x * 37) * Math.cos(v.y * 41) * Math.sin(v.z * 29);
    v.addScaledVector(v.clone().normalize(), n * Math.min(L, W, H) * 0.05);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

function buildStem({ length = 140, neckAngle = 132, headDiameter = 32, offset = 40 }) {
  const L = length * MM;
  const parts = [];
  // Tapered wedge body
  const segs = 24;
  for (let i = 0; i < segs; i++) {
    const t0 = i / segs;
    const r0 = (7 - 3.4 * t0) * MM;
    const seg = new THREE.CylinderGeometry(r0 * 0.85, r0, L / segs + 0.002, 4, 1);
    seg.rotateY(Math.PI / 4);
    seg.scale(1, 1, 0.62);
    seg.translate(0, -t0 * L + L / 2, 0);
    parts.push(seg);
  }
  // Neck at the anteversion angle, then the ball
  const rad = ((180 - neckAngle) * Math.PI) / 180;
  const neckL = offset * MM * 1.25;
  const neck = new THREE.CylinderGeometry(4.6 * MM, 6.4 * MM, neckL, 20);
  neck.translate(0, neckL / 2, 0);
  neck.rotateZ(-rad);
  neck.translate(0, L / 2, 0);
  parts.push(neck);

  const ball = new THREE.SphereGeometry((headDiameter * MM) / 2, 40, 28);
  ball.translate(0, neckL, 0);
  ball.rotateZ(-rad);
  ball.translate(0, L / 2, 0);
  parts.push(ball);

  const g = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  g.computeVertexNormals();
  return g;
}

function buildMesh({ length = 40, width = 40, thickness = 0.6, cell = 6 }) {
  const L = length * MM;
  const W = width * MM;
  const T = thickness * MM;
  const c = cell * MM;
  const parts = [];
  const nx = Math.max(2, Math.round(L / c));
  const nz = Math.max(2, Math.round(W / c));
  for (let i = 0; i <= nx; i++) {
    const bar = new THREE.BoxGeometry(T * 1.6, T, W);
    bar.translate((i / nx - 0.5) * L, 0, 0);
    parts.push(bar);
  }
  for (let j = 0; j <= nz; j++) {
    const bar = new THREE.BoxGeometry(L, T, T * 1.6);
    bar.translate(0, 0, (j / nz - 0.5) * W);
    parts.push(bar);
  }
  const g = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  g.computeVertexNormals();
  return g;
}

/* -------------------------------------------------------------------
   Dispatch + cache
   ------------------------------------------------------------------- */

const BUILDERS = {
  screw: buildScrew,
  plate: buildPlate,
  nail: buildNail,
  wire: buildWire,
  cage: buildCage,
  graft: buildGraft,
  stem: buildStem,
  mesh: buildMesh,
};

const geoCache = new Map();

/** Geometry is cached on the exact parameter set, so dragging a length
 *  slider back to a value already seen is free, and two screws of the
 *  same size share one buffer. */
export function implantGeometry(kind, params) {
  const key = `${kind}:${JSON.stringify(params)}`;
  if (geoCache.has(key)) return geoCache.get(key);
  const builder = BUILDERS[kind];
  if (!builder) throw new Error(`Unknown implant kind: ${kind}`);
  const g = builder(params ?? {});
  // Cap the cache — a surgeon scrubbing a slider can otherwise generate
  // hundreds of one-off geometries in a single session.
  if (geoCache.size > 120) {
    const oldest = geoCache.keys().next().value;
    geoCache.get(oldest)?.dispose();
    geoCache.delete(oldest);
  }
  geoCache.set(key, g);
  return g;
}

export function disposeGeometryCache() {
  geoCache.forEach((g) => g.dispose());
  geoCache.clear();
}
