import {createHash} from 'node:crypto';

const SOURCE='https://www.f-online.app/page-data/at/fragenkatalog/alle-fragen/page-data.json';

export function validateQuestions(questions){
  if(!Array.isArray(questions)||questions.length<100||questions.length>30000)throw Error('Unerwartete Kataloggröße');
  const ids=new Set();
  for(const q of questions){
    if(!Number.isInteger(q?.qst_id)||ids.has(q.qst_id)||typeof q.txt_text!=='string'||!q.txt_text.trim()||!Array.isArray(q.classes)||!q.classes.length)throw Error('Ungültige Frage');
    ids.add(q.qst_id);
    if(!Array.isArray(q.answers)||q.answers.length<2||q.answers.length>10||!q.answers.some(a=>a?.ans_correct===1))throw Error('Antworten unvollständig');
    for(const answer of q.answers)if(typeof answer?.txt_text!=='string'||![0,1].includes(answer.ans_correct))throw Error('Antwortschlüssel ungültig');
    if(!Number.isFinite(q.qst_value)||q.qst_value<0)throw Error('Punkte ungültig');
  }
  for(const q of questions)if(Number.isInteger(q.qst_sub)&&q.qst_sub>0&&!ids.has(q.qst_sub))throw Error('Zusatzfrage fehlt');
  return questions;
}

export default async function handler(){
  try{
    const upstream=await fetch(SOURCE,{headers:{accept:'application/json','user-agent':'Fahrklar-Web/1.0 (personal learning; github.com/paulschenkenfelder31-debug/Lern-App)'},signal:AbortSignal.timeout(45000)});
    if(!upstream.ok)throw Error('Quelle antwortet mit HTTP '+upstream.status);
    const raw=await upstream.text();if(raw.length>25000000)throw Error('Quelldatei ist zu groß');
    const questions=validateQuestions(JSON.parse(raw)?.result?.pageContext?.questions);
    const serialized=JSON.stringify(questions),now=Date.now(),hash=createHash('sha256').update(serialized).digest('hex');
    return Response.json({questions,meta:{checkedAt:now,changedAt:now,hash,count:questions.length,source:SOURCE,etag:upstream.headers.get('etag'),serverModified:upstream.headers.get('last-modified')}},{headers:{'cache-control':'public, max-age=0, must-revalidate','netlify-cdn-cache-control':'public, durable, s-maxage=21600, stale-while-revalidate=86400'}});
  }catch(error){
    console.error('catalog refresh failed',error instanceof Error?error.message:'unknown');
    return Response.json({error:'Der Fragenkatalog ist gerade nicht erreichbar.'},{status:502,headers:{'cache-control':'no-store'}});
  }
}
