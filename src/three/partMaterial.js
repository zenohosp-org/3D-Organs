import * as THREE from 'three';

/* ===================================================================
   PER-PART SHADER INJECTION
   -------------------------------------------------------------------
   The merged anatomy geometry is one mesh, but a clinician needs every
   structure in it to behave independently: its own tissue colour, its
   own opacity, hidden or shown, highlighted on hover, selected.

   Doing that with materials would mean splitting the mesh back into
   thousands of draw calls. Instead each vertex carries `aPartIndex`,
   and two 1-D data textures hold the per-part state:

       partColorTex : RGB = tissue colour,  A = opacity
       partFlagTex  : R   = visible (0/1)
                      G   = highlight amount (hover)
                      B   = selection amount
                      A   = reserved

   A vertex shader reads both by index and passes them down; the
   fragment shader multiplies them into the standard PBR result. So a
   doctor toggling the arterial tree writes one texel and the change
   lands next frame — no geometry rebuild, no recompile, no hitch.

   MeshPhysicalMaterial is patched via onBeforeCompile rather than
   replaced by a ShaderMaterial, so the tissue keeps three.js's real
   lighting, sheen and clearcoat model instead of a hand-rolled
   approximation.
   =================================================================== */

/** Textures are sized to the next power of two — some drivers still
 *  penalise NPOT sampling, and the waste is a few kilobytes. */
export function createPartTextures(count) {
  const width = THREE.MathUtils.ceilPowerOfTwo(Math.max(1, count));

  const colorData = new Float32Array(width * 4);
  const colorTex = new THREE.DataTexture(colorData, width, 1, THREE.RGBAFormat, THREE.FloatType);
  colorTex.needsUpdate = true;

  const flagData = new Float32Array(width * 4);
  const flagTex = new THREE.DataTexture(flagData, width, 1, THREE.RGBAFormat, THREE.FloatType);
  flagTex.needsUpdate = true;

  // Nearest filtering is essential: this is a lookup table, not an
  // image. Linear filtering would blend part 12's colour into part 13.
  [colorTex, flagTex].forEach((t) => {
    t.minFilter = THREE.NearestFilter;
    t.magFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
  });

  return { width, colorData, colorTex, flagData, flagTex };
}

const VERT_DECL = /* glsl */ `
  attribute float aPartIndex;
  uniform sampler2D uPartColor;
  uniform sampler2D uPartFlags;
  uniform float uPartTexWidth;
  varying vec4 vPartColor;
  varying vec4 vPartFlags;
`;

const VERT_BODY = /* glsl */ `
  // Sample the centre of the texel so rounding never lands us on a
  // neighbour's colour.
  float _u = (aPartIndex + 0.5) / uPartTexWidth;
  vPartColor = texture2D(uPartColor, vec2(_u, 0.5));
  vPartFlags = texture2D(uPartFlags, vec2(_u, 0.5));

  // Hidden parts are collapsed to a degenerate triangle rather than
  // discarded per fragment: it costs nothing in the fragment stage and
  // keeps hidden anatomy out of the depth buffer entirely.
  if (vPartFlags.r < 0.5) {
    gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
    return;
  }
`;

const FRAG_DECL = /* glsl */ `
  varying vec4 vPartColor;
  varying vec4 vPartFlags;
`;

const FRAG_COLOR = /* glsl */ `
  diffuseColor.rgb *= vPartColor.rgb;
  diffuseColor.a   *= vPartColor.a;
`;

const FRAG_EMISSIVE = /* glsl */ `
  // Hover warms the structure; selection pushes a cooler clinical cyan.
  // Both are added as emissive so they survive on tissue that happens
  // to be facing away from every light.
  vec3 _hoverTint  = vec3(0.34, 0.20, 0.06) * vPartFlags.g;
  vec3 _selectTint = vec3(0.02, 0.26, 0.34) * vPartFlags.b;
  totalEmissiveRadiance += _hoverTint + _selectTint;
`;

/**
 * Patch a MeshPhysicalMaterial for per-part lookup.
 * The material is mutated in place and returned.
 */
export function applyPartShading(material, { colorTex, flagTex, width }) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uPartColor = { value: colorTex };
    shader.uniforms.uPartFlags = { value: flagTex };
    shader.uniforms.uPartTexWidth = { value: width };

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERT_DECL}`)
      .replace('#include <begin_vertex>', `${VERT_BODY}\n#include <begin_vertex>`);

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAG_DECL}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${FRAG_COLOR}`)
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>\n${FRAG_EMISSIVE}`
      );
  };
  // Changing onBeforeCompile after a program exists requires a new key,
  // or three.js will hand back the unpatched cached program.
  material.customProgramCacheKey = () => 'o3d-part-shading-v1';
  material.needsUpdate = true;
  return material;
}

/** Write one part's colour + opacity into the lookup texture. */
export function setPartColor(store, index, color, opacity = 1) {
  const o = index * 4;
  store.colorData[o] = color.r;
  store.colorData[o + 1] = color.g;
  store.colorData[o + 2] = color.b;
  store.colorData[o + 3] = opacity;
  store.colorTex.needsUpdate = true;
}

/** Write one part's visible / hover / selected flags. */
export function setPartFlags(store, index, { visible = 1, hover = 0, selected = 0 } = {}) {
  const o = index * 4;
  store.flagData[o] = visible ? 1 : 0;
  store.flagData[o + 1] = hover;
  store.flagData[o + 2] = selected;
  store.flagTex.needsUpdate = true;
}

export function getPartVisible(store, index) {
  return store.flagData[index * 4] >= 0.5;
}
