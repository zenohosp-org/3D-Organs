import {
  Activity, Undo2, Redo2, Grid3x3, Sun, Scan, ScissorsLineDashed,
  RotateCw, Camera, Download, Upload, HelpCircle, Maximize2, Layers,
  Presentation, FileText,
} from 'lucide-react';
import { useSceneStore } from '../store/useSceneStore';

/* ===================================================================
   TOP BAR
   -------------------------------------------------------------------
   Only actions that apply to the whole scene live here. Anything that
   applies to one implant lives in the right panel, and anything that
   applies to one structure lives in the left rail — so there is never
   a question of where a control should be.
   =================================================================== */

const VIEWS = [
  ['anterior', 'A', 'Anterior'],
  ['posterior', 'P', 'Posterior'],
  ['left', 'L', 'Left lateral'],
  ['right', 'R', 'Right lateral'],
  ['superior', 'S', 'Superior'],
  ['inferior', 'I', 'Inferior'],
];

export default function Toolbar({ cameraApiRef, onScreenshot, onExport, onImport, onHelp, onHandout }) {
  const undo = useSceneStore((s) => s.undo);
  const redo = useSceneStore((s) => s.redo);
  const canUndo = useSceneStore((s) => s.past.length > 0);
  const canRedo = useSceneStore((s) => s.future.length > 0);

  const xray = useSceneStore((s) => s.xray);
  const showGrid = useSceneStore((s) => s.showGrid);
  const showShadows = useSceneStore((s) => s.showShadows);
  const autoRotate = useSceneStore((s) => s.autoRotate);
  const clipEnabled = useSceneStore((s) => s.clipEnabled);
  const setDisplay = useSceneStore((s) => s.setDisplay);
  const consultMode = useSceneStore((s) => s.consultMode);
  const setConsultMode = useSceneStore((s) => s.setConsultMode);

  return (
    <header className="o3d-topbar">
      <div className="o3d-brand">
        <span className="o3d-brand__mark"><Activity size={14} /></span>
        <span>
          Organ 3D
          <span className="o3d-brand__sub" style={{ display: 'block' }}>ZenoHosp</span>
        </span>
      </div>

      {/* History */}
      <div className="o3d-toolgroup">
        <button className="o3d-tool" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)">
          <Undo2 size={14} />
        </button>
        <button className="o3d-tool" onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)">
          <Redo2 size={14} />
        </button>
      </div>

      {/* Standard radiographic views */}
      <div className="o3d-toolgroup">
        {VIEWS.map(([id, key, label]) => (
          <button
            key={id}
            className="o3d-tool"
            onClick={() => cameraApiRef.current?.view(id)}
            title={`${label} view`}
          >
            {key}
          </button>
        ))}
        <button
          className="o3d-tool"
          onClick={() => cameraApiRef.current?.frame()}
          title="Fit to view (F)"
        >
          <Maximize2 size={14} />
        </button>
      </div>

      {/* Display */}
      <div className="o3d-toolgroup">
        <button
          className={`o3d-tool ${xray ? 'o3d-tool--on' : ''}`}
          onClick={() => setDisplay({ xray: !xray })}
          title="X-ray — ghost the tissue so seated hardware stays visible"
        >
          <Scan size={14} /> X-ray
        </button>
        <button
          className={`o3d-tool ${clipEnabled ? 'o3d-tool--on' : ''}`}
          onClick={() => setDisplay({ clipEnabled: !clipEnabled })}
          title="Cross-section — cut the scene with a movable plane"
        >
          <ScissorsLineDashed size={14} /> Section
        </button>
        <button
          className={`o3d-tool ${showGrid ? 'o3d-tool--on' : ''}`}
          onClick={() => setDisplay({ showGrid: !showGrid })}
          title="Reference grid"
        >
          <Grid3x3 size={14} />
        </button>
        <button
          className={`o3d-tool ${showShadows ? 'o3d-tool--on' : ''}`}
          onClick={() => setDisplay({ showShadows: !showShadows })}
          title="Shadows — turn off if the frame rate drops"
        >
          <Sun size={14} />
        </button>
        <button
          className={`o3d-tool ${autoRotate ? 'o3d-tool--on' : ''}`}
          onClick={() => setDisplay({ autoRotate: !autoRotate })}
          title="Turntable"
        >
          <RotateCw size={14} />
        </button>
      </div>

      {/* Consultation — kept next to the file group because these are
          the two things reached for at the END of an explanation. */}
      <div className="o3d-toolgroup o3d-toolgroup--divider">
        <button
          className={`o3d-tool ${consultMode ? 'o3d-tool--on' : ''}`}
          onClick={() => setConsultMode(!consultMode)}
          title="Consult mode — full screen, plain English (C)"
        >
          <Presentation size={14} /> {consultMode ? 'Exit' : 'Consult'}
        </button>
        <button className="o3d-tool" onClick={onHandout} title="Patient handout">
          <FileText size={14} />
        </button>
      </div>

      {/* File */}
      <div className="o3d-toolgroup">
        <button className="o3d-tool" onClick={onScreenshot} title="Capture the current view as PNG">
          <Camera size={14} />
        </button>
        <button className="o3d-tool" onClick={onExport} title="Export plan as JSON">
          <Download size={14} />
        </button>
        <button className="o3d-tool" onClick={onImport} title="Import plan">
          <Upload size={14} />
        </button>
        <button className="o3d-tool" onClick={onHelp} title="Controls, data sources and licensing">
          <HelpCircle size={14} />
        </button>
      </div>
    </header>
  );
}

