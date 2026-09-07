import { useState } from 'react';
import {
  Bone, Plus, Trash2, Copy, Eye, EyeOff, Lock, Unlock,
  Move3d, Rotate3d, Scale3d, Magnet, Layers2, PackagePlus, MessageSquareHeart,
} from 'lucide-react';
import { useSceneStore, selectedImplant } from '../store/useSceneStore';
import {
  IMPLANT_CATALOG, IMPLANT_CATEGORIES, catalogEntry, describeImplant,
} from '../data/implants';
import { HARDWARE_PRESETS } from '../three/materials';
import ConsultPanel from './ConsultPanel';

/* ===================================================================
   RIGHT PANEL — what you are doing
   -------------------------------------------------------------------
   Two modes on one surface:

     CATALOGUE — pick hardware to add. Grouped by category because a
                 surgeon thinks "I need a plate", not "I need item 7".

     PROPERTIES — size, material and transform for the selected
                 implant. Every control here is generated from the
                 catalogue's `params` spec, so the panel never needs
                 editing when a device is added to the catalogue.

   The panel switches to PROPERTIES automatically on selection, because
   the thing you almost always want immediately after placing a screw
   is to size and seat it.
   =================================================================== */

const KIND_ICON = {
  screw: Bone, plate: Layers2, nail: Bone, wire: Bone,
  cage: PackagePlus, graft: Bone, stem: Bone, mesh: Layers2,
};

export default function ImplantPanel({ onOpenHandout }) {
  const [tab, setTab] = useState('catalog');

  const implants = useSceneStore((s) => s.implants);
  const selected = useSceneStore(selectedImplant);
  const addImplant = useSceneStore((s) => s.addImplant);

  const handleAdd = (id) => {
    addImplant(id, [0, 0, 0]);
    setTab('props');
  };

  // 'props' is only meaningful with something selected; fall back rather
  // than render an empty panel after the selected implant is deleted.
  const activeTab = tab === 'props' && !selected ? 'catalog' : tab;

  return (
    <aside className="o3d-panel">
      <div className="o3d-seg" style={{ margin: 'var(--hms-space-sm)' }}>
        <button aria-pressed={activeTab === 'catalog'} onClick={() => setTab('catalog')}>
          <Plus size={12} /> Add
        </button>
        <button
          aria-pressed={activeTab === 'props'}
          onClick={() => setTab('props')}
          disabled={!selected}
          style={!selected ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}
        >
          <Move3d size={12} /> Size
        </button>
        <button aria-pressed={activeTab === 'consult'} onClick={() => setTab('consult')}>
          <MessageSquareHeart size={12} /> Explain
        </button>
      </div>

      {activeTab === 'catalog' && <Catalog onAdd={handleAdd} />}
      {activeTab === 'props' && <Properties implant={selected} />}
      {activeTab === 'consult' && <ConsultPanel onOpenHandout={onOpenHandout} />}

      {activeTab !== 'consult' && (
        <PlanList implants={implants} onSelect={() => setTab('props')} />
      )}
    </aside>
  );
}

/* -------------------------------------------------------------------
   Catalogue
   ------------------------------------------------------------------- */

