// Referenzbilder der Oberfläche für Designänderungen.
//
// Einmalig einrichten (schreibt nichts in package.json):
//   npm i --no-save playwright@1.58.2
//   npx playwright install chromium
//
// Referenz erzeugen:   node scripts/ui-baseline.mjs
// Mit Referenz prüfen: node scripts/ui-baseline.mjs --compare
//
// Die Playwright-Version ist bewusst fest. Eine andere Chromium-Version rendert
// Schrift minimal anders, dann meldet der Vergleich jedes Bild als geändert.
// Der Fragenkatalog ist synthetisch und wird nur im Speicher erzeugt.

import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import {mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {extname, join, resolve} from 'node:path';
import {execFileSync} from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const dist = resolve(root, 'dist');
const baselineDir = resolve(root, 'tests/ui-baseline');
const compare = process.argv.includes('--compare');
const outDir = compare ? join(tmpdir(), 'fahrklar-ui-current') : baselineDir;

let chromium;
try {
  ({chromium} = await import('playwright'));
} catch {
  console.error('Playwright fehlt. Einrichten mit:\n  npm i --no-save playwright@1.58.2\n  npx playwright install chromium');
  process.exit(2);
}

execFileSync(process.execPath, [resolve(root, 'scripts/build-web.mjs')], {stdio: 'inherit'});

function syntheticCatalog() {
  const topics = [['Vorrang', 'Kreuzung'], ['Vorrang', 'Zeichen'], ['Fahrtechnik', 'Bremsen'], ['Verkehrszeichen', 'Gebot'], ['Umwelt', 'Verbrauch']];
  const questions = [];
  for (let i = 0; i < 120; i++) {
    const n = 2 + (i % 3);
    questions.push({
      qst_id: 1000 + i,
      txt_text: `Synthetische Übungsfrage Nummer ${i + 1}: Wie verhältst du dich richtig?`,
      qst_image: 0, qst_sub: 0, qst_main: 1, qst_value: i % 3 === 0 ? 4 : 2,
      classes: [1, 3], path: topics[i % topics.length],
      answers: Array.from({length: n}, (_, j) => ({
        txt_text: `Antwortmöglichkeit ${j + 1} für Frage ${i + 1}.`,
        ans_correct: j === 0 ? 1 : 0, ans_image: 0,
      })),
    });
  }
  return JSON.stringify({questions, meta: {checkedAt: Date.UTC(2026, 8, 1), count: questions.length, source: 'synthetic'}});
}

const types = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json'};
const catalog = syntheticCatalog();
const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (path === '/catalog.json') { res.writeHead(200, {'content-type': 'application/json'}); return res.end(catalog); }
  const file = resolve(dist, '.' + (path === '/' ? '/index.html' : path));
  if (!file.startsWith(dist) || !existsSync(file)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, {'content-type': types[extname(file)] || 'application/octet-stream'});
  res.end(await readFile(file));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch();
await rm(outDir, {recursive: true, force: true});
const shots = [];

async function run({theme, dark, full}) {
  const variant = `${theme}-${dark ? 'dunkel' : 'hell'}`;
  const dir = join(outDir, variant);
  await mkdir(dir, {recursive: true});
  const context = await browser.newContext({viewport: {width: 390, height: 844}, deviceScaleFactor: 2, locale: 'de-AT', timezoneId: 'Europe/Vienna', serviceWorkers: 'block', reducedMotion: 'reduce'});
  const page = await context.newPage();
  await page.clock.setFixedTime(new Date('2026-09-01T10:00:00+02:00'));
  await page.addInitScript(({theme, dark}) => {
    let seed = 20260901;
    Math.random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    // Die App misst aktive Antwortzeit mit performance.now. Echte Klickdauer
    // würde Zeitangaben und damit Bilder zwischen zwei Läufen verändern.
    performance.now = () => 0;
    localStorage.setItem('fahrklar', JSON.stringify({
      schema: 1,
      settings: {modules: [1, 3], goal: 30, dark, theme, largeText: false, reduceMotion: true, keepAwake: false, haptics: false, sessionSize: 20, auto: false, sourceEnabled: true},
      attempts: [], sessions: [], bookmarks: [], active: null,
    }));
  }, {theme, dark});

  // Zwei Bilder je Zustand: der sichtbare Bildschirm, wie ihn jemand beim Öffnen
  // sieht, und die ganze Seite. In der ganzen Seite ist die fixierte Navigation
  // ausgeblendet, weil Chromium sie sonst mitten ins Bild setzt.
  const shoot = async name => {
    await page.addStyleTag({content: '#toast{visibility:hidden!important}'});
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({path: join(dir, name + '.png'), animations: 'disabled', caret: 'hide'});
    shots.push(`${variant}/${name}.png`);
    const nav = await page.addStyleTag({content: 'nav{display:none!important}'});
    await page.screenshot({path: join(dir, name + '-ganz.png'), fullPage: true, animations: 'disabled', caret: 'hide'});
    await nav.evaluate(el => el.remove());
    shots.push(`${variant}/${name}-ganz.png`);
  };
  const route = async r => { await page.click(`[data-route="${r}"]`); await page.waitForTimeout(150); };
  const action = async a => { await page.click(`[data-action="${a}"]`); await page.waitForTimeout(150); };

  await page.goto(origin + '/');
  await page.waitForSelector('#app');
  await page.waitForTimeout(400);
  await shoot('01-start');
  if (!full) return context.close();

  for (const [n, r] of [['02-ueben', 'learn'], ['03-pruefung', 'exam'], ['04-fortschritt-leer', 'stats'], ['05-verlauf-leer', 'history'], ['06-einstellungen', 'settings']]) { await route(r); await shoot(n); }

  await route('home');
  await action('quick');
  await shoot('10-lernrunde-frage');
  await page.click('[data-answer="0"]');
  await shoot('11-lernrunde-auswahl');
  await action('answer');
  await shoot('12-lernrunde-aufloesung-a');
  await action('next');
  await page.click('[data-answer="1"]');
  await action('answer');
  await shoot('13-lernrunde-aufloesung-b');
  await action('pause');
  await shoot('14-lernrunde-pause');
  await action('continue');
  await action('abort');
  await page.waitForSelector('dialog[open]');
  await shoot('15-beenden-dialog');
  await page.click('dialog[open] [data-yes]');
  await page.waitForTimeout(300);
  await shoot('16-nach-abbruch');

  await route('stats'); await shoot('20-fortschritt-mit-daten');
  await route('history'); await shoot('21-verlauf-mit-daten');

  await route('exam');
  await action('start-exam');
  await shoot('30-simulation-frage');
  await context.close();
}

const variants = [
  {theme: 'green', dark: false, full: true},
  {theme: 'green', dark: true, full: true},
  {theme: 'blue', dark: false, full: false},
  {theme: 'purple', dark: false, full: false},
  {theme: 'orange', dark: false, full: false},
];
try {
  for (const v of variants) await run(v);
} finally {
  await browser.close();
  server.close();
}

const hash = async f => createHash('sha256').update(await readFile(f)).digest('hex');
const manifest = {};
for (const s of shots) manifest[s] = await hash(join(outDir, s));
await writeFile(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

if (!compare) {
  console.log(`${shots.length} Referenzbilder in tests/ui-baseline geschrieben.`);
} else {
  const before = JSON.parse(await readFile(join(baselineDir, 'manifest.json'), 'utf8'));
  const changed = shots.filter(s => before[s] && before[s] !== manifest[s]);
  const added = shots.filter(s => !before[s]);
  const missing = Object.keys(before).filter(s => !manifest[s]);
  const rows = changed.map(s => `<h2>${s}</h2><div class="pair"><figure><img src="file:///${join(baselineDir, s).replace(/\\/g, '/')}"><figcaption>Referenz</figcaption></figure><figure><img src="file:///${join(outDir, s).replace(/\\/g, '/')}"><figcaption>Jetzt</figcaption></figure></div>`).join('');
  const report = join(outDir, 'bericht.html');
  await writeFile(report, `<!doctype html><meta charset="utf-8"><title>Fahrklar Bildvergleich</title><style>body{font:14px system-ui;margin:24px}.pair{display:flex;gap:16px;flex-wrap:wrap}img{width:390px;border:1px solid #ccc}figure{margin:0}</style><h1>${changed.length} geändert, ${added.length} neu, ${missing.length} fehlen</h1>${rows}`);
  console.log(`Unverändert: ${shots.length - changed.length - added.length}`);
  for (const s of changed) console.log(`Geändert:    ${s}`);
  for (const s of added) console.log(`Neu:         ${s}`);
  for (const s of missing) console.log(`Fehlt:       ${s}`);
  console.log(`Bericht: ${report}`);
  process.exitCode = changed.length || missing.length ? 1 : 0;
}
