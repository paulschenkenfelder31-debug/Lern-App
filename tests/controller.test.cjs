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
test('Settings offers four persistent single-accent color themes',async()=>{const t=await setup();t.run("route='settings';render()");let html=t.elements['#app'].innerHTML;for(const name of ['green','blue','purple','orange'])assert.match(html,new RegExp('data-theme="'+name+'"'));t.run("state.settings.theme='blue';save();render()");html=t.elements['#app'].innerHTML;assert.match(html,/data-theme="blue" class="theme-option selected"/);assert.equal(JSON.parse(t.storage.get('fahrklar')).settings.theme,'blue');});
test('Settings groups services and offers readable comfort controls',async()=>{const t=await setup();t.run("route='settings';render()");const html=t.elements['#app'].innerHTML;assert.match(html,/Alles an einem Ort/);assert.match(html,/Größere Schrift/);assert.match(html,/Animationen reduzieren/);assert.match(html,/Bildschirm beim Lernen aktiv halten/);assert.match(html,/data-session-size="10"/);assert.match(html,/data-session-size="5"/);});
test('Configured round length controls adaptive and filtered training',async()=>{const t=await setup();t.run('state.settings.sessionSize=10;actions.quick()');assert.equal(t.run('state.active.questions.length'),10);t.run("finish('aborted');route='learn';filter='all';actions['start-filtered']()");assert.equal(t.run('state.active.questions.length'),10);});
test('Training saves exactly one answer, feedback does not add time, review persists',async()=>{const t=await setup();t.run('startTrain([catalog[0]])');t.advance(10000);t.run('selected=[0,1];answer()');assert.equal(t.run('state.attempts.length'),1);assert.equal(t.run('feedback'),true);t.advance(60000);t.run('answer();next()');assert.equal(t.run('state.attempts.length'),1);assert.equal(t.run('state.attempts[0].ms'),10000);assert.equal(t.run('state.sessions[0].status'),'finished');assert.equal(t.run('state.active'),null);assert.equal(t.run('route'),'review');assert.ok(t.storage.get('fahrklar').includes('"schema":1'));});
test('Full simulation grades all 20 main/follow-up pairs at 100 points',async()=>{const t=await setup();t.run('state.settings.modules=[3];startExam()');for(let i=0;i<40;i++){t.advance(5000);t.run('selected=[0,1];answer()');}assert.equal(t.run('state.active'),null);assert.equal(t.run('state.sessions[0].modules[0].earned'),100);assert.equal(t.run('state.sessions[0].modules[0].max'),100);assert.equal(t.run('state.attempts.length'),40);assert.ok(t.elements['#app'].innerHTML.includes('100 / 100'));});
test('Wrong main skips follow-up, timeout completes remaining questions without inflating answered count',async()=>{const t=await setup();t.run('state.settings.modules=[3];startExam()');t.advance(10000);t.run('selected=[2];answer()');assert.equal(t.run('state.attempts.length'),2);assert.equal(t.run('state.attempts[1].skipped'),true);t.run('state.active.deadline=Date.now()-1;expireModule()');assert.equal(t.run('state.active'),null);assert.equal(t.run('state.sessions[0].modules[0].earned'),0);assert.equal(t.run('state.attempts.filter(a=>!a.skipped).length'),1);assert.equal(t.run('state.attempts.length'),40);});
test('Paused time is excluded from active answer speed',async()=>{const t=await setup();t.run('startTrain([catalog[0]])');t.advance(3000);t.run('actions.pause()');t.advance(90000);t.run('actions.continue()');t.advance(2000);t.run('selected=[0,1];answer()');assert.equal(t.run('state.attempts[0].ms'),5000);});
test('Generated backup passes validation, malformed nested history is rejected',async()=>{const t=await setup();t.run('startTrain([catalog[0]]);selected=[0,1];answer();next()');const data=JSON.parse(t.run('JSON.stringify(state)'));assert.equal(C.validateBackup(data).sessions.length,1);data.sessions[0].attempts[0].answers[0].text={bad:true};assert.throws(()=>C.validateBackup(data));});
test('Empty catalog routes lead to download instead of disabled learning controls',async()=>{const t=await setup();t.run('catalog=[]');for(const route of ['home','learn','exam']){t.run(`route='${route}';render()`);const html=t.elements['#app'].innerHTML;assert.match(html,/Fragen herunterladen/);assert.doesNotMatch(html,/data-action="(?:quick|start-exam|start-filtered)"/);assert.match(html,/<svg/);}});
test('First start guides through licence selection, download and learning without empty navigation',async()=>{
  const t=await setup();t.run('catalog=[];route="home";render()');const html=t.elements['#app'].innerHTML;
  assert.match(html,/SCHRITT 1 VON 3/);assert.match(html,/SCHRITT 2 VON 3/);assert.match(html,/SCHRITT 3 VON 3/);
  assert.match(html,/data-module="1"[^>]*class="license-card selected"/);
  assert.match(html,/data-module="3"/);assert.match(html,/Fragen herunterladen/);assert.equal(t.elements['#nav'].hidden,true);
  t.run('catalog=Core.normalize('+JSON.stringify(fixture())+');render()');assert.equal(t.elements['#nav'].hidden,false);
});
test('Download progress disables retries; errors allow retry without losing saved questions',async()=>{const t=await setup();const count=t.run('catalog.length');await t.run("window.nativeEvent('sync','Fragenkatalog wird geladen …')");assert.match(t.elements['#app'].innerHTML,/data-action="sync" disabled/);await t.run("window.nativeEvent('error','Verbindung unterbrochen')");assert.match(t.elements['#app'].innerHTML,/Erneut versuchen/);assert.match(t.elements['#app'].innerHTML,/gespeicherten Fragen bleiben nutzbar/);assert.equal(t.run('catalog.length'),count);assert.equal(t.run('transferBusy'),false);});
test('Successful first download unlocks learning and clears the loading state',async()=>{const t=await setup();t.run("catalog=[];downloadState={phase:'loading',message:''};transferBusy=true;render()");await t.run("window.nativeEvent('updated','Fragenkatalog gespeichert')");assert.match(t.elements['#app'].innerHTML,/Etappe starten/);assert.equal(t.run('transferBusy'),false);assert.equal(t.run('downloadState.phase'),'idle');});

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
function comfortBridge(calls){return {...aiBridge([]),setKeepAwake:value=>calls.push(['awake',value]),feedback:kind=>calls.push(['feedback',kind])};}
test('Learning keeps the screen awake and provides optional haptic feedback',async()=>{const calls=[],t=await setup(comfortBridge(calls));t.run('state.settings.haptics=true;state.settings.keepAwake=true;startTrain([catalog[0]])');assert.ok(calls.some(x=>x[0]==='awake'&&x[1]===true));t.run('selected=[0,1];answer()');assert.ok(calls.some(x=>x[0]==='feedback'&&x[1]==='correct'));t.run('next()');assert.ok(calls.some(x=>x[0]==='awake'&&x[1]===false));});
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
test('Daily home provides a finite recommendation and removes mistake penalties',async()=>{
 const t=await setup();t.run('route="home";render()');let html=t.elements['#app'].innerHTML;
 assert.match(html,/Deine heutige Etappe/);assert.match(html,/Etappe starten/);assert.match(html,/Stabil gelernt/);assert.doesNotMatch(html,/Fokus|Herzen/);
 t.run('startTrain([catalog[0]]);selected=[0,1];answer();next();route="home";render()');html=t.elements['#app'].innerHTML;assert.equal(t.run('C.learningXp(state.attempts)'),10);
});
test('Review plan shows the next appointment and offers due mistakes immediately',async()=>{
  const t=await setup();
  let plan=t.run('reviewOverview([catalog[0]])');assert.equal(plan.due.length,0);assert.equal(plan.nextAt,null);assert.equal(plan.nextLabel,'Noch keine Wiederholung geplant');
  t.run('startTrain([catalog[0]]);selected=[2];answer();state.attempts[0].at=Date.now()-25*60*60*1000;rebuildProgress();route="learn";render()');
  const html=t.elements['#app'].innerHTML;assert.match(html,/1 fällig/);assert.match(html,/1 Fragen jetzt wiederholen/);assert.match(html,/Jetzt bereit/);
  plan=t.run('reviewOverview([catalog[0]])');assert.equal(plan.due.length,1);assert.equal(plan.wrong,1);
});

