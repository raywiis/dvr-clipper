#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

WIDTH=1280
HEIGHT=720
FPS=1
DURATION_SECONDS=10
JPEG_QUALITY=3

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "error: ffmpeg is required" >&2
  exit 1
fi

if ! command -v ffprobe >/dev/null 2>&1; then
  echo "warning: ffprobe not found; skipping verification" >&2
fi

echo "Generating source JPEG slides..."
ffmpeg -y -hide_banner -loglevel error \
  -f lavfi -i "color=c=red:s=${WIDTH}x${HEIGHT}:d=1" \
  -frames:v 1 slide_red.jpg

ffmpeg -y -hide_banner -loglevel error \
  -f lavfi -i "color=c=blue:s=${WIDTH}x${HEIGHT}:d=1" \
  -frames:v 1 slide_blue.jpg

ffmpeg -y -hide_banner -loglevel error \
  -f lavfi -i "nullsrc=s=${WIDTH}x${HEIGHT},geq=random(1)*255:128:128" \
  -frames:v 1 -q:v 2 slide_noise.jpg

build_video() {
  local outfile="$1"
  shift

  local inputs=()
  local labels=""

  for ((i = 0; i < DURATION_SECONDS; i++)); do
    case $((i % 3)) in
      0) slide="slide_red.jpg" ;;
      1) slide="slide_blue.jpg" ;;
      2) slide="slide_noise.jpg" ;;
    esac

    inputs+=("-loop" "1" "-t" "1" "-i" "$slide")
    labels="${labels}[${i}:v]"
  done

  echo "Generating ${outfile}..."
  ffmpeg -y -hide_banner -loglevel error \
    "${inputs[@]}" \
    -filter_complex "${labels}concat=n=${DURATION_SECONDS}:v=1:a=0,fps=${FPS},format=yuvj420p[v]" \
    -map "[v]" \
    -c:v mjpeg \
    -q:v "${JPEG_QUALITY}" \
    "$@" \
    "${outfile}"
}

build_video reference.mov -movflags +faststart
build_video reference.avi

if command -v ffprobe >/dev/null 2>&1; then
  echo
  echo "Verifying outputs..."
  for video in reference.mov reference.avi; do
    echo "${video}:"
    ffprobe -v error \
      -show_entries format=format_name,duration,size \
      -show_entries stream=codec_name,width,height,r_frame_rate,nb_frames,pix_fmt \
      -of default=noprint_wrappers=1 \
      "${video}"
    echo
  done
fi

echo "Done."
