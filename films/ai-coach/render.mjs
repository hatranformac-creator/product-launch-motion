// node render.mjs <out.mp4> [fps=60] [sub=4] [scale=1] [workers=4]
// Playwright subframes centred on each frame time -> ffmpeg tmix motion blur, rendered in 4 s chunks.
import { chromium } from 'playwright';
import { execFileSync } from 'child_process';
import fs from 'fs'; import path from 'path';
const [out, FPS = '60', SUB = '4', SCALE = '1', WORKERS = '4'] = process.argv.slice(2);
const fps = +FPS, sub = +SUB, scale = +SCALE, nw = +WORKERS, DUR = 42, CH = 4;
const W = Math.round(1920 * scale / 2) * 2, H = Math.round(1080 * scale / 2) * 2;
const root = path.resolve('frames'); fs.rmSync(root, { recursive: true, force: true }); fs.mkdirSync(root, { recursive: true });
const chunks = Array.from({ length: Math.ceil(DUR / CH) }, (_, i) => i);
async function launch() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  await p.goto('file://' + path.resolve('index.html'));
  await p.waitForFunction(() => window.READY === true, null, { timeout: 60000 });
  return [b, p];
}
async function worker(id) {
  let [b, p] = await launch();
  while (chunks.length) {
    const c = chunks.shift(), dir = `${root}/c${String(c).padStart(2, '0')}`; fs.mkdirSync(dir);
    const f0 = c * CH * fps, f1 = Math.min(DUR * fps, (c + 1) * CH * fps);
    let k = 0;
    for (let f = f0; f < f1; f++) for (let i = 0; i < sub; i++) {
      const t = Math.max(0, f / fps + (sub > 1 ? (i - (sub - 1) / 2) / (fps * sub) : 0));
      for (let tries = 0; ; tries++) {
        try { await p.evaluate(t => window.seek(t), t); await p.screenshot({ path: `${dir}/s${String(k).padStart(5, '0')}.png` }); break; }
        catch (e) { if (tries > 3) throw e; try { await b.close(); } catch {} [b, p] = await launch(); }
      }
      k++;
    }
    const vf = (sub > 1 ? `tmix=frames=${sub}:weights='${Array(sub).fill(1).join(' ')}',select='eq(mod(n\\,${sub})\\,${sub - 1})',setpts=N/(${fps}*TB),` : '') +
      `scale=${W}:${H}:flags=lanczos:out_color_matrix=bt709:out_range=tv,format=yuv420p`;
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', String(fps * sub), '-i', `${dir}/s%05d.png`, '-vf', vf, '-r', String(fps),
      '-c:v', 'libx264', '-preset', scale < 1 ? 'veryfast' : 'slow', '-crf', scale < 1 ? '23' : '15', '-tune', 'film',
      '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', `${root}/seg${String(c).padStart(2, '0')}.mp4`]);
    fs.rmSync(dir, { recursive: true, force: true });
    console.log(`worker ${id}: chunk ${c} done`);
  }
  try { await b.close(); } catch {}
}
await Promise.all(Array.from({ length: nw }, (_, i) => worker(i)));
const list = fs.readdirSync(root).filter(f => f.startsWith('seg')).sort().map(f => `file '${root}/${f}'`).join('\n');
fs.writeFileSync(`${root}/list.txt`, list);
execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', `${root}/list.txt`, '-i', 'mix.wav', '-map', '0:v', '-map', '1:a',
  '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-movflags', '+faststart', '-shortest', out]);
console.log('wrote', out); process.exit(0);
