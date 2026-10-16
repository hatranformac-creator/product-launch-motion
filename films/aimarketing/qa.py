# python3 qa.py <mp4> <outdir> : 1-per-second storyboard + frame-difference scan
import sys, subprocess, os, numpy as np
mp4, out = sys.argv[1], sys.argv[2]; os.makedirs(out, exist_ok=True)
subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', mp4, '-vf', 'fps=1,scale=' + ('180' if 'vertical' in mp4 else '480') + ':-1,tile=' + ('10x6' if 'vertical' in mp4 else '6x10'), '-frames:v', '1', f'{out}/storyboard.png'], check=True)
W, H = 192, 108
raw = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', mp4, '-vf', f'scale={W}:{H},format=gray', '-f', 'rawvideo', '-'], capture_output=True, check=True).stdout
fr = np.frombuffer(raw, np.uint8).reshape(-1, H, W).astype(np.float32)
d = np.abs(np.diff(fr, axis=0)).mean(axis=(1, 2))
print('frames', len(fr), 'mean diff', d.mean().round(2))
med = np.median(d)
spikes = [(i + 1, round(float(v), 2)) for i, v in enumerate(d) if v > max(6 * med, 4)]
print('spikes (frame, diff):', [(f'{f/60:.2f}s', v) for f, v in spikes][:40])
# chunk seams every 240 frames
print('seams:', [(c * 240, round(float(d[c * 240 - 1]), 2), round(float(np.median(d[c*240-6:c*240+5])), 2)) for c in range(1, 15)])
