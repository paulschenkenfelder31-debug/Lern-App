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