/* -------------------------------------------------------------------
   Display settings — rendered as a floating panel over the canvas so
   exposure and section depth can be adjusted while watching the result,
   without the eye leaving the model.
   ------------------------------------------------------------------- */

export function DisplayControls() {
  const exposure = useSceneStore((s) => s.exposure);
  const tissueOpacity = useSceneStore((s) => s.tissueOpacity);
  const clipEnabled = useSceneStore((s) => s.clipEnabled);
  const clipAxis = useSceneStore((s) => s.clipAxis);
  const clipPosition = useSceneStore((s) => s.clipPosition);
  const setDisplay = useSceneStore((s) => s.setDisplay);
  const consultMode = useSceneStore((s) => s.consultMode);
  const setConsultMode = useSceneStore((s) => s.setConsultMode);

  return (
    <div className="o3d-hud" style={{ width: 220 }}>
      <div className="o3d-hud__title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Layers size={12} /> Display
      </div>

      <HudRange
        label="Exposure"
        value={exposure}
        min={0.4} max={2} step={0.05}
        onChange={(v) => setDisplay({ exposure: v })}
        format={(v) => `${v.toFixed(2)}×`}
      />

      <HudRange
        label="Tissue opacity"
        value={tissueOpacity}
        min={0.08} max={1} step={0.02}
        onChange={(v) => setDisplay({ tissueOpacity: v })}
        format={(v) => `${Math.round(v * 100)}%`}
      />

      {clipEnabled && (
        <>
          <div style={{ display: 'flex', gap: 3, marginTop: 4 }}>
            {['x', 'y', 'z'].map((a) => (
              <button
                key={a}
                onClick={() => setDisplay({ clipAxis: a })}
                style={{
                  flex: 1, height: 22, border: 'none', borderRadius: 4, cursor: 'pointer',
                  fontSize: 10.5, fontWeight: 600, fontFamily: 'inherit',
                  background: clipAxis === a ? '#38bdf8' : 'rgba(255,255,255,0.1)',
                  color: clipAxis === a ? '#04212f' : '#cbd5e1',
                }}
              >
                {a.toUpperCase()}
              </button>
            ))}
          </div>
          <HudRange
            label="Section depth"
            value={clipPosition}
            min={-1} max={1} step={0.01}
            onChange={(v) => setDisplay({ clipPosition: v })}
            format={(v) => v.toFixed(2)}
          />
        </>
      )}
    </div>
  );
}

function HudRange({ label, value, min, max, step, onChange, format }) {
  return (
    <div style={{ marginTop: 2 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
        <span style={{ fontSize: 10.5, color: '#94a3b8' }}>{label}</span>
        <span style={{ fontSize: 10.5, color: '#e2e8f0', fontFamily: 'var(--o3d-mono)' }}>
          {format(value)}
        </span>
      </div>
      <input
        className="o3d-range"
        type="range"
        min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ background: 'rgba(255,255,255,0.16)' }}
      />
    </div>
  );
}
