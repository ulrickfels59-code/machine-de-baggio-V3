import {ensureMachineTooling} from '@/lib/machine-tooling';
import { isAdmin } from '@/lib/auth';
import { bucket, db, jsonError, safeName } from '@/lib/data';
export async function POST(request:Request){
 if(!await isAdmin())return jsonError('Accès réservé à l’administration.',403);
 const b=await request.json() as Record<string,unknown>; const name=safeName(b.name), kind=safeName(b.kind), description=safeName(b.description,500), image=safeName(b.image,1000);
 if(!name)return jsonError('Nom requis.');
 if(image && !/^https:\/\//i.test(image) && !/^\/api\/image\//.test(image))return jsonError('Adresse de l’image invalide.');
 const id=typeof b.id==='string'&&b.id.length<80?b.id:crypto.randomUUID();
 if(b.id){await db().prepare('UPDATE machines SET name=?,kind=?,description=?,image=? WHERE id=?').bind(name,kind||'Machine CNC',description,image,id).run();}
 else {await db().prepare('INSERT INTO machines (id,name,kind,description,image,sort) VALUES (?,?,?,?,?,(SELECT COALESCE(MAX(sort),0)+1 FROM machines))').bind(id,name,kind||'Machine CNC',description,image).run();}
 return Response.json({id});
}
export async function DELETE(request:Request){
 if(!await isAdmin())return jsonError('Accès réservé à l’administration.',403);
 const id=new URL(request.url).searchParams.get('id'); if(!id)return jsonError('Machine manquante.');
 const files=await db().prepare('SELECT key FROM documents WHERE machine_id=?').bind(id).all<{key:string}>();
 await ensureMachineTooling();try{await db().prepare('DELETE FROM machines WHERE id=?').bind(id).run()}catch(e){if((String(e)+' '+String((e as any)?.cause)).includes('tooling_machine_active'))return jsonError('Remets les outils de cette machine en stock avant de la supprimer.',409);throw e}for(const file of files.results)if(file.key)await bucket().delete(file.key);return Response.json({ok:true});
}
