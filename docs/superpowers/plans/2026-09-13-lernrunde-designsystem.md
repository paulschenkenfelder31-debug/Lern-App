# Lernrunde als Vollbild und Designsystem – Umsetzungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die Lernrunde zeigt die Frage als Vollbild mit angedocktem Urteil und Hauptknopf, und die ganze Oberfläche nutzt ein einschichtiges Token-System mit geprüftem Kontrast.

**Architecture:** `style.css` bekommt eine Token-Schicht mit neuen Namen; ein Node-Test liest die Datei und prüft Kontrastpaare für alle Themen. `app.js` erhält zwei reine Hilfsfunktionen für die Auflösung und eine neue `session()`-Ausgabe; `render()` setzt `data-register` und die Klasse `in-session`. Der Vergleich mit dem Screenshot-Netz sichert den Rest ab.

**Tech Stack:** Vanilla JS ohne Build, CSS Custom Properties, `node --test`, Playwright 1.58.2 über `scripts/ui-baseline.mjs`.

**Spec:** `docs/superpowers/specs/2026-09-13-lernrunde-designsystem-design.md`

## Global Constraints

* Keine Laufzeitabhängigkeiten, `package.json` bleibt ohne Pakete.
* Keine neue Datei unter `app/src/main/assets/` – die WebView-Whitelist in `MainActivity` kennt genau sieben Dateinamen.
* CSP in `index.html` und WebView-Härtung unverändert.
* Kontrast mindestens 4,5 : 1 für die Paare im Spec, in `theme-green`, `theme-blue`, `theme-purple`, `theme-orange`, jeweils hell und dunkel.
* Keine Schriftgröße unter 12 px in neuen Regeln.
* Oberflächentexte deutsch, du-Ansprache.
* Code-Stil wie im Bestand: kompakte Ein-Zeilen-Funktionen in `app.js`, minifizierte Regeln in `style.css`.
* Tests nur mit synthetischen Inhalten.
* Vor jedem Commit: `node --test tests/*.test.cjs` grün.

---

### Task 1: Kontrasttest und Token-Schicht

**Files:**
- Create: `tests/contrast.test.cjs`
- Modify: `app/src/main/assets/style.css` (Zeilen 1, 12, 18 und Variablenverwendungen in der ganzen Datei)

**Interfaces:**
- Produces: CSS-Tokens `--bg --surface --text --text-muted --line --accent --accent-strong --accent-soft --on-accent --ok --ok-soft --bad --bad-soft --reward --radius`. Entfernte Namen: `--muted --soft --green --greenbg --red --redbg --yellow --accent-dark --purple --accent-light --accent-border --result-bg`.

- [ ] **Step 1: Kontrasttest schreiben**

`tests/contrast.test.cjs`:

```js
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const css=fs.readFileSync('app/src/main/assets/style.css','utf8');
const block=sel=>{const m=css.match(new RegExp('(?:^|[}\\s])'+sel.replace(/\./g,'\\.')+'\\{([^}]*)\\}'));assert.ok(m,'Block fehlt: '+sel);return Object.fromEntries([...m[1].matchAll(/(--[a-z-]+):([^;}]+)/g)].map(x=>[x[1],x[2].trim()]));};
const rgb=h=>{h=h.replace('#','');if(h.length===3)h=[...h].map(c=>c+c).join('');return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255);};
const lum=h=>{const c=rgb(h).map(v=>v<=.03928?v/12.92:((v+.055)/1.055)**2.4);return .2126*c[0]+.7152*c[1]+.0722*c[2];};
const ratio=(a,b)=>{const [x,y]=[lum(a),lum(b)].sort((p,q)=>q-p);return (x+.05)/(y+.05);};
const pairs=[['--text','--bg'],['--text','--surface'],['--text-muted','--bg'],['--text-muted','--surface'],['--on-accent','--accent-strong'],['--accent-strong','--surface'],['--accent-strong','--bg'],['--ok','--ok-soft'],['--bad','--bad-soft']];
test('Style sheet has exactly one token layer without legacy names',()=>{
  assert.equal((css.match(/:root\{/g)||[]).length,1);
  assert.doesNotMatch(css,/(?:^|})\s*\.dark\{/);
  for(const old of ['--muted','--soft','--green','--greenbg','--red','--redbg','--yellow','--accent-dark','--purple','--accent-light','--accent-border','--result-bg'])assert.doesNotMatch(css,new RegExp('var\\('+old+'\\)'),old);
});
for(const theme of ['green','blue','purple','orange'])for(const dark of [false,true])test(`Contrast holds for theme-${theme} ${dark?'dark':'light'}`,()=>{
  const t={...block(':root'),...(dark?block('body.dark'):{}),...block(`body.${dark?'dark.':''}theme-${theme}`)};
  for(const [fg,bg] of pairs){const r=ratio(t[fg],t[bg]);assert.ok(r>=4.5,`${fg} auf ${bg}: ${r.toFixed(2)}`);}
});
```

