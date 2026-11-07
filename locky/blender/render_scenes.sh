#!/usr/bin/env bash
# Final renders of the new entrances, one after another (resumable: skips frames already on disk).
#   ./render_scenes.sh /path/to/blender telon celular
set -e
cd "$(dirname "$0")"
BL=$1; shift
for s in "$@"; do
  mkdir -p out_$s
  "$BL" -b locky_$s.blend --python-expr "import bpy; r=bpy.context.scene.render; r.use_overwrite=False; r.use_placeholder=True" -a
  STEP=1 python3 composite_scene.py $s
done
