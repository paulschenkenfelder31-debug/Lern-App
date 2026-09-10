const {test}=require('node:test');
const assert=require('node:assert/strict');

test('Web catalog proxy validates and packages the live source',async()=>{
  const {default:handler}=await import('../web/functions/catalog.mjs');
  const questions=Array.from({length:100},(_,i)=>({qst_id:i+1,txt_text:'Frage '+(i+1),qst_value:3,classes:[3],answers:[{txt_text:'Richtig',ans_correct:1},{txt_text:'Falsch',ans_correct:0}]}));
  const original=global.fetch;global.fetch=async()=>new Response(JSON.stringify({result:{pageContext:{questions}}}),{status:200,headers:{etag:'test'}});
  try{const response=await handler(new Request('https://example.test/catalog.json'));const body=await response.json();assert.equal(response.status,200);assert.equal(body.questions.length,100);assert.equal(body.meta.count,100);assert.equal(body.meta.etag,'test');assert.match(body.meta.hash,/^[a-f0-9]{64}$/);}finally{global.fetch=original;}
});

test('Web catalog proxy rejects incomplete answer keys',async()=>{
  const {default:handler}=await import('../web/functions/catalog.mjs');
  const questions=Array.from({length:100},(_,i)=>({qst_id:i+1,txt_text:'Frage',classes:[3],answers:[{txt_text:'A',ans_correct:0},{txt_text:'B',ans_correct:0}]}));
  const original=global.fetch;global.fetch=async()=>new Response(JSON.stringify({result:{pageContext:{questions}}}));
  try{const response=await handler(new Request('https://example.test/catalog.json'));assert.equal(response.status,502);assert.equal((await response.json()).error,'Der Fragenkatalog ist gerade nicht erreichbar.');}finally{global.fetch=original;}
});

test('Web Gemini helpers select available Flash models and preserve the answer key',async()=>{
  const G=await import('../web/functions/gemini.mjs');
  assert.equal(G.selectModel({models:[{name:'models/gemini-2.5-flash',supportedGenerationMethods:['generateContent']}]}),'models/gemini-2.5-flash');
  assert.throws(()=>G.normalizeKey('Bearer secret'));
  const payload=await G.buildPayload({text:'Was gilt?',image:null,answers:[{text:'Das ist richtig.',correct:true,image:null},{text:'Das ist falsch.',correct:false,image:null}]});
  assert.match(payload.contents[0].parts[0].text,/laut Katalog richtig/);assert.match(payload.contents[0].parts[0].text,/laut Katalog falsch/);
  assert.equal(G.extractText({candidates:[{finishReason:'STOP',content:{parts:[{text:'Einfach erklärt.'}]}}]}),'Einfach erklärt.');
});
