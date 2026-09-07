# Organ 3D — User Guide

Step-by-step operating instructions. Written for the person driving the screen.

---

## 0. Starting it

```bash
cd "/Users/karthikeyan-zc034/3D Organs"
npm install          # first time only
npm run dev          # http://localhost:5180   — development
```

For the production build:

```bash
npm run build        # -> dist/
npm run preview      # http://127.0.0.1:4173
```

**First load takes a few seconds.** The app fetches the anatomy manifest
(1.3 MB) and then only the geometry chunks the chosen region needs (~4 MB each).
A progress bar sits top-left while this happens. Nothing is downloaded twice —
switching back to a region you have already opened is instant.

---

## 1. The screen

```
┌──────────────────────────────────────────────────────────────────────┐
│ TOP BAR   undo/redo · views · display · consult · file               │
├───────────────┬──────────────────────────────────┬───────────────────┤
│ LEFT RAIL     │                                  │ RIGHT PANEL       │
│               │                                  │                   │
│ Region        │           THE MODEL              │  Add | Size |     │
│ Textured organ│                                  │       Explain     │
│ Structures    │   ┌ hovered structure (top-L)    │                   │
│  (searchable) │   ┌ display controls (top-R)     │  …tab contents…   │
│               │   └ zoom + hints (bottom-L)      │                   │
│               │   └ injury/repair (bottom-C)     │  Plan (bottom)    │
└───────────────┴──────────────────────────────────┴───────────────────┘
```

| Area | What it is for |
| --- | --- |
| **Left rail** | *What am I looking at* — region, optional textured organ, structure list |
| **Canvas** | The model. Click anything to select it. |
| **Right panel** | *What am I doing* — add hardware, size it, or explain it |
| **Top bar** | Whole-scene actions only |

---

## 2. Moving around

| Action | How |
| --- | --- |
| **Rotate** | Left-click drag / one-finger drag |
| **Move (pan)** | **Right-click drag**, middle-drag, or two-finger drag |
| **Zoom** | Mouse wheel, pinch, `+` / `−`, or the buttons bottom-left |
| **Fit everything** | `F`, or the ⤢ button |
| **Standard views** | `A P L R S I` buttons in the top bar |

`A` anterior (front) · `P` posterior (back) · `L` left · `R` right ·
`S` superior (above) · `I` inferior (below)

> **Zoom follows your cursor.** Point at the structure you want and scroll — you
> dive toward *that*, not the middle of the screen. This is the fastest way to
> get from a whole skeleton to one vertebra.

The coloured axis cube bottom-right always shows which way is up.

---

## 3. Choosing what to show

### 3.1 Pick a region — left rail, top

14 regions. Start here; it decides what loads.

| Region | Contains |
| --- | --- |
| Skeleton | All bones, discs, costal cartilage — **the implant workspace** |
| Spine & pelvis | Vertebrae, discs, sacrum, hip bones |
| Lower limb | Femur, tibia, fibula, patella, hindfoot |
| Upper limb | Humerus, radius, ulna, scapula, clavicle |
| Thorax | Ribs, sternum, thoracic spine, airway |
| Heart | Chamber walls, cavities, valves, coronary arteries |
| Airway | Trachea, bronchi, bronchial tree |
| Abdominal viscera | Stomach, bowel, pancreas, spleen, biliary tree |
| Urinary tract | Kidneys, ureters, bladder, adrenals, prostate |
| Arterial tree | 639 arteries |
| Venous tree | 404 veins |
| Nervous system | Brain surface, cerebellum, nerves |
| Musculature | Skeletal muscle |
| Whole body | All 2,234 structures — **slowest to load** |

⚠️ **Changing region clears any fracture you have marked.** A fracture is tied
to a specific structure in the current region's list, and that list renumbers
completely when the region changes. Finish a region before leaving it.

### 3.2 Optional textured organ — left rail, middle

Adds a photo-realistic textured organ on top of the atlas geometry, placed at
its correct position in the body. Heart, lungs, liver, kidney. Choose **None**
to turn it off.

These fill the four gaps in the atlas data — it has no lung tissue, no whole
liver, and no solid heart muscle.

### 3.3 Find a structure — left rail, bottom

