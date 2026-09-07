import { X } from 'lucide-react';

/* Help + provenance. The licensing section is not optional garnish:
   BodyParts3D is CC BY / CC BY-SA, and attribution is a condition of
   the licence, so the credit has to be reachable from the running
   application rather than buried in a repo file. */

export default function HelpModal({ onClose }) {
  return (
    <div className="o3d-modal-overlay" onClick={onClose} role="presentation">
      <div
        className="o3d-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Help and data sources"
      >
        <div className="o3d-modal__head">
          <span>Controls &amp; data sources</span>
          <button className="o3d-icon-btn" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>

        <div className="o3d-modal__body">
          <h4>Navigation</h4>
          <table className="o3d-kbd-table">
            <tbody>
              <tr><td>Rotate around the model</td><td><kbd>Left drag</kbd></td></tr>
              <tr><td>Pan / move</td><td><kbd>Right drag</kbd> or <kbd>Two fingers</kbd></td></tr>
              <tr><td>Zoom in / out</td><td><kbd>Wheel</kbd>, <kbd>Pinch</kbd> or <kbd>+</kbd> / <kbd>−</kbd></td></tr>
              <tr><td>Fit everything in view</td><td><kbd>F</kbd></td></tr>
              <tr><td>Focus the selected structure</td><td><kbd>Double-click</kbd></td></tr>
            </tbody>
          </table>
          <p style={{ marginTop: 8 }}>
            Zoom follows the pointer, so putting the cursor over a vertebra and
            scrolling dives toward that vertebra rather than the screen centre.
          </p>

          <h4>Implants</h4>
          <table className="o3d-kbd-table">
            <tbody>
              <tr><td>Move / Rotate / Scale gizmo</td><td><kbd>W</kbd> <kbd>E</kbd> <kbd>R</kbd></td></tr>
              <tr><td>Undo / Redo</td><td><kbd>Ctrl</kbd>+<kbd>Z</kbd> / <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd></td></tr>
              <tr><td>Duplicate selected</td><td><kbd>Ctrl</kbd>+<kbd>D</kbd></td></tr>
              <tr><td>Delete selected</td><td><kbd>Delete</kbd></td></tr>
              <tr><td>Clear selection</td><td><kbd>Esc</kbd> or click empty space</td></tr>
            </tbody>
          </table>
          <p style={{ marginTop: 8 }}>
            One scene unit is one centimetre. Implant sizes are entered in
            millimetres and constrained to real clinical ranges. Turn on
            <strong> X-ray</strong> to keep hardware visible once it is seated
            inside bone, and <strong>Section</strong> to cut through the anatomy
            with a movable plane.
          </p>

          <h4>Anatomical data — BodyParts3D</h4>
          <p>
            The 2,234 anatomical structures come from <strong>BodyParts3D</strong>,
            produced by the <strong>Database Center for Life Science (DBCLS)</strong>,
            University of Tokyo — 3D structure data for an adult human male, with
            structures identified by <code>FMA</code> concept ids.
          </p>
          <p>
            Licensed <strong>Creative Commons Attribution</strong> (CC BY 4.0 as
            redistributed; original database CC BY-SA 2.1 Japan). The binary
            repacking comes from the MIT-licensed{' '}
            <code>human-atlas</code> project.
          </p>

          <h4>Textured organ meshes</h4>
          <p>
            <span className="o3d-badge o3d-badge--warn">Provenance unverified</span>
          </p>
          <p>
            The heart, lung, liver and kidney models are photogrammetry-style
            assets from the <code>Human-Organ3D</code> repository. That repository
            claims MIT in its README but ships no licence file, and the meshes are
            third-party art the owner is unlikely to hold rights to relicense.
          </p>
          <p>
            Establish the upstream licence or replace these four files before any
            clinical, commercial or public deployment. Removing{' '}
            <code>public/models/organs/</code> disables this feature and affects
            nothing else — the atlas is the primary data path.
          </p>

          <h4>Intended use</h4>
          <p>
            This is a visualisation and communication tool built on a generic
            adult male reference anatomy. It is <strong>not patient-specific</strong>,
            it is not derived from this patient's imaging, and it is not a
            diagnostic or surgical-navigation device. Plans exported here are
            illustrative.
          </p>
        </div>
      </div>
    </div>
  );
}
