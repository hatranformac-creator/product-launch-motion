// node snap.mjs <outdir> t1 t2 ...   (or "beats" for one frame per beat)
import { chromium } from 'playwright';
import fs from 'fs'; import path from 'path';
const [out, ...ts] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const times = ts[0] === 'beats' ? Array.from({ length: 84 }, (_, k) => +(k * 0.5 + 0.3).toFixed(2)) : ts.map(Number);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on('pageerror', e => console.error('PAGEERR', e.message));
await page.goto('file://' + path.resolve('index.html'));
await page.waitForFunction(() => window.READY === true);
for (const t of times) {
  await page.evaluate(t => window.seek(t), t);
  await page.screenshot({ path: `${out}/t${t.toFixed(2).padStart(6, '0')}.png` });
}
if (process.env.CUES) fs.writeFileSync('events.json', JSON.stringify(await page.evaluate(() => window.CUES), null, 0));
await browser.close(); process.exit(0);
