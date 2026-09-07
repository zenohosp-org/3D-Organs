import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { ZoomIn, ZoomOut, Maximize2, HeartCrack, Wrench } from 'lucide-react';
import Viewer from './three/Viewer';
import { organAnchor } from './three/OrganModel';
import Toolbar, { DisplayControls } from './components/Toolbar';
import AnatomyRail from './components/AnatomyRail';
import ImplantPanel from './components/ImplantPanel';
import HelpModal from './components/HelpModal';
import ConsultPanel from './components/ConsultPanel';
import Handout from './components/Handout';
import { useSceneStore, selectedImplant } from './store/useSceneStore';
import { loadAtlas, buildMergedGeometry, ATLAS_SCALE } from './three/atlasLoader';
import { partsForRegion } from './data/anatomy';
import { probeOrgans } from './three/organAvailability';
import { patientLabel } from './data/layTerms';
import { disposeGeometryCache } from './three/implantGeometry';

/* ===================================================================
   APPLICATION SHELL
   -------------------------------------------------------------------
   Owns the async lifecycle that everything else depends on: fetch the
   atlas manifest, resolve the selected region to a part list, stream
   the geometry chunks that list needs, and merge them into the single
   buffer the renderer draws.

   Region switching is the fiddly part. A doctor clicking through
   regions faster than the network can serve them will have several
   loads in flight at once, and without guarding, an earlier slow load
   can resolve last and overwrite the region they actually chose. Every
   load therefore carries a token, and a stale token's result is
   discarded on arrival.
   =================================================================== */

