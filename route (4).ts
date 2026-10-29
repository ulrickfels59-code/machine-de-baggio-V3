import {db,bucket,jsonError,safeName} from '@/lib/data';
import {learnerActor,mutationAllowed} from '@/lib/learning';
import {ensureProjectVisual} from '@/lib/project-visual';
export const dynamic='force-dynamic';
const LIMIT=25*1024*1024;
export async function GET(request:Request){
 const actor=await learnerActor();if(!actor)return jsonError('Connexion requise.',401);
 const url=new URL(request.url),projectId=url.searchParams.get('projectId')||'',id=url.searchParams.get('modelId')||'';
 const project=await db().prepare('SELECT class_id FROM class_projects WHERE id=?').bind(projectId).first<{class_id:string}>();
 if(!project||(!actor.admin&&project.class_id!==actor.classId))return jsonError('Projet indisponible.',404);
 await ensureProjectVisual();const row=await db().prepare('SELECT glb_key,step_key,filename FROM project_visual_uploads WHERE id=? AND project_id=?').bind(id,projectId).first<{glb_key:string;step_key:string;filename:string}>();
 if(!row)return jsonError('Modèle indisponible.',404);
 const original=url.searchParams.get('format')==='step',object=await bucket().get(original?row.step_key:row.glb_key);if(!object)return jsonError('Fichier indisponible.',404);
 return new Response(object.body,{headers:{'Content-Type':original?'application/step':'model/gltf-binary','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff',...(original?{'Content-Disposition':`attachment; filename="${row.filename.replace(/[^a-zA-Z0-9._-]/g,'_')}"`}:{})}});
}
export async function POST(request:Request){
 const actor=await learnerActor();if(!actor)return jsonError('Connexion requise.',401);if(!actor.admin)return jsonError('Import réservé au professeur.',403);if(!mutationAllowed(request))return jsonError('Origine refusée.',403);
 if(Number(request.headers.get('Content-Length')||0)>LIMIT*2+1024*1024)return jsonError('Fichier trop volumineux.',413);
 let form:FormData;try{form=await request.formData()}catch{return jsonError('Import invalide.')}
 const projectId=safeName(form.get('projectId'),80),id=safeName(form.get('modelId'),80),expected=safeName(form.get('expectedModel'),80),step=form.get('step'),model=form.get('model');
 if(!/^[a-f0-9-]{36}$/.test(id)||!(step instanceof File)||!(model instanceof File)||!step.size||!model.size||step.size>LIMIT||model.size>LIMIT)return jsonError('STEP et modèle 3D : 25 Mo maximum chacun.',413);
 if(!/\.(stp|step)$/i.test(step.name)||!new TextDecoder().decode(await step.slice(0,512).arrayBuffer()).includes('ISO-10303-21'))return jsonError('Choisis un fichier STEP (.stp ou .step) valide.');
 const project=await db().prepare('SELECT id FROM class_projects WHERE id=?').bind(projectId).first();if(!project)return jsonError('Projet inconnu.',404);
 await ensureProjectVisual();
 const current=await db().prepare('SELECT model FROM project_visual_config WHERE project_id=?').bind(projectId).first<{model:string}>();if((current?.model||'')!==expected)return jsonError('Un autre modèle a été ajouté. Actualise avant de réessayer.',409);
 if(await db().prepare('SELECT id FROM project_visual_uploads WHERE id=?').bind(id).first())return jsonError('Import déjà enregistré. Actualise le projet.',409);
 const raw=form.get('catalog');if(typeof raw!=='string'||raw.length>700000)return jsonError('Catalogue de pièces invalide.');
 let parts:{id:string;name:string;label:string;initialState:string}[];
 try{parts=JSON.parse(raw);if(!Array.isArray(parts)||parts.length===0||parts.length>2000||new Set(parts.map(p=>p.id)).size!==parts.length||parts.some(p=>typeof p.name!=='string'||typeof p.label!=='string'||p.name.length>160||p.label.length>200||!new RegExp('^'+id+'-part-[0-9]{1,5}$').test(p.id)||p.initialState!=='todo'))throw Error();}catch{return jsonError('Catalogue de pièces invalide (2 000 éléments maximum).')}
 const buffer=await model.arrayBuffer(),view=new DataView(buffer);let gltf:any;
 try{if(buffer.byteLength<28||view.getUint32(0,true)!==0x46546c67||view.getUint32(4,true)!==2||view.getUint32(8,true)!==buffer.byteLength||view.getUint32(16,true)!==0x4e4f534a)throw Error();const size=view.getUint32(12,true);if(size>1000000||20+size>buffer.byteLength)throw Error();gltf=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,20,size)));if(gltf.asset?.version!=='2.0'||gltf.nodes?.length!==parts.length||gltf.meshes?.length!==parts.length||gltf.nodes.some((n:any,i:number)=>n.extras?.partId!==parts[i].id)||JSON.stringify(gltf).includes('"uri"'))throw Error();}catch{return jsonError('Modèle 3D converti invalide.')}
 const keys={step:`project-models/${id}/source.step`,glb:`project-models/${id}/model.glb`};let stored=false;
 try{
  await bucket().put(keys.step,step.stream(),{httpMetadata:{contentType:'application/step'}});
  await bucket().put(keys.glb,buffer,{httpMetadata:{contentType:'model/gltf-binary'}});
  // The conditional update prevents simultaneous imports from replacing each other.
  const results=await db().batch([
   db().prepare('INSERT INTO project_visual_uploads(id,project_id,filename,glb_key,step_key,catalog,size,created_at,created_by) VALUES (?,?,?,?,?,?,?,?,?)').bind(id,projectId,safeName(step.name,180),keys.glb,keys.step,JSON.stringify(parts),step.size+model.size,new Date().toISOString(),actor.name),
   db().prepare('INSERT INTO project_visual_config(project_id,model) SELECT ?,? WHERE ?=\'\' ON CONFLICT(project_id) DO UPDATE SET model=excluded.model WHERE project_visual_config.model=?').bind(projectId,id,expected,expected)
  ]);
  // For an existing configuration, INSERT SELECT must produce a row to run UPSERT.
  let changed=results[1].meta.changes;
  if(!changed&&expected){const r=await db().prepare('UPDATE project_visual_config SET model=? WHERE project_id=? AND model=?').bind(id,projectId,expected).run();changed=r.meta.changes;}
  if(!changed){await db().prepare('DELETE FROM project_visual_uploads WHERE id=?').bind(id).run();throw Error('conflict');}
  stored=true;return Response.json({ok:true,modelId:id,parts:parts.length});
 }catch(e){if(!stored){await Promise.allSettled([bucket().delete(keys.step),bucket().delete(keys.glb)]);}if(e instanceof Error&&e.message==='conflict')return jsonError('Un autre modèle a été ajouté. Actualise le projet.',409);return jsonError('Enregistrement impossible. Réessaie l’import.',500);}
}
