# Model data attribution

## BodyParts3D 4.0

`atlas.json` and `body-*.bin` contain geometry derived from **BodyParts3D**,
produced by the **Database Center for Life Science (DBCLS)**, University of
Tokyo — a dictionary-type anatomy database in which anatomical concepts are
represented by 3D structure data for an adult human male.

- Upstream data: BodyParts3D / Anatomography, © DBCLS
- Licence: **Creative Commons Attribution–ShareAlike**
  (BodyParts3D 4.0 as redistributed here is used under **CC BY 4.0**;
  the original database is CC BY-SA 2.1 Japan)
- Concept identifiers in `atlas.json` (`conceptId`) are **FMA** ids from the
  Foundational Model of Anatomy ontology.

**Attribution is a licence condition, not a courtesy.** The viewer surfaces it
in the About panel; if this data is embedded anywhere else in the product, that
surface must carry the same credit.

## Repacking

The flat binary layout (`body-N.bin` + byte offsets in `atlas.json`) comes from
the open-source [`human-atlas`](https://github.com/ashemag/human-atlas) project
by ashemag, MIT licensed. Only the packed data files are vendored here; the
loader in `src/three/atlasLoader.js` is our own.

## Contents

- 2,234 individually selectable meshes
- 2,288,268 triangles total
- 15 geometry chunks (~4 MB each)

## What is NOT in this dataset

Worth knowing before promising a clinician a view:

- No lung parenchyma (the bronchial **tree** is present, the lobes are not)
- No whole-liver mesh (biliary tree and caudate lobe only)
- No solid myocardium — the heart is chamber **walls**, **cavities** and
  **valve leaflets**, which is arguably more useful for valve work and less
  useful for a gross overview
- No cranial vault; the skull is represented by mandible and maxilla only

Bones that ARE present, and that carry the implant workflow: femur, tibia,
fibula, patella, humerus, radius, ulna, scapula, clavicle, hip bone, sacrum,
the full vertebral column with intervertebral discs, all twelve rib pairs,
costal cartilages, talus and calcaneus.

---

## Textured organ meshes (`organs/*.glb`) — NOT IN THIS REPOSITORY

`heart.glb`, `lung.glb`, `liver.glb` and `kidney.glb` are **deliberately not
committed** (`public/models/organs/` is gitignored).

They come from [`Human-Organ3D`](https://github.com/yihalem123/Human-Organ3D),
which claims MIT in its README but ships no LICENSE file. The meshes are
third-party photogrammetry art the repository owner is unlikely to hold rights
to relicense — an MIT statement covers the owner's own code, not artwork they
did not create. Redistributing them from a public repository would be
publishing someone else's work without a verified licence.

To use them locally:

```bash
./scripts/fetch-models.sh --all
```

The application is fully functional without them. The BodyParts3D atlas is the
primary data path; the "Textured organ" picker simply has nothing to offer.

**Establish the upstream licence before including these in a deployed product.**
