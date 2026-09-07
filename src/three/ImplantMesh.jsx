import { useCallback, useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { TransformControls, Edges } from '@react-three/drei';
import { useSceneStore } from '../store/useSceneStore';
import { implantGeometry } from './implantGeometry';
import { hardwareMaterial } from './materials';

/* ===================================================================
   IMPLANT MESH + GIZMO
   -------------------------------------------------------------------
   One implant. Geometry is regenerated from parameters whenever a size
   changes (cached in implantGeometry.js, so scrubbing a slider back
   over a value already seen costs nothing).

   Two details that are easy to get wrong and very visible when you do:

   1. CAMERA vs GIZMO. Dragging a screw must not also orbit the camera.
      drei's TransformControls already listens for `dragging-changed`
      and disables `state.controls` — but ONLY if something claimed
      that slot. That is why OrbitControls in Viewer.jsx carries
      `makeDefault`. Without it the wiring silently does nothing and
      every drag flings the implant across the scene.

   2. ATTACHING THE GIZMO. The controls need the actual Object3D, which
      does not exist on first render. Reading a ref during render would
      give null and never re-run, so the mesh is captured through a
      CALLBACK REF into state — that does schedule the re-render which
      mounts the gizmo.
   =================================================================== */

export default function ImplantMesh({ implant, selected }) {
  // Callback ref into state: see note 2 above.
  const [object, setObject] = useState(null);

  const transformMode = useSceneStore((s) => s.transformMode);
  const transformSpace = useSceneStore((s) => s.transformSpace);
  const snapEnabled = useSceneStore((s) => s.snapEnabled);
  const updateImplant = useSceneStore((s) => s.updateImplant);
  const selectImplant = useSceneStore((s) => s.selectImplant);
  const commit = useSceneStore((s) => s.commit);
  const consultMode = useSceneStore((s) => s.consultMode);

  const geometry = useMemo(
    () => implantGeometry(implant.kind, implant.params),
    [implant.kind, implant.params]
  );

  const material = useMemo(() => hardwareMaterial(implant.material), [implant.material]);

  /* Push store state onto the Object3D. During a drag the gizmo is the
     source of truth and writes back with history:false, so this only
     has to handle changes that came from elsewhere — the properties
     panel, undo, or loading a plan. */
  useEffect(() => {
    if (!object) return;
    object.position.fromArray(implant.position);
    object.rotation.fromArray(implant.rotation);
    object.scale.setScalar(implant.scale);
  }, [object, implant.position, implant.rotation, implant.scale]);

  const writeBack = useCallback(
    (history) => {
      if (!object) return;
      updateImplant(
        implant.id,
        {
          position: object.position.toArray(),
          rotation: [object.rotation.x, object.rotation.y, object.rotation.z],
          scale: object.scale.x,
        },
        { history }
      );
    },
    [object, implant.id, updateImplant]
  );

  // No gizmo and no selection outline once the screen is facing the
  // patient: manipulation handles are editing chrome, and they make a
  // clinical explanation look like a CAD session.
  const showGizmo = selected && !implant.locked && object && !consultMode;
  const showOutline = selected && !consultMode;

  return (
    <>
      <mesh
        ref={setObject}
        geometry={geometry}
        material={material}
        visible={implant.visible}
        castShadow
        receiveShadow
        onClick={(e) => {
          e.stopPropagation();
          selectImplant(implant.id);
        }}
      >
        {showOutline && (
          // A thin outline so a small screw stays findable against bone
          // of a similar tone once it is seated.
          <Edges scale={1.03} threshold={25} color="#38bdf8" />
        )}
      </mesh>

      {showGizmo && (
        <TransformControls
          object={object}
          mode={transformMode}
          space={transformSpace}
          size={0.85}
          // 1 mm / 5° / 5% increments — the resolution hardware is
          // actually chosen and seated at. (1 scene unit = 1 cm.)
          translationSnap={snapEnabled ? 0.1 : null}
          rotationSnap={snapEnabled ? THREE.MathUtils.degToRad(5) : null}
          scaleSnap={snapEnabled ? 0.05 : null}
          // Snapshot ONCE at gesture start, so a single Ctrl+Z undoes
          // the whole move rather than one frame of it.
          onMouseDown={() => commit()}
          onObjectChange={() => writeBack(false)}
          onMouseUp={() => writeBack(false)}
        />
      )}
    </>
  );
}

/** All implants in the plan. */
export function ImplantLayer() {
  const implants = useSceneStore((s) => s.implants);
  const selectedImplantId = useSceneStore((s) => s.selectedImplantId);
  const phase = useSceneStore((s) => s.phase);

  // In the 'injury' phase the operation has not happened yet, so showing
  // hardware would be telling the patient the wrong story.
  if (phase === 'injury') return null;

  return implants.map((im) => (
    <ImplantMesh key={im.id} implant={im} selected={im.id === selectedImplantId} />
  ));
}
