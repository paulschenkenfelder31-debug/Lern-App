const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const Icons=require('../app/src/main/assets/icons.js');
const C=require('../app/src/main/assets/core.js');
function fixture(){const qs=[];for(let n=1;n<=25;n++){for(const sub of [false,true])qs.push({qst_id:n+(sub?100:0),txt_text:'Synthetische Frage '+n,qst_main:sub?0:1,qst_sub:sub?null:n+100,qst_value:sub?2:3,classes:[3],path:['Test'],answers:[{txt_text:'Richtig A',ans_correct:1},{txt_text:'Richtig B',ans_correct:1},{txt_text:'Falsch',ans_correct:0}]});}return qs;}
async function setup(nativeBridge=null){const elements={};for(const id of ['#app','#nav','#toast','#timer'])elements[id]={innerHTML:'',textContent:'',classList:{add(){},remove(){}},hidden:false};const storage=new Map();let clock=100;
const context=vm.createContext({...(nativeBridge?{Native:nativeBridge}:{}),Core:C,Icons,console,Date,Math,Map,Set,JSON,Number,String,Array,Promise,Error,document:{querySelector:s=>elements[s]||null,querySelectorAll:()=>[],addEventListener(){},body:{classList:{toggle(){}}},hidden:false},window:{scrollTo(){}},performance:{now:()=>clock},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},fetch:async()=>({ok:true,json:async()=>({questions:fixture(),meta:{hash:'test',checkedAt:Date.now()}})}),setInterval(){},setTimeout(){},clearTimeout(){}});
vm.runInContext(fs.readFileSync('app/src/main/assets/app.js','utf8'),context);await new Promise(resolve=>setImmediate(resolve));return {run:src=>vm.runInContext(src,context),advance:ms=>clock+=ms,elements,storage};}
test('Every primary route renders with synthetic catalog and empty local history',async()=>{const t=await setup();for(const route of ['home','learn','exam','stats','history','settings']){t.run(`route='${route}';render()`);assert.ok(t.elements['#app'].innerHTML.length>100,route);assert.ok(!t.elements['#app'].innerHTML.includes('NaN'),route);}});
test('Training saves exactly one answer, feedback does not add time, review persists',async()=>{const t=await setup();t.run('startTrain([catalog[0]])');t.advance(10000);t.run('selected=[0,1];answer()');assert.equal(t.run('state.attempts.length'),1);assert.equal(t.run('feedback'),true);t.advance(60000);t.run('answer();next()');assert.equal(t.run('state.attempts.length'),1);assert.equal(t.run('state.attempts[0].ms'),10000);assert.equal(t.run('state.sessions[0].status'),'finished');assert.equal(t.run('state.active'),null);assert.equal(t.run('route'),'review');assert.ok(t.storage.get('fahrklar').includes('"schema":1'));});
test('Full simulation grades all 20 main/follow-up pairs at 100 points',async()=>{const t=await setup();t.run('state.settings.modules=[3];startExam()');for(let i=0;i<40;i++){t.advance(5000);t.run('selected=[0,1];answer()');}assert.equal(t.run('state.active'),null);assert.equal(t.run('state.sessions[0].modules[0].earned'),100);assert.equal(t.run('state.sessions[0].modules[0].max'),100);assert.equal(t.run('state.attempts.length'),40);assert.ok(t.elements['#app'].innerHTML.includes('100 / 100'));});
test('Wrong main skips follow-up, timeout completes remaining questions without inflating answered count',async()=>{const t=await setup();t.run('state.settings.modules=[3];startExam()');t.advance(10000);t.run('selected=[2];answer()');assert.equal(t.run('state.attempts.length'),2);assert.equal(t.run('state.attempts[1].skipped'),true);t.run('state.active.deadline=Date.now()-1;expireModule()');assert.equal(t.run('state.active'),null);assert.equal(t.run('state.sessions[0].modules[0].earned'),0);assert.equal(t.run('state.attempts.filter(a=>!a.skipped).length'),1);assert.equal(t.run('state.attempts.length'),40);});
test('Paused time is excluded from active answer speed',async()=>{const t=await setup();t.run('startTrain([catalog[0]])');t.advance(3000);t.run('actions.pause()');t.advance(90000);t.run('actions.continue()');t.advance(2000);t.run('selected=[0,1];answer()');assert.equal(t.run('state.attempts[0].ms'),5000);});
test('Generated backup passes validation, malformed nested history is rejected',async()=>{const t=await setup();t.run('startTrain([catalog[0]]);selected=[0,1];answer();next()');const data=JSON.parse(t.run('JSON.stringify(state)'));assert.equal(C.validateBackup(data).sessions.length,1);data.sessions[0].attempts[0].answers[0].text={bad:true};assert.throws(()=>C.validateBackup(data));});
test('Empty catalog routes lead to download instead of disabled learning controls',async()=>{const t=await setup();t.run('catalog=[]');for(const route of ['home','learn','exam']){t.run(`route='${route}';render()`);const html=t.elements['#app'].innerHTML;assert.match(html,/Fragen herunterladen/);assert.doesNotMatch(html,/data-action="(?:quick|start-exam|start-filtered)"/);assert.match(html,/<svg/);}});
test('Download progress disables retries; errors allow retry without losing saved questions',async()=>{const t=await setup();const count=t.run('catalog.length');await t.run("window.nativeEvent('sync','Fragenkatalog wird geladen …')");assert.match(t.elements['#app'].innerHTML,/data-action="sync" disabled/);await t.run("window.nativeEvent('error','Verbindung unterbrochen')");assert.match(t.elements['#app'].innerHTML,/Erneut versuchen/);assert.match(t.elements['#app'].innerHTML,/gespeicherten Fragen bleiben nutzbar/);assert.equal(t.run('catalog.length'),count);assert.equal(t.run('transferBusy'),false);});
test('Successful first download unlocks learning and clears the loading state',async()=>{const t=await setup();t.run("catalog=[];downloadState={phase:'loading',message:''};transferBusy=true;render()");await t.run("window.nativeEvent('updated','Fragenkatalog gespeichert')");assert.match(t.elements['#app'].innerHTML,/Lernrunde starten/);assert.equal(t.run('transferBusy'),false);assert.equal(t.run('downloadState.phase'),'idle');});