test('A short round defers a wrong answer instead of immediately repeating it',async()=>{
 const t=await setup();t.run('startTrain([catalog[0]]);selected=[2];answer()');assert.equal(t.run('state.active.questions.length'),1);assert.equal(t.run('progress(catalog[0]).state'),'learning');assert.ok(t.run('progress(catalog[0]).nextReview-state.attempts[0].at')>=86400000);t.run('next()');assert.equal(t.run('state.active'),null);
});
test('Completed exams update learning only after finish; aborted exams do not',async()=>{
 const t=await setup();t.run('state.settings.modules=[3];startExam()');const id=t.run('question().id');t.run('selected=[0,1];answer()');assert.equal(t.run(`C.progress(catalog.find(q=>q.id===${id}),state.attempts).seen`),false);t.run("finish('finished')");assert.equal(t.run(`C.progress(catalog.find(q=>q.id===${id}),state.attempts).seen`),true);assert.equal(t.run('state.attempts[0].examStatus'),'finished');
 const u=await setup();u.run('state.settings.modules=[3];startExam();selected=[2];answer()');u.run("finish('aborted')");assert.equal(u.run('C.progress(catalog.find(q=>q.id===state.attempts[0].id),state.attempts).seen'),false);
});
test('Optional guessed reporting persists without changing grading or snapshots',async()=>{
 const t=await setup();t.run('startTrain([catalog[0]]);selected=[0,1];answer();confidence(true)');assert.equal(t.run('state.attempts[0].correct'),true);assert.equal(t.run('state.attempts[0].guessed'),true);assert.equal(t.run('state.active.attempts[0].guessed'),true);assert.equal(t.run('progress(catalog[0]).state'),'learning');assert.equal(t.run('C.learningXp(state.attempts)'),0);assert.deepEqual(JSON.parse(t.run('JSON.stringify(state.attempts[0].selected)')),[0,1]);
});
test('Viewing help before a new attempt is recorded as assistance, after-answer feedback is not retroactive',async()=>{
 const t=await setup();t.run('markHelpViewed(aiQuestionKey(catalog[0]));startTrain([catalog[0]]);selected=[0,1];answer()');assert.equal(t.run('state.attempts[0].assisted'),true);assert.equal(t.run('progress(catalog[0]).lastIndependent'),null);
 const u=await setup();u.run('startTrain([catalog[0]]);selected=[0,1];answer()');assert.equal(u.run('state.attempts[0].assisted'),false);assert.equal(u.run('progress(catalog[0]).independentDates.length'),1);
});
test('An incoming cloud snapshot preserves answers submitted locally while sync was in flight',async()=>{
 const t=await setup();t.run('startTrain([catalog[0]]);const oldSync=JSON.stringify(state);selected=[0,1];answer();window.cloudEvent("synced",JSON.stringify({state:JSON.parse(oldSync)}))');assert.equal(t.run('state.active.attempts.length'),1);assert.equal(t.run('state.attempts.length'),1);assert.equal(t.run('state.active.feedback'),true);assert.equal(t.run('progress(catalog[0]).seen'),true);
});
