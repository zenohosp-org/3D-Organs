import * as THREE from 'three';

/* ===================================================================
   FRACTURE MODELLING
   -------------------------------------------------------------------
   A consultation needs to show the PROBLEM before the fix. This splits
   a single bone into fragments that can be displaced, so a patient sees
   their fracture rather than an intact bone with hardware on it.

   HOW THE CUT WORKS

   Triangles are assigned whole to one side of the fracture plane by
   their centroid, rather than being clipped exactly along it. Two
   reasons, and the second is the important one:

     1. It is far cheaper — one pass, no new vertices, no re-indexing
        of a cut boundary.

     2. It looks RIGHT. An exact planar cut produces a glassy, machined
        edge that reads as "sliced", not "broken". Assigning whole
        triangles leaves the break following the mesh's own topology,
        and adding a little noise to the plane distance makes it
        wander the way a real fracture line does.

   So the jagged edge is the feature, not a limitation. What this does
   NOT model is the interdigitating 3D fracture surface of a real
   break — fragments are hollow where they were cut, which is invisible
   from outside but obvious if the camera goes inside a fragment.

   COORDINATE SPACE

   Everything works in the merged geometry's local space (centimetres,
   recentred on the region — see ATLAS_SCALE in atlasLoader.js). The
   fracture plane is built from the bone's own principal axis, so a
   "transverse" fracture is transverse to THAT bone regardless of how
   the bone is oriented in the body.
   =================================================================== */

export const FRACTURE_PATTERNS = {
  transverse: {
    label: 'Transverse',
    lay: 'A clean break straight across the bone',
    angle: 0,
    fragments: 2,
  },
  oblique: {
    label: 'Oblique',
    lay: 'A break at an angle across the bone',
    angle: 35,
    fragments: 2,
  },
  spiral: {
    // A true spiral needs a helicoidal cut surface, which a single plane
    // cannot express. A steep oblique is the honest approximation, and
    // the UI says so rather than pretending otherwise.
    label: 'Spiral (approximated)',
    lay: 'A twisting break that winds around the bone',
    angle: 62,
    fragments: 2,
  },
  comminuted: {
    label: 'Comminuted',
    lay: 'The bone is broken into more than two pieces',
    angle: 22,
    fragments: 3,
  },
};

/**
 * Principal axis of a bone, and the extent of the bone along it.
 *
 * Long bones are overwhelmingly their own longest dimension, so the
 * dominant axis of the bounding box is a reliable and very cheap stand
 * in for a proper PCA of the vertex cloud.
 */
export function boneAxis(geometry) {
  const box = geometry.boundingBox ?? geometry.computeBoundingBox() ?? geometry.boundingBox;
  const size = new THREE.Vector3();
  box.getSize(size);
  const center = new THREE.Vector3();
  box.getCenter(center);

  let axis;
  if (size.y >= size.x && size.y >= size.z) axis = new THREE.Vector3(0, 1, 0);
  else if (size.x >= size.z) axis = new THREE.Vector3(1, 0, 0);
  else axis = new THREE.Vector3(0, 0, 1);

  const length = Math.max(size.x, size.y, size.z);
  return { axis, center, length, size };
}

/** Deterministic value noise — the same bone always breaks the same way,
 *  so a plan reopened tomorrow looks identical to the one discussed. */
function noise(x, y, z) {
  const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
  return s - Math.floor(s) - 0.5; // -0.5 .. 0.5
}

/**
 * Split a geometry by a plane into two geometries.
 * `roughness` displaces the plane per-triangle to break up the cut line.
 */
function splitByPlane(geometry, plane, roughness) {
  const pos = geometry.getAttribute('position');
  const nrm = geometry.getAttribute('normal');
  const index = geometry.getIndex();
  const triCount = index.count / 3;

  const above = [];
  const below = [];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const centroid = new THREE.Vector3();

  for (let t = 0; t < triCount; t++) {
    const i0 = index.getX(t * 3);
    const i1 = index.getX(t * 3 + 1);
    const i2 = index.getX(t * 3 + 2);
    a.fromBufferAttribute(pos, i0);
    b.fromBufferAttribute(pos, i1);
    c.fromBufferAttribute(pos, i2);
    centroid.copy(a).add(b).add(c).multiplyScalar(1 / 3);

    const d =
      plane.distanceToPoint(centroid) +
      noise(centroid.x, centroid.y, centroid.z) * roughness;

    (d >= 0 ? above : below).push(i0, i1, i2);
  }

  return [buildSide(pos, nrm, above), buildSide(pos, nrm, below)];
}

