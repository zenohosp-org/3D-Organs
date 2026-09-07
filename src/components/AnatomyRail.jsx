import { useMemo, useState } from 'react';
import { Search, Eye, EyeOff, Crosshair, Layers, Box } from 'lucide-react';
import { useSceneStore } from '../store/useSceneStore';
import { REGIONS, classifyTissue } from '../data/anatomy';
import { TISSUE_PRESETS } from '../three/materials';
import { patientLabel } from '../data/layTerms';
import { ORGAN_MODELS } from '../three/OrganModel';

/* ===================================================================
   LEFT RAIL — what is on screen
   -------------------------------------------------------------------
   Region picker, textured-organ picker, and the structure list.

   The structure list is the reason this rail exists: a region can hold
   639 arteries, and a clinician looking for one of them will not scroll
   for it. Search filters by name; the list is capped at a few hundred
   rendered rows because a 2,234-row DOM list janks the whole app, and
   the count line says plainly how many matched beyond the cap rather
   than silently truncating.
   =================================================================== */

const RENDER_CAP = 300;

export default function AnatomyRail({ onFocusPart }) {
  const [query, setQuery] = useState('');

  const regionId = useSceneStore((s) => s.regionId);
  const setRegion = useSceneStore((s) => s.setRegion);
  const parts = useSceneStore((s) => s.parts);
  const hiddenParts = useSceneStore((s) => s.hiddenParts);
  const selectedPart = useSceneStore((s) => s.selectedPart);
  const selectPart = useSceneStore((s) => s.selectPart);
  const togglePart = useSceneStore((s) => s.togglePart);
  const isolatePart = useSceneStore((s) => s.isolatePart);
  const showAllParts = useSceneStore((s) => s.showAllParts);
  const organFile = useSceneStore((s) => s.organFile);
  const setDisplay = useSceneStore((s) => s.setDisplay);
  const layLanguage = useSceneStore((s) => s.layLanguage);
  const organsAvailable = useSceneStore((s) => s.organsAvailable);
  const fracturedPart = useSceneStore((s) => s.fracture?.partIndex ?? -1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = parts.map((p, i) => ({ part: p, index: i }));
    if (!q) return rows;
    return rows.filter((r) => r.part.name.toLowerCase().includes(q));
  }, [parts, query]);

  const shown = filtered.slice(0, RENDER_CAP);

  return (
    <aside className="o3d-rail">
      {/* ---- Region ---- */}
      <div className="o3d-section">
        <div className="o3d-section__head">
          <span><Layers size={11} style={{ verticalAlign: '-1px', marginRight: 5 }} />Region</span>
        </div>
        <div className="o3d-section__body" style={{ maxHeight: 210 }}>
          <div className="o3d-list">
            {REGIONS.map((r) => (
              <button
                key={r.id}
                className={`o3d-item ${regionId === r.id ? 'o3d-item--on' : ''}`}
                onClick={() => setRegion(r.id)}
                title={r.hint}
              >
                <span className="o3d-item__main">
                  <span className="o3d-item__label">{r.label}</span>
                  <span className="o3d-item__hint">{r.hint}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ---- Textured organs ---- */}
      <div className="o3d-section">
        <div className="o3d-section__head">
          <span><Box size={11} style={{ verticalAlign: '-1px', marginRight: 5 }} />Textured organ</span>
        </div>
        <div className="o3d-section__body">
          <div className="o3d-list">
            <button
              className={`o3d-item ${!organFile ? 'o3d-item--on' : ''}`}
              onClick={() => setDisplay({ organFile: null })}
            >
              <span className="o3d-item__main">
                <span className="o3d-item__label">None</span>
                <span className="o3d-item__hint">Atlas geometry only</span>
              </span>
            </button>
            {ORGAN_MODELS.map((m) => {
              // While probing (null) keep rows enabled rather than
              // flashing everything disabled for a few hundred ms.
              const missing = organsAvailable ? !organsAvailable.has(m.file) : false;
              return (
                <button
                  key={m.id}
                  className={`o3d-item ${organFile === m.file ? 'o3d-item--on' : ''} ${missing ? 'o3d-item--muted' : ''}`}
                  onClick={() => !missing && setDisplay({ organFile: organFile === m.file ? null : m.file })}
                  disabled={missing}
                  title={missing ? 'Not installed on this deployment — run scripts/fetch-models.sh --all' : m.hint}
                >
                  <span className="o3d-item__main">
                    <span className="o3d-item__label">{m.label}</span>
                    <span className="o3d-item__hint">
                      {missing ? 'Not installed' : m.hint}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          {organsAvailable && organsAvailable.size === 0 && (
            <p className="o3d-note" style={{ paddingTop: 8 }}>
              Textured organs are not bundled with this deployment — their
              upstream licence is unverified. The atlas anatomy is unaffected.
            </p>
          )}
        </div>
      </div>

      {/* ---- Structures ---- */}
      <div className="o3d-section o3d-section--grow">
        <div className="o3d-section__head">
          <span>Structures</span>
          <span className="o3d-section__count">
            {filtered.length}
            {filtered.length > RENDER_CAP ? ` (showing ${RENDER_CAP})` : ''}
          </span>
        </div>

        <div className="o3d-search">
          <Search size={13} />
          <input
            type="search"
            placeholder="Search 2,234 structures…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search anatomical structures"
          />
        </div>

        {hiddenParts.size > 0 && (
          <div style={{ padding: '0 8px 8px' }}>
            <button className="hms-btn-secondary" style={{ width: '100%' }} onClick={showAllParts}>
              <Eye size={12} /> Show all ({hiddenParts.size} hidden)
            </button>
          </div>
        )}

        <div className="o3d-section__body" style={{ paddingTop: 0 }}>
          {shown.length === 0 ? (
            <div className="o3d-empty">
              {parts.length === 0 ? 'Loading region…' : 'No structure matches that name.'}
            </div>
          ) : (
            <div className="o3d-list">
              {shown.map(({ part, index }) => {
                const tissue = classifyTissue(part);
                const hidden = hiddenParts.has(index);
                return (
                  <div
                    key={`${part.id}-${index}`}
                    className={`o3d-item ${selectedPart === index ? 'o3d-item--on' : ''} ${hidden ? 'o3d-item--muted' : ''}`}
                    onClick={() => selectPart(index)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && selectPart(index)}
                  >
                    <span
                      className="o3d-swatch"
                      style={{ background: TISSUE_PRESETS[tissue]?.color ?? '#888' }}
                      title={TISSUE_PRESETS[tissue]?.label}
                    />
                    <span className="o3d-item__main">
                      <span className="o3d-item__label">
                        {layLanguage ? patientLabel(part.name) : part.name}
                      </span>
                      <span className="o3d-item__hint">
                        {index === fracturedPart ? 'Fractured' : layLanguage ? part.name : part.conceptId}
                      </span>
                    </span>
                    <button
                      className="o3d-item__eye"
                      title="Isolate this structure"
                      onClick={(e) => { e.stopPropagation(); isolatePart(index); onFocusPart?.(index); }}
                    >
                      <Crosshair size={12} />
                    </button>
                    <button
                      className="o3d-item__eye"
                      title={hidden ? 'Show' : 'Hide'}
                      onClick={(e) => { e.stopPropagation(); togglePart(index); }}
                    >
                      {hidden ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
