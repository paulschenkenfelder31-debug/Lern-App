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
  // Replayed from immutable versioned attempts; no mutable mastery cache to merge.
  const learningConfig=Object.freeze({days:Object.freeze([1,3,7,14,30]),stableReviews:3,minRecallMs:86400000,retryGap:3,maxDaily:20,backlogThreshold:40,recentHelpMs:10*60000,allocation:Object.freeze({5:Object.freeze([2,1,1,1]),10:Object.freeze([5,2,2,1]),20:Object.freeze([10,5,3,2])})});
  const recallDay=t=>new Date(t).toISOString().slice(0,10);
  const attemptKey=a=>a.attemptId||canonical([a.sessionId,a.id,a.version,a.at,a.selected,a.correct,!!a.skipped]);
  function canonical(value){if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';return JSON.stringify(value);}
  function mergeAttempts(...lists){
    const map=new Map();for(const a of lists.flat()){const key=attemptKey(a),old=map.get(key);if(!old||(a.learningRevision||0)>(old.learningRevision||0)||((a.learningRevision||0)===(old.learningRevision||0)&&canonical(a)>canonical(old)))map.set(key,a);}
    return [...map.values()].sort((a,b)=>a.at-b.at||attemptKey(a).localeCompare(attemptKey(b)));
  }
  function progress(q,attempts,now=Date.now()){
    const history=mergeAttempts(attempts.filter(a=>a.id===q.id&&a.version===q.version&&!a.skipped&&!(a.learningSchema===2&&a.mode==='exam'&&a.examStatus!=='finished')&&Number.isFinite(a.at)&&a.at<=now));
    const p={seen:false,mastered:false,streak:0,wrong:0,lapses:0,state:'new',stage:0,nextReview:null,last:null,lastIndependent:null,independentDates:[],delayedSuccesses:0,delayedAttempts:0,delayedCorrect:0};
    let wasStable=false,lastHelp=null;
    for(const a of history){
      const modern=a.learningSchema===2;
      const delayed=modern&&p.last&&a.at>=p.nextReview&&a.at-p.last.at>=learningConfig.minRecallMs;
      const independent=modern&&!a.retry&&!a.assisted&&!a.guessed&&(lastHelp==null||a.at-lastHelp>=learningConfig.minRecallMs);
      p.seen=true;p.streak=a.correct?p.streak+1:0;
      if(delayed&&independent){p.delayedAttempts++;if(a.correct)p.delayedCorrect++;}
      if(!a.correct){p.wrong++;if(p.mastered)p.lapses++;p.stage=0;p.delayedSuccesses=0;p.independentDates=[];p.mastered=false;p.state=wasStable?'attention':'learning';p.nextReview=a.at+learningConfig.minRecallMs;}
      else if(!modern){p.state='reviewing';p.nextReview=a.at+learningConfig.minRecallMs;}
      else if(a.guessed){p.stage=0;p.mastered=false;p.state=wasStable?'attention':'learning';p.nextReview=a.at+learningConfig.minRecallMs;}
      else if(independent){
        const day=a.recallDay||recallDay(a.at);
        if(p.lastIndependent==null){p.lastIndependent=a.at;p.independentDates.push(day);p.nextReview=a.at+learningConfig.minRecallMs;p.state='reviewing';}
        else if(delayed&&!p.independentDates.includes(day)){
          p.stage=Math.min(p.stage+1,learningConfig.days.length-1);p.delayedSuccesses++;p.lastIndependent=a.at;p.independentDates.push(day);
          p.mastered=p.delayedSuccesses>=learningConfig.stableReviews&&p.stage>=learningConfig.stableReviews;
          if(p.mastered)wasStable=true;
          p.state=p.mastered?'stable':wasStable?'attention':'reviewing';p.nextReview=a.at+learningConfig.days[p.stage]*learningConfig.minRecallMs;
        }
      }
      else {p.nextReview=Math.max(p.nextReview||0,a.at+learningConfig.minRecallMs);if(p.state==='new')p.state='learning';}
      if(a.feedbackShownAt!=null)lastHelp=Math.max(lastHelp||0,a.feedbackShownAt);
      p.last=a;
    }
    p.at=p.nextReview;p.due=p.nextReview!=null&&p.nextReview<=now;
    return p;
  }
  function progressMap(qs,attempts,now=Date.now()){
    const groups=new Map();for(const a of attempts){const k=a.id+':'+a.version;if(!groups.has(k))groups.set(k,[]);groups.get(k).push(a);}
    return new Map(qs.map(q=>[q.id+':'+q.version,progress(q,groups.get(q.id+':'+q.version)||[],now)]));
  }
  const learningLabel=p=>({new:'Neu',learning:'Im Lernen',reviewing:'Wiederholen',stable:'Stabil gelernt',attention:'Erneut festigen'}[p.state]||'Neu');
  const normalizeSessionSize=value=>Number(value)===5?5:Number(value)===10?10:20;
  function stats(attempts,sessions,qs,now=Date.now()){
    const answered=attempts.filter(a=>!a.skipped),correct=answered.filter(a=>a.correct).length;
    const times=answered.map(a=>a.ms).filter(t=>Number.isFinite(t)&&t>=0).sort((a,b)=>a-b);
    const totalMs=times.reduce((a,b)=>a+b,0),exams=sessions.filter(s=>s.mode==='exam'&&s.status==='finished');
    const dates=new Set(answered.map(a=>dayKey(a.at))),today=dayKey(now);
    const d=new Date(now);let streak=0;if(!dates.has(dayKey(d)))d.setDate(d.getDate()-1);
    while(dates.has(dayKey(d))){streak++;d.setDate(d.getDate()-1);}
    const seen=new Set(),mastered=new Set();let first=0,firstCorrect=0;
    const byQuestion=new Map(); for(const a of answered){const key=a.id+':'+a.version;if(!byQuestion.has(key))byQuestion.set(key,[]);byQuestion.get(key).push(a);}
    for(const q of qs){const h=byQuestion.get(q.id+':'+q.version)||[];if(h.length){seen.add(q.id);first++;if(h[0].correct)firstCorrect++;if(progress(q,h,now).mastered)mastered.add(q.id);}}
    const daily=[];for(let i=13;i>=0;i--){const date=new Date(now);date.setDate(date.getDate()-i);const key=dayKey(date),as=answered.filter(a=>dayKey(a.at)===key);daily.push({day:key,n:as.length,correct:as.filter(a=>a.correct).length});}
    const topics={};for(const a of answered){const key=a.topic||'Ohne Thema';const t=topics[key]||(topics[key]={n:0,correct:0,ms:0});t.n++;t.correct+=a.correct?1:0;t.ms+=a.ms;}
    return {count:answered.length,correct,accuracy:answered.length?correct/answered.length:null,totalMs,qpm:totalMs?answered.length*60000/totalMs:null,avg:times.length?totalMs/times.length:null,median:times.length?(times[Math.floor((times.length-1)/2)]+times[Math.ceil((times.length-1)/2)])/2:null,p90:times.length?times[Math.ceil(times.length*.9)-1]:null,seen:seen.size,mastered:mastered.size,coverage:qs.length?seen.size/qs.length:0,firstAccuracy:first?firstCorrect/first:null,streak,today:answered.filter(a=>dayKey(a.at)===today).length,daily,topics,exams:exams.length,passed:exams.filter(e=>e.modules.every(m=>m.earned>=m.max*.8)).length};
  }
  function validateBackup(data){
    if(!data||data.schema!==1||!Array.isArray(data.attempts)||!Array.isArray(data.sessions)||!data.settings||!Array.isArray(data.settings.modules)||!data.settings.modules.length||!data.settings.modules.every(n=>Number.isInteger(n)&&n>0&&n<1000))throw Error('Ungültige Sicherung');
    if(data.attempts.length>200000||data.sessions.length>20000)throw Error('Sicherung ist zu groß');
    function validAttempt(a){
      if(!a||!Number.isInteger(a.id)||typeof a.version!=='string'||typeof a.correct!=='boolean'||!Number.isFinite(a.ms)||a.ms<0||!Number.isFinite(a.at)||typeof a.topic!=='string'||typeof a.text!=='string'||!Array.isArray(a.classes)||!a.classes.every(Number.isInteger)||!Array.isArray(a.answers)||a.answers.length<2||a.answers.length>10||!Array.isArray(a.selected)||!a.selected.every(i=>Number.isInteger(i)&&i>=0&&i<a.answers.length))throw Error('Ungültige Antwortdaten');
      if(a.examStatus!=null&&!['pending','finished','aborted'].includes(a.examStatus))throw Error('Ungültiger Prüfungsstatus');
      if(a.learningSchema!=null&&a.learningSchema!==2)throw Error('Unbekannte Lernversion');
      for(const flag of ['retry','assisted','guessed'])if(a[flag]!=null&&typeof a[flag]!=='boolean')throw Error('Ungültiger Lernhinweis');
      if(a.feedbackShownAt!=null&&!Number.isFinite(a.feedbackShownAt))throw Error('Ungültiger Hilfezeitpunkt');
      if(a.recallDay!=null&&(!/^\d{4}-\d{2}-\d{2}$/.test(a.recallDay)||a.recallDay!==recallDay(a.at)))throw Error('Ungültiger Lerntag');
      if(a.attemptId!=null&&typeof a.attemptId!=='string')throw Error('Ungültige Antwort-ID');
      if(a.learningRevision!=null&&(!Number.isInteger(a.learningRevision)||a.learningRevision<0))throw Error('Ungültige Antwortrevision');
      for(const answer of a.answers)if(!answer||typeof answer.text!=='string'||typeof answer.correct!=='boolean'||(answer.image!=null&&!Number.isInteger(answer.image)))throw Error('Ungültige Lösungsdaten');
      if(a.image!=null&&!Number.isInteger(a.image))throw Error('Ungültiges Bild');
    }
    if(data.helpShown!=null&&(!data.helpShown||typeof data.helpShown!=='object'||Array.isArray(data.helpShown)||Object.entries(data.helpShown).some(([k,v])=>!/^\d+:[a-zA-Z0-9]+$/.test(k)||!Number.isFinite(v)||v<0)))throw Error('Ungültige Hilfezeitpunkte');
    data.attempts.forEach(validAttempt);
    for(const s of data.sessions){if(typeof s.id!=='string'||!['train','exam'].includes(s.mode)||!['finished','aborted'].includes(s.status)||!Number.isFinite(s.started)||!Number.isFinite(s.ended)||!Array.isArray(s.attempts)||!Array.isArray(s.modules))throw Error('Ungültiger Verlauf');
      s.attempts.forEach(validAttempt);
      for(const m of s.modules){if(s.mode==='train'){if(!Number.isInteger(m))throw Error('Ungültiges Modul');}else if(!m||!Number.isInteger(m.module)||!Number.isFinite(m.earned)||!Number.isFinite(m.max)||m.max<0||m.earned<0||m.earned>m.max)throw Error('Ungültiges Ergebnis');}
    }
    data.settings.goal=Math.max(1,Math.min(1000,Number(data.settings.goal)||30));
    data.settings.dark=!!data.settings.dark;data.settings.auto=!!data.settings.auto;
    data.settings.largeText=!!data.settings.largeText;data.settings.reduceMotion=!!data.settings.reduceMotion;
    data.settings.keepAwake=data.settings.keepAwake!==false;data.settings.haptics=data.settings.haptics!==false;
    data.settings.sessionSize=normalizeSessionSize(data.settings.sessionSize);
    data.settings.theme=['neutral','green','blue','purple','orange'].includes(data.settings.theme)?data.settings.theme:'neutral';
    return {...data,active:null};
  }

  function reviewStatus(p,now=Date.now()){
    const at=p.nextReview??(p.seen&&p.last?p.last.at+learningConfig.minRecallMs:null);
    return {due:at!=null&&at<=now,at};
  }
  function dailySession(qs,attempts,count=20,now=Date.now(),rng=Math.random){
    count=Math.min(learningConfig.maxDaily,normalizeSessionSize(count));
    qs=[...new Map(qs.map(q=>[q.id+':'+q.version,q])).values()];
    const map=progressMap(qs,attempts,now),pool=shuffle(qs,rng).map(q=>({q,p:map.get(q.id+':'+q.version)})).filter(x=>x.p.last?.feedbackShownAt==null||now-x.p.last.feedbackShownAt>=learningConfig.recentHelpMs);
    const due=pool.filter(x=>x.p.due).sort((a,b)=>Number(b.p.state==='attention')-Number(a.p.state==='attention')||a.p.nextReview-b.p.nextReview||b.p.wrong-a.p.wrong);
    const topics=new Map();for(const {q,p} of pool){const t=topics.get(q.topic)||{wrong:0,n:0};t.wrong+=p.wrong;t.n+=p.seen?1:0;topics.set(q.topic,t);}
    const weak=pool.filter(x=>x.p.seen&&x.p.wrong&&!x.p.due).sort((a,b)=>topics.get(b.q.topic).wrong/Math.max(1,topics.get(b.q.topic).n)-topics.get(a.q.topic).wrong/Math.max(1,topics.get(a.q.topic).n)||b.p.wrong-a.p.wrong);
    const fresh=pool.filter(x=>!x.p.seen),older=pool.filter(x=>x.p.seen&&x.p.last.at<=now-7*learningConfig.minRecallMs&&!x.p.due);
    older.sort((a,b)=>a.p.last.at-b.p.last.at);
    const buckets=[due,fresh,weak,older],targets=[...learningConfig.allocation[count]];
    if(due.length>=learningConfig.backlogThreshold){targets[0]+=targets[1];targets[1]=0;}
    const chosen=[],used=new Set(),coverage=new Map(),counts=[0,0,0,0];
    function take(bucket,n,index){
      for(let i=0;i<n;i++){
        const available=bucket.filter(x=>!used.has(x.q.id+':'+x.q.version));if(!available.length)break;
        // Diversify each bucket, allowing repeats only when no other topics remain.
        const min=Math.min(...available.map(x=>coverage.get(x.q.topic)||0));
        const item=available.find(x=>(coverage.get(x.q.topic)||0)===min),key=item.q.id+':'+item.q.version;
        used.add(key);chosen.push(item.q);coverage.set(item.q.topic,(coverage.get(item.q.topic)||0)+1);if(index!=null)counts[index]++;
      }
    }
    buckets.forEach((b,i)=>take(b,targets[i],i));
    const rest=count-chosen.length;
    if(rest)take([...due,...weak,...older,...(due.length>=learningConfig.backlogThreshold?[]:fresh),...pool],rest,null);
    // Brief introduction of two new questions from one topic; thereafter interleave topics.
    const ordered=[],pending=[...chosen];let intro=0;
    if(pending.length&&fresh.length){const first=pending.find(q=>!map.get(q.id+':'+q.version).seen);if(first){for(const q of pending.filter(q=>q.topic===first.topic&&!map.get(q.id+':'+q.version).seen).slice(0,2)){ordered.push(q);pending.splice(pending.indexOf(q),1);intro++;}}}
    while(pending.length){let i=pending.findIndex(q=>q.topic!==ordered.at(-1)?.topic);if(i<0)i=0;ordered.push(pending.splice(i,1)[0]);}
    const selected=ordered.map(q=>map.get(q.id+':'+q.version)),newCount=selected.filter(p=>!p.seen).length,dueCount=selected.filter(p=>p.due).length;
    return {questions:ordered,due:dueCount,fresh:newCount,weak:counts[2],retention:counts[3],backlog:due.length>count,reason:dueCount?'Heute festigst du bereits gelerntes Wissen.':counts[2]?'Diese Fragen waren zuletzt schwierig.':'Du lernst neue Fragen in überschaubaren Schritten.'};
  }
  function learningQueue(qs,attempts,count=20,now=Date.now(),rng=Math.random){return dailySession(qs,attempts,count,now,rng).questions;}
  function retryIndex(session,q){
    if(session.attempts.filter(a=>a.id===q.id&&a.version===q.version&&!a.skipped).length!==1)return null;
    const index=session.index+learningConfig.retryGap+1;
    return index<=session.questions.length?index:null;
  }
  function retentionStats(qs,attempts,now=Date.now()){
    const ps=[...progressMap(qs,attempts,now).values()];
    const n=ps.reduce((n,p)=>n+p.delayedAttempts,0),correct=ps.reduce((n,p)=>n+p.delayedCorrect,0);
    return {count:n,correct,accuracy:n?correct/n:null,stable:ps.filter(p=>p.mastered).length};
  }
  function learningXp(attempts,sessions=[]){
    const awarded=new Set(),legacyStreak=new Map(),legacyBonus=new Set();let xp=0;
    for(const a of mergeAttempts(attempts)){if(a.skipped||!a.correct)continue;if(a.learningSchema!==2){xp+=10;continue;}const key=a.id+':'+a.version+':'+recallDay(a.at);if(!a.retry&&!a.assisted&&!a.guessed&&!awarded.has(key)){awarded.add(key);xp+=10;}}
    for(const a of mergeAttempts(attempts).filter(a=>!a.skipped&&a.learningSchema!==2)){const key=a.id+':'+a.version,n=a.correct?(legacyStreak.get(key)||0)+1:0;legacyStreak.set(key,n);if(n>=3)legacyBonus.add(key);}
    xp+=legacyBonus.size*20+sessions.filter(s=>s.mode==='exam'&&s.status==='finished'&&s.attempts.every(a=>a.learningSchema!==2)&&s.modules.every(m=>m.earned>=m.max*.8)).length*100;
    return xp;
  }
  function mergeSessions(...lists){
    const map=new Map();
    const metadata=s=>{const {attempts,...rest}=s;return canonical(rest);};
    for(const s of lists.flat()){
      const old=map.get(s.id);if(!old){map.set(s.id,{...s,attempts:mergeAttempts(s.attempts||[])});continue;}
      const winner=(s.ended||0)>(old.ended||0)||((s.ended||0)===(old.ended||0)&&metadata(s)>metadata(old))?s:old;
      map.set(s.id,{...winner,attempts:mergeAttempts(old.attempts||[],s.attempts||[])});
    }
    return [...map.values()].sort((a,b)=>a.started-b.started||a.id.localeCompare(b.id));
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

  const api={classes,dayKey,fingerprint,normalize,grade,shuffle,makeExam,progress,stats,validateBackup,reviewStatus,learningQueue,topicGroups,learningConfig,recallDay,attemptKey,mergeAttempts,mergeSessions,progressMap,learningLabel,normalizeSessionSize,dailySession,retryIndex,retentionStats,learningXp};root.Core=api;if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
