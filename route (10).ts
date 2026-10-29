import {db,jsonError,safeName} from '@/lib/data';
import {learnerActor,mutationAllowed} from '@/lib/learning';
import {ensureProjectVisual,visualModel,visualLabels} from '@/lib/project-visual';
export const dynamic='force-dynamic';
async function context(projectId:string){
 const actor=await learnerActor();if(!actor)return {error:jsonError('Connexion requise.',401)};
 const project=await db().prepare('SELECT id,class_id,title FROM class_projects WHERE id=?').bind(projectId).first<{id:string;class_id:string;title:string}>();
 if(!project||(!actor.admin&&project.class_id!==actor.classId))return {error:jsonError('Projet indisponible.',404)};
 await ensureProjectVisual();
 const model=await visualModel(projectId,project.title);
 return {actor,project,...model};
}
export async function GET(request:Request){
 const projectId=new URL(request.url).searchParams.get('projectId')||'',c=await context(projectId);if(c.error)return c.error;
 const {actor,project,enabled,catalog}=c;
 const saved=(await db().prepare('SELECT p.*,s.username AS assigned_name FROM project_visual_parts p LEFT JOIN students s ON s.id=p.assigned_student_id WHERE p.project_id=?').bind(projectId).all()).results;
 const parts=catalog.map(p=>({...p,state:p.initialState,assigned_student_id:null,assigned_name:null,comment:'',teacher_comment:'',version:0,...saved.find(r=>r.part_id===p.id)}));
 const students=actor.admin?(await db().prepare('SELECT id,username FROM students WHERE class_id=? AND active=1 ORDER BY username').bind(project.class_id).all()).results:[];
 const history=actor.admin?(await db().prepare('SELECT part_id,state,actor,comment,created_at FROM project_visual_history WHERE project_id=? ORDER BY id DESC LIMIT 100').bind(projectId).all()).results:[];
 return Response.json({enabled,admin:actor.admin,studentId:actor.id,model:c.model,modelId:c.modelId,filename:c.filename,parts,students,history:history.filter(h=>catalog.some(p=>p.id===h.part_id))},{headers:{'Cache-Control':'private, no-store'}});
}
export async function POST(request:Request){
 if(!mutationAllowed(request))return jsonError('Origine refusée.',403);
 let b:Record<string,unknown>;try{b=await request.json()}catch{return jsonError('Données invalides.')}
 const projectId=safeName(b.projectId,80),c=await context(projectId);if(c.error)return c.error;
 const {actor,project,enabled,catalog}=c,d=db();
 if(b.action==='enable'){if(!actor.admin)return jsonError('Action réservée au professeur.',403);await d.prepare("INSERT OR IGNORE INTO project_visual_config(project_id,model) VALUES (?,'stirling')").bind(projectId).run();return Response.json({ok:true});}
 if(!enabled)return jsonError('Active le modèle 3D du projet.',409);
 const partId=safeName(b.partId,100),part=catalog.find(p=>p.id===partId),version=b.version;
 if(!part||!Number.isSafeInteger(version)||Number(version)<0)return jsonError('Pièce ou version invalide.');
 const previous=await d.prepare('SELECT * FROM project_visual_parts WHERE project_id=? AND part_id=?').bind(projectId,partId).first<{state:string;assigned_student_id:string|null;comment:string;teacher_comment:string;version:number}>();
 if((previous?.version||0)!==version)return jsonError('Cette pièce a changé. Actualise avant de réessayer.',409);
 const currentState=previous?.state||part.initialState;
 let state=safeName(b.state,30),assigned=previous?.assigned_student_id||null,comment=safeName(b.comment,1500),teacherComment=previous?.teacher_comment||'';
 if(!actor.admin){
  if(currentState==='completed'||currentState==='purchased')return jsonError('Le professeur doit rouvrir cette pièce.',403);
  if(b.action==='claim'){
   if(assigned&&assigned!==actor.id)return jsonError('Cette pièce est déjà attribuée.',403);
   assigned=actor.id;state=currentState;comment=previous?.comment||'';
  }else{
   if(assigned!==actor.id)return jsonError('Seul l’élève chargé de cette pièce peut la modifier.',403);
   if(!['todo','in_progress','to_review'].includes(state))return jsonError('La validation est réservée au professeur.',403);
  }
 }else{
  if(!Object.hasOwn(visualLabels,state))return jsonError('État invalide.');
  assigned=safeName(b.assignedStudentId,80)||null;teacherComment=safeName(b.teacherComment,1500);
  if(assigned&&!await d.prepare('SELECT id FROM students WHERE id=? AND class_id=? AND active=1').bind(assigned,project.class_id).first())return jsonError('Élève hors de cette classe.',403);
 }
 const now=new Date().toISOString();let result;
 if(Number(version)===0){result=await d.prepare('INSERT INTO project_visual_parts(project_id,part_id,state,assigned_student_id,comment,teacher_comment,updated_by,updated_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(project_id,part_id) DO NOTHING').bind(projectId,partId,state,assigned,comment,teacherComment,actor.name,now).run();}
 else{result=await d.prepare('UPDATE project_visual_parts SET state=?,assigned_student_id=?,comment=?,teacher_comment=?,updated_by=?,updated_at=?,version=version+1 WHERE project_id=? AND part_id=? AND version=?').bind(state,assigned,comment,teacherComment,actor.name,now,projectId,partId,version).run();}
 if(!result.meta.changes)return jsonError('Cette pièce a changé. Actualise avant de réessayer.',409);
 return Response.json({ok:true});
}
