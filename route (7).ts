import {db,bucket,jsonError} from '@/lib/data';
import {learnerActor,ensureLearning,clean,mutationAllowed} from '@/lib/learning';
import {validatedFile,storedResponse} from '@/lib/learning-files';
export async function POST(request:Request){
 const a=await learnerActor();if(!a||a.admin)return jsonError('Dépôt réservé à un compte élève connecté.',403);if(!mutationAllowed(request))return jsonError('Origine refusée.',403);await ensureLearning();
 const form=await request.formData(),taskId=clean(form.get('taskId'),80),file=form.get('file'),comment=clean(form.get('comment'),1500);
 if(!(file instanceof File))return jsonError('Fichier requis.');
 const task=await db().prepare('SELECT id FROM learning_tasks WHERE id=? AND class_id=? AND active=1').bind(taskId,a.classId).first();if(!task)return jsonError('Activité indisponible.',404);
 const progress=await db().prepare('SELECT state FROM learning_progress WHERE task_id=? AND student_id=?').bind(taskId,a.id).first<{state:string}>();if(progress?.state==='completed')return jsonError('Cette activité est validée. Demande sa réouverture au professeur.',409);
 const used=await db().prepare('SELECT COALESCE(SUM(size),0) AS total,COUNT(*) AS count FROM learning_submissions WHERE student_id=?').bind(a.id).first<{total:number;count:number}>();if((used?.total||0)+file.size>200*1024*1024||(used?.count||0)>=200)return jsonError('Limite de dépôts atteinte. Contacte le professeur.',409);
 let validated;try{validated=await validatedFile(file)}catch(e){return jsonError((e as Error).message)}
 const id=crypto.randomUUID(),key='learning/submissions/'+id;await bucket().put(key,validated.bytes,{httpMetadata:{contentType:validated.mime}});
 try{await db().prepare('INSERT INTO learning_submissions(id,task_id,student_id,class_id,username,name,key,mime,size,comment,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)').bind(id,taskId,a.id,a.classId,a.name,validated.name,key,validated.mime,file.size,comment,new Date().toISOString()).run()}catch(e){await bucket().delete(key);const message=String(e)+' '+String((e as any)?.cause);if(message.includes('learning_submission_'))return jsonError('Activité fermée ou limite de dépôts atteinte. Actualise ton espace.',409);throw e}return Response.json({id},{status:201});
}
export async function GET(request:Request){
 const a=await learnerActor();if(!a)return jsonError('Connexion requise.',401);await ensureLearning();const id=new URL(request.url).searchParams.get('id')||'';
 const row=await db().prepare('SELECT s.*,t.class_id AS current_class FROM learning_submissions s JOIN learning_tasks t ON t.id=s.task_id WHERE s.id=?').bind(id).first<{student_id:string;current_class:string;key:string;mime:string;name:string}>();
 if(!row||(!a.admin&&(row.student_id!==a.id||row.current_class!==a.classId)))return jsonError('Fichier indisponible.',404);return storedResponse(row.key,row.mime,row.name);
}
