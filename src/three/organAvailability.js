import { ORGAN_MODELS } from './OrganModel';

/* ===================================================================
   ORGAN AVAILABILITY
   -------------------------------------------------------------------
   The textured organ meshes are optional and are NOT committed to the
   repository — their upstream licence could not be verified, so
   `public/models/organs/` is gitignored (see THIRD-PARTY-NOTICES.md).

   That means the four files are present on a developer machine that has
   run `scripts/fetch-models.sh --all`, and absent on a clean deployment.
   The picker cannot be a static list: offering a file that 404s is how
   this crashed the whole canvas once already — useGLTF throws, nothing
   catches it, React unmounts the tree and the WebGL context is lost.

   So availability is PROBED once at startup with a cheap HEAD request
   per file, and the UI is driven by the result. Anything missing is
   shown disabled with an explanation rather than silently omitted —
   a doctor who used the liver view yesterday on a machine that had it
   deserves to know why it is gone, not to find the row vanished.
   =================================================================== */

let probe = null;

/** @returns {Promise<Set<string>>} filenames that actually exist */
export function probeOrgans() {
  if (probe) return probe;

  probe = Promise.all(
    ORGAN_MODELS.map(async (m) => {
      const url = `${import.meta.env.BASE_URL}models/organs/${m.file}`;
      try {
        const r = await fetch(url, { method: 'HEAD' });
        if (!r.ok) return null;
        // A 200 is not proof the file exists. Any host with SPA fallback
        // — `vite preview` included — answers a missing path with
        // index.html and a 200, and useGLTF would then try to parse HTML
        // as binary glTF and throw, which is the exact crash this probe
        // exists to prevent. A real .glb is never text/html.
        const type = r.headers.get('content-type') ?? '';
        if (type.includes('text/html')) return null;
        return m.file;
      } catch {
        // Network error, offline, blocked — treat as unavailable rather
        // than letting it surface as a crash later.
        return null;
      }
    })
  ).then((files) => new Set(files.filter(Boolean)));

  return probe;
}