- [ ] **Step 2: Test laufen lassen, er muss scheitern**

Run: `node --test tests/contrast.test.cjs`
Expected: FAIL. Der erste Test meldet zwei `:root`-Blöcke, die Kontrasttests melden fehlende Tokens wie `--text-muted`.

- [ ] **Step 3: Token-Schicht mit einem einmaligen Skript umstellen**

Skript im Scratchpad ablegen, nicht committen, dann aus dem Repository-Wurzelverzeichnis ausführen:

```js
// migrate-tokens.cjs
const fs=require('fs');const f='app/src/main/assets/style.css';let css=fs.readFileSync(f,'utf8');
const rootNew=':root{--bg:#f6f8fb;--surface:#fff;--text:#263238;--text-muted:#6a7081;--line:#dce4e8;--accent:#159a5b;--accent-strong:#12814c;--accent-soft:#e8f5ef;--on-accent:#fff;--ok:#127a61;--ok-soft:#e5f6ef;--bad:#b43b52;--bad-soft:#fff0f1;--reward:#f2b82c;--radius:20px;color-scheme:light}';
const darkNew='body.dark{--bg:#111a18;--surface:#1d2230;--text:#f3f8f5;--text-muted:#a2abc1;--line:#31463e;--accent:#55d596;--accent-strong:#55d596;--accent-soft:#294946;--on-accent:#10151f;--ok:#70dcba;--ok-soft:#183e36;--bad:#ffa4b1;--bad-soft:#42232c;--reward:#ffd166;color-scheme:dark}';
const themesNew='body.theme-green{--accent:#159a5b;--accent-strong:#12814c;--accent-soft:#e8f5ef}body.theme-blue{--accent:#2878d7;--accent-strong:#2570c8;--accent-soft:#eaf2fb}body.theme-purple{--accent:#7455d4;--accent-strong:#7455d4;--accent-soft:#f1eefb}body.theme-orange{--accent:#d85d24;--accent-strong:#ba501f;--accent-soft:#fbefe9}body.dark.theme-green{--accent:#55d596;--accent-strong:#55d596;--accent-soft:#294946}body.dark.theme-blue{--accent:#72aff4;--accent-strong:#72aff4;--accent-soft:#30415b}body.dark.theme-purple{--accent:#aa92f2;--accent-strong:#aa92f2;--accent-soft:#3c3b5b}body.dark.theme-orange{--accent:#f39568;--accent-strong:#f39568;--accent-soft:#4c3b3c}';
const once=(re,to)=>{assert(re.test(css),re);css=css.replace(re,to);};const assert=(c,m)=>{if(!c)throw Error('nicht gefunden: '+m);};
once(/^:root\{[^}]*\}/,rootNew);
once(/body\.dark\{--bg:[^}]*\}/,darkNew);
const themeRe=/body\.(?:dark\.)?theme-(?:green|blue|purple|orange)\{--accent:[^}]*\}/g;const hits=css.match(themeRe);assert(hits&&hits.length===8,'8 Themenblöcke');
let first=true;css=css.replace(themeRe,()=>{if(first){first=false;return themesNew;}return '';});
once(/:root\{--accent:#20aa68[^}]*\}/,'');
once(/body\{background:#f6f8fb;color:#263238\}/,'');
once(/\.dark\{--accent:#58d99a[^}]*\}/,'');
const map={'--muted':'--text-muted','--soft':'--accent-soft','--greenbg':'--ok-soft','--green':'--ok','--redbg':'--bad-soft','--red':'--bad','--yellow':'--reward','--accent-dark':'--accent-strong','--purple':'--accent','--accent-light':'--accent','--accent-border':'--accent-soft','--result-bg':'--accent-soft'};
for(const [a,b] of Object.entries(map))css=css.split('var('+a+')').join('var('+b+')');
once(/\.primary\{background:var\(--accent\);border-color:var\(--accent\);color:var\(--bg\)\}/,'.primary{background:var(--accent-strong);border-color:var(--accent-strong);color:var(--on-accent)}');
once(/\.primary\{background:var\(--accent\);border-color:var\(--accent-strong\);color:#fff;box-shadow:0 4px 0 var\(--accent-strong\)\}/,'.primary{background:var(--accent-strong);border-color:var(--accent-strong);color:var(--on-accent);box-shadow:0 4px 0 color-mix(in srgb,var(--accent-strong) 70%,#000)}');
once(/\.primary:active\{box-shadow:0 1px 0 var\(--accent-strong\)\}/,'.primary:active{box-shadow:0 1px 0 color-mix(in srgb,var(--accent-strong) 70%,#000)}');
once(/\.chips \.selected\{background:var\(--accent\);color:var\(--bg\);border-color:var\(--accent\)\}/,'.chips .selected{background:var(--accent-strong);color:var(--on-accent);border-color:var(--accent-strong)}');
once(/\.chips \.selected\{background:var\(--accent\);border-color:var\(--accent-strong\);color:#fff\}/,'.chips .selected{background:var(--accent-strong);border-color:var(--accent-strong);color:var(--on-accent)}');
once(/\.text-btn\{border:0;padding:4px 0;color:var\(--accent\)/,'.text-btn{border:0;padding:4px 0;color:var(--accent-strong)');
fs.writeFileSync(f,css);console.log('ok');
```

