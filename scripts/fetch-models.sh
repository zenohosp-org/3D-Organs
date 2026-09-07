#!/usr/bin/env bash
#
# Fetch the 3D model data. These files are NOT in git — see
# THIRD-PARTY-NOTICES.md for why.
#
#   ./scripts/fetch-models.sh          # atlas only (default, licence-clean)
#   ./scripts/fetch-models.sh --all    # atlas + unverified textured organs
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODELS="$ROOT/public/models"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

WANT_ORGANS=0
[[ "${1:-}" == "--all" ]] && WANT_ORGANS=1

mkdir -p "$MODELS"

# ---------------------------------------------------------------------
# 1. BodyParts3D atlas — CC BY-SA, DBCLS. Required.
# ---------------------------------------------------------------------
if [[ -f "$MODELS/atlas.json" ]]; then
  echo "==> Atlas already present, skipping."
else
  echo "==> Fetching BodyParts3D atlas (~58 MB). This is slow on a poor link."
  git clone --depth 1 https://github.com/ashemag/human-atlas.git "$TMP/human-atlas"
  cp "$TMP/human-atlas/public/models/atlas.json" "$MODELS/"
  cp "$TMP/human-atlas/public/models/"body-*.bin "$MODELS/"
  echo "==> Atlas installed: $(ls "$MODELS"/body-*.bin | wc -l | tr -d ' ') chunks."
fi

# ---------------------------------------------------------------------
# 2. Textured organs — PROVENANCE UNVERIFIED. Opt-in only.
# ---------------------------------------------------------------------
if [[ "$WANT_ORGANS" -eq 1 ]]; then
  cat <<'WARN'

  ------------------------------------------------------------------
  WARNING — provenance unverified

  heart.glb / lung.glb / liver.glb / kidney.glb come from a repository
  that claims MIT in its README but ships no LICENSE file, and the
  meshes are third-party art the owner likely cannot relicense.

  These are safe to look at locally. Do NOT ship them in a product, or
  commit them to a public repository, until the upstream licence is
  established.
  ------------------------------------------------------------------

WARN
  read -r -p "  Type 'yes' to download them anyway: " reply
  if [[ "$reply" != "yes" ]]; then
    echo "==> Skipped textured organs."
  else
    mkdir -p "$MODELS/organs"
    echo "==> Fetching textured organs (~43 MB)…"
    curl -fL --retry 5 --retry-all-errors \
      -o "$TMP/organs.tar.gz" \
      "https://codeload.github.com/yihalem123/Human-Organ3D/tar.gz/refs/heads/main"
    tar xzf "$TMP/organs.tar.gz" -C "$TMP"
    for f in heart lung liver kidney; do
      cp "$TMP/Human-Organ3D-main/models/$f.glb" "$MODELS/organs/"
    done
    echo "==> Textured organs installed."
  fi
else
  echo "==> Textured organs skipped (pass --all to include them)."
fi

echo
echo "Done. Model data in: $MODELS"
du -sh "$MODELS"
