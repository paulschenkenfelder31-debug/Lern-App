const {test}=require('node:test');
const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const C=require('../app/src/main/assets/core.js');
const DAY=86400000,T=Date.UTC(2026,0,1,12);
const q=(id,topic='Test',classes=[3])=>({id,version:'v1',text:'Synthetische Frage '+id,topic,classes,main:true,sub:null,points:3,image:null,answers:[{text:'Test A',correct:true},{text:'Test B',correct:false}]});
const attempt=(question,at,extra={})=>({...question,selected:[0],correct:true,ms:10000,at,mode:'train',sessionId:'s'+at,attemptId:question.id+':'+at,learningSchema:2,recallDay:C.recallDay(at),retry:false,assisted:false,guessed:false,...extra});
const ladder=(question)=>[0,1,4,11].map(d=>attempt(question,T+d*DAY));
test('Independent spaced recalls reach stability only after three delayed reviews',()=>{
 const question=q(1),history=ladder(question);
 for(let n=1;n<4;n++)assert.equal(C.progress(question,history.slice(0,n),T+40*DAY).mastered,false);
 const p=C.progress(question,history,T+11*DAY);assert.equal(p.mastered,true);assert.equal(p.stage,3);assert.equal(p.delayedSuccesses,3);assert.equal(p.independentDates.length,4);assert.equal(p.nextReview,T+25*DAY);
 assert.equal(C.progress(question,[...history,attempt(question,T+25*DAY)],T+25*DAY).nextReview,T+55*DAY);
});
test('Rapid repeats, early voluntary practice, help and guessed answers cannot manufacture stability',()=>{
 const question=q(1);
 for(const extra of [{},{retry:true},{assisted:true},{guessed:true}]){
  const hs=Array.from({length:20},(_,i)=>attempt(question,T+i*60000,extra));
  const p=C.progress(question,hs,T+DAY);assert.equal(p.mastered,false);assert.equal(p.stage,0);
 }
 const p=C.progress(question,[attempt(question,T),attempt(question,T+DAY/2)],T+DAY);assert.equal(p.nextReview,T+DAY);assert.equal(p.delayedSuccesses,0);
});
test('Correct but guessed lowers review stage and keeps the next review early',()=>{
 const question=q(1),hs=[...ladder(question),attempt(question,T+25*DAY,{guessed:true})],p=C.progress(question,hs,T+25*DAY);
 assert.equal(p.mastered,false);assert.equal(p.stage,0);assert.ok(p.nextReview<=T+26*DAY);
});
test('Feedback after submission keeps the submitted recall valid and affects subsequent attempts',()=>{
 const question=q(1),hs=[attempt(question,T,{feedbackShownAt:T+1000}),attempt(question,T+5000,{retry:true})];
 const p=C.progress(question,hs,T+5000);assert.equal(p.lastIndependent,T);assert.equal(p.independentDates.length,1);
 const next=attempt(question,T+DAY+1000);assert.equal(C.progress(question,[...hs,next],next.at).stage,0); // last attempt was less than 24h ago
 const later=attempt(question,T+2*DAY);assert.equal(C.progress(question,[...hs,later],later.at).stage,1);
});
test('Lapse resets the ladder, preserves history and needs attention after stability',()=>{
 const question=q(1),hs=[...ladder(question),attempt(question,T+25*DAY,{correct:false,selected:[1]})],p=C.progress(question,hs,T+25*DAY);
 assert.equal(p.state,'attention');assert.equal(p.lapses,1);assert.equal(p.wrong,1);assert.equal(p.mastered,false);assert.equal(p.nextReview,T+26*DAY);assert.equal(hs.length,5);
});
test('Legacy histories retain seen/wrong evidence without invented independence',()=>{
 const question=q(1),hs=ladder(question).map(({learningSchema,recallDay,...a})=>a),p=C.progress(question,hs,T+40*DAY);
 assert.equal(p.seen,true);assert.equal(p.mastered,false);assert.equal(p.independentDates.length,0);assert.equal(p.stage,0);
 assert.equal(C.progress({...question,version:'v2'},hs,T+40*DAY).seen,false);
});
test('Skipped, pending and aborted exam answers never contribute successful recall',()=>{
 const question=q(1);
 for(const extra of [{skipped:true},{mode:'exam',examStatus:'pending'},{mode:'exam',examStatus:'aborted'}])assert.equal(C.progress(question,[attempt(question,T,extra)],T).seen,false);
 const hs=ladder(question).map(a=>({...a,mode:'exam',examStatus:'finished'}));assert.equal(C.progress(question,hs,T+11*DAY).mastered,true);
});
test('Daily allocation uses due, new, weak and older buckets without duplicates',()=>{
 const questions=Array.from({length:40},(_,i)=>q(i+1,'Topic '+i%5));
 const hs=[...questions.slice(0,10).map(question=>attempt(question,T-2*DAY,{correct:false})),...questions.slice(15,18).map(question=>attempt(question,T-DAY/2,{correct:false})),...questions.slice(18,20).flatMap(question=>[...ladder(question).map(a=>({...a,at:a.at-23*DAY,recallDay:C.recallDay(a.at-23*DAY)})),attempt(question,T-12*DAY)])];
 const result=C.dailySession(questions,hs,20,T,()=>.5);
 assert.equal(result.questions.length,20);assert.equal(result.due,10);assert.equal(result.fresh,5);assert.equal(result.weak,3);assert.equal(result.retention,2);assert.equal(new Set(result.questions.map(q=>q.id)).size,20);
});
test('Empty buckets redistribute and partial or empty catalogues remain finite',()=>{
 const questions=Array.from({length:7},(_,i)=>q(i+1));
 assert.equal(C.learningQueue(questions,[],20,T,()=>.5).length,7);
 assert.equal(C.learningQueue(questions,[],5,T,()=>.5).length,5);
 assert.deepEqual(C.learningQueue([],[],20,T),[]);
 assert.equal(C.learningQueue([q(1),q(1)],[],20,T).length,1);
});
test('Overdue lapses have priority and topic coverage prevents single-topic monopolies',()=>{
 const questions=Array.from({length:30},(_,i)=>q(i+1,i<27?'Hard':'Other'));
 const hs=questions.map(question=>attempt(question,T-2*DAY,{correct:false}));
 const result=C.dailySession(questions,hs,10,T,()=>.5);
 assert.ok(result.questions.some(q=>q.topic==='Other'));
 const old=q(99,'Third'),history=ladder(old).map(a=>({...a,at:a.at-40*DAY}));history.push(attempt(old,T-3*DAY,{correct:false}));
 assert.ok(C.dailySession([...questions,old],[...hs,...history],5,T,()=>.5).questions.some(q=>q.id===99));
});
test('Backlog suppresses new material, caps workload and fixed RNG is reproducible',()=>{
 const questions=Array.from({length:65},(_,i)=>q(i+1,'Topic '+i%6)),hs=questions.slice(0,50).map(question=>attempt(question,T-3*DAY,{correct:false}));
 const a=C.dailySession(questions,hs,20,T,()=>.3),b=C.dailySession(questions,hs,20,T,()=>.3);
 assert.equal(a.backlog,true);assert.equal(a.fresh,0);assert.equal(a.questions.length,20);assert.deepEqual(a.questions,b.questions);
});
test('Manual question pool and module eligibility cannot leak other modules into recommendations',()=>{
 const questions=[q(1,'A',[3]),q(2,'B',[7])],pool=questions.filter(q=>q.classes.includes(3));
 assert.deepEqual(C.learningQueue(pool,[],20,T).map(q=>q.id),[1]);
});
test('Retry needs three intervening questions, is queued once and short rounds defer',()=>{
 const question=q(1),a=attempt(question,T,{correct:false});
 assert.equal(C.retryIndex({index:0,questions:[question,q(2),q(3)],attempts:[a]},question),null);
 assert.equal(C.retryIndex({index:0,questions:[question,q(2),q(3),q(4)],attempts:[a]},question),4);
 assert.equal(C.retryIndex({index:0,questions:[question,q(2),q(3),q(4)],attempts:[a,{...a,attemptId:'retry'}]},question),null);
});
test('Merge is order-independent and deduplicates attempts, including confidence revisions',()=>{
 const question=q(1),a=attempt(question,T),b={...a,guessed:true,learningRevision:1},hs=ladder(question);
 const first=C.mergeAttempts(hs,[a,b]),second=C.mergeAttempts([b,a],[...hs].reverse());
 assert.deepEqual(first,second);assert.equal(first.length,4);assert.equal(first[0].guessed,true);
 assert.deepEqual(C.progress(question,first,T+11*DAY),C.progress(question,second,T+11*DAY));
 const legacy={...a};delete legacy.attemptId;assert.equal(C.mergeAttempts([legacy],[{...legacy}]).length,1);
});
test('Session conflicts resolve identically in either merge order',()=>{
 const a={id:'one',started:T,ended:T+1,attempts:[]},b={...a,attempts:[attempt(q(1),T)]};
 assert.deepEqual(C.mergeSessions([a],[b]),C.mergeSessions([b],[a]));assert.equal(C.mergeSessions([a],[b]).length,1);
});
test('Scheduling and distinct recall dates are independent of DST and device timezone',()=>{
 const path=require.resolve('../app/src/main/assets/core.js');
 const script=`const C=require(${JSON.stringify(path)});const t=Date.parse('2026-10-25T00:30:00Z');console.log(JSON.stringify({day:C.recallDay(t),p:C.progress({id:1,version:'v'},[{id:1,version:'v',correct:false,at:t,learningSchema:2}],t)}));`;
 const outputs=['Europe/Vienna','America/New_York','Pacific/Auckland'].map(TZ=>execFileSync(process.execPath,['-e',script],{env:{...process.env,TZ},encoding:'utf8'}));
 assert.equal(new Set(outputs).size,1);const result=JSON.parse(outputs[0]);assert.equal(result.p.nextReview,Date.parse('2026-10-26T00:30:00Z'));
});
test('Crossing midnight alone and changing question versions cannot promote stability',()=>{
 const question=q(1),a=Date.parse('2026-01-01T23:59:00Z'),hs=[attempt(question,a),attempt(question,a+120000)];
 assert.equal(C.progress(question,hs,a+DAY).stage,0);assert.equal(C.progress({...question,version:'v2'},hs,a+DAY).seen,false);
});
test('Backup round trips preserve evidence and reject invalid adaptive metadata',()=>{
 const question=q(1),hs=ladder(question),data={schema:1,settings:{modules:[3],sessionSize:30,theme:'blue'},attempts:hs,sessions:[],bookmarks:[1],active:{id:'old'}};
 const round=C.validateBackup(JSON.parse(JSON.stringify(data)));assert.equal(round.settings.sessionSize,20);assert.equal(round.settings.theme,'blue');assert.equal(round.active,null);assert.deepEqual(round.attempts,hs);assert.equal(C.progress(question,round.attempts,T+11*DAY).mastered,true);
 for(const extra of [{assisted:'yes'},{recallDay:'2026-99-99'},{learningRevision:-1},{feedbackShownAt:'bad'}])assert.throws(()=>C.validateBackup({...data,attempts:[{...hs[0],...extra}]}));
});
test('Learning points cannot be farmed through repeated same-day answers or help',()=>{
 const question=q(1),hs=[attempt(question,T),attempt(question,T+1000),attempt(question,T+DAY,{retry:true}),attempt(question,T+2*DAY,{assisted:true}),attempt(question,T+3*DAY,{guessed:true}),attempt(question,T+4*DAY)];
 assert.equal(C.learningXp(hs),20);assert.equal(C.learningXp([...hs,...hs]),20);
});
test('Response speed changes neither review state nor rewards',()=>{
 const question=q(1),hs=ladder(question),fast=hs.map(a=>({...a,ms:100})),slow=hs.map(a=>({...a,ms:120000}));
 assert.equal(C.progress(question,fast,T+11*DAY).state,C.progress(question,slow,T+11*DAY).state);assert.equal(C.learningXp(fast),C.learningXp(slow));
});

test('Repeated mistakes during one lapse do not invent additional lapses',()=>{
 const question=q(1),hs=[...ladder(question),attempt(question,T+25*DAY,{correct:false}),attempt(question,T+25*DAY+60000,{correct:false,retry:true})];
 const p=C.progress(question,hs,T+26*DAY);assert.equal(p.lapses,1);assert.equal(p.wrong,2);
});
test('Legacy learning points and historical simulation bonuses remain visible',()=>{
 const question=q(1),hs=ladder(question).map(({learningSchema,...a})=>a);
 assert.equal(C.learningXp(hs),60);assert.equal(C.learningXp(hs,[{mode:'exam',status:'finished',attempts:hs,modules:[{earned:80,max:100}]}]),160);
});

test('Recommendations leave a gap after recently displayed feedback',()=>{
 const question=q(1),other=q(2),hs=[attempt(question,T,{feedbackShownAt:T})];
 assert.deepEqual(C.learningQueue([question,other],hs,5,T+1000).map(q=>q.id),[2]);
 assert.equal(C.learningQueue([question,other],hs,5,T+11*60000).length,2);
});