- **Search** filters all structures in the region by name.
- Each row shows a **colour swatch** (tissue type) and the **FMA id**.
- **⊕ crosshair** — isolate: hides everything else and flies the camera to it.
- **👁 eye** — hide / show that one structure.
- **Show all (n hidden)** appears at the top once anything is hidden.

Clicking a row selects the structure. Its name appears top-left on the canvas.
You can also click structures directly in the 3D view.

---

## 4. Workflow A — planning hardware

### Step 1 — Load the area
Left rail → e.g. **Lower limb**.

### Step 2 — Add an implant
Right panel → **Add** tab → click any card. It drops in at the centre of the
view, already selected, and the panel switches to **Size**.

15 implants in 7 groups:

| Group | Items |
| --- | --- |
| Screws | Cortical, Cancellous, Cannulated |
| Spinal | Pedicle screw, Spinal rod, Interbody cage |
| Plates | Locking compression, Reconstruction |
| Nails & rods | Intramedullary nail, K-wire / Steinmann pin |
| Arthroplasty | Femoral stem |
| Bone graft | Structural block, Strut, Opening wedge |
| Cranio-maxillofacial | Titanium mesh |

### Step 3 — Position it
The coloured gizmo on the implant does the work.

| Mode | Key | Gizmo |
| --- | --- | --- |
| Move | `W` | Arrows |
| Rotate | `E` | Rings |
| Scale | `R` | Boxes |

- **World axes / Along implant** — switch between dragging along scene axes or
  along the implant's own long axis. *Along implant* is what you want for
  driving a screw down a bone.
- **Snap to 1 mm / 5°** — turn on for reproducible placement.
- Drag the gizmo; the camera stays put. Undo (`Ctrl+Z`) steps back one whole
  drag, not one frame of it.

### Step 4 — Size it
Sliders in the **Size** tab. Every range is the real clinical range for that
device — you cannot dial a size that does not exist. The header shows the live
size, e.g. `40 × 4.5 mm`.

### Step 5 — Material
9 options. The swatch shows the finish; metals reflect the environment, so
polished cobalt-chrome really does look different from blasted titanium.

### Step 6 — Check it is seated
Press `X` for **X-ray**. Tissue goes translucent so hardware inside bone stays
visible. **Section** cuts the scene with a movable plane — pick the axis and
drag the depth slider in the top-right panel.

### Step 7 — Manage the plan
The **Plan** list at the bottom of the right panel. Per row: 🔒 lock (stops
accidental dragging), 👁 hide, ⧉ duplicate, 🗑 remove.

---

## 5. Workflow B — explaining it to the patient

This is the **Explain** tab. Work down it in order — it follows the
conversation.

### Step 1 — Select the bone
Click the bone in the 3D view, or in the left rail list.

Only bones can be fractured. If you have something else selected the panel will
say so.

### Step 2 — Mark the fracture
**Explain** tab → **Add fracture here**.

The bone splits into fragments and the view flips to **The injury**.

### Step 3 — Describe the break
Choose the pattern:

| Pattern | Plain-English description shown |
| --- | --- |
| Transverse | A clean break straight across the bone |
| Oblique | A break at an angle across the bone |
| Spiral *(approximated)* | A twisting break that winds around the bone |
| Comminuted | The bone is broken into more than two pieces |

> Spiral is honestly labelled "approximated" — a true spiral needs a helical cut
> surface, which this models as a steep oblique.

**Position along the bone** — lower third / mid-shaft / upper third.

**How far it has moved** — sideways shift (mm), angulation (°), rotation (°).

### Step 4 — Add the hardware
Back to the **Add** tab and place it as in Workflow A.

### Step 5 — Tell the story
The big red/green switch at the bottom of the canvas:

- **The injury** — fragments displaced, hardware hidden. *The operation has not
  happened yet.*
- **The repair** — fragments reduced, hardware in place.

Press **`B`** to flip between them without looking away from the patient. The
fragments **animate** back into position — that half-second of movement is the
part patients understand fastest.

### Step 6 — Turn the screen
Press **`C`** for **consult mode**:

- Both side panels collapse; the model takes the whole screen
- Gizmos and selection outlines disappear
- Technical overlays go
- **Plain English switches on**: `FMA24475 · Left femur` → **Left thigh bone
  (left femur)**