Run: `node <scratchpad>/migrate-tokens.cjs`
Expected: `ok`. Bei `nicht gefunden: …` abbrechen und die betroffene Regel in `style.css` ansehen, statt das Muster aufzuweichen.

- [ ] **Step 4: Tests laufen lassen**

Run: `node --test tests/*.test.cjs`
Expected: PASS, 45 Tests (36 bestehende, 9 neue).

- [ ] **Step 5: Bildvergleich ansehen**

Run: `node scripts/ui-baseline.mjs --compare`
Expected: Exit-Code 1 mit vielen geänderten Bildern. `bericht.html` öffnen und prüfen: Hauptknöpfe dunkler, Dunkelmodus-Knöpfe mit dunkler Schrift, keine Fläche ohne Farbe, Farbthemen weiter unterscheidbar. Referenz noch **nicht** neu schreiben.

- [ ] **Step 6: Commit**

```bash
git add tests/contrast.test.cjs app/src/main/assets/style.css
git commit -m "Replace layered CSS variables with one contrast-tested token set"
```

---

### Task 2: Auflösung als reine Funktionen

**Files:**
- Modify: `app/src/main/assets/app.js` (neue Funktionen direkt vor `function session(`)
- Test: `tests/controller.test.cjs`

**Interfaces:**
- Produces: `answerLetters(indices:number[]):string`, `answerTag(ans:{correct:boolean}, chosen:boolean):string`, `resolutionText(answers:{correct:boolean}[], selected:number[]):string`

- [ ] **Step 1: Tests anhängen**

Am Ende von `tests/controller.test.cjs`:

```js
test('Resolution names missed and wrongly chosen answers by letter',async()=>{
  const t=await setup();const run=(ans,sel)=>t.run(`resolutionText(${JSON.stringify(ans.map(c=>({correct:c})))},${JSON.stringify(sel)})`);
  assert.equal(run([true,true,false],[0,2]),'B war richtig, C war falsch.');
  assert.equal(run([true,true,true,false],[0,3]),'B und C waren richtig, D war falsch.');
  assert.equal(run([true,true,false],[0]),'B war auch richtig.');
  assert.equal(run([true,false,false,false],[0,1,2]),'B und C waren falsch.');
  assert.equal(run([true,false,false,false],[0,3,1]),'B und D waren falsch.');
  assert.equal(run([true,false],[0]),'');
  assert.equal(t.run('answerLetters([0,1,2])'),'A, B und C');
  assert.equal(t.run("answerTag({correct:true},true)"),'Richtig');
  assert.equal(t.run("answerTag({correct:true},false)"),'Richtig · übersehen');
  assert.equal(t.run("answerTag({correct:false},true)"),'Falsch gewählt');
  assert.equal(t.run("answerTag({correct:false},false)"),'');
});
```

- [ ] **Step 2: Test laufen lassen, er muss scheitern**

Run: `node --test tests/controller.test.cjs`
Expected: FAIL mit `ReferenceError: resolutionText is not defined`.

- [ ] **Step 3: Funktionen einfügen**

Direkt vor `function session(){` in `app.js` als eigene Zeile:

```js
function answerLetters(list){const s=[...list].sort((a,b)=>a-b).map(i=>String.fromCharCode(65+i));return s.length<2?s.join(''):s.slice(0,-1).join(', ')+' und '+s.at(-1);}function answerTag(ans,chosen){return ans.correct?(chosen?'Richtig':'Richtig · übersehen'):(chosen?'Falsch gewählt':'');}function resolutionText(answers,selected){const missed=answers.map((a,i)=>a.correct&&!selected.includes(i)?i:-1).filter(i=>i>=0),wrong=selected.filter(i=>!answers[i].correct),verb=n=>n>1?'waren':'war';if(missed.length&&wrong.length)return `${answerLetters(missed)} ${verb(missed.length)} richtig, ${answerLetters(wrong)} ${verb(wrong.length)} falsch.`;if(missed.length)return `${answerLetters(missed)} ${verb(missed.length)} auch richtig.`;if(wrong.length)return `${answerLetters(wrong)} ${verb(wrong.length)} falsch.`;return '';}
```