export default function App({ embedded = false, patient = null }) {
  const cameraApiRef = useRef(null);
  const fileInputRef = useRef(null);
  const loadToken = useRef(0);

  const [geometry, setGeometry] = useState(null);
  const [radius, setRadius] = useState(10);
  const [showHelp, setShowHelp] = useState(false);
  const [showHandout, setShowHandout] = useState(false);
  const [toast, setToast] = useState(null);

  const atlas = useSceneStore((s) => s.atlas);
  const setAtlas = useSceneStore((s) => s.setAtlas);
  const regionId = useSceneStore((s) => s.regionId);
  const parts = useSceneStore((s) => s.parts);
  const setParts = useSceneStore((s) => s.setParts);
  const setLoad = useSceneStore((s) => s.setLoad);
  const loadState = useSceneStore((s) => s.loadState);
  const loadProgress = useSceneStore((s) => s.loadProgress);
  const loadError = useSceneStore((s) => s.loadError);
  const organFile = useSceneStore((s) => s.organFile);
  const selectedPart = useSceneStore((s) => s.selectedPart);
  const hoveredPart = useSceneStore((s) => s.hoveredPart);
  const consultMode = useSceneStore((s) => s.consultMode);
  const layLanguage = useSceneStore((s) => s.layLanguage);
  const phase = useSceneStore((s) => s.phase);
  const setPhase = useSceneStore((s) => s.setPhase);
  const fracture = useSceneStore((s) => s.fracture);
  const setOrgansAvailable = useSceneStore((s) => s.setOrgansAvailable);
  const implantCount = useSceneStore((s) => s.implants.length);

  /* ---------------- Atlas manifest ---------------- */
  useEffect(() => {
    let alive = true;
    loadAtlas()
      .then((a) => alive && setAtlas(a))
      .catch((err) => alive && setLoad({ loadState: 'error', loadError: err.message }));
    return () => { alive = false; };
  }, [setAtlas, setLoad]);

  /* ---------------- Region geometry ---------------- */
  useEffect(() => {
    if (!atlas) return;
    const token = ++loadToken.current;

    const regionParts = partsForRegion(atlas, regionId);
    setParts(regionParts);
    setLoad({ loadState: 'loading', loadProgress: 0, loadError: null });

    buildMergedGeometry(regionParts, {
      onProgress: (p) => {
        if (token === loadToken.current) setLoad({ loadProgress: p });
      },
    })
      .then(({ geometry: g, bounds }) => {
        // A region the doctor has already navigated away from must not
        // clobber the one they are waiting for.
        if (token !== loadToken.current) {
          g.dispose();
          return;
        }
        const sphere = bounds.getBoundingSphere(new THREE.Sphere());
        const r = Math.max(sphere.radius, 0.5);

        // Recentre the geometry on its own centroid. Atlas coordinates
        // are absolute body coordinates, so a region like "lower limb"
        // sits far off the origin — without this the camera frames
        // empty space and the grid sits at the wrong height.
        g.translate(-sphere.center.x, -sphere.center.y, -sphere.center.z);
        // Remember the shift, so per-part bounds (which are still in
        // absolute atlas coordinates) can be mapped into scene space
        // when focusing the camera on a structure.
        g.userData.offset = sphere.center.clone().negate();
        g.computeBoundingSphere();

        setGeometry((prev) => {
          prev?.dispose();
          return g;
        });
        setRadius(r);
        setLoad({ loadState: 'ready', loadProgress: 1 });
        requestAnimationFrame(() => cameraApiRef.current?.frame(r));
      })
      .catch((err) => {
        if (token !== loadToken.current) return;
        setLoad({ loadState: 'error', loadError: err.message });
      });
  }, [atlas, regionId, setParts, setLoad]);

  useEffect(() => () => disposeGeometryCache(), []);

  /* Which textured organs exist here. Probed rather than assumed: they
     are gitignored, so a deployment has none and a dev machine may have
     all four. */
  useEffect(() => {
    let alive = true;
    probeOrgans().then((set) => alive && setOrgansAvailable(set));
    return () => { alive = false; };
  }, [setOrgansAvailable]);

  /* ---------------- Keyboard ---------------- */
  useEffect(() => {
    const onKey = (e) => {
      // Never steal keys from a text field.
      const t = e.target;
      if (t instanceof HTMLElement && /input|textarea|select/i.test(t.tagName)) return;

      const store = useSceneStore.getState();
      const mod = e.ctrlKey || e.metaKey;

      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        e.shiftKey ? store.redo() : store.undo();
        return;
      }
      if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        if (store.selectedImplantId) store.duplicateImplant(store.selectedImplantId);
        return;
      }
      switch (e.key.toLowerCase()) {
        case 'w': store.setTransformMode('translate'); break;
        case 'e': store.setTransformMode('rotate'); break;
        case 'r': store.setTransformMode('scale'); break;
        case 'x': store.setDisplay({ xray: !store.xray }); break;
        case 'c': store.setConsultMode(!store.consultMode); break;
        case 'b':
          // Before/after — the key a doctor hits mid-sentence.
          if (store.fracture || store.implants.length) store.togglePhase();
          break;
        case 'f': cameraApiRef.current?.frame(radius); break;
        case '+': case '=': cameraApiRef.current?.zoomBy(0.8); break;
        case '-': case '_': cameraApiRef.current?.zoomBy(1.25); break;
        case 'escape':
          store.selectImplant(null);
          store.selectPart(-1);
          setShowHelp(false);
          setShowHandout(false);
          if (store.consultMode) store.setConsultMode(false);
          break;
        case 'delete': case 'backspace':
          if (store.selectedImplantId) {
            e.preventDefault();
            store.removeImplant(store.selectedImplantId);
          }
          break;
        default: break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [radius]);

  /* ---------------- File actions ---------------- */

  const flash = useCallback((msg) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2600);
  }, []);

  /* Backstop: if an organ fails to load despite the probe, clear the
     selection so the picker does not sit on a dead entry, and say why. */
  const handleOrganError = useCallback(() => {
    const file = useSceneStore.getState().organFile;
    useSceneStore.getState().setDisplay({ organFile: null });
    useSceneStore.getState().setOrgansAvailable(
      new Set([...(useSceneStore.getState().organsAvailable ?? [])].filter((f) => f !== file))
    );
    flash('That organ model could not be loaded and is unavailable here.');
  }, [flash]);

  const handleScreenshot = useCallback(() => {
    const canvas = document.querySelector('.o3d-canvas canvas');
    if (!canvas) return;
    // `preserveDrawingBuffer: true` on the renderer is what makes this
    // return pixels rather than a blank image.
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `organ3d-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '')}.png`;
      a.click();
      URL.revokeObjectURL(url);
      flash('View captured.');
    }, 'image/png');
  }, [flash]);

  const handleExport = useCallback(() => {
    const plan = useSceneStore.getState().exportPlan();
    const blob = new Blob([JSON.stringify(plan, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `organ3d-plan-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    flash(`Exported ${plan.implants.length} item${plan.implants.length === 1 ? '' : 's'}.`);
  }, [flash]);

  const handleImportFile = useCallback(
    async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const doc = JSON.parse(await file.text());
        useSceneStore.getState().importPlan(doc);
        flash(`Loaded ${doc.implants?.length ?? 0} item(s).`);
      } catch (err) {
        flash(`Could not load plan — ${err.message}`);
      }
      // Reset so re-picking the same file fires change again.
      e.target.value = '';
    },
    [flash]
  );

  /* ---------------- Derived ---------------- */

  const hud = useMemo(() => {
    const idx = hoveredPart >= 0 ? hoveredPart : selectedPart;
    if (idx < 0 || !parts[idx]) return null;
    const p = parts[idx];
    return {
      name: layLanguage ? patientLabel(p.name) : p.name,
      meta: `${p.conceptId} · ${p.system}`,
    };
  }, [hoveredPart, selectedPart, parts, layLanguage]);

  /* Anatomical placement for the textured organ: atlas anchor (metres)
     scaled to centimetres, then shifted by the same recentring the
     merged geometry received, so organ and skeleton share one frame. */
  const organPosition = useMemo(() => {
    if (!organFile || !atlas) return null;
    const anchor = organAnchor(atlas, organFile);
    if (!anchor) return null;
    const offset = geometry?.userData?.offset ?? new THREE.Vector3();
    return anchor.multiplyScalar(ATLAS_SCALE).add(offset).toArray();
  }, [organFile, atlas, geometry]);

  const focusPart = useCallback(
    (index) => {
      const p = parts[index];
      if (!p || !geometry) return;
      // part.bounds are raw atlas metres; the geometry is centimetres.
      const box = new THREE.Box3(
        new THREE.Vector3(...p.bounds[0]).multiplyScalar(ATLAS_SCALE),
        new THREE.Vector3(...p.bounds[1]).multiplyScalar(ATLAS_SCALE)
      );
      const sphere = box.getBoundingSphere(new THREE.Sphere());
      // Part bounds are absolute atlas coordinates; the merged geometry
      // was recentred on load, so apply the same shift before pointing
      // the camera or it frames empty space.
      const center = sphere.center.add(geometry.userData.offset ?? new THREE.Vector3());
      cameraApiRef.current?.focusOn(center, Math.max(sphere.radius, 0.4));
    },
    [parts, geometry]
  );

  return (
    <div
      className={[
        'o3d-app',
        embedded ? 'o3d-app--embedded' : '',
        consultMode ? 'o3d-app--consult' : '',
      ].filter(Boolean).join(' ')}
    >
      <Toolbar
        cameraApiRef={cameraApiRef}
        onScreenshot={handleScreenshot}
        onExport={handleExport}
        onImport={() => fileInputRef.current?.click()}
        onHelp={() => setShowHelp(true)}
        onHandout={() => setShowHandout(true)}
      />

      <AnatomyRail onFocusPart={focusPart} />

      <main className="o3d-canvas">
        <Viewer
          geometry={geometry}
          parts={parts}
          organFile={organFile}
          organPosition={organPosition}
          radius={radius}
          cameraApiRef={cameraApiRef}
          onOrganError={handleOrganError}
        />

        {/* Hovered / selected structure readout */}
        {hud && (
          <div className="o3d-overlay o3d-overlay--tl">
            <div className="o3d-hud">
              <span className="o3d-hud__title">{hud.name}</span>
              <span className="o3d-hud__meta">{hud.meta}</span>
            </div>
          </div>
        )}

        {/* Loading / error */}
        {loadState !== 'ready' && (
          <div className="o3d-overlay o3d-overlay--tl" style={hud ? { top: 92 } : undefined}>
            <div className="o3d-hud" style={{ minWidth: 220 }}>
              {loadState === 'error' ? (
                <>
                  <span className="o3d-hud__title" style={{ color: '#fca5a5' }}>
                    Could not load anatomy
                  </span>
                  <span className="o3d-hud__meta">{loadError}</span>
                </>
              ) : (
                <>
                  <span className="o3d-hud__title">Loading anatomy…</span>
                  <span className="o3d-hud__meta">
                    {Math.round(loadProgress * 100)}% · {parts.length} structures
                  </span>
                  <div className="o3d-progress" style={{ marginTop: 4 }}>
                    <div className="o3d-progress__bar" style={{ width: `${loadProgress * 100}%` }} />
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        <div className="o3d-overlay o3d-overlay--tr">
          <DisplayControls />
        </div>

        {/* Before / after — always reachable, and the primary control
            once the screen is turned toward the patient. */}
        {(fracture || implantCount > 0) && (
          <div
            className="o3d-overlay"
            style={{ bottom: 'var(--hms-space-md)', left: '50%', transform: 'translateX(-50%)' }}
          >
            <div className="o3d-phase">
              <button
                className="is-injury"
                aria-pressed={phase === 'injury'}
                onClick={() => setPhase('injury')}
                disabled={!fracture}
                title={fracture ? 'Show the injury (B)' : 'Mark a fracture to show the injury'}
              >
                <HeartCrack size={16} /> The injury
              </button>
              <button
                className="is-repair"
                aria-pressed={phase === 'repair'}
                onClick={() => setPhase('repair')}
                title="Show the repair (B)"
              >
                <Wrench size={16} /> The repair
              </button>
            </div>
          </div>
        )}

        <div className="o3d-overlay o3d-overlay--bl">
          <div className="o3d-hud" style={{ marginBottom: 8 }}>
            <span className="o3d-hud__hint">
              <span><kbd>Drag</kbd> rotate</span>
              <span><kbd>Right-drag</kbd> pan</span>
              <span><kbd>Wheel</kbd> zoom</span>
              <span><kbd>F</kbd> fit</span>
            </span>
          </div>
          <div className="o3d-zoombar" style={{ flexDirection: 'row' }}>
            <button onClick={() => cameraApiRef.current?.zoomBy(0.8)} title="Zoom in (+)">
              <ZoomIn size={16} />
            </button>
            <button onClick={() => cameraApiRef.current?.zoomBy(1.25)} title="Zoom out (−)">
              <ZoomOut size={16} />
            </button>
            <button onClick={() => cameraApiRef.current?.frame(radius)} title="Fit to view (F)">
              <Maximize2 size={16} />
            </button>
          </div>
        </div>

        {toast && (
          <div className="o3d-overlay" style={{ bottom: 'var(--hms-space-md)', left: '50%', transform: 'translateX(-50%)' }}>
            <div className="o3d-hud">{toast}</div>
          </div>
        )}
      </main>

      <ImplantPanel onOpenHandout={() => setShowHandout(true)} />

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        style={{ display: 'none' }}
        onChange={handleImportFile}
      />

      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
      {showHandout && <Handout patient={patient} onClose={() => setShowHandout(false)} />}
    </div>
  );
}
