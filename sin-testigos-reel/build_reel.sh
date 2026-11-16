#!/usr/bin/env bash
# Sin testigos reel: 1080x1920, 30 fps, H.264 + AAC, 28.4 s.
# Usage: build_reel.sh <SinTestigos.mp4> <avatar.mp4|-> <overlays dir> <out dir>
# Pass "-" as the avatar to render placeholders where the HeyGen avatar goes.
set -euo pipefail
SRC=$1; AVATAR=$2; OV=$3; OUT=$4
mkdir -p "$OUT/seg"
SEG=$OUT/seg
V="-c:v libx264 -preset medium -crf 16 -pix_fmt yuv420p -r 30"
A="-c:a aac -b:a 192k -ar 48000 -ac 2"

# Vertical crop of the 1920x1080 film: 608 px wide window at x, scaled to 1080x1920.
vcrop() { echo "crop=608:1080:$1:0,scale=1080:1920:flags=lanczos,setsar=1,fps=30"; }

# Scene list: name  source-start(s)  crop-x   (all 2.5 s, verified by eye 16/11)
#  1 auto, interior     9:31.00  (shot 9:30.40-9:39.16)  IA
#  2 amuleto            3:53.00  (shot 3:52.69-4:04.66)  filmada
#  3 pared              7:38.00                          filmada
#  4 control policial  10:29.00  (shot 10:27.54-10:34.18) IA
#  5 servilleta         5:50.60  (shot ends 5:53.23)     filmada
#  6 auto que se va    12:57.00  (shot 12:55.86-13:00.07) IA
SCENES=(
  "s1 571.00 380"
  "s2 233.00 780"
  "s3 458.00 656"
  "s4 629.00 640"
  "s5 350.60 600"
  "s6 777.00 560"
)

# 0) Hook: burning report close-up, shot 12:45.01-12:47.98 (2.97 s) slowed to 3.65 s.
ffmpeg -v error -y -ss 765.01 -t 2.97 -i "$SRC" \
  -filter_complex "[0:v]$(vcrop 860),setpts=PTS*3.65/2.97,trim=0:3.65,setpts=PTS-STARTPTS[v];
                   [0:a]atempo=0.8137,atrim=0:3.65,asetpts=PTS-STARTPTS,volume=0.35[a]" \
  -map "[v]" -map "[a]" $V $A -t 3.65 "$SEG/s0.mp4"

# 1-6) Scenes with the film's own sound, tiny fades so cuts don't pop.
for row in "${SCENES[@]}"; do
  set -- $row
  ffmpeg -v error -y -ss "$2" -t 2.5 -i "$SRC" \
    -filter_complex "[0:v]$(vcrop "$3"),trim=0:2.5,setpts=PTS-STARTPTS[v];
                     [0:a]atrim=0:2.5,asetpts=PTS-STARTPTS,afade=t=in:d=0.02,afade=t=out:st=2.47:d=0.03[a]" \
    -map "[v]" -map "[a]" $V $A -t 2.5 "$SEG/$1.mp4"
done

# Avatar parts (from silence detection): hook audio 0-3.65, proof 5.03-8.23, close 8.90-15.41.
avatar_part() { # name start dur slotdur label
  if [[ "$AVATAR" != "-" ]]; then
    ffmpeg -v error -y -ss "$2" -t "$3" -i "$AVATAR" \
      -filter_complex "[0:v]scale=1080:1920,setsar=1,fps=30,tpad=stop_mode=clone:stop_duration=1,trim=0:$4,setpts=PTS-STARTPTS[v];
                       [0:a]apad,atrim=0:$4,asetpts=PTS-STARTPTS[a]" \
      -map "[v]" -map "[a]" $V $A -t "$4" "$SEG/$1.mp4"
  else
    ffmpeg -v error -y -f lavfi -i "color=c=0x141217:s=1080x1920:r=30:d=$4" -f lavfi -i "anullsrc=r=48000:cl=stereo" \
      -vf "drawtext=text='[$5]':fontcolor=0x7C93FF:fontsize=56:x=(w-tw)/2:y=h*0.55" \
      $V $A -t "$4" "$SEG/$1.mp4"
  fi
}
avatar_part a2 5.03 3.20 3.20 "avatar parte 2"
avatar_part a3 8.90 6.51 6.55 "avatar parte 3"

