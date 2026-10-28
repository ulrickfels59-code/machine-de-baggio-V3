import {db,bucket,jsonError} from '@/lib/data';
import {learnerActor,ensureLearning,learningSnapshot,clean,conflict,mutationAllowed,progressLabels} from '@/lib/learning';
export const dynamic='force-dynamic';
export async function GET(){const a=await learnerActor();if(!a)return jsonError('Connecte-toi pour ouvrir ton espace.',401);return Response.json(await learningSnapshot(a),{headers:{'Cache-Control':'private, no-store'}})}
export async function POST(request:Request){
 const a=await learnerActor();if(!a)return jsonError('Connexion requise.',401);if(!mutationAllowed(request))return jsonError('Origine refusée.',403);await ensureLearning();
 const b=await request.json() as Record<string,unknown>,action=clean(b.action,30),now=new Date().toISOString(),d=db();
 if(action==='progress'){
  const taskId=clean(b.taskId,80),studentId=a.admin?clean(b.studentId,80):a.id!,state=clean(b.state,20),version=b.version;
  if(!Object.hasOwn(progressLabels,state)||!Number.isSafeInteger(version)||(version as number)<0)return jsonError('État ou version invalide.');
  if(!a.admin&&state==='completed')return jsonError('Seul le professeur peut valider un projet terminé.',403);
  const task=await d.prepare('SELECT class_id,active FROM learning_tasks WHERE id=?').bind(taskId).first<{class_id:string;active:number}>();
  if(!task||!task.active||(!a.admin&&task.class_id!==a.classId))return jsonError('Activité indisponible.',404);
  if(!await d.prepare('SELECT id FROM students WHERE id=? AND class_id=? AND active=1').bind(studentId,task.class_id).first())return jsonError('Élève hors de cette classe.',403);
  const previous=await d.prepare('SELECT state,teacher_comment FROM learning_progress WHERE task_id=? AND student_id=?').bind(taskId,studentId).first<{state:string;teacher_comment:string}>();
  if(!a.admin&&previous?.state==='completed')return jsonError('Le professeur doit rouvrir cette activité validée.',409);
  const comment=a.admin?clean(b.teacherComment,2000):previous?.teacher_comment||'';
  const result=await d.prepare(`INSERT INTO learning_progress(task_id,student_id,state,teacher_comment,updated_at,reviewed_by) SELECT ?,?,?,?,?,? WHERE ?=0 ON CONFLICT(task_id,student_id) DO UPDATE SET state=excluded.state,teacher_comment=excluded.teacher_comment,updated_at=excluded.updated_at,reviewed_by=excluded.reviewed_by,version=learning_progress.version+1 WHERE learning_progress.version=? AND (?=1 OR learning_progress.state<>'completed')`).bind(taskId,studentId,state,comment,now,a.admin?a.name:'',version,version,a.admin?1:0).run();
  // Existing-row updates need a separate guarded UPDATE because an INSERT SELECT with version>0 produces no row.
  if(!result.meta.changes&&Number(version)>0){const update=await d.prepare("UPDATE learning_progress SET state=?,teacher_comment=?,updated_at=?,reviewed_by=?,version=version+1 WHERE task_id=? AND student_id=? AND version=? AND (?=1 OR state<>'completed')").bind(state,comment,now,a.admin?a.name:'',taskId,studentId,version,a.admin?1:0).run();if(!update.meta.changes)return conflict()}
  else if(!result.meta.changes)return conflict();
  return Response.json({ok:true});
 }
 if(!a.admin)return jsonError('Action réservée au professeur.',403);
 if(action==='task-delete'){
  const id=clean(b.id,80),version=Number(b.version)||0;
  const files=await d.prepare('SELECT key FROM learning_submissions WHERE task_id=?').bind(id).all<{key:string}>();
  const result=await d.prepare('DELETE FROM learning_tasks WHERE id=? AND version=?').bind(id,version).run();if(!result.meta.changes)return conflict();
  for(const file of files.results)await bucket().delete(file.key);return Response.json({ok:true});
 }
 if(action==='task'){
  const id=clean(b.id,80)||crypto.randomUUID(),classId=clean(b.classId,80),title=clean(b.title,150),instructions=clean(b.instructions,6000),nextStep=clean(b.nextStep,1000),due=clean(b.dueDate,10),projectId=clean(b.projectId,80)||null,machineId=clean(b.machineId,80)||null;
  if(!title||!instructions||!classId||(due&&(!/^\d{4}-\d{2}-\d{2}$/.test(due)||Number.isNaN(Date.parse(due))||new Date(due).toISOString().slice(0,10)!==due)))return jsonError('Classe, titre, consignes et date valides requis.');
  if(!await d.prepare('SELECT id FROM school_classes WHERE id=?').bind(classId).first())return jsonError('Classe inconnue.');
  if(projectId&&!await d.prepare('SELECT id FROM class_projects WHERE id=? AND class_id=?').bind(projectId,classId).first())return jsonError('Projet hors de cette classe.');
  if(machineId&&!await d.prepare('SELECT id FROM machines WHERE id=?').bind(machineId).first())return jsonError('Machine inconnue.');
  if(b.id){const result=await d.prepare('UPDATE learning_tasks SET title=?,instructions=?,next_step=?,due_date=?,project_id=?,machine_id=?,active=?,version=version+1,updated_at=? WHERE id=? AND class_id=? AND version=?').bind(title,instructions,nextStep,due,projectId,machineId,b.active===false?0:1,now,id,classId,Number(b.version)||0).run();if(!result.meta.changes)return conflict()}
  else await d.prepare('INSERT INTO learning_tasks(id,class_id,project_id,machine_id,title,instructions,next_step,due_date,updated_at) VALUES (?,?,?,?,?,?,?,?,?)').bind(id,classId,projectId,machineId,title,instructions,nextStep,due,now).run();return Response.json({id});
 }
 if(action==='guide'){
  const machineId=clean(b.machineId,80),title=clean(b.title,150),setup=clean(b.setup,6000),reminders=clean(b.reminders,4000),safety=clean(b.safety,6000),published=b.published===true?1:0,version=Number(b.version)||0;
  if(!title||!setup||!safety)return jsonError('Titre, étapes et consignes de sécurité requis.');
  if(!await d.prepare('SELECT id FROM machines WHERE id=?').bind(machineId).first())return jsonError('Machine inconnue.');
  const result=await d.prepare(`INSERT INTO learning_guides(machine_id,title,setup,reminders,safety,published,updated_at,reviewed_by) SELECT ?,?,?,?,?,?,?,? WHERE ?=0 OR EXISTS(SELECT 1 FROM learning_guides WHERE machine_id=? AND version=?) ON CONFLICT(machine_id) DO UPDATE SET title=excluded.title,setup=excluded.setup,reminders=excluded.reminders,safety=excluded.safety,published=excluded.published,updated_at=excluded.updated_at,reviewed_by=excluded.reviewed_by,version=learning_guides.version+1 WHERE learning_guides.version=?`).bind(machineId,title,setup,reminders,safety,published,now,a.name,version,machineId,version,version).run();if(!result.meta.changes)return conflict();return Response.json({ok:true});
 }
 if(action==='report-review'){
  const status=clean(b.status,20);if(!['open','in_progress','resolved'].includes(status))return jsonError('État invalide.');
  const result=await d.prepare('UPDATE learning_reports SET status=?,teacher_comment=?,reviewed_by=?,updated_at=?,version=version+1 WHERE id=? AND version=?').bind(status,clean(b.teacherComment,2000),a.name,now,clean(b.id,80),Number(b.version)||0).run();if(!result.meta.changes)return conflict();return Response.json({ok:true});
 }
 return jsonError('Action inconnue.');
}
