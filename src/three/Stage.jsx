import { useMemo } from 'react';
import { Environment, Lightformer, ContactShadows } from '@react-three/drei';

/* ===================================================================
   LIGHTING RIG
   -------------------------------------------------------------------
   Everything here is generated in-process. drei's `Environment preset=`
   helpers pull HDRIs off a CDN at runtime, which is unacceptable for
   software that has to work on a hospital network with no outbound
   internet — the viewer would simply render black. So the environment
   is built from `Lightformer` emissive planes rendered into a cube
   target: no fetch, no external asset, deterministic every load.

   The rig is a three-point studio setup adapted for wet tissue and
   polished metal, which want opposite things:

     KEY    — large, soft, high, slightly warm. Wraps the broad convex
              surfaces of an organ without blowing out the specular.
     FILL   — cool and broad from camera-left, lifting the shadow side
              so anatomy stays readable rather than dramatic. Clinical
              images should not have crushed blacks.
     RIM    — two narrow bright strips behind and above. These are for
              the METAL: a polished implant is a pure mirror, so what
              you actually see on it is the *shape of the lights*.
              Narrow strips read as recognisable specular highlights
              and are what make titanium look like titanium instead of
              flat grey.
     GROUND — dim, wide, from below. Stops the underside going to pure
              black on a dark stage.
   =================================================================== */

export default function Stage({ shadows = true, radius = 10 }) {
  // The environment is static; rebuilding it on every render would
  // re-render the cube target and cost a visible hitch.
  const env = useMemo(
    () => (
      <Environment resolution={256} frames={1}>
        {/* KEY */}
        <Lightformer
          form="rect"
          intensity={3.2}
          color="#fff3e6"
          scale={[12, 8, 1]}
          position={[6, 9, 6]}
          target={[0, 0, 0]}
        />
        {/* FILL */}
        <Lightformer
          form="rect"
          intensity={1.15}
          color="#cfe0ff"
          scale={[14, 10, 1]}
          position={[-9, 3, 7]}
          target={[0, 0, 0]}
        />
        {/* RIM — the two strips that give metal its highlight */}
        <Lightformer
          form="rect"
          intensity={6}
          color="#ffffff"
          scale={[0.6, 14, 1]}
          position={[-7, 6, -8]}
          target={[0, 0, 0]}
        />
        <Lightformer
          form="rect"
          intensity={5}
          color="#e8f2ff"
          scale={[0.6, 12, 1]}
          position={[8, 5, -7]}
          target={[0, 0, 0]}
        />
        {/* Overhead soft box — general ambient occlusion relief */}
        <Lightformer
          form="rect"
          intensity={1.6}
          color="#ffffff"
          scale={[18, 18, 1]}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 14, 0]}
        />
        {/* GROUND bounce */}
        <Lightformer
          form="rect"
          intensity={0.5}
          color="#8f9bb0"
          scale={[18, 18, 1]}
          rotation={[Math.PI / 2, 0, 0]}
          position={[0, -10, 0]}
        />
      </Environment>
    ),
    []
  );

  return (
    <>
      {env}

      {/* A single shadow-casting directional light on top of the image-
          based lighting. The env map alone gives beautiful shading but
          no cast shadows, and without contact shadows an implant looks
          like it is floating rather than sitting against bone. */}
      <directionalLight
        castShadow={shadows}
        position={[8, 14, 8]}
        intensity={1.5}
        color="#fff6ec"
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0006}
        shadow-normalBias={0.02}
      >
        <orthographicCamera
          attach="shadow-camera"
          args={[-radius * 1.6, radius * 1.6, radius * 1.6, -radius * 1.6, 0.1, radius * 6]}
        />
      </directionalLight>

      {/* Cool counter-light, no shadow — separates anatomy from the
          dark stage without adding a second shadow to reason about. */}
      <directionalLight position={[-10, 5, -6]} intensity={0.55} color="#bcd4ff" />

      <ambientLight intensity={0.18} />

      {shadows && (
        <ContactShadows
          position={[0, -radius * 0.92, 0]}
          scale={radius * 3.2}
          resolution={1024}
          blur={2.6}
          opacity={0.55}
          far={radius * 2}
          color="#000000"
          frames={1}
        />
      )}
    </>
  );
}