function Catalog({ onAdd }) {
  return (
    <div className="o3d-section o3d-section--grow">
      <div className="o3d-section__head"><span>Implant catalogue</span></div>
      <div className="o3d-section__body" style={{ padding: 0 }}>
        {IMPLANT_CATEGORIES.map((cat) => (
          <div className="o3d-cat" key={cat}>
            <div className="o3d-cat__head">{cat}</div>
            {IMPLANT_CATALOG.filter((c) => c.category === cat).map((def) => {
              const Icon = KIND_ICON[def.kind] ?? Bone;
              return (
                <button key={def.id} className="o3d-card" onClick={() => onAdd(def.id)}>
                  <span className="o3d-card__icon"><Icon size={15} /></span>
                  <span style={{ minWidth: 0 }}>
                    <span className="o3d-card__title">{def.label}</span>
                    <span className="o3d-card__blurb">{def.blurb}</span>
                  </span>
                </button>
              );
            })}
          </div>
        ))}
        <p className="o3d-note">
          Hardware is generated from its parameters, so every size in the clinical
          range is available — nothing is a scaled copy of a fixed mesh.
        </p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------
   Properties
   ------------------------------------------------------------------- */

function Properties({ implant }) {
  const updateImplantParams = useSceneStore((s) => s.updateImplantParams);
  const updateImplant = useSceneStore((s) => s.updateImplant);
  const transformMode = useSceneStore((s) => s.transformMode);
  const setTransformMode = useSceneStore((s) => s.setTransformMode);
  const transformSpace = useSceneStore((s) => s.transformSpace);
  const setTransformSpace = useSceneStore((s) => s.setTransformSpace);
  const snapEnabled = useSceneStore((s) => s.snapEnabled);
  const setSnap = useSceneStore((s) => s.setSnap);

  if (!implant) {
    return (
      <div className="o3d-section o3d-section--grow">
        <div className="o3d-empty">
          Select an implant to size and position it.
        </div>
      </div>
    );
  }

  const def = catalogEntry(implant.catalogId);

  return (
    <div className="o3d-section o3d-section--grow">
      <div className="o3d-section__head">
        <span>{def?.label ?? implant.label}</span>
        <span className="o3d-section__count">{describeImplant(implant)}</span>
      </div>

      <div className="o3d-section__body" style={{ padding: 0 }}>
        {/* ---- Transform mode ---- */}
        <div className="o3d-cat__head" style={{ padding: '10px 12px 5px' }}>Manipulate</div>
        <div className="o3d-seg">
          <button aria-pressed={transformMode === 'translate'} onClick={() => setTransformMode('translate')} title="Move (W)">
            <Move3d size={12} /> Move
          </button>
          <button aria-pressed={transformMode === 'rotate'} onClick={() => setTransformMode('rotate')} title="Rotate (E)">
            <Rotate3d size={12} /> Rotate
          </button>
          <button aria-pressed={transformMode === 'scale'} onClick={() => setTransformMode('scale')} title="Scale (R)">
            <Scale3d size={12} /> Scale
          </button>
        </div>

        <div className="o3d-seg" style={{ marginTop: 5 }}>
          <button aria-pressed={transformSpace === 'world'} onClick={() => setTransformSpace('world')}>
            World axes
          </button>
          <button aria-pressed={transformSpace === 'local'} onClick={() => setTransformSpace('local')}>
            Along implant
          </button>
        </div>

        <button className="o3d-toggle" onClick={() => setSnap(!snapEnabled)}>
          <span><Magnet size={12} style={{ verticalAlign: '-2px', marginRight: 6 }} />Snap to 1 mm / 5°</span>
          <span className={`o3d-switch ${snapEnabled ? 'o3d-switch--on' : ''}`} />
        </button>

        {/* ---- Size ---- */}
        <div className="o3d-cat__head" style={{ padding: '10px 12px 2px' }}>Size</div>
        {def?.params.map((spec) => (
          <ParamSlider
            key={spec.key}
            spec={spec}
            value={implant.params[spec.key]}
            onChange={(v) => updateImplantParams(implant.id, { [spec.key]: v })}
          />
        ))}

        {/* ---- Material ---- */}
        <div className="o3d-cat__head" style={{ padding: '10px 12px 2px' }}>Material</div>
        <div className="o3d-mats">
          {Object.entries(HARDWARE_PRESETS).map(([key, p]) => (
            <button
              key={key}
              className={`o3d-mat ${implant.material === key ? 'o3d-mat--on' : ''}`}
              onClick={() => updateImplant(implant.id, { material: key })}
              title={p.label}
            >
              <span
                className="o3d-mat__chip"
                style={{
                  background: p.metalness
                    ? `linear-gradient(135deg, #fff 0%, ${p.swatch} 40%, #6b7280 100%)`
                    : p.swatch,
                }}
              />
              {p.label.split(' ')[0]}
            </button>
          ))}
        </div>

        {/* ---- Position readout ---- */}
        <div className="o3d-cat__head" style={{ padding: '10px 12px 2px' }}>Position (mm from origin)</div>
        <div className="o3d-field">
          <div className="o3d-field__row">
            <span className="o3d-field__label">X · Y · Z</span>
            <span className="o3d-field__value">
              {implant.position.map((v) => (v * 10).toFixed(1)).join(' · ')}
            </span>
          </div>
          <div className="o3d-field__row">
            <span className="o3d-field__label">Rotation</span>
            <span className="o3d-field__value">
              {implant.rotation.map((v) => `${((v * 180) / Math.PI).toFixed(0)}°`).join(' · ')}
            </span>
          </div>
        </div>

        <div className="o3d-field">
          <div className="o3d-field__row">
            <span className="o3d-field__label">Reset transform</span>
          </div>
          <button
            className="hms-btn-secondary"
            style={{ width: '100%' }}
            onClick={() =>
              updateImplant(implant.id, { position: [0, 0, 0], rotation: [0, 0, 0], scale: 1 })
            }
          >
            Return to origin
          </button>
        </div>
      </div>
    </div>
  );
}

function ParamSlider({ spec, value, onChange }) {
  const decimals = spec.step < 1 ? (spec.step < 0.05 ? 3 : 2) : 0;
  return (
    <div className="o3d-field">
      <div className="o3d-field__row">
        <label className="o3d-field__label" htmlFor={`p-${spec.key}`}>{spec.label}</label>
        <span className="o3d-field__value">
          {Number(value).toFixed(decimals)}{spec.unit && ` ${spec.unit}`}
        </span>
      </div>
      <input
        id={`p-${spec.key}`}
        className="o3d-range"
        type="range"
        min={spec.min}
        max={spec.max}
        step={spec.step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

/* -------------------------------------------------------------------
   Plan list
   ------------------------------------------------------------------- */

function PlanList({ implants, onSelect }) {
  const selectedImplantId = useSceneStore((s) => s.selectedImplantId);
  const selectImplant = useSceneStore((s) => s.selectImplant);
  const removeImplant = useSceneStore((s) => s.removeImplant);
  const duplicateImplant = useSceneStore((s) => s.duplicateImplant);
  const updateImplant = useSceneStore((s) => s.updateImplant);

  return (
    <div className="o3d-section" style={{ flex: 'none', maxHeight: '34%', display: 'flex' }}>
      <div className="o3d-section__head">
        <span>Plan</span>
        <span className="o3d-section__count">{implants.length} item{implants.length === 1 ? '' : 's'}</span>
      </div>
      <div className="o3d-section__body" style={{ paddingTop: 4 }}>
        {implants.length === 0 ? (
          <div className="o3d-empty">No hardware placed yet.</div>
        ) : (
          <div className="o3d-list">
            {implants.map((im) => (
              <div
                key={im.id}
                className={`o3d-plan-row ${im.id === selectedImplantId ? 'o3d-plan-row--on' : ''}`}
                onClick={() => { selectImplant(im.id); onSelect?.(); }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && selectImplant(im.id)}
              >
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="o3d-plan-row__name">{im.label}</span>
                  <span className="o3d-plan-row__size" style={{ display: 'block' }}>
                    {describeImplant(im)}
                  </span>
                </span>
                <span className="o3d-row-actions">
                  <button
                    className="o3d-icon-btn"
                    title={im.locked ? 'Unlock' : 'Lock in place'}
                    onClick={(e) => { e.stopPropagation(); updateImplant(im.id, { locked: !im.locked }); }}
                  >
                    {im.locked ? <Lock size={12} /> : <Unlock size={12} />}
                  </button>
                  <button
                    className="o3d-icon-btn"
                    title={im.visible ? 'Hide' : 'Show'}
                    onClick={(e) => { e.stopPropagation(); updateImplant(im.id, { visible: !im.visible }); }}
                  >
                    {im.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                  </button>
                  <button
                    className="o3d-icon-btn"
                    title="Duplicate"
                    onClick={(e) => { e.stopPropagation(); duplicateImplant(im.id); }}
                  >
                    <Copy size={12} />
                  </button>
                  <button
                    className="o3d-icon-btn o3d-icon-btn--danger"
                    title="Remove"
                    onClick={(e) => { e.stopPropagation(); removeImplant(im.id); }}
                  >
                    <Trash2 size={12} />
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