test('Learning and statistics use topic picker and button filters rather than native dropdowns',async()=>{
  const t=await setup();
  for(const r of ['learn','stats']){t.run(`route='${r}';render()`);assert.doesNotMatch(t.elements['#app'].innerHTML,/<select/);}
  t.run("route='learn';render()");assert.match(t.elements['#app'].innerHTML,/data-action="topics"/);
  t.run("route='stats';render()");assert.match(t.elements['#app'].innerHTML,/data-period="30"/);
});
test('Wrong training answers return after intervening questions once, and persist in backup state',async()=>{
  const t=await setup();t.run('startTrain(catalog.slice(0,5))');const id=t.run('question().id');
  t.advance(5000);t.run('selected=[2];answer()');
  assert.equal(t.run('state.active.questions.length'),6);
  assert.equal(t.run('state.active.questions[4].id'),id);
  assert.equal(JSON.parse(t.storage.get('fahrklar')).active.questions.length,6);
  t.run('next()');
  for(let i=0;i<3;i++){t.advance(1000);t.run('selected=[0,1];answer();next()');}
  assert.equal(t.run('question().id'),id);
  t.run('selected=[2];answer();next();selected=[0,1];answer();next()');
  assert.equal(t.run('state.active'),null);
  assert.equal(t.run(`state.attempts.filter(a=>a.id===${id}).length`),2);
  assert.equal(t.run('state.sessions[0].attempts.length'),6);
});
test('App update errors are separate from question downloads and never erase history',async()=>{
  const t=await setup();t.run("route='settings';transferBusy=true;downloadState={phase:'loading',message:''};render()");
  await t.run(`window.nativeEvent('app-update','{"available":true,"message":"Version 1.0.9 verfügbar"}')`);
  assert.match(t.elements['#app'].innerHTML,/data-action="open-update"/);
  await t.run("window.nativeEvent('app-update-error','Offline')");
  assert.doesNotMatch(t.elements['#app'].innerHTML,/data-action="open-update"/);
  assert.equal(t.run('transferBusy'),true);assert.equal(t.run('downloadState.phase'),'loading');
});
function aiBridge(calls){return {loadState:()=> '{}',saveState:()=>true,hasGeminiKey:()=>true,appInfo:()=> '{"version":"test","stable":false}',explainQuestion:(id,json)=>calls.push({id,json}),testGemini:()=>calls.push({test:true}),configureGemini(){}};}
test('AI is unavailable before answering and throughout an exam; request sends only the question',async()=>{
  const calls=[],t=await setup(aiBridge(calls));t.run('startTrain([catalog[0]])');
  t.run('requestAi(aiQuestionKey(question()))');assert.equal(calls.length,0);
  t.run('selected=[0,1];answer();requestAi(aiQuestionKey(question()))');assert.equal(calls.length,1);
  assert.deepEqual(Object.keys(JSON.parse(calls[0].json)).sort(),['answers','image','text']);
  t.run('requestAi(aiQuestionKey(question()))');assert.equal(calls.length,1);
  t.run("finish('finished');state.settings.modules=[3];startExam();requestAi(aiQuestionKey(question()))");
  assert.equal(calls.length,1);assert.doesNotMatch(t.elements['#app'].innerHTML,/data-ai-panel/);
});
test('AI results are escaped, correlated by request, cached and excluded from backups',async()=>{
  const calls=[],t=await setup(aiBridge(calls));t.run('startTrain([catalog[0]]);selected=[0,1];answer();requestAi(aiQuestionKey(question()))');
  await t.run(`window.nativeEvent('ai-result',${JSON.stringify(JSON.stringify({id:'wrong-request',text:'wrong'}))})`);
  assert.equal(t.run('aiCache.size'),0);
  const result=JSON.stringify({id:calls[0].id,text:'<script>unsafe()</script>'});
  await t.run(`window.nativeEvent('ai-result',${JSON.stringify(result)})`);
  assert.match(t.run('aiPanel(question())'),/&lt;script&gt;/);
  assert.doesNotMatch(t.run('JSON.stringify(state)'),/unsafe/);
  t.run('requestAi(aiQuestionKey(question()))');assert.equal(calls.length,1);
});
test('Gemini connection test is explicit and reports success or an escaped API error',async()=>{
  const calls=[],t=await setup(aiBridge(calls));t.run("route='settings';render();actions['ai-test']()");
  assert.deepEqual(calls,[{test:true}]);assert.match(t.elements['#app'].innerHTML,/Verbindung wird geprüft/);
  await t.run("window.nativeEvent('ai-test-error','HTTP 403 <ungültig>')");
  assert.match(t.elements['#app'].innerHTML,/HTTP 403 &lt;ungültig&gt;/);assert.doesNotMatch(t.elements['#app'].innerHTML,/<ungültig>/);
  await t.run("window.nativeEvent('ai-test','Verbindung erfolgreich.')");
  assert.match(t.elements['#app'].innerHTML,/Verbindung erfolgreich/);
});
test('Playful home exposes a learning path with deterministic XP and non-blocking focus',async()=>{
  const t=await setup();t.run('state.attempts=[];state.sessions=[];rebuildProgress();route="home";render()');
  let html=t.elements['#app'].innerHTML;assert.match(html,/DEIN LERNPFAD/);assert.match(html,/Adaptive Lernrunde/);assert.match(html,/0<\/strong><small>XP/);assert.match(html,/5\/5<\/strong><small>Fokus/);
  t.run('startTrain([catalog[0]]);selected=[0,1];answer();next();route="home";render()');html=t.elements['#app'].innerHTML;
  assert.match(html,/10<\/strong><small>XP/);assert.match(html,/TAGESAUFGABE/);
});
