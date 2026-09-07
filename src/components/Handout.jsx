import { useEffect, useRef, useState } from 'react';
import { X, Printer, Loader2 } from 'lucide-react';
import { useSceneStore } from '../store/useSceneStore';
import { catalogEntry, describeImplant } from '../data/implants';
import { IMPLANT_LAY, MATERIAL_LAY, patientLabel, REGION_LAY } from '../data/layTerms';
import { FRACTURE_PATTERNS } from '../three/fracture';

/* ===================================================================
   PATIENT HANDOUT
   -------------------------------------------------------------------
   What the patient takes home.

   People retain very little of what they are told in a consultation —
   the number usually quoted is that most of it is gone within the hour,
   and what survives is often the part they misheard. A picture of their
   own explanation, with the words that were used, is the cheapest
   available fix, and it is the reason this feature exists at all.

   Two captures are taken from the live canvas — the injury and the
   repair — by flipping `phase` and waiting for the reduction animation
   to settle between shots. That is why this is a modal with a loading
   state rather than an instant print: it is genuinely rendering two
   different scenes.

   Printing goes through a detached iframe rather than window.open, so
   it survives popup blockers and cannot be orphaned if the user
   navigates away mid-print.
   =================================================================== */

const SETTLE_MS = 700; // must exceed the reduction spring in FractureLayer

