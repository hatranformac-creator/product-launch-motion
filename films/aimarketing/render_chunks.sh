#!/bin/bash
# Render 3600 frames in 4 s chunks across 4 workers, motion-blur each chunk, concat, mux audio.
set -e
cd "$(dirname "$0")"
WORK=${WORK:-build/chunks}; mkdir -p $WORK
FR=240; NCH=15
chunk() {
  c=$1; d=$WORK/c$c; f0=$((c*FR)); f1=$((f0+FR))
  [ -f $WORK/seg$c.mp4 ] && return
  node render.mjs $f0 $f1 $d
  ffmpeg -loglevel error -y -framerate 240 -i $d/s%05d.jpg \
    -vf "tmix=frames=4:weights='1 1 1 1',select='eq(mod(n\,4)\,3)',setpts=N/(60*TB),scale=out_color_matrix=bt709:out_range=tv,format=yuv420p" \
    -r 60 -c:v libx264 -preset slow -crf 15 -tune film -colorspace bt709 -color_primaries bt709 -color_trc bt709 $WORK/seg$c.mp4
  rm -rf $d; echo "chunk $c done"
}
export -f chunk; export WORK FR
seq 0 $((NCH-1)) | xargs -P 4 -I{} bash -c 'chunk {}'
: > $WORK/list.txt; for c in $(seq 0 $((NCH-1))); do echo "file 'seg$c.mp4'" >> $WORK/list.txt; done
ffmpeg -loglevel error -y -f concat -safe 0 -i $WORK/list.txt -c copy build/video.mp4
ffmpeg -loglevel error -y -i build/video.mp4 -i build/mix.wav -af "alimiter=limit=0.89:level=false,loudnorm=I=-14:TP=-1:LRA=11" -ar 48000 \
  -c:v copy -c:a aac -b:a 256k -shortest -movflags +faststart build/aimarketing-launch-1080p60.mp4
echo ALL DONE
