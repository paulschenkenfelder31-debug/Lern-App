'use strict';
(function(root){
const config=root.FahrklarFirebaseConfig||{enabled:false};
const storage=typeof localStorage!=='undefined'?localStorage:{getItem(){return null;},setItem(){},removeItem(){}};
const sessionKey='fahrklar-auth-'+(config.projectId||'none'),metaKey='fahrklar-cloud-meta-'+(config.projectId||'none');
let auth=null,busy=false,pendingState=null;
const emit=(type,payload={})=>root.cloudEvent?.(type,JSON.stringify(payload));
const clone=value=>JSON.parse(JSON.stringify(value));
function read(key,fallback=null){try{return JSON.parse(storage.getItem(key)||'null')||fallback;}catch{return fallback;}}
function write(key,value){try{storage.setItem(key,JSON.stringify(value));}catch{}}
function errorMessage(error){
  const raw=String(error?.firebaseCode||error?.message||'').toUpperCase();
  if(raw.includes('EMAIL_EXISTS'))return'Für diese E-Mail-Adresse gibt es bereits ein Konto.';
  if(raw.includes('INVALID_EMAIL'))return'Bitte gib eine gültige E-Mail-Adresse ein.';
  if(raw.includes('INVALID_LOGIN_CREDENTIALS')||raw.includes('EMAIL_NOT_FOUND')||raw.includes('INVALID_PASSWORD'))return'E-Mail-Adresse oder Passwort ist nicht richtig.';
  if(raw.includes('WEAK_PASSWORD'))return'Das Passwort muss mindestens 6 Zeichen lang sein.';
  if(raw.includes('TOO_MANY_ATTEMPTS'))return'Zu viele Versuche. Bitte warte kurz und versuche es später erneut.';
  if(raw.includes('NETWORK')||error instanceof TypeError)return'Keine Verbindung. Deine lokalen Daten bleiben erhalten.';
  return'Der Kontodienst ist gerade nicht verfügbar. Bitte versuche es später erneut.';
}
async function request(url,options={}){
  const response=await fetch(url,options),body=await response.json().catch(()=>({}));
  if(!response.ok){const e=new Error('Firebase request failed');e.firebaseCode=body?.error?.message||String(response.status);throw e;}
  return body;
}
function authUrl(action){return'https://identitytoolkit.googleapis.com/v1/accounts:'+action+'?key='+encodeURIComponent(config.apiKey);}
async function authRequest(action,body){return request(authUrl(action),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});}
function saveAuth(data){
  auth={idToken:data.idToken,refreshToken:data.refreshToken||auth?.refreshToken,email:data.email||auth?.email||'',verified:data.emailVerified===true||auth?.verified===true,expiresAt:Date.now()+(Number(data.expiresIn)||3600)*1000-60000};
  write(sessionKey,auth);return auth;
}
async function refresh(){
  if(!auth?.refreshToken)throw new Error('NO_SESSION');
  const data=await request('https://securetoken.googleapis.com/v1/token?key='+encodeURIComponent(config.apiKey),{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'refresh_token',refresh_token:auth.refreshToken})});
  saveAuth({idToken:data.id_token,refreshToken:data.refresh_token,expiresIn:data.expires_in,email:auth.email,emailVerified:auth.verified});
}
async function token(){if(!auth)throw new Error('NO_SESSION');if(!auth.idToken||Date.now()>=auth.expiresAt)await refresh();return auth.idToken;}
async function lookup(){
  const data=await authRequest('lookup',{idToken:await token()}),user=data.users?.[0];
  if(!user)throw new Error('NO_SESSION');
  auth.email=user.email||auth.email;auth.verified=user.emailVerified===true;write(sessionKey,auth);return user;
}
function account(){return auth?{configured:true,signedIn:true,email:auth.email||'',verified:!!auth.verified}:{configured:true,signedIn:false,email:'',verified:false};}
async function init(){
  if(!config.enabled){emit('unconfigured');return;}
  auth=read(sessionKey);
  if(!auth){emit('account',account());return;}
  try{await lookup();emit('account',account());if(auth.verified&&pendingState)sync(pendingState);}
  catch{auth=null;storage.removeItem(sessionKey);emit('account',account());}
}
async function signUp(email,password){
  try{const data=await authRequest('signUp',{email:email.trim(),password,returnSecureToken:true});saveAuth(data);await authRequest('sendOobCode',{requestType:'VERIFY_EMAIL',idToken:auth.idToken});emit('account',account());emit('notice',{message:'Bestätigungs-E-Mail gesendet. Öffne den Link und tippe danach auf „Bestätigung prüfen“.'});}
  catch(error){emit('error',{message:errorMessage(error)});}
}
async function signIn(email,password){
  try{const data=await authRequest('signInWithPassword',{email:email.trim(),password,returnSecureToken:true});saveAuth(data);await lookup();emit('account',account());if(!auth.verified)emit('notice',{message:'Bitte bestätige zuerst deine E-Mail-Adresse.'});if(auth.verified&&pendingState)sync(pendingState);}
  catch(error){emit('error',{message:errorMessage(error)});}
}
async function signOut(){auth=null;pendingState=null;storage.removeItem(sessionKey);emit('account',account());emit('notice',{message:'Du bist abgemeldet. Deine lokalen Daten bleiben erhalten.'});}
async function resend(){
  try{await authRequest('sendOobCode',{requestType:'VERIFY_EMAIL',idToken:await token()});emit('notice',{message:'Bestätigungs-E-Mail wurde erneut gesendet.'});}
  catch(error){emit('error',{message:errorMessage(error)});}
}
async function verify(){
  try{await refresh();await lookup();emit('account',account());if(auth.verified){emit('notice',{message:'E-Mail bestätigt. Dein Lernstand wird synchronisiert.'});if(pendingState)sync(pendingState);}else emit('notice',{message:'Noch nicht bestätigt. Öffne zuerst den Link in der E-Mail.'});}
  catch(error){emit('error',{message:errorMessage(error)});}
}
async function resetPassword(email){
  try{await authRequest('sendOobCode',{requestType:'PASSWORD_RESET',email:email.trim()});emit('notice',{message:'Wenn ein Konto existiert, wurde eine E-Mail zum Zurücksetzen gesendet.'});}
  catch(error){emit('error',{message:errorMessage(error)});}
}
function documentUrl(path){return'https://firestore.googleapis.com/v1/projects/'+encodeURIComponent(config.projectId)+'/databases/(default)/documents/'+path;}
async function firestore(path,options={}){
  const idToken=await token(),headers={...(options.headers||{}),authorization:'Bearer '+idToken};
  return request(documentUrl(path)+(options.query||''),{...options,headers});
}
const encoded=value=>({fields:{json:{stringValue:JSON.stringify(value)},updatedAt:{integerValue:String(Date.now())}}});
function decoded(doc){try{return JSON.parse(doc?.fields?.json?.stringValue||'null');}catch{return null;}}
async function getDoc(path){try{return decoded(await firestore(path));}catch(error){if(String(error.firebaseCode).includes('NOT_FOUND'))return null;throw error;}}
async function putDoc(path,value){return firestore(path,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify(encoded(value))});}
async function listSessions(){
  let result=[],page='';
  do{const data=await firestore('',{query:'?pageSize=300'+(page?'&pageToken='+encodeURIComponent(page):'')+'&showMissing=false'}).catch(()=>({}));void data;break;}while(page);
  page='';
  do{const suffix='users/'+auth.localId+'/sessions';const data=await firestore(suffix,{query:'?pageSize=300'+(page?'&pageToken='+encodeURIComponent(page):'')});for(const doc of data.documents||[]){const value=decoded(doc);if(value?.id)result.push(value);}page=data.nextPageToken||'';}while(page);
  return result;
}
function docId(id){return encodeURIComponent(String(id)).replaceAll('%','_').slice(0,500);}
async function ensureLocalId(){if(auth.localId)return auth.localId;const user=await lookup();auth.localId=user.localId;write(sessionKey,auth);return auth.localId;}
async function sync(localState){
  pendingState=clone(localState);if(!auth?.verified||busy)return;
  busy=true;emit('syncing');
  try{
    const uid=await ensureLocalId(),prefix='users/'+uid,local=pendingState,meta=read(metaKey,{}),first=meta.uid!==uid;
    const [remoteSettings,remoteBookmarks,remoteSessions]=await Promise.all([getDoc(prefix+'/settings/current'),getDoc(prefix+'/bookmarks/current'),listSessions()]);
    const settingsChanged=!first&&meta.settings!==JSON.stringify(local.settings),bookmarksChanged=!first&&meta.bookmarks!==JSON.stringify(local.bookmarks||[]);
    let settings=clone(local.settings),bookmarks=[...new Set(local.bookmarks||[])];
    if(remoteSettings&&!settingsChanged)settings={...settings,...remoteSettings};
    if(remoteBookmarks&&!bookmarksChanged)bookmarks=first?[...new Set([...bookmarks,...remoteBookmarks])] : remoteBookmarks;
    const merged=new Map((local.sessions||[]).map(s=>[s.id,clone(s)]));
    for(const remote of remoteSessions)if(!merged.has(remote.id)||(remote.ended||0)>(merged.get(remote.id).ended||0))merged.set(remote.id,remote);
    const sessions=[...merged.values()].sort((a,b)=>a.started-b.started),remoteIds=new Set(remoteSessions.map(s=>s.id));
    const writes=[];
    if(!remoteSettings||settingsChanged)writes.push(putDoc(prefix+'/settings/current',settings));
    if(!remoteBookmarks||bookmarksChanged||first)writes.push(putDoc(prefix+'/bookmarks/current',bookmarks));
    for(const session of sessions)if(!remoteIds.has(session.id))writes.push(putDoc(prefix+'/sessions/'+docId(session.id),session));
    for(let i=0;i<writes.length;i+=8)await Promise.all(writes.slice(i,i+8));
    const completed=new Set(sessions.map(s=>s.id)),attempts=sessions.flatMap(s=>s.attempts||[]);
    for(const attempt of local.attempts||[])if(!completed.has(attempt.sessionId))attempts.push(attempt);
    write(metaKey,{uid,settings:JSON.stringify(settings),bookmarks:JSON.stringify(bookmarks)});
    emit('synced',{state:{...local,settings,bookmarks,sessions,attempts},count:sessions.length});
  }catch(error){emit('error',{message:errorMessage(error)});}finally{busy=false;}
}
async function deleteAccount(){
  if(!auth?.verified)return;
  try{
    const uid=await ensureLocalId(),sessions=await listSessions();
    for(const session of sessions)await firestore('users/'+uid+'/sessions/'+docId(session.id),{method:'DELETE'});
    for(const path of ['settings/current','bookmarks/current'])await firestore('users/'+uid+'/'+path,{method:'DELETE'}).catch(()=>{});
    await authRequest('delete',{idToken:await token()});auth=null;pendingState=null;storage.removeItem(sessionKey);storage.removeItem(metaKey);emit('account',account());emit('notice',{message:'Konto und Cloud-Daten wurden gelöscht. Lokale Daten bleiben auf diesem Gerät.'});
  }catch(error){emit('error',{message:errorMessage(error)});}
}
root.CloudSync={configured:()=>!!config.enabled,init,signUp,signIn,signOut,resend,verify,resetPassword,sync,deleteAccount};
})(typeof window!=='undefined'?window:globalThis);
