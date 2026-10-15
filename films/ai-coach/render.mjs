// node render.mjs <out.mp4> [fps=60] [sub=4] [scale=1] [workers=3]
// Chunks of 4 s: render subframes → ffmpeg tmix motion blur → segment → delete PNGs → concat → mux mix.wav.
import { chromium } from 'playwright';
import fs from 'fs'; import path from 'path'; import { execFileSync } from 'child_process';
const [out, fpsA = '60', subA = '4', scaleA = '1', wA = '3'] = process.argv.slice(2);
const FPS = +fpsA, SUB = +subA, SC = +scaleA, WK = +wA, DUR = 60, CH = 4;
const W = Math.round(1920 * SC), H = Math.round(1080 * SC);
const tmp = path.resolve('renders/tmp'); fs.rmSync(tmp, { recursive: true, force: true }); fs.mkdirSync(tmp, { recursive: true });
const chunks = [...Array(DUR / CH).keys()];
const subT = (i) => Math.floor(i / SUB) / FPS + (SUB > 1 ? ((i % SUB) - (SUB - 1) / 2) / (FPS * SUB) : 0);
async function newPage(b) {
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: SC });
  await p.goto('file://' + path.resolve('index.html'));
  await p.waitForFunction(() => window.M && window.M.ready, null, { timeout: 30000 });
  return p;
}
async function worker(id) {
  let b = await chromium.launch(), p = await newPage(b);
  while (chunks.length) {
    const c = chunks.shift(), dir = `${tmp}/c${String(c).padStart(2, '0')}`; fs.mkdirSync(dir, { recursive: true });
    const n0 = c * CH * FPS * SUB, n = CH * FPS * SUB;
    for (let k = 0; k < n; k++) {
      const t = Math.max(0, subT(n0 + k)), f = `${dir}/s${String(k).padStart(5, '0')}.png`;
      for (let tries = 0; ; tries++) {
        try { await p.evaluate((t) => window.M.seek(t), t); await p.screenshot({ path: f }); break; }
        catch (e) { if (tries > 3) throw e; try { await b.close(); } catch {} b = await chromium.launch(); p = await newPage(b); }
      }
    }
    const vf = SUB > 1
      ? `tmix=frames=${SUB}:weights='${Array(SUB).fill(1).join(' ')}',select='eq(mod(n\\,${SUB})\\,${SUB - 1})',setpts=N/(${FPS}*TB),scale=out_color_matrix=bt709:out_range=tv,format=yuv420p`
      : `scale=out_color_matrix=bt709:out_range=tv,format=yuv420p`;
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS * SUB), '-i', `${dir}/s%05d.png`, '-vf', vf, '-r', String(FPS),
      '-c:v', 'libx264', '-preset', SC < 1 ? 'veryfast' : 'slow', '-crf', SC < 1 ? '23' : '15', '-tune', 'film',
      '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', `${tmp}/seg${String(c).padStart(2, '0')}.mp4`]);
    fs.rmSync(dir, { recursive: true, force: true });
    console.log(`worker ${id} chunk ${c} done`);
  }
  await b.close().catch(() => {});
}
await Promise.all([...Array(WK).keys()].map(worker));
const segs = fs.readdirSync(tmp).filter((f) => f.startsWith('seg')).sort();
fs.writeFileSync(`${tmp}/list.txt`, segs.map((s) => `file '${tmp}/${s}'`).join('\n'));
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', `${tmp}/list.txt`, '-i', 'mix.wav',
  '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-movflags', '+faststart', '-shortest', out]);
console.log('wrote', out);
process.exit(0);
