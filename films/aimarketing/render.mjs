// node render.mjs <frame0> <frame1> <outdir>   renders 4 subframes per 60fps frame as JPEG
import { createRequire } from 'module';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
import fs from 'fs';
const [f0, f1, out] = [parseInt(process.argv[2]), parseInt(process.argv[3]), process.argv[4]];
fs.mkdirSync(out, { recursive: true });
const SUB = 4, FPS = 60;
const subT = i => Math.floor(i / SUB) / FPS + ((i % SUB) - 1.5) / (FPS * SUB);
let browser, page;
async function open() {
  if (browser) await browser.close().catch(() => {});
  browser = await chromium.launch(); page = await browser.newPage({ viewport: (process.env.VERT ? { width: 1080, height: 1920 } : { width: 1920, height: 1080 }) });
  await page.goto('http://127.0.0.1:8765/index.html' + (process.env.VERT ? '?v=1' : ''));
  await page.waitForFunction(() => window.READY === true, null, { timeout: 60000 });
}
await open();
for (let i = f0 * SUB; i < f1 * SUB; i++) {
  const file = `${out}/s${String(i - f0 * SUB).padStart(5, '0')}.jpg`;
  for (let tries = 0; ; tries++) {
    try {
      await page.evaluate(t => window.M.seek(Math.max(0, t)), subT(i));
      await page.screenshot({ path: file, type: 'jpeg', quality: 94 });
      break;
    } catch (e) { if (tries > 3) throw e; console.error('retry', i, e.message); await open(); }
  }
}
await browser.close().catch(() => {});
process.exit(0);
