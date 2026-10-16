# python3 sheet.py <dir> <out.png> <cols> <thumb_w>
import sys, os
from PIL import Image, ImageDraw
d, out, cols, tw = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
fs = sorted(f for f in os.listdir(d) if f.endswith('.png'))
im0 = Image.open(os.path.join(d, fs[0])); th = tw * im0.height // im0.width; rows = (len(fs) + cols - 1) // cols
S = Image.new('RGB', (cols * tw, rows * (th + 22)), 'white'); D = ImageDraw.Draw(S)
for i, f in enumerate(fs):
    im = Image.open(os.path.join(d, f)).convert('RGB').resize((tw, th))
    x, y = (i % cols) * tw, (i // cols) * (th + 22); S.paste(im, (x, y + 22)); D.text((x + 4, y + 4), f[1:-4], fill='black')
S.save(out)
