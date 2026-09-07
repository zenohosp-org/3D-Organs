import * as THREE from 'three';

/* ===================================================================
   BODYPARTS3D ATLAS LOADER
   -------------------------------------------------------------------
   Source data: BodyParts3D 4.0 (Database Center for Life Science,
   University of Tokyo), repacked by the `human-atlas` project into a
   flat binary the browser can mmap-style slice without parsing. See
   public/models/ATTRIBUTION.md for licensing.

   Wire format, confirmed against the upstream reader:
     atlas.json  — { version, parts: [ { id, name, conceptId, system,
                     chunk, positions, normals, indices, vertexCount,
                     indexCount, bounds } ] }
     body-N.bin  — one chunk holding many parts back to back. Each
                   part's three offsets are BYTE offsets into that
                   chunk:
                     positions : Float32, 3 per vertex
                     normals   : Int16 NORMALISED, 3 per vertex
                                 (half the bytes of Float32 for a
                                 quantity that only ever spans -1..1)
                     indices   : Uint32, indexCount entries

   Because the offsets are byte offsets into a buffer we already hold,
   building a part's geometry is a handful of typed-array VIEWS — no
   copying, no decode pass. That is what makes it viable to put two
   million triangles on screen from a cold start.
   =================================================================== */

/**
 * UNITS. BodyParts3D coordinates are METRES — the atlas body measures
 * 1.730 units heel to crown. The rest of this application works in
 * CENTIMETRES (see MM in implantGeometry.js), because millimetre-scale
 * hardware against a metre-scale body puts a 4 mm screw at 0.004 units,
 * where float precision in the depth buffer starts to visibly z-fight.
 *
 * So the atlas is converted once, here, on the way in. Getting this
 * wrong is not subtle: a 400 mm nail would be built 100x oversized and
 * render as a slab across the whole viewport.
 */
export const ATLAS_SCALE = 100;

const MODELS_BASE = `${import.meta.env.BASE_URL}models`;

let atlasPromise = null;
const chunkPromises = new Map();

/** The atlas manifest, fetched once and shared by every caller. */
export function loadAtlas() {
  if (!atlasPromise) {
    atlasPromise = fetch(`${MODELS_BASE}/atlas.json`).then((r) => {
      if (!r.ok) throw new Error(`atlas.json — HTTP ${r.status}`);
      return r.json();
    });
  }
  return atlasPromise;
}

/** One geometry chunk. Chunks are fetched lazily and never released:
 *  every geometry built from a chunk holds typed-array views INTO it,
 *  so dropping the buffer would invalidate live meshes. Fifteen chunks
 *  is ~60 MB fully resident, which is the deliberate trade for
 *  zero-copy geometry. */
function loadChunk(index, onProgress) {
  if (!chunkPromises.has(index)) {
    const p = fetch(`${MODELS_BASE}/body-${index}.bin`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`body-${index}.bin — HTTP ${r.status}`);
        if (!r.body || !onProgress) return r.arrayBuffer();
        // Stream so the loading bar reflects real bytes rather than a
        // fake timer — these are multi-megabyte fetches on hospital wifi.
        const total = Number(r.headers.get('content-length')) || 0;
        const reader = r.body.getReader();
        const parts = [];
        let received = 0;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          parts.push(value);
          received += value.length;
          onProgress(received, total);
        }
        const out = new Uint8Array(received);
        let at = 0;
        for (const c of parts) {
          out.set(c, at);
          at += c.length;
        }
        return out.buffer;
      })
      .catch((err) => {
        // Let a later attempt retry instead of caching the failure.
        chunkPromises.delete(index);
        throw err;
      });
    chunkPromises.set(index, p);
  }
  return chunkPromises.get(index);
}

/**
 * Build ONE merged geometry for a set of parts.
 *
 * Drawing 2,234 separate meshes would mean 2,234 draw calls a frame and
 * a viewer that stutters on any laptop. Instead every selected part is
 * concatenated into a single buffer carrying an extra `aPartIndex`
 * attribute; per-part colour, opacity and visibility are then looked up
 * in a data texture inside the shader (see partMaterial.js). One draw
 * call, and toggling a part's visibility costs a texture write rather
 * than a geometry rebuild.
 *
 * Returns { geometry, parts, bounds } where `parts` is the ordered list
 * whose array position equals the aPartIndex stored in the geometry.
 */
