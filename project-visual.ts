import {db} from './data';
import catalog from './stirling-catalog.json';
export {catalog};
export const visualLabels:Record<string,string>={todo:'À commencer',in_progress:'En cours',to_review:'À contrôler',completed:'Validée par le professeur',purchased:'Composant acheté'};
export const visualSchema=[
 `CREATE TABLE IF NOT EXISTS project_visual_config(project_id TEXT PRIMARY KEY REFERENCES class_projects(id) ON DELETE CASCADE,model TEXT NOT NULL DEFAULT 'stirling')`,
 `CREATE TABLE IF NOT EXISTS project_visual_uploads(id TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES class_projects(id) ON DELETE CASCADE,filename TEXT NOT NULL,glb_key TEXT NOT NULL,step_key TEXT NOT NULL,catalog TEXT NOT NULL,size INTEGER NOT NULL,created_at TEXT NOT NULL,created_by TEXT NOT NULL)`,
 `CREATE TABLE IF NOT EXISTS project_visual_parts(project_id TEXT NOT NULL REFERENCES class_projects(id) ON DELETE CASCADE,part_id TEXT NOT NULL,state TEXT NOT NULL CHECK(state IN ('todo','in_progress','to_review','completed','purchased')),assigned_student_id TEXT REFERENCES students(id) ON DELETE SET NULL,comment TEXT NOT NULL DEFAULT '',teacher_comment TEXT NOT NULL DEFAULT '',version INTEGER NOT NULL DEFAULT 1,updated_by TEXT NOT NULL,updated_at TEXT NOT NULL,PRIMARY KEY(project_id,part_id))`,
 `CREATE TABLE IF NOT EXISTS project_visual_history(id INTEGER PRIMARY KEY AUTOINCREMENT,project_id TEXT NOT NULL REFERENCES class_projects(id) ON DELETE CASCADE,part_id TEXT NOT NULL,state TEXT NOT NULL,actor TEXT NOT NULL,comment TEXT NOT NULL,created_at TEXT NOT NULL)`,
 `CREATE TRIGGER IF NOT EXISTS project_visual_insert_history AFTER INSERT ON project_visual_parts BEGIN INSERT INTO project_visual_history(project_id,part_id,state,actor,comment,created_at) VALUES(NEW.project_id,NEW.part_id,NEW.state,NEW.updated_by,NEW.comment,NEW.updated_at); END`,
 `CREATE TRIGGER IF NOT EXISTS project_visual_update_history AFTER UPDATE ON project_visual_parts BEGIN INSERT INTO project_visual_history(project_id,part_id,state,actor,comment,created_at) VALUES(NEW.project_id,NEW.part_id,NEW.state,NEW.updated_by,NEW.comment,NEW.updated_at); END`
];
let ready:Promise<unknown>|undefined;
export async function ensureProjectVisual(){if(!ready)ready=db().batch(visualSchema.map(sql=>db().prepare(sql))).catch(e=>{ready=undefined;throw e});await ready;}
export async function visualModel(projectId:string,title:string){
 const config=await db().prepare('SELECT model FROM project_visual_config WHERE project_id=?').bind(projectId).first<{model:string}>();
 const upload=config?await db().prepare('SELECT id,filename,catalog FROM project_visual_uploads WHERE id=? AND project_id=?').bind(config.model,projectId).first<{id:string;filename:string;catalog:string}>():null;
 if(upload)return {enabled:true,modelId:upload.id,filename:upload.filename,catalog:JSON.parse(upload.catalog) as typeof catalog,model:`/api/project-model?projectId=${encodeURIComponent(projectId)}&modelId=${upload.id}`};
 const enabled=config?.model==='stirling';
 return {enabled,modelId:config?.model||'',filename:'',catalog:enabled?catalog:[],model:'/models/stirling.glb'};
}
