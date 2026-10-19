import { isAdmin } from '@/lib/auth';
import { bucket, db, jsonError, safeName } from '@/lib/data';
export async function POST(request:Request){
 if(!await isAdmin())return jsonError('Accès réservé à l’administration.',403);
 const b=await request.json() as Record<string,unknown>, name=safeName(b.name), machineId=safeName(b.machineId,80);
 if(!name||!machineId)return jsonError('Machine et rubrique requises.');
 const id=typeof b.id==='string'&&b.id.length<80?b.id:crypto.randomUUID();
 if(b.id)await db().prepare('UPDATE sections SET name=? WHERE id=? AND machine_id=?').bind(name,id,machineId).run();
 else await db().prepare('INSERT INTO sections (id,machine_id,name,sort) VALUES (?,?,?,(SELECT COALESCE(MAX(sort),0)+1 FROM sections WHERE machine_id=?))').bind(id,machineId,name,machineId).run();
 return Response.json({id});
}
export async function DELETE(request:Request){
 if(!await isAdmin())return jsonError('Accès réservé à l’administration.',403);
 const id=new URL(request.url).searchParams.get('id');if(!id)return jsonError('Rubrique manquante.');
 const files=await db().prepare('SELECT key FROM documents WHERE section_id=?').bind(id).all<{key:string}>();
 await db().prepare('DELETE FROM sections WHERE id=?').bind(id).run();for(const file of files.results)if(file.key)await bucket().delete(file.key);return Response.json({ok:true});
}