/** Rebuild one side as a compact geometry with only the vertices it uses. */
function buildSide(pos, nrm, indices) {
  const remap = new Map();
  const outPos = [];
  const outNrm = [];
  const outIdx = new Uint32Array(indices.length);

  for (let i = 0; i < indices.length; i++) {
    const src = indices[i];
    let dst = remap.get(src);
    if (dst === undefined) {
      dst = remap.size;
      remap.set(src, dst);
      outPos.push(pos.getX(src), pos.getY(src), pos.getZ(src));
      // getX on a normalised Int16 attribute already returns -1..1.
      outNrm.push(nrm.getX(src), nrm.getY(src), nrm.getZ(src));
    }
    outIdx[i] = dst;
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(outPos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(outNrm, 3));
  g.setIndex(new THREE.BufferAttribute(outIdx, 1));
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}

/**
 * Build the fragments for a fracture.
 *
 * @param geometry   the bone, in merged-geometry local space
 * @param pattern    key into FRACTURE_PATTERNS
 * @param level      0..1 position along the bone's long axis
 * @returns { fragments: [{ geometry, anchor, mobile }], axis, length }
 *
 * `anchor` is each fragment's own centroid, so displacement can be
 * applied as a rotation about the fragment's centre rather than about
 * the scene origin — otherwise angulating a distal fragment swings it
 * across the room.
 */
export function buildFracture(geometry, pattern = 'transverse', level = 0.5) {
  const spec = FRACTURE_PATTERNS[pattern] ?? FRACTURE_PATTERNS.transverse;
  const { axis, center, length } = boneAxis(geometry);

  // Tilt the cut away from perpendicular by the pattern's angle, around
  // an arbitrary axis perpendicular to the bone.
  const perp = new THREE.Vector3(axis.y, axis.z, axis.x).cross(axis).normalize();
  const normal = axis
    .clone()
    .applyAxisAngle(perp, THREE.MathUtils.degToRad(spec.angle))
    .normalize();

  // Fracture height along the bone. Clamped away from the very ends so
  // the cut always produces two real fragments rather than shaving off
  // a sliver of condyle.
  const t = THREE.MathUtils.clamp(level, 0.15, 0.85);
  const offset = (t - 0.5) * length;
  const point = center.clone().addScaledVector(axis, offset);

  const roughness = Math.min(length * 0.012, 0.35);
  const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, point);

  let pieces = splitByPlane(geometry, plane, roughness);

  if (spec.fragments >= 3) {
    // Comminuted: cut the larger piece again to yield a butterfly
    // fragment, which is what a wedge-pattern comminution looks like.
    const [first, second] = pieces;
    const bigIsFirst = first.getIndex().count >= second.getIndex().count;
    const big = bigIsFirst ? first : second;
    const small = bigIsFirst ? second : first;

    const secondPoint = point.clone().addScaledVector(axis, length * 0.13);
    const secondNormal = axis
      .clone()
      .applyAxisAngle(perp, THREE.MathUtils.degToRad(-spec.angle))
      .normalize();
    const plane2 = new THREE.Plane().setFromNormalAndCoplanarPoint(secondNormal, secondPoint);
    const [p2a, p2b] = splitByPlane(big, plane2, roughness);
    big.dispose();
    pieces = [small, p2a, p2b];
  }

  const fragments = pieces
    .filter((g) => g.getIndex().count > 0)
    .map((g, i) => {
      const c = new THREE.Vector3();
      g.boundingBox.getCenter(c);
      return {
        geometry: g,
        anchor: c,
        // The first fragment is treated as the proximal, surgically
        // fixed reference; the rest are what displaces.
        mobile: i > 0,
      };
    });

  return { fragments, axis, length, plane, pattern };
}

/**
 * Displacement transform for a mobile fragment.
 *
 * Displacement is expressed the way a fracture is actually described:
 * shortening along the bone, translation across it, and angulation.
 * `amount` scales all three together, so a single "reduce" slider can
 * animate from the injured position (1) to anatomical (0).
 */
export function fragmentTransform(fragment, { axis, length }, displacement, amount = 1) {
  const { shift = 0, angulation = 0, rotation = 0 } = displacement;
  const k = THREE.MathUtils.clamp(amount, 0, 1);

  const perp = new THREE.Vector3(axis.y, axis.z, axis.x).cross(axis).normalize();

  const m = new THREE.Matrix4();
  const toOrigin = new THREE.Matrix4().makeTranslation(
    -fragment.anchor.x, -fragment.anchor.y, -fragment.anchor.z
  );
  const back = new THREE.Matrix4().makeTranslation(
    fragment.anchor.x, fragment.anchor.y, fragment.anchor.z
  );

  const rot = new THREE.Matrix4().makeRotationAxis(
    perp, THREE.MathUtils.degToRad(angulation * k)
  );
  const twist = new THREE.Matrix4().makeRotationAxis(
    axis, THREE.MathUtils.degToRad(rotation * k)
  );
  // shift is in millimetres in the UI; scene units are centimetres.
  const translate = new THREE.Matrix4().makeTranslation(
    perp.x * shift * 0.1 * k,
    perp.y * shift * 0.1 * k,
    perp.z * shift * 0.1 * k
  );

  m.multiply(translate).multiply(back).multiply(twist).multiply(rot).multiply(toOrigin);
  return m;
}

export function disposeFracture(fracture) {
  fracture?.fragments?.forEach((f) => f.geometry.dispose());
}
