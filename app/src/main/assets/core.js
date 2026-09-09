(function(root){
  'use strict';
  const classes={1:'Grundwissen',2:'A',3:'B',4:'C',5:'D',6:'E',7:'F',8:'AM',10:'Fahrlehrer'};
  const dayKey=t=>{const d=new Date(t);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');};
  function fingerprint(value){let h=2166136261;for(const c of JSON.stringify(value)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return (h>>>0).toString(16);}
  function normalize(raw){
    if(!Array.isArray(raw))throw Error('Fragenliste fehlt');
    const seen=new Set();
    const qs=raw.map(q=>{
      if(!Number.isInteger(q.qst_id)||seen.has(q.qst_id)||typeof q.txt_text!=='string'||!Array.isArray(q.answers)||q.answers.length<2||!Array.isArray(q.classes)||!q.classes.length)throw Error('Ungültiger Katalog');
      seen.add(q.qst_id);
      const answers=q.answers.map(a=>{if(typeof a.txt_text!=='string'||![0,1].includes(a.ans_correct))throw Error('Ungültiger Antwortschlüssel');return {text:a.txt_text,correct:a.ans_correct===1,image:Number(a.ans_image)||null};});
      if(!answers.some(a=>a.correct))throw Error('Richtige Antwort fehlt');
      const obj={id:q.qst_id,text:q.txt_text,image:Number(q.qst_image)||null,sub:Number(q.qst_sub)||null,main:q.qst_main===1,points:Number(q.qst_value)||0,classes:q.classes.map(Number),topic:(q.path||[]).join(' › '),answers};
      obj.version=fingerprint(obj);return obj;
    });
    for(const q of qs)if(q.sub&&!seen.has(q.sub))throw Error('Zusatzfrage fehlt');
    return qs;
  }
  function grade(q,selected){const expected=q.answers.map((a,i)=>a.correct?i:-1).filter(i=>i>=0);return selected.length===expected.length&&expected.every(i=>selected.includes(i));}
  function shuffle(array,rng=Math.random){const a=[...array];for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
  function makeExam(qs,modules,rng=Math.random){
    const byId=new Map(qs.map(q=>[q.id,q]));
    return modules.map(module=>{
      const pool=qs.filter(q=>q.main&&q.classes.includes(module)&&(!q.sub||byId.has(q.sub)));
      if(pool.length<20)throw Error('Für '+(classes[module]||module)+' fehlen mindestens 20 Hauptfragen.');
      const groups=shuffle(pool,rng).slice(0,20).map(q=>({main:q,sub:q.sub?byId.get(q.sub):null}));
      return {module,groups,max:groups.reduce((n,g)=>n+g.main.points+(g.sub?.points||0),0),earned:0,limitMs:30*60*1000};
    });
  }
  function progress(q,attempts){
    const history=attempts.filter(a=>a.id===q.id&&a.version===q.version&&!a.skipped);let streak=0;
    for(let i=history.length-1;i>=0&&history[i].correct;i--)streak++;
    return {seen:history.length>0,mastered:streak>=3,streak,last:history.at(-1),wrong:history.filter(a=>!a.correct).length};
  }
  function stats(attempts,sessions,qs,now=Date.now()){
    const answered=attempts.filter(a=>!a.skipped),correct=answered.filter(a=>a.correct).length;
    const times=answered.map(a=>a.ms).filter(t=>Number.isFinite(t)&&t>=0).sort((a,b)=>a-b);
    const totalMs=times.reduce((a,b)=>a+b,0),exams=sessions.filter(s=>s.mode==='exam'&&s.status==='finished');
    const dates=new Set(answered.map(a=>dayKey(a.at))),today=dayKey(now);
    const d=new Date(now);let streak=0;if(!dates.has(dayKey(d)))d.setDate(d.getDate()-1);
    while(dates.has(dayKey(d))){streak++;d.setDate(d.getDate()-1);}
    const seen=new Set(),mastered=new Set();let first=0,firstCorrect=0;
    const byQuestion=new Map(); for(const a of answered){const key=a.id+':'+a.version;if(!byQuestion.has(key))byQuestion.set(key,[]);byQuestion.get(key).push(a);}
    for(const q of qs){const h=byQuestion.get(q.id+':'+q.version)||[];if(h.length){seen.add(q.id);first++;if(h[0].correct)firstCorrect++;if(h.length>=3&&h.slice(-3).every(a=>a.correct))mastered.add(q.id);}}
    const daily=[];for(let i=13;i>=0;i--){const date=new Date(now);date.setDate(date.getDate()-i);const key=dayKey(date),as=answered.filter(a=>dayKey(a.at)===key);daily.push({day:key,n:as.length,correct:as.filter(a=>a.correct).length});}
    const topics={};for(const a of answered){const key=a.topic||'Ohne Thema';const t=topics[key]||(topics[key]={n:0,correct:0,ms:0});t.n++;t.correct+=a.correct?1:0;t.ms+=a.ms;}
    return {count:answered.length,correct,accuracy:answered.length?correct/answered.length:null,totalMs,qpm:totalMs?answered.length*60000/totalMs:null,avg:times.length?totalMs/times.length:null,median:times.length?(times[Math.floor((times.length-1)/2)]+times[Math.ceil((times.length-1)/2)])/2:null,p90:times.length?times[Math.ceil(times.length*.9)-1]:null,seen:seen.size,mastered:mastered.size,coverage:qs.length?seen.size/qs.length:0,firstAccuracy:first?firstCorrect/first:null,streak,today:answered.filter(a=>dayKey(a.at)===today).length,daily,topics,exams:exams.length,passed:exams.filter(e=>e.modules.every(m=>m.earned>=m.max*.8)).length};
  }
  function validateBackup(data){
    if(!data||data.schema!==1||!Array.isArray(data.attempts)||!Array.isArray(data.sessions)||!data.settings||!Array.isArray(data.settings.modules)||!data.settings.modules.length||!data.settings.modules.every(n=>Number.isInteger(n)&&n>0&&n<1000))throw Error('Ungültige Sicherung');
    if(data.attempts.length>200000||data.sessions.length>20000)throw Error('Sicherung ist zu groß');
    function validAttempt(a){
      if(!a||!Number.isInteger(a.id)||typeof a.version!=='string'||typeof a.correct!=='boolean'||!Number.isFinite(a.ms)||a.ms<0||!Number.isFinite(a.at)||typeof a.topic!=='string'||typeof a.text!=='string'||!Array.isArray(a.classes)||!a.classes.every(Number.isInteger)||!Array.isArray(a.answers)||a.answers.length<2||a.answers.length>10||!Array.isArray(a.selected)||!a.selected.every(i=>Number.isInteger(i)&&i>=0&&i<a.answers.length))throw Error('Ungültige Antwortdaten');
      for(const answer of a.answers)if(!answer||typeof answer.text!=='string'||typeof answer.correct!=='boolean'||(answer.image!=null&&!Number.isInteger(answer.image)))throw Error('Ungültige Lösungsdaten');
      if(a.image!=null&&!Number.isInteger(a.image))throw Error('Ungültiges Bild');
    }
    data.attempts.forEach(validAttempt);
    for(const s of data.sessions){if(typeof s.id!=='string'||!['train','exam'].includes(s.mode)||!['finished','aborted'].includes(s.status)||!Number.isFinite(s.started)||!Number.isFinite(s.ended)||!Array.isArray(s.attempts)||!Array.isArray(s.modules))throw Error('Ungültiger Verlauf');
      s.attempts.forEach(validAttempt);
      for(const m of s.modules){if(s.mode==='train'){if(!Number.isInteger(m))throw Error('Ungültiges Modul');}else if(!m||!Number.isInteger(m.module)||!Number.isFinite(m.earned)||!Number.isFinite(m.max)||m.max<0||m.earned<0||m.earned>m.max)throw Error('Ungültiges Ergebnis');}
    }
    data.settings.goal=Math.max(1,Math.min(1000,Number(data.settings.goal)||30));
    data.settings.dark=!!data.settings.dark;data.settings.auto=!!data.settings.auto;
    return {...data,active:null};
  }

  // The schedule is derived from versioned attempts, so backups and catalog edits
  // need no separate mutable scheduling state.
  function reviewStatus(p,now=Date.now()){
    if(!p.seen||!p.last)return {due:false,at:null};
    const interval=p.last.correct?[1,3,7,14,30][Math.min(Math.max(p.streak-1,0),4)]*86400000:10*60000;
    const at=p.last.at+interval;return {due:at<=now,at};
  }
  function learningQueue(qs,attempts,count=20,now=Date.now(),rng=Math.random){
    const ps=new Map();
    for(const a of attempts){if(a.skipped)continue;const key=a.id+':'+a.version,p=ps.get(key)||{seen:true,streak:0};p.streak=a.correct?p.streak+1:0;p.last=a;ps.set(key,p);}
    const due=[],fresh=[],later=[];
    for(const q of shuffle(qs,rng)){const p=ps.get(q.id+':'+q.version);if(!p){fresh.push(q);continue;}const r=reviewStatus(p,now);(r.due?due:later).push({q,p,at:r.at});}
    due.sort((a,b)=>Number(a.p.last.correct)-Number(b.p.last.correct)||a.at-b.at);
    later.sort((a,b)=>a.at-b.at);
    const first=due.splice(0,Math.ceil(count*.7)).map(x=>x.q);
    const newQuestions=fresh.splice(0,Math.max(0,count-first.length));
    return [...first,...newQuestions,...due.map(x=>x.q),...fresh,...later.map(x=>x.q)].slice(0,count);
  }
  function topicGroups(qs,query=''){
    const groups=new Map(),counts=new Map();
    for(const q of qs)counts.set(q.topic,(counts.get(q.topic)||0)+1);
    for(const [value,count] of counts){
      if(query&&!value.toLocaleLowerCase('de').includes(query.toLocaleLowerCase('de')))continue;
      const parts=value.split(' › '),name=parts.length>1?parts.shift():'Weitere Themen',label=parts.join(' › ')||'Ohne Themenangabe';
      if(!groups.has(name))groups.set(name,[]);
      groups.get(name).push({value,label,count});
    }
    return [...groups].sort((a,b)=>a[0].localeCompare(b[0],'de')).map(([name,items])=>({name,items:items.sort((a,b)=>a.label.localeCompare(b.label,'de'))}));
  }

  const api={classes,dayKey,fingerprint,normalize,grade,shuffle,makeExam,progress,stats,validateBackup,reviewStatus,learningQueue,topicGroups};root.Core=api;if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
