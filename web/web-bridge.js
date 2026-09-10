'use strict';
(()=>{
  const STATE='fahrklar',AI_KEY='fahrklar-gemini-session';
  let wakeLock=null;
  const emit=(type,message)=>window.nativeEvent?.(type,message);
  const apiKey=()=>sessionStorage.getItem(AI_KEY)||'';
  function validKey(raw){
    const key=String(raw||'').trim(),low=key.toLowerCase();
    if(!key)throw Error('Bitte deinen vollständigen Gemini-API-Key einfügen.');
    if(key.length>8192)throw Error('Die Eingabe ist länger als 8192 Zeichen. Bitte nur den API-Key einfügen.');
    if(key.startsWith('{')||key.startsWith('[')||low.includes('private_key')||low.startsWith('bearer ')||low.startsWith('curl ')||low.includes('x-goog-api-key:'))throw Error('Bitte nur einen API-Key aus Google AI Studio einfügen.');
    for(const ch of key)if(ch.charCodeAt(0)<33||ch.charCodeAt(0)>126)throw Error('Im Key befinden sich Leerzeichen oder Zeilenumbrüche.');
    return key;
  }
  function keyDialog(){
    const old=document.querySelector('#web-key-dialog');if(old)old.remove();
    const dialog=document.createElement('dialog');dialog.id='web-key-dialog';dialog.className='card';
    dialog.innerHTML='<form method="dialog"><h2>Gemini einrichten</h2><p class="muted">Der Key bleibt nur bis zum Schließen dieser Browser-Sitzung gespeichert.</p><label for="web-gemini-key">Gemini-API-Key</label><input id="web-gemini-key" type="password" autocomplete="off" spellcheck="false"><p id="web-key-count" class="tiny muted">0 Zeichen</p><p id="web-key-error" class="notice" hidden></p><div class="row"><button value="cancel">Abbrechen</button><button class="primary" value="save">Speichern</button></div></form>';
    document.body.append(dialog);const input=dialog.querySelector('input'),count=dialog.querySelector('#web-key-count'),error=dialog.querySelector('#web-key-error');
    input.addEventListener('input',()=>count.textContent=input.value.length+' Zeichen');
    dialog.addEventListener('close',()=>{if(dialog.returnValue==='save'){try{sessionStorage.setItem(AI_KEY,validKey(input.value));emit('ai-key','saved');}catch(e){dialog.showModal();error.hidden=false;error.textContent=e.message;input.focus();return;}}input.value='';dialog.remove();});
    dialog.showModal();input.focus();
  }
  async function gemini(mode,question,id){
    try{
      const response=await fetch('/api/gemini',{method:'POST',headers:{'content-type':'application/json','x-fahrklar-gemini-key':apiKey()},body:JSON.stringify({mode,question})});
      const result=await response.json().catch(()=>({error:'Die Gemini-Antwort konnte nicht gelesen werden.'}));
      if(!response.ok)throw Error(result.error||'Gemini ist gerade nicht verfügbar.');
      if(mode==='test')emit('ai-test',result.message||'Verbindung erfolgreich.');else emit('ai-result',JSON.stringify({id,text:result.text}));
    }catch(e){if(mode==='test')emit('ai-test-error',e.message);else emit('ai-error',JSON.stringify({id,text:e.message}));}
  }
  async function cacheImages(modulesJson){
    try{
      const selected=new Set(JSON.parse(modulesJson)),catalog=await fetch('/catalog.json').then(r=>r.json()),urls=[];
      for(const q of catalog.questions||[]){if(!(q.classes||[]).some(c=>selected.has(c)))continue;for(const id of [q.qst_image,...(q.answers||[]).map(a=>a.ans_image)])if(Number.isInteger(id)&&id>0)urls.push('https://img.f-online.at/'+id+'.jpg');}
      const unique=[...new Set(urls)],cache=await caches.open('fahrklar-images-v1');let done=0,failed=0,cursor=0;
      async function worker(){while(cursor<unique.length){const url=unique[cursor++];try{const response=await fetch(url,{mode:'no-cors'});await cache.put(url,response); }catch(e){failed++;}done++;if(done%20===0)emit('sync','Bilder: '+done+' / '+unique.length);}}
      await Promise.all(Array.from({length:Math.min(6,unique.length||1)},worker));emit('done','Bilder geprüft: '+done+'. Nicht verfügbar: '+failed+'.');
    }catch(e){emit('error','Bilder konnten nicht geladen werden.');}
  }
  async function setKeepAwake(enabled){
    try{if(enabled&&!wakeLock&&navigator.wakeLock){wakeLock=await navigator.wakeLock.request('screen');wakeLock.addEventListener('release',()=>{wakeLock=null;},{once:true});}else if(!enabled&&wakeLock){await wakeLock.release();wakeLock=null;}}catch(e){}
  }
  window.WebFeatures={
    loadState:()=>localStorage.getItem(STATE)||'{}',
    saveState:value=>{try{localStorage.setItem(STATE,value);return true;}catch(e){return false;}},
    appInfo:()=>JSON.stringify({version:'Web-PWA',stable:true}),
    hasGeminiKey:()=>!!apiKey(),configureGemini:keyDialog,
    deleteGeminiKey:()=>{if(confirm('Gemini-Key aus dieser Browser-Sitzung entfernen?')){sessionStorage.removeItem(AI_KEY);emit('ai-key','deleted');}},
    explainQuestion:(id,json)=>gemini('explain',JSON.parse(json),id),testGemini:()=>gemini('test',null,''),
    syncCatalog:async()=>{emit('sync','Fragenkatalog wird geladen …');try{const response=await fetch('/catalog.json?refresh='+Date.now(),{cache:'no-store'});if(!response.ok)throw Error();await response.json();emit('updated','Fragenkatalog geprüft und offline gespeichert.');}catch(e){emit('error','Aktualisierung fehlgeschlagen. Dein gespeicherter Katalog bleibt erhalten.');}},
    cacheImages,openSource:()=>window.open('https://www.f-online.app/at/fragenkatalog/alle-fragen/','_blank','noopener'),
    exportState:value=>{const blob=new Blob([value],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='fahrklar-sicherung.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);},
    importState:()=>{const input=document.createElement('input');input.type='file';input.accept='application/json,.json';input.onchange=()=>{const file=input.files?.[0];if(file)file.text().then(text=>emit('import',text)).catch(()=>emit('error','Datei konnte nicht gelesen werden.'));};input.click();},
    setKeepAwake,feedback:kind=>{if(navigator.vibrate)navigator.vibrate(kind==='wrong'?[35,25,35]:20);},
    checkUpdate:async()=>{try{const reg=await navigator.serviceWorker?.getRegistration();await reg?.update();reg?.waiting?.postMessage('SKIP_WAITING');emit('app-update',JSON.stringify({available:false,message:'Aktualisierung geprüft. Die neueste Web-Version ist bereit.'}));}catch(e){emit('app-update-error','Aktualisierung konnte nicht geprüft werden.');}},
    openUpdate:()=>location.reload()
  };
  if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&wakeLock)setKeepAwake(true);});
})();
