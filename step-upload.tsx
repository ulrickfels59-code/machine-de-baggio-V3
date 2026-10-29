'use client';
import {useEffect,useRef,useState} from 'react';
import {toast} from 'sonner';
type Packed={buffer:ArrayBuffer;catalog:{id:string;name:string;label:string;initialState:string}[]};
export default function StepUpload({projectId,expectedModel,hasModel,onSaved}:{projectId:string;expectedModel:string;hasModel:boolean;onSaved:()=>Promise<unknown>}){
 const input=useRef<HTMLInputElement>(null),worker=useRef<Worker|null>(null),cancelled=useRef(false),abort=useRef<AbortController|null>(null);
 const cancelConversion=useRef<()=>void>(()=>{});
 const [busy,setBusy]=useState(false),[status,setStatus]=useState(''),[error,setError]=useState(''),[candidate,setCandidate]=useState<File|null>(null);
 useEffect(()=>()=>{cancelled.current=true;cancelConversion.current();worker.current?.terminate();abort.current?.abort();},[]);
 function cancel(){cancelled.current=true;cancelConversion.current();worker.current?.terminate();worker.current=null;abort.current?.abort();setBusy(false);setStatus('');setError('Import interrompu sur ce poste. Actualise le projet pour vérifier le modèle enregistré.');}
 async function convert(file:File,id:string){return new Promise<Packed>(async(resolve,reject)=>{
  let timer:ReturnType<typeof setTimeout>|undefined;
  try{const w=new Worker('/vendor/step/convert-worker.js');worker.current=w;
   const stop=()=>{clearTimeout(timer);w.terminate();if(worker.current===w)worker.current=null;cancelConversion.current=()=>{};};
   cancelConversion.current=()=>{stop();reject(Error('Import annulé.'));};
   timer=setTimeout(()=>{stop();reject(Error('La conversion est trop longue. Essaie un assemblage simplifié.'));},180000);
   w.onmessage=e=>{if(e.data.error){stop();reject(Error(e.data.error))}else if(e.data.done){stop();resolve(e.data)}else if(e.data.status)setStatus(e.data.status)};
   w.onerror=()=>{stop();reject(Error('Le lecteur STEP n’a pas pu démarrer. Vérifie que tous les fichiers de la mise à jour sont installés.'));};
   const buffer=await file.arrayBuffer();if(cancelled.current){stop();reject(Error('Import annulé.'));return;}w.postMessage({buffer,id},[buffer]);
  }catch(e){clearTimeout(timer);worker.current?.terminate();reject(e);}
 });}
 async function upload(file:File){
  cancelled.current=false;setBusy(true);setError('');setCandidate(null);
  try{
   if(!/\.(stp|step)$/i.test(file.name)||!file.size||file.size>25*1024*1024)throw Error('Choisis un STEP (.stp ou .step) de 25 Mo maximum.');
   if(!new TextDecoder().decode(await file.slice(0,512).arrayBuffer()).includes('ISO-10303-21'))throw Error('Ce fichier n’est pas un STEP valide. Un paquet TopSolid .TopPkg doit être exporté au format STEP.');
   const id=crypto.randomUUID(),packed=await convert(file,id);if(cancelled.current)return;
   if(packed.buffer.byteLength>25*1024*1024)throw Error('Le modèle converti dépasse 25 Mo. Exporte un assemblage simplifié.');
   setStatus('Enregistrement du modèle dans le projet…');abort.current=new AbortController();
   const body=new FormData();body.append('projectId',projectId);body.append('modelId',id);body.append('expectedModel',expectedModel);body.append('step',file);body.append('model',new Blob([packed.buffer],{type:'model/gltf-binary'}),'model.glb');body.append('catalog',JSON.stringify(packed.catalog));
   const token=sessionStorage.getItem('atelier_admin_token'),response=await fetch('/api/project-model',{method:'POST',headers:token?{Authorization:`Bearer ${token}`}:{},body,signal:abort.current.signal});
   const value=await response.json() as {error?:string};if(!response.ok)throw Error(value.error||'Enregistrement impossible.');
   await onSaved();setStatus('');toast.success('Le modèle 3D est ajouté au projet et accessible aux élèves.');
  }catch(e){if(!cancelled.current){setError(e instanceof Error?e.message:'Import impossible.');setStatus('');}}finally{if(!cancelled.current)setBusy(false);}
 }
 return <div className="pv-upload"><input ref={input} type="file" accept=".stp,.step" hidden onChange={e=>{const f=e.target.files?.[0];e.target.value='';if(f){if(hasModel)setCandidate(f);else upload(f)}}}/><button type="button" className="primary" disabled={busy} onClick={()=>input.current?.click()}>{busy?'Import du STEP…':hasModel?'Remplacer le modèle STEP':'Ajouter un modèle STEP'}</button><span>Assemblage .stp ou .step · 25 Mo maximum</span>{busy&&<><p role="status">{status}</p><button type="button" className="secondary" onClick={cancel}>Annuler l’import</button></>}{error&&<p role="alert" className="error">{error}</p>}{candidate&&<div className="pv-replace"><p>Remplacer le modèle actuel par « {candidate.name} » ? Le nouveau modèle aura son propre suivi, initialement gris. Le suivi précédent reste conservé dans la base.</p><button type="button" className="primary" onClick={()=>upload(candidate)}>Importer ce modèle</button><button type="button" className="secondary" onClick={()=>setCandidate(null)}>Conserver le modèle actuel</button></div>}</div>;
}