- [ ] **Step 4: Tests laufen lassen**

Run: `node --test tests/*.test.cjs`
Expected: PASS, 46 Tests.

- [ ] **Step 5: Commit**

```bash
git add app/src/main/assets/app.js tests/controller.test.cjs
git commit -m "Add letter-based resolution text for answered questions"
```

---

### Task 3: Neue Lernrunde in `session()` und Register in `render()`

**Files:**
- Modify: `app/src/main/assets/app.js` (`function render(` und `function session(`)
- Modify: `app/src/main/assets/icons.js` (Symbol `x` nach `"pause"`)
- Test: `tests/controller.test.cjs` (Stub in `setup()` plus neue Tests)

**Interfaces:**
- Consumes: `answerLetters`, `answerTag`, `resolutionText` aus Task 2.
- Produces: Markup-Klassen `session-bar session-count session-time icon-btn session-meta answer-tag ai-row session-dock verdict xp`; Attribut `data-register` an `#app`; Klasse `in-session` am `body`. Task 4 stylt genau diese Klassen.

- [ ] **Step 1: Stub erweitern und Tests anhängen**

In `setup()` in `tests/controller.test.cjs` den Element-Stub um `dataset:{}` ergänzen:

```js
elements[id]={innerHTML:'',textContent:'',classList:{add(){},remove(){}},dataset:{},hidden:false}
```

Am Ende der Datei:

```js
test('Session renders a slim bar, lettered answers and a docked primary action',async()=>{
  const t=await setup();t.run('startTrain([catalog[0]])');let html=t.elements['#app'].innerHTML;
  assert.equal(t.elements['#app'].dataset.register,'calm');
  assert.match(html,/class="session-bar"/);assert.match(html,/aria-label="Einheit beenden"/);
  assert.match(html,/data-action="pause"[^>]*>.*<span id="timer">/s);
  assert.match(html,/<span class="box">A<\/span>/);assert.match(html,/<span class="box">C<\/span>/);
  assert.match(html,/class="session-dock"/);assert.match(html,/Antwort auswählen/);
  assert.doesNotMatch(html,/Pause machen/);assert.doesNotMatch(html,/#\d+/);
  t.run('selected=[0];render()');assert.match(t.elements['#app'].innerHTML,/Antwort prüfen/);
  t.run('answer()');html=t.elements['#app'].innerHTML;
  assert.match(html,/Noch nicht ganz\./);assert.match(html,/B war auch richtig\./);assert.match(html,/Richtig · übersehen/);
  assert.doesNotMatch(html,/Alle richtigen Antworten/);
  assert.match(html,/<details class="ai-row">/);
  t.run("route='home';render()");assert.equal(t.elements['#app'].dataset.register,'playful');
});
test('Correct answers show XP, wrong choices are named, exams keep a countdown without pause',async()=>{
  const t=await setup();t.run('startTrain([catalog[0],catalog[1]]);selected=[0,1];answer()');let html=t.elements['#app'].innerHTML;
  assert.match(html,/Richtig\./);assert.match(html,/class="xp">\+10 XP/);assert.doesNotMatch(html,/Falsch gewählt/);
  t.run('next();selected=[0,2];answer()');html=t.elements['#app'].innerHTML;
  assert.match(html,/B war richtig, C war falsch\./);assert.match(html,/Falsch gewählt/);
  t.run("finish('aborted');state.settings.modules=[3];startExam()");html=t.elements['#app'].innerHTML;
  assert.doesNotMatch(html,/data-action="pause"/);assert.match(html,/<span id="timer">/);
  assert.match(html,/Ergebnisse und Lösungen erscheinen nach dem Abschluss/);assert.doesNotMatch(html,/data-ai-panel/);
});
test('Pause screen explains the stopped answer time',async()=>{
  const t=await setup();t.run('startTrain([catalog[0]]);actions.pause()');
  assert.match(t.elements['#app'].innerHTML,/zählt nur, solange du eine Frage bearbeitest/);
});
```

- [ ] **Step 2: Tests laufen lassen, sie müssen scheitern**

Run: `node --test tests/controller.test.cjs`
Expected: FAIL, zuerst mit `undefined !== 'calm'` für `dataset.register`.

