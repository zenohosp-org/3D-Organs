import { useMemo } from 'react';
import { Bone, HeartCrack, Wrench, Presentation, FileText, Languages, RotateCcw } from 'lucide-react';
import { useSceneStore } from '../store/useSceneStore';
import { FRACTURE_PATTERNS } from '../three/fracture';
import { patientLabel, layName } from '../data/layTerms';

/* ===================================================================
   CONSULT PANEL
   -------------------------------------------------------------------
   The patient-facing half of the tool: mark the injury, then flip
   between "what's wrong" and "what we'll do".

   Ordering here is the consultation itself, top to bottom — choose the
   bone, describe the break, show how far it has moved, then switch to
   the repair. A doctor should be able to work down this panel while
   talking and never hunt for the next control.
   =================================================================== */

const BONE_LIKE = /\b(femur|tibia|fibula|humerus|radius|ulna|scapula|clavicle|patella|talus|calcaneus|hip bone|sacrum|vertebra|rib|mandible|maxilla|sternum)\b/i;

export default function ConsultPanel({ onOpenHandout }) {
  const parts = useSceneStore((s) => s.parts);
  const selectedPart = useSceneStore((s) => s.selectedPart);
  const fracture = useSceneStore((s) => s.fracture);
  const setFracture = useSceneStore((s) => s.setFracture);
  const updateFracture = useSceneStore((s) => s.updateFracture);
  const updateDisplacement = useSceneStore((s) => s.updateDisplacement);
  const clearFracture = useSceneStore((s) => s.clearFracture);
  const phase = useSceneStore((s) => s.phase);
  const setPhase = useSceneStore((s) => s.setPhase);
  const consultMode = useSceneStore((s) => s.consultMode);
  const setConsultMode = useSceneStore((s) => s.setConsultMode);
  const layLanguage = useSceneStore((s) => s.layLanguage);
  const setLayLanguage = useSceneStore((s) => s.setLayLanguage);
  const implants = useSceneStore((s) => s.implants);

  /* Only bones can be fractured. Offering to "fracture" the descending
     colon would be nonsense, and filtering here is cheaper than
     explaining that in the UI. */
  const boneCandidate = useMemo(() => {
    const p = parts[selectedPart];
    if (!p || !BONE_LIKE.test(p.name)) return null;
    return { index: selectedPart, name: p.name };
  }, [parts, selectedPart]);

  const fracturedName = fracture ? fracture.partName : null;

  const startFracture = () => {
    if (!boneCandidate) return;
    setFracture({
      partIndex: boneCandidate.index,
      partName: boneCandidate.name,
      pattern: 'transverse',
      level: 0.5,
      displacement: { shift: 8, angulation: 10, rotation: 0 },
    });
    setPhase('injury');
  };

  return (
    <div className="o3d-section o3d-section--grow">
      <div className="o3d-section__head"><span>Patient conversation</span></div>
      <div className="o3d-section__body" style={{ padding: 0 }}>

        {/* ---- Before / after: the core of the explanation ---- */}
        <div className="o3d-cat__head" style={{ padding: '10px 12px 4px' }}>Show the patient</div>
        <div className="o3d-seg">
          <button
            aria-pressed={phase === 'injury'}
            onClick={() => setPhase('injury')}
            disabled={!fracture}
            title={fracture ? 'Show the injury' : 'Mark a fracture first'}
            style={!fracture ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}
          >
            <HeartCrack size={12} /> The injury
          </button>
          <button aria-pressed={phase === 'repair'} onClick={() => setPhase('repair')}>
            <Wrench size={12} /> The repair
          </button>
        </div>
        <p className="o3d-note" style={{ paddingTop: 6 }}>
          {phase === 'injury'
            ? fracture
              ? 'Showing the break, before treatment. Hardware is hidden.'
              : 'Mark a fracture below to show the injury.'
            : implants.length
              ? `Showing the repair with ${implants.length} item${implants.length === 1 ? '' : 's'} of hardware in place.`
              : 'Showing intact anatomy. Add hardware from the Add tab.'}
        </p>

        {/* ---- Presentation ---- */}
        <div className="o3d-cat" style={{ paddingBottom: 8 }}>
          <button
            className={consultMode ? 'hms-btn-primary' : 'hms-btn-secondary'}
            style={{ width: '100%' }}
            onClick={() => setConsultMode(!consultMode)}
          >
            <Presentation size={13} />
            {consultMode ? 'Exit consult mode' : 'Consult mode — full screen'}
          </button>
        </div>

        <button className="o3d-toggle" onClick={() => setLayLanguage(!layLanguage)}>
          <span><Languages size={12} style={{ verticalAlign: '-2px', marginRight: 6 }} />Plain English labels</span>
          <span className={`o3d-switch ${layLanguage ? 'o3d-switch--on' : ''}`} />
        </button>

        <div className="o3d-cat" style={{ paddingTop: 4, paddingBottom: 10 }}>
          <button className="hms-btn-secondary" style={{ width: '100%' }} onClick={onOpenHandout}>
            <FileText size={13} /> Patient handout
          </button>
        </div>

        {/* ---- Fracture ---- */}
        <div className="o3d-cat__head" style={{ padding: '6px 12px 4px', borderTop: '1px solid var(--hms-gray-200)' }}>
          Mark the injury
        </div>

        {!fracture ? (
          <div className="o3d-cat">
            {boneCandidate ? (
              <>
                <p className="o3d-note" style={{ padding: '0 4px 8px' }}>
                  Selected: <strong>{patientLabel(boneCandidate.name)}</strong>
                </p>
                <button className="hms-btn-primary" style={{ width: '100%' }} onClick={startFracture}>
                  <Bone size={13} /> Add fracture here
                </button>
              </>
            ) : (
              <p className="o3d-note" style={{ padding: '0 4px' }}>
                Click a bone in the model — or in the list on the left — to mark a
                fracture on it.
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="o3d-cat">
              <p className="o3d-note" style={{ padding: '0 4px 6px' }}>
                <strong>{patientLabel(fracturedName)}</strong>
              </p>
            </div>

            <div className="o3d-cat__head" style={{ padding: '4px 12px 2px' }}>Pattern</div>
            <div className="o3d-cat">
              {Object.entries(FRACTURE_PATTERNS).map(([key, spec]) => (
                <button
                  key={key}
                  className={`o3d-card ${fracture.pattern === key ? 'o3d-card--on' : ''}`}
                  onClick={() => updateFracture({ pattern: key })}
                >
                  <span className="o3d-card__icon"><HeartCrack size={14} /></span>
                  <span style={{ minWidth: 0 }}>
                    <span className="o3d-card__title">{spec.label}</span>
                    <span className="o3d-card__blurb">{spec.lay}</span>
                  </span>
                </button>
              ))}
            </div>

            <Range
              label="Position along the bone"
              value={fracture.level}
              min={0.15} max={0.85} step={0.01}
              format={(v) => (v < 0.4 ? 'Lower third' : v > 0.6 ? 'Upper third' : 'Mid-shaft')}
              onChange={(v) => updateFracture({ level: v }, { history: false })}
            />

            <div className="o3d-cat__head" style={{ padding: '8px 12px 2px' }}>
              How far it has moved
            </div>
            <Range
              label="Sideways shift"
              value={fracture.displacement.shift}
              min={0} max={40} step={1} unit=" mm"
              onChange={(v) => updateDisplacement({ shift: v })}
            />
            <Range
              label="Angulation"
              value={fracture.displacement.angulation}
              min={-45} max={45} step={1} unit="°"
              onChange={(v) => updateDisplacement({ angulation: v })}
            />
            <Range
              label="Rotation"
              value={fracture.displacement.rotation}
              min={-60} max={60} step={1} unit="°"
              onChange={(v) => updateDisplacement({ rotation: v })}
            />

            <div className="o3d-cat" style={{ paddingTop: 8 }}>
              <button className="hms-btn-secondary" style={{ width: '100%' }} onClick={clearFracture}>
                <RotateCcw size={13} /> Remove fracture
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Range({ label, value, min, max, step, unit = '', format, onChange }) {
  const decimals = step < 1 ? 2 : 0;
  return (
    <div className="o3d-field">
      <div className="o3d-field__row">
        <span className="o3d-field__label">{label}</span>
        <span className="o3d-field__value">
          {format ? format(value) : `${Number(value).toFixed(decimals)}${unit}`}
        </span>
      </div>
      <input
        className="o3d-range"
        type="range"
        min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}
