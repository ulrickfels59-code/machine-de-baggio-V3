/* Atelier Baggio: restores the verified update folders before Cloudflare builds.
 * Upload this file, package.json and BAGGIO-STEP.data together at repository root.
 * Only the app/, lib/ and public/ update files are written; nothing is deleted.
 */
'use strict';
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),crypto=require('node:crypto');
const EXPECTED_SHA256='b46d44523e83601d13168bb9f4c09f463d65634cf2b3b65c804930a06b1eda28';
const root=__dirname,payload=path.join(root,'BAGGIO-STEP.data');
function fail(message){throw Error('[Baggio STEP] '+message);}
if(!fs.existsSync(payload))fail('BAGGIO-STEP.data manque. Envoyer les trois fichiers ensemble à la racine du dépôt.');
const compressed=fs.readFileSync(payload);
if(crypto.createHash('sha256').update(compressed).digest('hex')!==EXPECTED_SHA256)fail('Archive de mise à jour incorrecte ou incomplète.');
const tar=zlib.gunzipSync(compressed,{maxOutputLength:64*1024*1024}),files=new Map();
let offset=0;
while(offset+512<=tar.length){
 const header=tar.subarray(offset,offset+512);if(header.every(n=>n===0))break;
 const text=(start,end)=>header.subarray(start,end).toString('utf8').replace(/\0.*$/s,'');
 const prefix=text(345,500),raw=(prefix?prefix+'/':'')+text(0,100),name=raw.replace(/^\.\//,''),kind=text(156,157)||'0',size=parseInt(text(124,136).trim()||'0',8);
 if(!Number.isSafeInteger(size)||size<0||offset+512+size>tar.length)fail('Archive tronquée.');
 if(kind==='0'){
  if(!/^(app|lib|public)\//.test(name)||name.includes('\\')||name.split('/').some(p=>p==='..'||p==='.'||!p)||files.has(name))fail('Chemin inattendu dans la mise à jour.');
  if(size>26*1024*1024)fail('Un fichier dépasse la taille prévue.');
  files.set(name,tar.subarray(offset+512,offset+512+size));
 }else if(kind!=='5')fail('Type de fichier inattendu.');
 offset+=512+Math.ceil(size/512)*512;
}
for(const required of ['app/classes-panel.tsx','app/step-upload.tsx','app/project-visual.tsx','app/api/project-model/route.ts','app/api/project-visual/route.ts','lib/project-visual.ts','public/vendor/step/occt-import-js.wasm','public/vendor/step/convert-worker.js'])if(!files.has(required))fail('Fichier requis absent : '+required);
if(files.size!==55)fail('Nombre de fichiers inattendu dans la mise à jour.');
// Reject symlinks before any writes, including existing destination files.
for(const name of files.keys()){
 let current=root;for(const segment of name.split('/')){current=path.join(current,segment);if(fs.existsSync(current)&&fs.lstatSync(current).isSymbolicLink())fail('Lien symbolique refusé : '+name);}
}
let changed=0;
for(const [name,bytes] of files){const target=path.join(root,name);if(fs.existsSync(target)&&fs.readFileSync(target).equals(bytes))continue;fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes);changed++;}
console.log(`[Baggio STEP] Installation vérifiée : ${files.size} fichiers aux bons emplacements (${changed} actualisés).`);