- [ ] **Step 3: Tastatur- und Selektorverweise prüfen**

Run: `git grep -n -o "#submit\|Pause machen\|Gemerkt" -- app/src/main/assets web scripts`
Expected: Treffer nur in `app/src/main/assets/app.js`. `#submit` darf außerhalb von `session()` vorkommen, etwa für die Eingabetaste – der neue Code in Step 5 behält `id="submit"` am Knopf. Kommt „Pause machen" oder „Gemerkt" außerhalb von `session()` vor, diese Stelle vor Step 5 anpassen.

- [ ] **Step 4: Symbol `x` ergänzen**

In `icons.js` im Objekt `paths` nach dem Eintrag `"pause"` einfügen:

```js
  "x": "<path d=\"M18 6 6 18\" />\n  <path d=\"m6 6 12 12\" />",
```

- [ ] **Step 5: `render()` und `session()` ersetzen**

In `render()` direkt nach `root.classList.add('route-'+route);` einfügen:

```js
root.dataset.register=route==='session'?'calm':'playful';document.body.classList.toggle('in-session',route==='session');
```

Die komplette Zeile `function session(){…}` ersetzen durch:

```js
function session(){const a=state.active;if(!a)return empty('Keine laufende Einheit','Starte eine Lernrunde.');const q=question(),isExam=a.mode==='exam';if(!q)return '';if(paused&&!isExam)return `<div class="card paused"><span class="empty-icon">${icon('pause')}</span><h1>Kurze Pause.</h1><p class="muted">Die aktive Lernzeit steht still. Sie zählt nur, solange du eine Frage bearbeitest.</p><button class="primary" data-action="continue">Weiterlernen ${icon('arrow-right')}</button><button class="text-btn full" data-action="abort">Einheit beenden</button></div>`;const count=isExam?`${esc(C.classes[a.modules[a.moduleIndex].module]||'Modul')} · ${a.groupIndex+1} / 20`:`${a.index+1} / ${a.questions.length}`,time=isExam?duration(Math.max(0,a.deadline-Date.now())):duration(activeTime()),last=a.attempts.at(-1),marked=state.bookmarks.includes(q.id);const bar=`<div class="session-bar"><button class="icon-btn" data-action="abort" aria-label="Einheit beenden">${icon('x')}</button><span class="session-count">${count}</span><progress max="${isExam?20:a.questions.length}" value="${isExam?a.groupIndex:a.index}"></progress>${isExam?`<span class="session-time"><span id="timer">${time}</span></span>`:`<button class="session-time" data-action="pause" aria-label="Pause">${icon('pause')}<span id="timer">${time}</span></button>`}</div>`;const meta=`<div class="session-meta"><span><strong>${esc(q.topic)}</strong> · ${q.points} Punkte${isExam&&a.part==='sub'?' · ZUSATZFRAGE':''}</span><button class="icon-btn" data-action="bookmark" aria-label="Frage merken" aria-pressed="${marked}">${icon('bookmark')}</button></div>`;const answers=q.answers.map((ans,i)=>{const chosen=selected.includes(i),letter=String.fromCharCode(65+i),tag=feedback?answerTag(ans,chosen):'';let cl=chosen?' chosen':'';if(feedback){if(ans.correct)cl+=' correct';else if(chosen)cl+=' wrong';}return `<button class="answer${cl}" data-answer="${i}" aria-pressed="${chosen}" ${feedback?'disabled':''}><span class="box">${letter}</span><span>${esc(ans.text)}${ans.image?`<img src="https://img.f-online.at/${ans.image}.jpg" alt="Abbildung zu Antwort ${letter}" data-essential>`:''}${tag?`<small class="answer-tag">${tag}</small>`:''}</span></button>`;}).join('');const dock=feedback?`<div class="session-dock"><p class="verdict ${last?.correct?'good':'bad'}"><strong>${last?.correct?'Richtig.':'Noch nicht ganz.'}</strong>${last?.correct?'<span class="xp">+10 XP</span>':esc(resolutionText(q.answers,selected))}</p><button class="primary full" data-action="next">${a.index+1===a.questions.length?'Lernrunde abschließen':'Nächste Frage '+icon('arrow-right')}</button></div>`:`<div class="session-dock"><button class="primary full" id="submit" data-action="answer" ${!selected.length?'disabled':''}>${!selected.length?'Antwort auswählen':isExam?'Antwort abgeben '+icon('arrow-right'):'Antwort prüfen'}</button>${isExam?'<p class="tiny muted">Ergebnisse und Lösungen erscheinen nach dem Abschluss.</p>':''}</div>`;return `${bar}${meta}<h1 class="qtitle">${esc(q.text)}</h1>${q.image?`<img class="qimage" src="https://img.f-online.at/${q.image}.jpg" alt="Abbildung zu Frage ${q.id}" data-essential>`:''}${feedback?'':'<p class="tiny muted">Mehrere Antworten können richtig sein.</p>'}${answers}${feedback&&!isExam?`<details class="ai-row"><summary>${icon('sparkles')} Einfach erklärt</summary>${aiPanel(q)}</details>`:''}${dock}`;}
```

