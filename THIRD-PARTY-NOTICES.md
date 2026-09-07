# Third-party notices

This product includes third-party material. The notices below are **licence
conditions, not courtesies** — they must remain with any distribution of this
software, and the BodyParts3D credit must remain reachable from the running
application (it is surfaced in the in-app **?** dialog).

---

## 1. Anatomical data — BodyParts3D

**© Database Center for Life Science (DBCLS), University of Tokyo.**

BodyParts3D is a dictionary-type anatomy database in which anatomical concepts
are represented by 3D structure data for an adult human male. Structures are
identified by **FMA** (Foundational Model of Anatomy) concept ids.

- Source: <https://dbarchive.biosciencedbc.jp/en/bodyparts3d/>
- Licence: **Creative Commons Attribution–ShareAlike 2.1 Japan (CC BY-SA 2.1 JP)**
  <https://creativecommons.org/licenses/by-sa/2.1/jp/>

Files: `public/models/atlas.json`, `public/models/body-*.bin`

### What ShareAlike does and does not require here

**It does not apply to this application's source code.** ShareAlike is triggered
by distributing an *adaptation of the licensed work*. Software that loads,
transforms in memory, and renders the data is not an adaptation of the data.
The application code is licensed separately — see `LICENSE`.

**It does apply to the data files.** `atlas.json` and `body-*.bin` are a
repackaged form of the original meshes and remain under CC BY-SA. If you
redistribute them, modified or not, they must stay under CC BY-SA with this
attribution intact.

### Note on the upstream relicensing

These files were obtained via the `human-atlas` project, which labels the data
**CC BY 4.0** — i.e. without ShareAlike. A downstream redistributor cannot
normally remove a ShareAlike condition imposed by the original licensor. This
project therefore treats the data as **CC BY-SA** and complies with the
stricter terms. If you need certainty for a commercial deployment, confirm the
current licence directly with DBCLS.

---

## 2. Binary repacking — human-atlas

The flat binary layout (`body-N.bin` chunks addressed by byte offsets in
`atlas.json`) originates from:

- <https://github.com/ashemag/human-atlas> — **MIT License**, © 2026 ashemag

Only the packed data files are vendored. The loader in
`src/three/atlasLoader.js` is original work.

```
MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## 3. Textured organ meshes — NOT DISTRIBUTED

`heart.glb`, `lung.glb`, `liver.glb` and `kidney.glb` are **deliberately
excluded from this repository.**

They originate from <https://github.com/yihalem123/Human-Organ3D>, which states
MIT in its README but contains **no LICENSE file**, and the meshes are
third-party photogrammetry art that the repository owner is unlikely to hold
the rights to relicense. An MIT statement by a repository owner covers their
own code, not artwork they did not create.

They are therefore treated as **provenance-unverified** and are not
redistributed here. The application is fully functional without them — the
BodyParts3D atlas is the primary data path, and the "Textured organ" picker
simply shows nothing to choose.

To use them locally, see `scripts/fetch-models.sh`. **Establish the upstream
licence before including them in any deployed product.**

---

## 4. Software dependencies

All permissive; none impose copyleft on this project.

| Package | Licence |
| --- | --- |
| `three` | MIT |
| `react`, `react-dom` | MIT |
| `@react-three/fiber` | MIT |
| `@react-three/drei` | MIT |
| `zustand` | MIT |
| `lucide-react` | ISC |
| `vite`, `@vitejs/plugin-react` | MIT |

Full texts ship inside each package under `node_modules/<pkg>/LICENSE`.

---

## 5. Font

**Lexend** is loaded at runtime from Google Fonts and is licensed under the
**SIL Open Font License 1.1**. It is not redistributed in this repository.
