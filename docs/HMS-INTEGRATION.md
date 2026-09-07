# Embedding in the HMS consultation page

The viewer is written to mount either standalone or as a panel inside
`ConsultationViewPage.jsx`. It needs no router, no context and no provider —
all of its state lives in its own zustand store.

## 1. Add the tab

`ConsultationViewPage.jsx` already has a `TabBar` with Consultation /
Prescription / Lab Tests. Add a fourth:

```jsx
// in TabBar
<TabButton
  active={tab === "anatomy"}
  onClick={() => setTab("anatomy")}
  icon={<Bone className="w-4 h-4" />}
  label="3D Explain"
/>
```

```jsx
// in the tab body, alongside {tab === "rx" && <RxTab … />}
{tab === "anatomy" && (
  <Organ3D
    embedded
    patient={{
      name: appointment?.patient_name,
      id: fmtId(appointment?.patient_id),
      age: appointment?.patient_age,
      doctor: user?.name,
    }}
    plan={draft.anatomyPlan}
    onPlanChange={(plan) => draft.setField("anatomyPlan", plan)}
  />
)}
```

`patient` only feeds the handout header. Everything else works without it.

## 2. Sizing

`embedded` switches the root from `100dvh` to `height: 100%`, so it fills
`.hms-cv-tab-body` (which is already `flex: 1`). It sets a `min-height: 520px`
floor — below that the two side panels stop being usable.

**Consult mode escapes the tab.** When the doctor turns the screen to the
patient, the root goes `position: fixed; inset: 0` at `--hms-z-modal`, covering
the HMS chrome. `Esc` or the Exit button returns it to the tab.

## 3. Persisting the plan with the consultation

The plan (fracture + implants) is a plain JSON object — `exportPlan()` /
`importPlan()` on the store. Persist it the same way the rest of the
consultation is persisted, through `useConsultationDraft`:

```jsx
import { useSceneStore } from "@/…/store/useSceneStore";

// save
const plan = useSceneStore.getState().exportPlan();

// restore, once, when the appointment loads
useEffect(() => {
  if (draft.anatomyPlan) useSceneStore.getState().importPlan(draft.anatomyPlan);
}, [appointment?.id]);
```

⚠️ **The store is a module singleton.** It does not reset between patients on
its own, and `ConsultationViewPage` keeps the component mounted while
Next/Previous walks the queue. Clear it when the appointment changes or the
previous patient's hardware will still be on screen for the next one:

```jsx
useEffect(() => {
  const s = useSceneStore.getState();
  s.clearPlan();
  s.clearFracture();
  s.setConsultMode(false);
  if (draft.anatomyPlan) s.importPlan(draft.anatomyPlan);
}, [appointment?.id]);
```

This is the single most important line in this document. Nothing else leaks
between patients, but this would.

## 4. Assets

`public/models/` is ~101 MB. It is served as static files from the app root,
so in HMS either:

- copy `public/models/` into the HMS `public/` directory, or
- host it on a CDN/bucket and set `BASE_URL` accordingly — the loader builds
  every path from `import.meta.env.BASE_URL`, so this is a one-line change and
  no code edit.

The second option is strongly preferred: the model data is immutable, cacheable
forever, and has no business in the application bundle or the git history.

## 5. Dependencies HMS does not already have

`three`, `@react-three/fiber`, `@react-three/drei`, `zustand`. React 18,
`lucide-react` and Vite are already in HMS at compatible versions.

## 6. Styling

`src/styles/base.css` re-declares the `--hms-*` tokens so the viewer works
standalone. **When embedding, drop that import** — HMS already defines them,
and a second declaration would shadow any future token change. Keep
`viewer.css`, which only defines `--o3d-*` and `.o3d-*`.