- [ ] **Step 6: Tests laufen lassen**

Run: `node --test tests/*.test.cjs`
Expected: PASS, 49 Tests. Bestehende Tests zu Pause, Prüfung und KI bleiben grün.

- [ ] **Step 7: Commit**

```bash
git add app/src/main/assets/app.js app/src/main/assets/icons.js tests/controller.test.cjs
git commit -m "Render the learning round with slim bar, lettered answers and docked actions"
```

---

### Task 4: Ruhiges Register und Stile der Lernrunde

**Files:**
- Modify: `app/src/main/assets/style.css` (Zeile 9, die mit `.route-session{max-width:680px` beginnt)
- Test: `tests/contrast.test.cjs`

**Interfaces:**
- Consumes: Tokens aus Task 1, Klassen und `data-register` aus Task 3.

- [ ] **Step 1: Test für Registerregeln anhängen**

Am Ende von `tests/contrast.test.cjs`:

```js
test('Calm register removes block shadows and legacy session cards',()=>{
  assert.match(css,/\[data-register="calm"\] \.card,\[data-register="calm"\] button,\[data-register="calm"\] \.answer\{box-shadow:none/);
  assert.match(css,/body\.in-session>header\{display:none\}/);
  assert.match(css,/\.session-dock\{position:sticky;bottom:0/);
  assert.doesNotMatch(css,/\.route-session \.card\.good h3::after/);
  for(const m of css.matchAll(/font-size:(\d+)px/g))if(css.slice(Math.max(0,m.index-400),m.index).includes('.session-'))assert.ok(+m[1]>=12,'Schrift unter 12 px in Session-Regel');
});
```

- [ ] **Step 2: Test laufen lassen, er muss scheitern**

Run: `node --test tests/contrast.test.cjs`
Expected: FAIL beim ersten `assert.match`.

- [ ] **Step 3: Zeile 9 ersetzen**

Die gesamte Zeile, die mit `.route-session{max-width:680px;margin:auto}` beginnt, durch diese Zeile ersetzen. Die Regeln für `.route-review`, `.ai-settings-card`, `.ai-test-status` und `@keyframes reward-pop` bleiben mit neuen Tokennamen erhalten:

