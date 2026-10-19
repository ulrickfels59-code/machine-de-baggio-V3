import { isAdmin } from '@/lib/auth';
import { bucket, db, jsonError, safeName } from '@/lib/data';
export async function POST(request:Request){
 if(!await isAdmin())return jsonError('Accès réservé à l’administration.',403);
 if(request.headers.get('content-type')?.includes('application/json')){const body=await request.json() as Record<string,unknown>,machineId=safeName(body.machineId,80),sectionId=safeName(body.sectionId,80),name=safeName(body.title);let url:URL;try{url=new URL(typeof body.url==='string'?body.url:'')}catch{return jsonError('Lien Google Sheets invalide.')}if(url.protocol!=='https:'||url.hostname!=='docs.google.com'||!url.pathname.startsWith('/spreadsheets/'))return jsonError('Utilise un lien https://docs.google.com/spreadsheets/…');if(!name)return jsonError('Titre requis.');if(!await db().prepare('SELECT id FROM sections WHERE id=? AND machine_id=?').bind(sectionId,machineId).first())return jsonError('Rubrique invalide.');const id=crypto.randomUUID();await db().prepare('INSERT INTO documents(id,machine_id,section_id,name,key,url,size,created_at) VALUES (?,?,?,?,?,?,?,?)').bind(id,machineId,sectionId,name,'',url.href,0,new Date().toISOString()).run();return Response.json({id});}
 const form=await request.formData(), file=form.get('file'), machineId=safeName(form.get('machineId'),80), sectionId=safeName(form.get('sectionId'),80), title=safeName(form.get('title'));
 if(!(file instanceof File)||file.type!=='application/pdf'||file.size>20*1024*1024||file.size<1)return jsonError('Choisir un PDF de 20 Mo maximum.');
 const section=await db().prepare('SELECT id FROM sections WHERE id=? AND machine_id=?').bind(sectionId,machineId).first();if(!section)return jsonError('Rubrique invalide.');
 const id=crypto.randomUUID(), key=`pdf/${id}`;
 await bucket().put(key,file.stream(),{httpMetadata:{contentType:'application/pdf'}});
 try{await db().prepare('INSERT INTO documents (id,machine_id,section_id,name,key,size,created_at) VALUES (?,?,?,?,?,?,?)').bind(id,machineId,sectionId,title||file.name.slice(0,100),key,file.size,new Date().toISOString()).run();}
 catch(e){await bucket().delete(key);throw e;}
 return Response.json({id});
}
export async function DELETE(request:Request){
 if(!await isAdmin())return jsonError('Accès réservé à l’administration.',403);
 const id=new URL(request.url).searchParams.get('id');if(!id)return jsonError('Document manquant.');
 const row=await db().prepare('SELECT key FROM documents WHERE id=?').bind(id).first<{key:string}>();if(!row)return jsonError('Document introuvable.',404);
 await db().prepare('DELETE FROM documents WHERE id=?').bind(id).run();if(row.key)await bucket().delete(row.key);return Response.json({ok:true});
}
