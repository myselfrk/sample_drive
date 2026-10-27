#!/usr/bin/env bash
# Raw Blender GLBs -> compressed GLBs in public/models.
set -euo pipefail
cd "$(dirname "$0")/.."
RAW=blender/exports; OUT=public/models; mkdir -p "$OUT"
T="npx --yes @gltf-transform/cli"
# Named-node assets: keep hierarchy, node names and per-part materials (the app looks them up by name)
for m in car signal buildings; do
  $T optimize "$RAW/$m.raw.glb" "$OUT/$m.glb" --compress meshopt --texture-compress webp \
     --texture-size 1024 --simplify false --join false --flatten false --palette false
done
# Scenery: let it merge freely
for m in road tree streetlight; do
  $T optimize "$RAW/$m.raw.glb" "$OUT/$m.glb" --compress meshopt --texture-compress webp --texture-size 1024
done
ls -lh "$OUT"