The medical term stays in brackets deliberately — the patient will hear it again
from everyone else in the hospital.

`Esc` or **Exit** returns you to the planning view. Nothing is lost.

> You can also turn plain English on *without* consult mode — the toggle is in
> the Explain tab.

### Step 7 — Give them something to take home
**Patient handout** (Explain tab, or the document icon in the top bar).

**Frame the model how you want it explained first** — the handout captures the
view you have on screen. Then open it. It builds an A4 page with:

- What has happened, in plain words, with a picture of the injury
- What we plan to do, with a picture of the repair
- Each implant described by *what it does*
- Questions worth asking
- A footer stating these are illustrations, not the patient's own scan

**Print / Save PDF** at the top. Choose "Save as PDF" in the print dialog to
attach it to the record instead of printing.

---

## 6. Saving and reopening

| Action | Where |
| --- | --- |
| **Export plan** | Top bar ⬇ — JSON containing the fracture and all hardware |
| **Import plan** | Top bar ⬆ |
| **Screenshot** | Top bar 📷 — PNG of the current view |

The plan file is small and text-based, so it can be stored against the patient
record. It does **not** contain the anatomy — only what you added to it.

---

## 7. Every keyboard shortcut

| Key | Does |
| --- | --- |
| `F` | Fit everything in view |
| `+` / `−` | Zoom in / out |
| `W` `E` `R` | Move / Rotate / Scale gizmo |
| `X` | X-ray on / off |
| **`C`** | **Consult mode on / off** |
| **`B`** | **Before / after (injury ↔ repair)** |
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` | Redo |
| `Ctrl+D` | Duplicate selected implant |
| `Delete` | Remove selected implant |
| `Esc` | Clear selection · close dialog · exit consult mode |

Shortcuts are ignored while typing in the search box.

---

## 8. Display controls (top-right of canvas)

| Control | Effect |
| --- | --- |
| **Exposure** | Overall brightness. Raise it for a bright consulting room. |
| **Tissue opacity** | Fade anatomy without going to full x-ray |
| **Section axis + depth** | Only shown when **Section** is on in the top bar |

Top-bar display toggles: **X-ray**, **Section**, grid, shadows, turntable.

---

## 9. Troubleshooting

**Nothing appears / black screen.**
The browser needs WebGL 2. Check `chrome://gpu`. Hardware acceleration must be
on.

**It is slow.**
Turn off **shadows** (sun icon) — the biggest single cost. Avoid the *Whole
body*, *Arterial tree* and *Musculature* regions on older machines; they are
hundreds of thousands of triangles. Prefer a specific region.

**Loading bar stalls.**
Each geometry chunk is ~4 MB. On a slow connection the first region takes a
while. Check the browser network tab for a failed `body-*.bin`.

**I fractured a bone and it vanished.**
It did not — the whole bone is hidden and replaced by its fragments. If
displacement is set very high the fragments may be off screen. Press `F` to fit,
or reduce the shift.

**My fracture disappeared.**
You changed region. See §3.1 — this is deliberate.

**The gizmo will not move an implant.**
It is locked. Click the 🔒 in the Plan list.

**The previous patient's hardware is still on screen** *(embedded in HMS)*.
The plan is not cleared automatically when the appointment changes. See
`docs/HMS-INTEGRATION.md` §3 — this must be wired up.

**Handout is blank / images missing.**
The 3D view must be on screen when you open the handout. Do not open it while
the canvas is hidden behind another tab.

---

## 10. Important limitations

Read these before using it with a patient.

- **This is a generic adult male reference model.** It is **not** the patient's
  own anatomy and **not** derived from their imaging. The handout says so in
  its footer; say it out loud too.
- **Not a diagnostic or surgical-navigation device.** It illustrates a plan; it
  does not measure or guide one.
- **Fracture fragments are hollow at the break.** Invisible from outside,
  obvious if you fly the camera inside a fragment.
- **Spiral fractures are approximated** as a steep oblique.
- **One fracture at a time.**
- **The atlas has no lung tissue, no whole liver, no solid heart muscle and no
  cranial vault.** Use the textured organs for the first three.
