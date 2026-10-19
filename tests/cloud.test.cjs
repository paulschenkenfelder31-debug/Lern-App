const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

test('Cloud client exposes optional account actions without Analytics',()=>{
  const source=fs.readFileSync('app/src/main/assets/cloud.js','utf8');
  const window={FahrklarFirebaseConfig:{enabled:true,projectId:'test'}};
  vm.runInNewContext(source,{window,globalThis:window,localStorage:{getItem(){return null;},setItem(){},removeItem(){}},fetch(){throw Error('not called');},URLSearchParams,JSON,Date,Promise,Set,Map,encodeURIComponent,String,Number,Error,TypeError});
  for(const name of ['init','signUp','signIn','signOut','resend','verify','resetPassword','sync','deleteAccount'])assert.equal(typeof window.CloudSync[name],'function');
  assert.doesNotMatch(source,/getAnalytics|firebase\/analytics/);
});

test('Firestore rules require owner and verified email',()=>{
  const rules=fs.readFileSync('firestore.rules','utf8');
  assert.match(rules,/request\.auth\.uid == uid/);
  assert.match(rules,/email_verified == true/);
  assert.match(rules,/allow read, write: if false/);
});

test('Cloud sync merges completed sessions, active attempts and help evidence deterministically',async()=>{
 const Core=require('../app/src/main/assets/core.js'),events=[],store=new Map(),writes=[];
 store.set('fahrklar-auth-test',JSON.stringify({localId:'owner',idToken:'synthetic-token',refreshToken:'synthetic-refresh',email:'test@example.invalid',verified:true,expiresAt:Date.now()+3600000}));
 const answer={id:1,version:'v',at:100,attemptId:'s:0',correct:true,ms:10,selected:[0],learningSchema:2},s={id:'s',started:100,ended:200,status:'finished',mode:'train',attempts:[answer],modules:[3]},local={schema:1,settings:{modules:[3],sessionSize:20},sessions:[s],attempts:[answer,{...answer,attemptId:'active:0',sessionId:'active',at:300}],bookmarks:[1],active:{id:'active'}};
 const remote={...s,attempts:[{...answer,guessed:true,learningRevision:1}]},at=Date.now();
 const doc=value=>({fields:{json:{stringValue:JSON.stringify(value)}}});
 const window={Core,FahrklarFirebaseConfig:{enabled:true,projectId:'test',apiKey:'synthetic'},cloudEvent:(type,json)=>events.push({type,...JSON.parse(json)})};
 const fetch=async(url,options={})=>{let body={};if(url.includes('accounts:lookup'))body={users:[{localId:'owner',emailVerified:true}]};else if(options.method==='PATCH'){writes.push({url,value:JSON.parse(JSON.parse(options.body).fields.json.stringValue)});}else if(url.endsWith('/settings/current'))body=doc({modules:[3],sessionSize:10,_helpShown:{'1:v':at}});else if(url.endsWith('/bookmarks/current'))body=doc([2]);else if(url.includes('/sessions?'))body={documents:[doc(remote)]};return {ok:true,json:async()=>body};};
 vm.runInNewContext(fs.readFileSync('app/src/main/assets/cloud.js','utf8'),{window,globalThis:window,localStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},fetch,URLSearchParams,JSON,Date,Promise,Set,Map,encodeURIComponent,String,Number,Error,TypeError});
 await window.CloudSync.init();await window.CloudSync.sync(local);
 const result=events.find(e=>e.type==='synced').state;assert.equal(result.sessions.length,1);assert.equal(result.attempts.length,2);assert.equal(result.attempts[0].guessed,true);assert.equal(result.attempts[1].attemptId,'active:0');assert.equal(result.helpShown['1:v'],at);assert.equal(result.settings._helpShown,undefined);assert.equal(result.settings.sessionSize,10);assert.deepEqual(result.bookmarks,[1,2]);
 assert.ok(!writes.some(x=>x.url.includes('/sessions/'))); // the remote revision already equals the resolved session
});