export default function Handout({ patient, onClose }) {
  const [shots, setShots] = useState(null);
  const [error, setError] = useState(null);
  const frameRef = useRef(null);

  const fracture = useSceneStore((s) => s.fracture);
  const implants = useSceneStore((s) => s.implants);
  const regionId = useSceneStore((s) => s.regionId);

  /* Capture both phases, then restore whatever the doctor was looking
     at. Restoring matters: taking a handout should not silently leave
     the screen on a different view mid-consultation. */
  useEffect(() => {
    let cancelled = false;
    const store = useSceneStore.getState();
    const originalPhase = store.phase;

    const canvas = () => document.querySelector('.o3d-canvas canvas');
    const grab = () => {
      const c = canvas();
      if (!c) throw new Error('The 3D view is not available to capture.');
      return c.toDataURL('image/png');
    };
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));

    (async () => {
      try {
        let injury = null;
        if (fracture) {
          store.setPhase('injury');
          await wait(SETTLE_MS);
          if (cancelled) return;
          injury = grab();
        }
        store.setPhase('repair');
        await wait(SETTLE_MS);
        if (cancelled) return;
        const repair = grab();

        store.setPhase(originalPhase);
        if (!cancelled) setShots({ injury, repair });
      } catch (e) {
        store.setPhase(originalPhase);
        if (!cancelled) setError(e.message);
      }
    })();

    return () => {
      cancelled = true;
      useSceneStore.getState().setPhase(originalPhase);
    };
  }, [fracture]);

  const html = shots ? buildHandoutHtml({ patient, shots, fracture, implants, regionId }) : null;

  const print = () => {
    const frame = frameRef.current;
    if (!frame) return;
    frame.contentWindow.focus();
    frame.contentWindow.print();
  };

  return (
    <div className="o3d-modal-overlay" onClick={onClose} role="presentation">
      <div
        className="o3d-modal o3d-modal--wide"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Patient handout"
      >
        <div className="o3d-modal__head">
          <span>Patient handout</span>
          <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button className="hms-btn-primary" onClick={print} disabled={!shots}>
              <Printer size={13} /> Print / Save PDF
            </button>
            <button className="o3d-icon-btn" onClick={onClose} aria-label="Close"><X size={16} /></button>
          </span>
        </div>

        <div className="o3d-modal__body" style={{ padding: 0, background: 'var(--hms-gray-100)' }}>
          {error ? (
            <div className="o3d-empty" style={{ padding: 40 }}>{error}</div>
          ) : !html ? (
            <div className="o3d-empty" style={{ padding: 60, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <Loader2 size={22} className="o3d-spin" />
              Capturing the views…
            </div>
          ) : (
            <>
              <p className="o3d-note" style={{ padding: '10px 16px 0', margin: 0 }}>
                The two pictures are captured from the view you had on screen. Close
                this, frame the model how you want it explained, then reopen.
              </p>
              <iframe
                ref={frameRef}
                title="Patient handout preview"
                srcDoc={html}
                className="o3d-handout-frame"
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------
   The document itself — a self-contained HTML page.
   ------------------------------------------------------------------- */

function esc(s) {
  return String(s ?? '').replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])
  );
}

function buildHandoutHtml({ patient, shots, fracture, implants, regionId }) {
  const date = new Date().toLocaleDateString(undefined, {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  const patientLine = [
    patient?.name && `<strong>${esc(patient.name)}</strong>`,
    patient?.id && `ID ${esc(patient.id)}`,
    patient?.age && `${esc(patient.age)}`,
  ].filter(Boolean).join(' &nbsp;·&nbsp; ');

  const spec = fracture ? FRACTURE_PATTERNS[fracture.pattern] : null;

  const injurySection = fracture
    ? `
    <section class="block">
      <h2>What has happened</h2>
      <p>You have a broken bone — a fracture — in your
         <strong>${esc(patientLabel(fracture.partName).toLowerCase())}</strong>.</p>
      <p>${esc(spec?.lay ?? '')}. The pieces have moved out of line, which is why
         it needs to be put back into position and held there.</p>
      ${shots.injury ? `<figure><img src="${shots.injury}" alt="The injury"><figcaption>How the bone looks now</figcaption></figure>` : ''}
    </section>`
    : '';

  const hardwareRows = implants.map((im) => {
    const def = catalogEntry(im.catalogId);
    return `
      <li>
        <div class="hw-name">${esc(def?.label ?? im.label)} <span class="hw-size">${esc(describeImplant(im))}</span></div>
        <div class="hw-lay">${esc(IMPLANT_LAY[im.catalogId] ?? '')}</div>
        <div class="hw-mat">${esc(MATERIAL_LAY[im.material] ?? '')}</div>
      </li>`;
  }).join('');

  const repairSection = `
    <section class="block">
      <h2>What we plan to do</h2>
      ${implants.length
        ? `<p>We plan to put the bone back into position and hold it there using
             the following:</p>
           <ul class="hw">${hardwareRows}</ul>`
        : `<p>This view shows ${esc(REGION_LAY[regionId] ?? 'the area')} we discussed.</p>`}
      <figure><img src="${shots.repair}" alt="The plan"><figcaption>How it will look afterwards</figcaption></figure>
    </section>`;

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>Your treatment — explained</title>
<style>
  @page { size: A4; margin: 16mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: "Lexend", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
    color: #111827; font-size: 12pt; line-height: 1.6;
    background: #fff; padding: 22px 26px;
  }
  header { border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 18px; }
  .title { font-size: 19pt; font-weight: 700; letter-spacing: -0.01em; }
  .sub { color: #4b5563; font-size: 10.5pt; margin-top: 3px; }
  .meta { margin-top: 9px; font-size: 10.5pt; color: #374151; }
  h2 { font-size: 13pt; margin: 0 0 7px; color: #0f172a; }
  .block { margin-bottom: 22px; page-break-inside: avoid; }
  p { margin: 0 0 9px; }
  figure { margin: 12px 0 0; page-break-inside: avoid; }
  img { width: 100%; border-radius: 7px; border: 1px solid #e5e7eb; background: #12161c; }
  figcaption { font-size: 9.5pt; color: #6b7280; margin-top: 5px; text-align: center; }
  ul.hw { list-style: none; padding: 0; margin: 10px 0 0; }
  ul.hw li { border-left: 3px solid #0f172a; padding: 7px 0 7px 11px; margin-bottom: 11px; page-break-inside: avoid; }
  .hw-name { font-weight: 600; font-size: 11.5pt; }
  .hw-size { font-weight: 400; color: #6b7280; font-size: 10pt; }
  .hw-lay { margin-top: 2px; }
  .hw-mat { color: #4b5563; font-size: 10.5pt; margin-top: 2px; }
  .questions { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 13px 16px; }
  .questions li { margin-bottom: 5px; }
  footer { margin-top: 22px; padding-top: 11px; border-top: 1px solid #e5e7eb;
           font-size: 9pt; color: #6b7280; line-height: 1.55; }
</style></head>
<body>
  <header>
    <div class="title">Your treatment — explained</div>
    <div class="sub">Prepared during your consultation at ZenoHosp</div>
    ${patientLine ? `<div class="meta">${patientLine}</div>` : ''}
    <div class="meta">${esc(date)}${patient?.doctor ? ` &nbsp;·&nbsp; ${esc(patient.doctor)}` : ''}</div>
  </header>

  ${injurySection}
  ${repairSection}

  <section class="block questions">
    <h2>Questions you may want to ask</h2>
    <ul>
      <li>How long will I be in hospital?</li>
      <li>How long before I can put weight on it / use it normally?</li>
      <li>Will the metal need to be removed later?</li>
      <li>What are the risks, and what happens if I do nothing?</li>
      <li>What should I watch out for once I am home?</li>
    </ul>
  </section>

  <footer>
    These pictures are a general illustration created to explain your treatment.
    They are drawn from a standard anatomical model — they are <strong>not</strong>
    images of your own body and not a scan or an X-ray. Your surgeon will confirm
    the final plan, which can change based on what is found during the operation.
    Anatomical model: BodyParts3D, Database Center for Life Science (CC BY).
  </footer>
</body></html>`;
}
