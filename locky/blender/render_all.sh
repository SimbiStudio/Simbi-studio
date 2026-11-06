#!/usr/bin/env bash
# Full Cycles render of locky_v2.blend -> blender/out/f_0000.png ... (skips frames already on disk,
# so it can be stopped and resumed).  Usage: ./render_all.sh [blender-binary]
set -e
cd "$(dirname "$0")"
BL=${1:-blender}
"$BL" -b locky_v2.blend --python-expr "import bpy; r=bpy.context.scene.render; r.use_overwrite=False; r.use_placeholder=True; bpy.context.scene.frame_step=int(__import__(\"os\").environ.get(\"STEP\",\"1\"))" -a
