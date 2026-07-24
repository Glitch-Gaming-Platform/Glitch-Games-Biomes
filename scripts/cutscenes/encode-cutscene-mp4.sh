#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 || $# -gt 3 ]]; then
  echo "Usage: $0 INPUT.webm OUTPUT.mp4 [DURATION_SECONDS]" >&2
  exit 2
fi

input=$1
output=$2
duration=${3:-}

duration_args=()
video_filter="fps=30,format=yuv420p"
audio_filter=""
if [[ -n "$duration" ]]; then
  duration_args=(-t "$duration")
  # Browser capture can run slower than realtime when software WebGL is also
  # reading postprocessed frames. Use the final packet timestamp to retime the
  # complete authored scene to the requested duration instead of truncating it.
  source_duration=$(ffprobe -v error -select_streams v:0 \
    -show_entries packet=pts_time -of csv=p=0 "$input" | \
    tail -n 1 | cut -d, -f1 | tr -d '[:space:]')
  if [[ -n "$source_duration" ]] && \
    awk "BEGIN { exit !($source_duration > 0 && $duration > 0) }"; then
    video_scale=$(awk "BEGIN { printf \"%.12f\", $duration / $source_duration }")
    audio_speed=$(awk "BEGIN { printf \"%.12f\", $source_duration / $duration }")
    video_filter="setpts=${video_scale}*PTS,${video_filter}"
    audio_filter="atempo=${audio_speed}"
  fi
fi

# H.264 + yuv420p + faststart is the broadest browser/chat/player-compatible
# MP4 target. The browser records the real engine canvas to WebM first; this
# step transcodes and, when requested, retimes the complete authored timeline.
has_audio=$(ffprobe -v error -select_streams a:0 \
  -show_entries stream=index -of csv=p=0 "$input")

if [[ -n "$has_audio" && -n "$audio_filter" ]]; then
  ffmpeg -y \
    -i "$input" \
    -filter_complex "[0:v]${video_filter}[v];[0:a]${audio_filter}[a]" \
    -map "[v]" \
    -map "[a]" \
    "${duration_args[@]}" \
    -c:v libx264 \
    -preset medium \
    -crf 18 \
    -c:a aac \
    -b:a 192k \
    -movflags +faststart \
    "$output"
elif [[ -n "$has_audio" ]]; then
  ffmpeg -y \
    -i "$input" \
    "${duration_args[@]}" \
    -vf "$video_filter" \
    -c:v libx264 \
    -preset medium \
    -crf 18 \
    -c:a aac \
    -b:a 192k \
    -movflags +faststart \
    "$output"
else
  ffmpeg -y \
    -i "$input" \
    "${duration_args[@]}" \
    -vf "$video_filter" \
    -c:v libx264 \
    -preset medium \
    -crf 18 \
    -an \
    -movflags +faststart \
    "$output"
fi