```css
.route-session{max-width:680px;margin:auto;padding-bottom:0}body.in-session>header{display:none}.session-bar{position:sticky;top:0;z-index:5;display:flex;align-items:center;gap:10px;padding:6px 0;background:var(--bg)}.session-bar progress{flex:1;margin:0;height:6px}.session-count{font-size:14px;font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap}.icon-btn{min-height:44px;min-width:44px;padding:0;display:inline-grid;place-items:center;border:0;background:transparent;box-shadow:none;color:var(--text-muted)}.icon-btn .icon{width:22px;height:22px}.icon-btn[aria-pressed="true"]{color:var(--accent-strong)}.session-time{display:inline-flex;align-items:center;gap:6px;min-height:36px;padding:4px 12px;border:0;border-radius:999px;background:var(--line);color:var(--text);font-size:14px;font-weight:700;font-variant-numeric:tabular-nums;box-shadow:none}.session-meta{display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:14px;color:var(--text-muted)}.session-meta strong{color:var(--text)}.route-session .qtitle{font-size:clamp(22px,5.5vw,28px);line-height:1.3;margin:6px 0 12px}.route-session .answer{min-height:56px;padding:12px 14px;margin:8px 0;background:var(--surface)}.route-session .answer .box{width:28px;height:28px;line-height:24px;border-width:2px;border-radius:8px;font-size:14px;color:var(--text-muted)}.route-session .answer.chosen .box{color:var(--on-accent);background:var(--accent-strong);border-color:var(--accent-strong)}.route-session .answer.correct{border-color:var(--ok);background:var(--ok-soft)}.route-session .answer.correct .box{background:var(--ok);border-color:var(--ok);color:var(--surface)}.route-session .answer.wrong{border-color:var(--bad);background:var(--bad-soft)}.route-session .answer.wrong .box{background:var(--bad);border-color:var(--bad);color:var(--surface)}.route-session .answer:disabled{opacity:1}.answer-tag{display:block;margin-top:4px;font-size:12px;font-weight:700;letter-spacing:.3px;text-transform:uppercase}.answer.correct .answer-tag{color:var(--ok)}.answer.wrong .answer-tag{color:var(--bad)}.ai-row{margin:8px 0 0;border-top:1px solid var(--line)}.ai-row summary{display:flex;align-items:center;gap:8px;color:var(--accent-strong)}.ai-row .card{margin-top:0}.session-dock{position:sticky;bottom:0;z-index:5;margin:12px -22px 0;padding:12px 22px max(12px,env(safe-area-inset-bottom));background:var(--surface);border-top:1px solid var(--line)}.session-dock .primary{min-height:52px;font-size:16px}.session-dock .tiny{margin:8px 0 0;text-align:center;font-size:12px}.route-session .session-dock .primary:disabled{opacity:1;background:var(--line);border-color:var(--line);color:var(--text-muted);box-shadow:none}.verdict{margin:0 0 10px;font-size:14px}.verdict.good,.verdict.bad{background:transparent;color:var(--text)}.verdict strong{margin-right:6px;font-size:18px}.verdict.good strong{color:var(--ok)}.verdict.bad strong{color:var(--bad)}.xp{display:inline-block;padding:2px 8px;border-radius:999px;background:var(--reward);color:#4a3700;font-size:12px;font-weight:800;vertical-align:2px;animation:reward-pop .3s ease-out}.dark .xp{color:#10151f}[data-register="calm"] .card,[data-register="calm"] button,[data-register="calm"] .answer{box-shadow:none;border-width:1.5px}[data-register="calm"] .card,[data-register="calm"] .answer{border-radius:12px}[data-register="calm"] button:active{transform:none}[data-register="calm"] progress::-webkit-progress-value{background:var(--accent)}.route-review>.card.center{border-color:var(--accent);background:linear-gradient(155deg,var(--accent-soft),var(--surface) 62%);box-shadow:0 5px 0 var(--accent-soft);padding:28px 20px}.route-review .score{color:var(--accent-strong);font-size:56px;text-shadow:none}.ai-settings-card{border-color:var(--accent-soft)}.ai-test-status{display:flex;align-items:center;gap:8px;border-radius:12px;padding:12px 14px;background:var(--accent-soft);overflow-wrap:anywhere}.ai-test-status.success{color:var(--accent-strong);font-weight:700}.ai-test-status.notice{margin:12px 0}.ai-test-status .icon{width:20px;height:20px}@keyframes reward-pop{from{opacity:0;transform:scale(.65)}to{opacity:1;transform:scale(1)}}@media(prefers-reduced-motion:reduce){.xp{animation:none}}@media(max-width:360px){.session-dock{margin-inline:-15px;padding-inline:15px}}
```

- [ ] **Step 4: Tests laufen lassen**

Run: `node --test tests/*.test.cjs`
Expected: PASS, 50 Tests.

- [ ] **Step 5: Abnahme im Browser prüfen**

Run: `node scripts/ui-baseline.mjs --compare`, dann in `bericht.html` diese Bilder ansehen: `green-hell/10-lernrunde-frage.png`, `11-lernrunde-auswahl.png`, `12-lernrunde-aufloesung-a.png`, `13-lernrunde-aufloesung-b.png`, `30-simulation-frage.png`, jeweils hell und dunkel.
Expected: kein Markenkopf, Leiste oben, Buchstaben A B C, Hauptknopf im sichtbaren Bildschirm, falsch gewählte Antwort rot, Dunkelmodus-Knopf mit dunkler Schrift. Weicht etwas ab, Regel korrigieren und Schritt wiederholen.

- [ ] **Step 6: Commit**

```bash
git add app/src/main/assets/style.css tests/contrast.test.cjs
git commit -m "Style the calm register and docked learning round"
```

---

### Task 5: Neue Referenzbilder, Abnahmekriterien, Protokoll

**Files:**
- Modify: `tests/ui-baseline/**` (neu erzeugt, nicht committet – offene Absprache)
- Modify: `AGENTS.md` (Abschnitt Designrichtung)
- Create: `docs/log/2026-09-13-david-lernrunde-umsetzung.md`

- [ ] **Step 1: Abnahmekriterien messen**

Skript im Scratchpad als `measure.mjs`, Aufruf aus dem Repository-Wurzelverzeichnis nach `npm run build:web`:

