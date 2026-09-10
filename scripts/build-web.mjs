import {copyFile, mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';

const root=resolve(import.meta.dirname,'..');
const assets=resolve(root,'app/src/main/assets');
const web=resolve(root,'web');
const dist=resolve(root,'dist');

await rm(dist,{recursive:true,force:true});
await mkdir(dist,{recursive:true});
for(const name of ['app.js','core.js','icons.js','style.css'])await copyFile(resolve(assets,name),resolve(dist,name));
for(const name of ['web-bridge.js','sw.js','manifest.webmanifest','icon.svg','icon-192.png','icon-512.png'])await copyFile(resolve(web,name),resolve(dist,name));

let html=await readFile(resolve(assets,'index.html'),'utf8');
html=html
  .replace('<title>Fahrklar</title>','<title>Fahrklar – Führerschein lernen</title><meta name="description" content="Österreichische Führerscheinfragen lernen, Fehler wiederholen und Prüfungen simulieren."><meta name="theme-color" content="#159a5b"><link rel="manifest" href="manifest.webmanifest"><link rel="icon" href="icon.svg" type="image/svg+xml">')
  .replace('<script src="core.js"></script>','<script src="web-bridge.js"></script><script src="core.js"></script>');
await writeFile(resolve(dist,'index.html'),html);
console.log('Fahrklar Web-PWA wurde nach dist gebaut.');
