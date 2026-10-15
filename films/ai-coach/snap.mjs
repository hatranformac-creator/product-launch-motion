// node snap.mjs <outdir> t1 t2 ...   → PNG per time (half-res unless FULL=1)
import { chromium } from 'playwright';
import fs from 'fs'; import path from 'path';
const [out, ...ts] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const full = process.env.FULL === '1';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: full ? 1 : 0.5 });
p.on('pageerror', (e) => console.error('PAGEERR', e.message));
p.on('console', (m) => { if (m.type() === 'error') console.error('CONSOLE', m.text()); });
await p.goto('file://' + path.resolve('index.html'));
await p.waitForFunction(() => window.M && window.M.ready);
for (const t of ts) {
  await p.evaluate((t) => window.M.seek(+t), t);
  await p.screenshot({ path: `${out}/t${(+t).toFixed(2).padStart(6, '0')}.png`, clip: { x: 0, y: 0, width: 1920, height: 1080 } });
}
if (process.env.CUES) fs.writeFileSync(process.env.CUES, JSON.stringify(await p.evaluate(() => window.M.cues), null, 0));
await b.close();
