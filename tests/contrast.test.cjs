const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const css=fs.readFileSync('app/src/main/assets/style.css','utf8');
const block=sel=>{const m=css.match(new RegExp('(?:^|[}\\s])'+sel.replace(/\./g,'\\.')+'\\{([^}]*)\\}'));assert.ok(m,'Block fehlt: '+sel);return Object.fromEntries([...m[1].matchAll(/(--[a-z-]+):([^;}]+)/g)].map(x=>[x[1],x[2].trim()]));};
const rgb=h=>{h=h.replace('#','');if(h.length===3)h=[...h].map(c=>c+c).join('');return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255);};
const lum=h=>{const c=rgb(h).map(v=>v<=.03928?v/12.92:((v+.055)/1.055)**2.4);return .2126*c[0]+.7152*c[1]+.0722*c[2];};
const ratio=(a,b)=>{const [x,y]=[lum(a),lum(b)].sort((p,q)=>q-p);return (x+.05)/(y+.05);};
const pairs=[['--text','--bg'],['--text','--surface'],['--text-muted','--bg'],['--text-muted','--surface'],['--on-accent','--accent-strong'],['--accent-strong','--surface'],['--accent-strong','--bg'],['--ok','--ok-soft'],['--bad','--bad-soft']];
test('Style sheet has exactly one token layer without legacy names',()=>{
  assert.equal((css.match(/:root\{/g)||[]).length,1);
  assert.doesNotMatch(css,/(?:^|})\s*\.dark\{/);
  for(const old of ['--muted','--soft','--green','--greenbg','--red','--redbg','--yellow','--accent-dark','--purple','--accent-light','--accent-border','--result-bg'])assert.doesNotMatch(css,new RegExp('var\\('+old+'\\)'),old);
});
for(const theme of ['green','blue','purple','orange'])for(const dark of [false,true])test(`Contrast holds for theme-${theme} ${dark?'dark':'light'}`,()=>{
  const t={...block(':root'),...(dark?block('body.dark'):{}),...block(`body.${dark?'dark.':''}theme-${theme}`)};
  for(const [fg,bg] of pairs){assert.ok(t[fg]&&t[bg],`Token fehlt: ${fg} oder ${bg}`);const r=ratio(t[fg],t[bg]);assert.ok(r>=4.5,`${fg} auf ${bg}: ${r.toFixed(2)}`);}
});
