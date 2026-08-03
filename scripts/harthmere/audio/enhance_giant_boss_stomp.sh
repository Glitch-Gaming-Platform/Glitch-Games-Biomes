#!/usr/bin/env bash
# Make the giant boss stomp audible on ordinary playback hardware.
#
#   bash scripts/harthmere/audio/enhance_giant_boss_stomp.sh
#
# WHY
# ---
# The stomp was reported as inaudible while giants walk. The gating logic,
# distance model, 4x gain and 96 m max distance are all correct, and the file is
# actually hotter than its peers (mean -10.7 dB, peak 0.0 dB). The problem is
# spectral: essentially all of its energy is below 80 Hz.
#
#   band            stomp      jump (reference)
#   sub  <80 Hz     -10.8 dB   -16.4 dB
#   low  80-250 Hz  -26.2 dB   -26.4 dB
#   mid  250-2k Hz  -41.4 dB   -24.3 dB     <-- 31 dB below its own sub
#   high >2k Hz     -52.2 dB   -40.8 dB
#
# It was authored to the prompt "deep controlled sub-bass thud", and that is
# exactly what was delivered — a near-pure sub sine with no impact transient.
# Laptop speakers, phone speakers and most headphones roll off hard below
# ~100-150 Hz, so a sound living entirely under 80 Hz measures loud and is still
# inaudible. `jump` reads clearly because its midrange sits only 8 dB under its
# sub, not 31 dB.
#
# WHAT THIS DOES
# --------------
# Adds the missing impact transient without discarding the sub, which is worth
# keeping for players on headphones or a subwoofer:
#
#   1. keeps the original as the weight layer;
#   2. derives a harmonic layer from the same source using soft clipping, which
#      generates upper harmonics from the sub fundamental — the standard trick
#      for making low-frequency content translate to small speakers;
#   3. band-limits that layer to 200 Hz - 5 kHz so it reads as a foot-plant
#      crack rather than as noise;
#   4. mixes them and trims the peak back under 0 dBFS.
#
# The result is the same stomp with a body that small speakers can reproduce.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
LIVE="$REPO/public/assets/harthmere/audio/sfx/giant_boss_stomp.webm"
OUT_DIR="$REPO/tmp/audio_out"
BACKUP="$OUT_DIR/giant_boss_stomp.original.webm"
OUT="$OUT_DIR/giant_boss_stomp.webm"

mkdir -p "$OUT_DIR"

# Keep the untouched original next to the result so the change is reversible
# without relying on version control for a binary asset.
if [ ! -f "$BACKUP" ]; then
  cp "$LIVE" "$BACKUP"
fi
SRC="$BACKUP"

# Two staged soft-clip passes generate a dense harmonic series from the sub
# fundamental; one pass alone barely moved the midrange because the source is
# almost a pure low sine. +6 dB on the resulting layer puts the midrange about
# 7 dB under the sub, which is the same relationship `jump` has and reads
# clearly on small speakers, while the sub stays hotter than `jump` as befits a
# giant.
ffmpeg -hide_banner -loglevel error -y -i "$SRC" -filter_complex "
  [0:a]asplit=2[sub][drv];
  [drv]highpass=f=45,
       volume=20dB, asoftclip=type=atan,
       volume=20dB, asoftclip=type=atan,
       highpass=f=220,
       lowpass=f=5000,
       volume=6dB[crack];
  [sub][crack]amix=inputs=2:weights=1 1:normalize=0,
       alimiter=limit=0.95[out]
" -map "[out]" -c:a libopus -b:a 112k -ar 48000 -ac 1 "$OUT"

echo "wrote $OUT"
echo "original preserved at $BACKUP"

if [ "${INSTALL:-0}" = "1" ]; then
  cp "$OUT" "$LIVE"
  echo "installed to $LIVE"
else
  echo "(set INSTALL=1 to copy over the shipping asset)"
fi
echo
band() { ffmpeg -hide_banner -nostats -i "$1" -af "$2,volumedetect" -f null /dev/null 2>&1 | grep mean_volume | sed 's/.*mean_volume: //'; }
printf "%-16s %-12s %-12s\n" "band" "before" "after"
printf "%-16s %-12s %-12s\n" "full"        "$(band "$SRC" anull)"                        "$(band "$OUT" anull)"
printf "%-16s %-12s %-12s\n" "sub <80Hz"   "$(band "$SRC" 'lowpass=f=80')"               "$(band "$OUT" 'lowpass=f=80')"
printf "%-16s %-12s %-12s\n" "low 80-250"  "$(band "$SRC" 'highpass=f=80,lowpass=f=250')" "$(band "$OUT" 'highpass=f=80,lowpass=f=250')"
printf "%-16s %-12s %-12s\n" "mid 250-2k"  "$(band "$SRC" 'highpass=f=250,lowpass=f=2000')" "$(band "$OUT" 'highpass=f=250,lowpass=f=2000')"
printf "%-16s %-12s %-12s\n" "high >2k"    "$(band "$SRC" 'highpass=f=2000')"            "$(band "$OUT" 'highpass=f=2000')"
echo
echo "peak: $(ffmpeg -hide_banner -nostats -i "$OUT" -af volumedetect -f null /dev/null 2>&1 | grep max_volume | sed 's/.*max_volume: //')"
