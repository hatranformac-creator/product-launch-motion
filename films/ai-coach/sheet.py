# python3 sheet.py <dir> <out.png> <cols> — contact sheet with time labels (ffmpeg-free, uses PIL if present)
import sys, os
from PIL import Image, ImageDraw
d, out, cols = sys.argv[1], sys.argv[2], int(sys.argv[3])
fs = sorted(f for f in os.listdir(d) if f.endswith('.png'))
ims = [Image.open(os.path.join(d, f)) for f in fs]
w, h = 480, 270
rows = (len(ims) + cols - 1) // cols
S = Image.new('RGB', (cols * w, rows * (h + 22)), (40, 40, 40))
dr = ImageDraw.Draw(S)
for i, (f, im) in enumerate(zip(fs, ims)):
    x, y = (i % cols) * w, (i // cols) * (h + 22)
    S.paste(im.convert('RGB').resize((w, h)), (x, y + 22)); dr.text((x + 6, y + 5), f[1:-4], fill=(255, 255, 0))
S.save(out)