```js
import {createServer} from 'node:http';import {readFile} from 'node:fs/promises';import {existsSync} from 'node:fs';import {extname,resolve} from 'node:path';import {chromium} from 'playwright';
const dist=resolve('dist'),long='Synthetische lange Übungsfrage: '+'Du fährst auf einer Vorrangstraße und näherst dich einer ungeregelten Kreuzung mit Gegenverkehr. '.repeat(3);
const qs=Array.from({length:30},(_,i)=>({qst_id:2000+i,txt_text:long,qst_image:0,qst_sub:0,qst_main:1,qst_value:2,classes:[1,3],path:['Vorrang','Kreuzung'],answers:[0,1,2,3].map(j=>({txt_text:'Synthetische Antwort '+(j+1)+' mit etwas längerem Text, damit sie umbricht.',ans_correct:j===0?1:0,ans_image:0}))}));
const T={'.html':'text/html','.js':'text/javascript','.css':'text/css'};const srv=createServer(async(q,r)=>{const p=new URL(q.url,'http://x').pathname;if(p==='/catalog.json'){r.writeHead(200,{'content-type':'application/json'});return r.end(JSON.stringify({questions:qs,meta:{source:'synthetic'}}));}const f=resolve(dist,'.'+(p==='/'?'/index.html':p));if(!existsSync(f)){r.writeHead(404);return r.end();}r.writeHead(200,{'content-type':T[extname(f)]||'application/octet-stream'});r.end(await readFile(f));});
await new Promise(ok=>srv.listen(0,'127.0.0.1',ok));const b=await chromium.launch();let fail=0;
for(const dark of [false,true]){const c=await b.newContext({viewport:{width:390,height:844},serviceWorkers:'block'}),pg=await c.newPage();
await pg.addInitScript(d=>localStorage.setItem('fahrklar',JSON.stringify({schema:1,settings:{modules:[1,3],goal:30,dark:d,theme:'green',largeText:false,reduceMotion:true,keepAwake:false,haptics:false,sessionSize:20,auto:false,sourceEnabled:true},attempts:[],sessions:[],bookmarks:[],active:null})),dark);
await pg.goto(`http://127.0.0.1:${srv.address().port}/`);await pg.waitForTimeout(400);await pg.click('[data-action="quick"]');
const check=async(label,sel)=>{const r=await pg.$eval(sel,e=>e.getBoundingClientRect().toJSON());const t=await pg.$eval('.qtitle',e=>e.getBoundingClientRect().top);const ok=r.top>=0&&r.bottom<=844&&t<169;if(!ok)fail++;console.log(dark?'dunkel':'hell',label,ok?'OK':'FEHLER',JSON.stringify({knopfOben:Math.round(r.top),knopfUnten:Math.round(r.bottom),frageOben:Math.round(t)}));};
await check('frage','[data-action="answer"]');await pg.click('[data-answer="1"]');await check('auswahl','[data-action="answer"]');await pg.click('[data-action="answer"]');await check('aufloesung-falsch','[data-action="next"]');await c.close();}
await b.close();srv.close();process.exit(fail?1:0);
```

Run: `node <scratchpad>/measure.mjs` – vorher `measure.mjs` ins Repository-Wurzelverzeichnis kopieren, damit `playwright` aus `node_modules` gefunden wird, und danach wieder löschen.
Expected: sechs Zeilen mit `OK`, Exit-Code 0.

- [ ] **Step 2: Referenz neu schreiben**

Run: `node scripts/ui-baseline.mjs` und direkt danach `node scripts/ui-baseline.mjs --compare`
Expected: `70 Referenzbilder …`, danach `Unverändert: 70`.

- [ ] **Step 3: `AGENTS.md` ergänzen**

Im Abschnitt „Designrichtung" nach der Aufzählung der zwei Register einfügen:

```markdown
Technisch setzt `render()` am App-Container `data-register="calm"` für die Lernrunde, sonst `playful`. Neue Regeln für Lernrunde und Prüfung gehören unter `[data-register="calm"]`. Farben nur über die Tokens in der einzigen `:root`-Definition; `tests/contrast.test.cjs` prüft sie für alle Themen.
```

- [ ] **Step 4: Protokoll schreiben**

`docs/log/2026-09-13-david-lernrunde-umsetzung.md` mit den Abschnitten Gemacht, Verifiziert, Entschieden, Offen nach dem Format in `AGENTS.md`. Unter Verifiziert die tatsächlichen Ausgaben aus Task 1 bis Task 5 eintragen.

- [ ] **Step 5: Letzte Prüfung und Commit**

Run: `node --test tests/*.test.cjs` und `git grep -n "var(--purple)\|--accent-dark" -- app`
Expected: alle Tests grün, `git grep` ohne Treffer.

```bash
git add AGENTS.md docs/log/2026-09-13-david-lernrunde-umsetzung.md
git commit -m "Document calm register and log the learning round rollout"
```
