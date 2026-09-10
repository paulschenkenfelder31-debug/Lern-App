const {test}=require('node:test');
const assert=require('node:assert/strict');
const C=require('../app/src/main/assets/core.js');
function q(id,extra={}){return {qst_id:id,txt_text:'Synthetische Testfrage '+id,qst_image:null,qst_sub:null,qst_main:1,qst_value:3,classes:[3],path:['Test'],answers:[{txt_text:'A',ans_correct:1},{txt_text:'B',ans_correct:1},{txt_text:'C',ans_correct:0}],...extra};}
test('Multiple choice requires exactly all correct answers',()=>{const [a]=C.normalize([q(1)]);assert.equal(C.grade(a,[0]),false);assert.equal(C.grade(a,[0,1,2]),false);assert.equal(C.grade(a,[1,0]),true);assert.equal(C.grade(a,[]),false);assert.equal(C.grade(a,[0,0]),false);});
test('Bad answer keys, duplicate IDs and missing follow-ups reject updates',()=>{assert.throws(()=>C.normalize([q(1),q(1)]));assert.throws(()=>C.normalize([q(1,{qst_sub:2})]));assert.throws(()=>C.normalize([q(1,{answers:[{txt_text:'A',ans_correct:0},{txt_text:'B',ans_correct:0}]})]));});
test('Question revisions reset mastery, but retain old history',()=>{const [a]=C.normalize([q(1)]);const history=[1,2,3].map(n=>({id:1,version:a.version,correct:true,ms:10000,at:n}));assert.equal(C.progress(a,history).mastered,true);const [b]=C.normalize([q(1,{txt_text:'Geändert'})]);assert.notEqual(a.version,b.version);assert.equal(C.progress(b,history).seen,false);assert.equal(history.length,3);});
test('Simulation selects 20 unique main questions and includes follow-up point denominator',()=>{let raw=[];for(let i=1;i<=25;i++)raw.push(q(i,{qst_sub:i+100}),q(i+100,{qst_main:0,qst_value:2}));const [m]=C.makeExam(C.normalize(raw),[3],()=>.5);assert.equal(m.groups.length,20);assert.equal(new Set(m.groups.map(g=>g.main.id)).size,20);assert.equal(m.max,100);assert.equal(m.groups.every(g=>g.sub.id===g.main.id+100),true);assert.equal(m.limitMs,1800000);assert.throws(()=>C.makeExam(C.normalize(raw),[2]));});
test('Speed excludes skipped questions and uses active time; incomplete exams excluded',()=>{const now=Date.now(),[a]=C.normalize([q(1)]);const attempts=[{id:1,version:a.version,correct:true,ms:10000,at:now,topic:'Test'},{id:1,version:a.version,correct:false,ms:20000,at:now,topic:'Test'},{id:2,version:'x',correct:false,ms:0,at:now,skipped:true,topic:'Test'}];const sessions=[{mode:'exam',status:'finished',modules:[{earned:80,max:100}]},{mode:'exam',status:'aborted',modules:[{earned:20,max:100}]}];const s=C.stats(attempts,sessions,[a],now);assert.equal(s.count,2);assert.equal(s.qpm,4);assert.equal(s.accuracy,.5);assert.equal(s.avg,15000);assert.equal(s.median,15000);assert.equal(s.p90,20000);assert.equal(s.exams,1);assert.equal(s.passed,1);assert.equal(s.firstAccuracy,1);});
test('Empty stats never claim readiness or produce NaN',()=>{const s=C.stats([],[],[],Date.now());assert.equal(s.accuracy,null);assert.equal(s.qpm,null);assert.equal(s.coverage,0);assert.equal(s.exams,0);assert.equal(s.mastered,0);});
test('Streak tolerates today not yet studied and crosses month boundaries',()=>{const now=new Date(2026,8,1,12).getTime();const attempts=[new Date(2026,7,31,12),new Date(2026,7,30,12)].map(t=>({at:+t,id:1,version:'v',correct:true,ms:5000,topic:'T'}));assert.equal(C.stats(attempts,[],[],now).streak,2);});
test('Backup rejects malformed or negative statistics and normalizes local appearance',()=>{assert.throws(()=>C.validateBackup({}));assert.throws(()=>C.validateBackup({schema:1,settings:{modules:[1]},attempts:[{id:1,ms:-1}],sessions:[]}));const b=C.validateBackup({schema:1,settings:{modules:[1],theme:'unknown'},attempts:[],sessions:[],active:{bad:true}});assert.equal(b.active,null);assert.equal(b.settings.theme,'green');const blue=C.validateBackup({schema:1,settings:{modules:[1],theme:'blue'},attempts:[],sessions:[]});assert.equal(blue.settings.theme,'blue');});

test('Review schedule respects wrong-answer delay and increasing correct intervals',()=>{
  const now=1700000000000;
  assert.equal(C.reviewStatus({seen:false},now).due,false);
  const wrong={seen:true,streak:0,last:{correct:false,at:now}};
  assert.equal(C.reviewStatus(wrong,now+599999).due,false);
  assert.equal(C.reviewStatus(wrong,now+600000).due,true);
  for(const [streak,days] of [[1,1],[2,3],[3,7],[4,14],[5,30],[10,30]]){
    const p={seen:true,streak,last:{correct:true,at:now}};
    assert.equal(C.reviewStatus(p,now).at,now+days*86400000);
  }
});
test('Adaptive rounds prioritize due errors while retaining new questions without duplicates',()=>{
  const qs=C.normalize(Array.from({length:30},(_,i)=>q(i+1))),now=1700000000000;
  const attempts=qs.slice(0,20).map(q=>({id:q.id,version:q.version,correct:false,at:now-700000}));
  const chosen=C.learningQueue(qs,attempts,10,now,()=>.5);
  assert.equal(chosen.length,10);
  assert.equal(chosen.filter(q=>q.id<=20).length,7);
  assert.equal(new Set(chosen.map(q=>q.id)).size,10);
  assert.ok(chosen.slice(0,7).every(q=>q.id<=20));
  const changed={...qs[0],version:'changed'};
  assert.equal(C.reviewStatus(C.progress(changed,attempts),now).due,false);
  assert.deepEqual(C.learningQueue([],attempts),[]);
});
test('Topic search groups shared parents and counts exact question paths',()=>{
  const groups=C.topicGroups([{topic:'F - Bremsanlagen › Auflaufbremse F'},{topic:'F - Bremsanlagen › Auflaufbremse F'},{topic:'F - Bremsanlagen › Druckluft F'},{topic:'B - Vorrang › Kreuzung'}],'brems');
  assert.equal(groups.length,1);assert.equal(groups[0].items.length,2);
  assert.equal(groups[0].items[0].label,'Auflaufbremse F');assert.equal(groups[0].items[0].count,2);
  assert.equal(C.topicGroups([{topic:'F › Anhänger'}],'ANHÄNGER')[0].items[0].value,'F › Anhänger');
  assert.deepEqual(C.topicGroups([{topic:'F › Anhänger'}],'xyz'),[]);
});
