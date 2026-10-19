const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const C=require(process.cwd()+'/app/src/main/assets/core.js');
const raw=Array.from({length:60},(_,i)=>({qst_id:i+1,txt_text:i===0?'Synthetische Übungsfrage: Welche der folgenden Aussagen trifft für dieses Beispiel zu?':'Synthetische Übungsfrage '+(i+1)+': Welche Aussagen passen zum beschriebenen Beispiel?',qst_image:null,qst_main:1,qst_sub:null,qst_value:3,classes:[1,3],path:[['Verkehrsregeln','Verkehrszeichen','Sicherheit','Fahrzeugtechnik','Verhalten im Verkehr'][i%5],['Grundlagen','Vertiefung'][i%2]],answers:[{txt_text:'Diese synthetische Aussage ist im Beispiel richtig.',ans_correct:1},{txt_text:'Auch diese synthetische Aussage gehört zur vollständigen Lösung.',ans_correct:1},{txt_text:'Diese Aussage ist nur eine falsche synthetische Antwortoption.',ans_correct:0}]}));
const now=Date.now(),qs=C.normalize(raw);
const attempts=qs.slice(0,25).flatMap((q,i)=>[0,1,4,11].map((d,j)=>({...q,at:now-(32-d)*86400000,correct:i%4!==0||j!==3,ms:12000+i*350,selected:i%4===0&&j===3?[2]:[0,1],sessionId:'demo-'+j,attemptId:'demo-'+q.id+'-'+j,mode:'train',learningSchema:2,recallDay:C.recallDay(now-(32-d)*86400000),guessed:false,retry:false,assisted:false})));
const sessions=Array.from({length:4},(_,j)=>({id:'demo-'+j,mode:'train',status:j===3?'aborted':'finished',started:now-(32-[0,1,4,11][j])*86400000,ended:now-(32-[0,1,4,11][j])*86400000+400000,attempts:attempts.filter(a=>a.sessionId==='demo-'+j),modules:[1,3]}));
const base={schema:1,settings:{modules:[1,3],goal:20,dark:true,theme:'neutral',sourceEnabled:true,auto:false,sessionSize:10},attempts,sessions,bookmarks:[2,4],active:null};
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),args:process.env.FAHRKLAR_SINGLE_PROCESS?['--no-sandbox','--single-process','--no-zygote']:[]});
 const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.route('http://127.0.0.1:8765/**',r=>{const name=new URL(r.request().url()).pathname.slice(1)||'index.html';const file=path.join(process.cwd(),'dist',name);return fs.existsSync(file)?r.fulfill({body:fs.readFileSync(file),contentType:name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':name.endsWith('.html')?'text/html':'application/octet-stream'}):r.fulfill({status:404,body:''});});
 await page.route('**/catalog.json',r=>r.fulfill({json:{questions:raw,meta:{checkedAt:now,hash:'synthetic'}}}));
 await page.route('**/firebase-config.js',r=>r.fulfill({body:'window.FahrklarFirebaseConfig={enabled:false};',contentType:'text/javascript'}));
 await page.addInitScript(({seed,raw})=>{localStorage.setItem('fahrklar',JSON.stringify(seed));window.syntheticCatalog=raw;},{seed:base,raw});
 await page.goto('http://127.0.0.1:8765/');await page.waitForSelector('[data-action="quick"]');
 const out=path.join(process.cwd(),'docs/screenshots');fs.mkdirSync(out,{recursive:true});
 let checks=0;
 for(const width of [360,390,768,1440])for(const dark of [true,false])for(const large of [false,true]){
  await page.setViewportSize({width,height:1000});
  for(const route of ['home','learn','exam','stats','history','settings']){
   await page.evaluate(({route:next,dark,large})=>{route=next;state.settings.dark=dark;state.settings.largeText=large;render();}, {route,dark,large});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`overflow: ${width} ${dark} ${large} ${route}`);checks++;
   if(!large&&(width===390||width===1440)&&['home','learn','stats','settings'].includes(route))await page.screenshot({path:path.join(out,`${width===390?'mobile':'desktop'}-${dark?'dark':'light'}-${route}.png`),fullPage:false,animations:'disabled'});
  }
 }
 await page.setViewportSize({width:390,height:844});
 await page.evaluate(()=>{state.settings.dark=true;state.settings.largeText=false;route='learn';render();});
 await page.click('[data-action="topics"]');assert.equal(await page.locator('dialog').isVisible(),true);await page.fill('#topic-search','verkehr');await page.screenshot({path:path.join(out,'mobile-dark-topics.png'),animations:'disabled'});await page.click('[data-close]');
 await page.click('[data-action="start-filtered"]');assert.equal(await page.locator('#nav').isVisible(),false);await page.screenshot({path:path.join(out,'mobile-dark-question.png'),fullPage:true,animations:'disabled'});
 await page.click('[data-answer="0"]');await page.click('[data-answer="1"]');await page.click('#submit');await page.screenshot({path:path.join(out,'mobile-dark-feedback.png'),fullPage:true,animations:'disabled'});
 assert.equal(await page.locator('[data-ai-panel]').count(),1);await page.click('[data-action="pause"]');await page.click('[data-action="continue"]');
 await page.evaluate(()=>finish('aborted'));await page.screenshot({path:path.join(out,'mobile-dark-result.png'),fullPage:true,animations:'disabled'});
 await page.evaluate(()=>{state.settings.modules=[3];startExam();});assert.equal(await page.locator('[data-ai-panel]').count(),0);assert.equal(await page.locator('#nav').isVisible(),false);await page.screenshot({path:path.join(out,'mobile-dark-exam.png'),fullPage:true,animations:'disabled'});
 await page.evaluate(()=>{state.active.deadline=Date.now()-1;expireModule();});
 await page.evaluate(()=>{catalog=[];route='home';render();document.querySelector('#toast').classList.remove('show');});assert.equal(await page.locator('#nav').isVisible(),false);await page.screenshot({path:path.join(out,'mobile-dark-setup.png'),fullPage:true,animations:'disabled'});
 await page.evaluate(()=>{downloadState={phase:'error',message:'Synthetischer Test: Keine Verbindung.'};render();});assert.equal(await page.getByText('Erneut versuchen').count(),1);
 await page.evaluate(()=>{downloadState={phase:'loading',message:''};transferBusy=true;render();});assert.equal(await page.locator('[data-action="sync"]').isDisabled(),true);
 await page.evaluate(()=>{downloadState={phase:'idle'};transferBusy=false;state.settings.modules=[3];catalog=Core.normalize(window.syntheticCatalog);route='settings';render();accountDialog('signin');});
 assert.equal(await page.locator('.account-dialog').isVisible(),true);await page.keyboard.press('Escape');
 await page.evaluate(()=>{route='home';render();});await page.keyboard.press('Tab');
 assert.equal(await page.evaluate(()=>getComputedStyle(document.activeElement).outlineStyle),'solid');
 await page.setViewportSize({width:1440,height:1000});await page.click('[data-action="sidebar"]');assert.equal(await page.locator('[data-action="sidebar"]').getAttribute('aria-expanded'),'false');await page.click('[data-action="sidebar"]');
 await page.route('**/999999.jpg',r=>r.fulfill({status:404,body:''}));
 await page.evaluate(()=>{const question={...catalog[0],image:999999};startTrain([question]);});await page.waitForSelector('.image-error');await page.click('[data-answer="0"]');assert.equal(await page.locator('#submit').isDisabled(),true);assert.equal(await page.evaluate(()=>state.active.attempts.length),0);await page.evaluate(()=>finish('aborted'));
 await page.evaluate(()=>{catalog=[];route='home';downloadState={phase:'loading'};transferBusy=true;render();});
 await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('.download-status .icon').evaluate(e=>getComputedStyle(e).animationName),'none');
 assert.deepEqual(errors,[]);await browser.close();console.log(`UI smoke: ${checks} responsive/theme/text/route combinations passed; topic dialog, training, pause, feedback, exam, setup, error/loading, keyboard focus, sidebar, account dialog, missing-image safeguards and reduced-motion checks passed.`);
})().catch(e=>{console.error(e);process.exit(1);});
