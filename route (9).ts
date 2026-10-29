import {db,bucket,jsonError} from '@/lib/data';
import {learnerActor,ensureLearning,clean,mutationAllowed} from '@/lib/learning';
import {validatedFile,storedResponse} from '@/lib/learning-files';
export async function POST(request:Request){
 const a=await learnerActor();if(!a)return jsonError('Connexion requise.',401);if(!mutationAllowed(request))return jsonError('Origine refusée.',403);await ensureLearning();
 const form=await request.formData(),category=clean(form.get('category'),20),machineId=clean(form.get('machineId'),80),description=clean(form.get('description'),3000),photo=form.get('photo');
 if(!['machine','tool','part'].includes(category)||description.length<5||(category==='machine'&&!machineId))return jsonError('Choisis le type, la machine si nécessaire et décris le problème.');
 const machine=machineId?await db().prepare('SELECT name FROM machines WHERE id=?').bind(machineId).first<{name:string}>():null;if(machineId&&!machine)return jsonError('Machine inconnue.');
 const recent=await db().prepare('SELECT COUNT(*) AS n FROM learning_reports WHERE actor_key=? AND created_at>?').bind(a.key,new Date(Date.now()-3600000).toISOString()).first<{n:number}>();if((recent?.n||0)>=20)return jsonError('Limite de signalements par heure atteinte.',429);
 const id=crypto.randomUUID(),now=new Date().toISOString();let key='',mime='',size=0;
 if(photo instanceof File&&photo.size){let v;try{v=await validatedFile(photo,true)}catch(e){return jsonError((e as Error).message)}key='learning/reports/'+id;mime=v.mime;size=photo.size;await bucket().put(key,v.bytes,{httpMetadata:{contentType:mime}})}
 try{await db().prepare('INSERT INTO learning_reports(id,student_id,class_id,username,actor_key,category,machine_id,machine_name,description,photo_key,photo_mime,photo_size,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,a.id,a.classId,a.name,a.key,category,machineId||null,machine?.name||'',description,key,mime,size,now,now).run()}catch(e){if(key)await bucket().delete(key);throw e}return Response.json({id},{status:201});
}
export async function GET(request:Request){
 const a=await learnerActor();if(!a)return jsonError('Connexion requise.',401);await ensureLearning();const id=new URL(request.url).searchParams.get('id')||'';
 const row=await db().prepare('SELECT actor_key,photo_key,photo_mime FROM learning_reports WHERE id=?').bind(id).first<{actor_key:string;photo_key:string;photo_mime:string}>();
 if(!row||!row.photo_key||(!a.admin&&row.actor_key!==a.key))return jsonError('Photo indisponible.',404);return storedResponse(row.photo_key,row.photo_mime,'signalement.'+({'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[row.photo_mime]||'jpg'));
}