export async function buildMergedGeometry(parts, { onProgress } = {}) {
  const chunks = [...new Set(parts.map((p) => p.chunk))].sort((a, b) => a - b);

  const buffers = new Map();
  let done = 0;
  for (const c of chunks) {
    buffers.set(
      c,
      await loadChunk(c, (received, total) => {
        if (!onProgress) return;
        const chunkFrac = total ? received / total : 0;
        onProgress((done + chunkFrac) / chunks.length);
      })
    );
    done += 1;
    onProgress?.(done / chunks.length);
  }

  let totalVerts = 0;
  let totalIdx = 0;
  for (const p of parts) {
    totalVerts += p.vertexCount;
    totalIdx += p.indexCount;
  }

  const position = new Float32Array(totalVerts * 3);
  const normal = new Int16Array(totalVerts * 3);
  const partIndex = new Float32Array(totalVerts);
  // Uint32 throughout: a full-body selection is well past the 65,535
  // vertices a Uint16 index can address.
  const index = new Uint32Array(totalIdx);

  const bounds = new THREE.Box3();
  const v = new THREE.Vector3();

  // Per-part ranges into the merged buffers. The fracture tool needs to
  // pull ONE bone back out of the merge to cut it, and without these it
  // would have to re-fetch and re-decode the chunk to find it.
  const ranges = new Array(parts.length);

  let vOff = 0;
  let iOff = 0;
  parts.forEach((p, pi) => {
    ranges[pi] = {
      vertexStart: vOff,
      vertexCount: p.vertexCount,
      indexStart: iOff,
      indexCount: p.indexCount,
    };
    const buf = buffers.get(p.chunk);
    const pos = new Float32Array(buf, p.positions, p.vertexCount * 3);
    const nrm = new Int16Array(buf, p.normals, p.vertexCount * 3);
    const idx = new Uint32Array(buf, p.indices, p.indexCount);

    // Metres -> centimetres. Normals are direction-only and Int16
    // normalised, so they must NOT be touched by this.
    for (let k = 0; k < pos.length; k++) position[vOff * 3 + k] = pos[k] * ATLAS_SCALE;
    normal.set(nrm, vOff * 3);
    partIndex.fill(pi, vOff, vOff + p.vertexCount);
    for (let k = 0; k < idx.length; k++) index[iOff + k] = idx[k] + vOff;

    bounds.expandByPoint(v.fromArray(p.bounds[0]).multiplyScalar(ATLAS_SCALE));
    bounds.expandByPoint(v.fromArray(p.bounds[1]).multiplyScalar(ATLAS_SCALE));

    vOff += p.vertexCount;
    iOff += p.indexCount;
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normal, 3, true));
  geometry.setAttribute('aPartIndex', new THREE.BufferAttribute(partIndex, 1));
  geometry.setIndex(new THREE.BufferAttribute(index, 1));
  geometry.computeBoundingSphere();
  geometry.computeBoundingBox();

  geometry.userData.ranges = ranges;

  return { geometry, parts, bounds, ranges };
}

/**
 * Pull a single part back out of the merged geometry as a standalone,
 * independently transformable BufferGeometry.
 *
 * Indices are rebased to zero and positions are COPIED rather than
 * viewed, because the caller (the fracture tool) is going to cut and
 * move this geometry, and writing through a view would corrupt the
 * shared merged buffer that the rest of the anatomy is drawn from.
 */
export function extractPart(mergedGeometry, partIndex) {
  const ranges = mergedGeometry.userData.ranges;
  const r = ranges?.[partIndex];
  if (!r) return null;

  const srcPos = mergedGeometry.getAttribute('position').array;
  const srcNrm = mergedGeometry.getAttribute('normal').array;
  const srcIdx = mergedGeometry.getIndex().array;

  const pos = new Float32Array(r.vertexCount * 3);
  const nrm = new Int16Array(r.vertexCount * 3);
  pos.set(srcPos.subarray(r.vertexStart * 3, (r.vertexStart + r.vertexCount) * 3));
  nrm.set(srcNrm.subarray(r.vertexStart * 3, (r.vertexStart + r.vertexCount) * 3));

  const idx = new Uint32Array(r.indexCount);
  for (let i = 0; i < r.indexCount; i++) idx[i] = srcIdx[r.indexStart + i] - r.vertexStart;

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3, true));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}
