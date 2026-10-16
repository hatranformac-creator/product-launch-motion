// node snap.mjs <outdir> [scale] t1 t2 ...   (scale 1 = 1920x1080)
import { createRequire } from 'module';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
import fs from 'fs';
const [out, sc, ...ts] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: (process.env.VERT ? { width: 1080, height: 1920 } : { width: 1920, height: 1080 }), deviceScaleFactor: parseFloat(sc) });
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('console:', m.text()); });
page.on('pageerror', e => console.log('pageerror:', e.message));
await page.goto('http://127.0.0.1:8765/index.html' + (process.env.VERT ? '?v=1' : ''));
await page.waitForFunction(() => window.READY === true, null, { timeout: 30000 });
for (const t of ts) {
  await page.evaluate(t => window.M.seek(t), parseFloat(t));
  await page.screenshot({ path: `${out}/t${parseFloat(t).toFixed(2).padStart(6, '0')}.png` });
}
if (process.env.CUES) fs.writeFileSync(process.env.CUES, JSON.stringify(await page.evaluate(() => window.M.cues)));
await browser.close();