# Hook voice (avatar audio 0-3.65) or silence.
if [[ "$AVATAR" != "-" ]]; then
  ffmpeg -v error -y -t 3.65 -i "$AVATAR" -vn $A "$SEG/hookvo.m4a"
else
  ffmpeg -v error -y -f lavfi -i "anullsrc=r=48000:cl=stereo" -t 3.65 $A "$SEG/hookvo.m4a"
fi

# Click: 25 ms filtered noise burst with fast decay.
ffmpeg -v error -y -f lavfi -i "anoisesrc=d=0.04:c=white:a=0.9" \
  -af "highpass=f=1800,afade=t=out:st=0:d=0.035,volume=0.6" -ar 48000 -ac 2 "$SEG/click.wav"

# Concat video+film audio.
ffmpeg -v error -y \
  -i "$SEG/s0.mp4" -i "$SEG/a2.mp4" -i "$SEG/s1.mp4" -i "$SEG/s2.mp4" -i "$SEG/s3.mp4" \
  -i "$SEG/s4.mp4" -i "$SEG/s5.mp4" -i "$SEG/s6.mp4" -i "$SEG/a3.mp4" \
  -filter_complex "concat=n=9:v=1:a=1[v][a]" -map "[v]" -map "[a]" $V $A "$SEG/base.mp4"

# Text overlays + hook voice + clicks, then loudness to -14 LUFS for Instagram.
o() { echo "-loop 1 -t 28.4 -framerate 30 -i $OV/$1.png"; }
OVL=(t_hook1 t_hook2 t_proof num1 num2 num3 num4 num5 num6 credit t_close1 t_close2 t_close3)
WIN=("0,1.6" "1.6,3.65" "3.65,6.85" "6.85,9.35" "9.35,11.85" "11.85,14.35" "14.35,16.85" "16.85,19.35" "19.35,21.85" "6.85,21.85" "21.85,23.62" "23.62,25.91" "25.91,28.4")
INPUTS=""; FC="[0:v]null[v0];"
for i in "${!OVL[@]}"; do
  INPUTS+=" $(o "${OVL[$i]}")"
  n=$((i + 1))
  FC+="[v$i][$n:v]overlay=0:0:enable='between(t,${WIN[$i]})'[v$n];"
done
NO=${#OVL[@]}
HV=$((NO + 1)); CK=$((NO + 2))
FC+="[$HV:a]adelay=0|0[hv];"
FC+="[$CK:a]asplit=6[c1][c2][c3][c4][c5][c6];"
k=1; for t in 6850 9350 11850 14350 16850 19350; do FC+="[c$k]adelay=$t|$t[d$k];"; k=$((k+1)); done
FC+="[0:a][hv][d1][d2][d3][d4][d5][d6]amix=inputs=8:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000[a]"
# shellcheck disable=SC2086
ffmpeg -v error -y -i "$SEG/base.mp4" $INPUTS -i "$SEG/hookvo.m4a" -i "$SEG/click.wav" \
  -filter_complex "$FC" -map "[v$NO]" -map "[a]" $V -profile:v high -level 4.1 $A \
  -t 28.4 -movflags +faststart "$OUT/sin-testigos-reel.mp4"

# Cover: burning report frame with "¿Cuáles son IA?".
ffmpeg -v error -y -ss 767.9 -i "$SRC" -i "$OV/t_cover.png" \
  -filter_complex "[0:v]$(vcrop 860)[b];[b][1:v]overlay=0:0" -frames:v 1 -q:v 2 "$OUT/sin-testigos-portada.jpg"

ffprobe -v error -show_entries format=duration:stream=codec_name,width,height,r_frame_rate -of compact "$OUT/sin-testigos-reel.mp4"
