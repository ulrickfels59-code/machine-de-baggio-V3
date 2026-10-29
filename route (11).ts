import {ensureLearning} from '@/lib/learning';
import { isAdmin } from '@/lib/auth';
import { classId, seedClasses } from '@/lib/classes';
import { db, jsonError } from '@/lib/data';
export async function GET(){await seedClasses();const admin=await isAdmin(),id=admin?null:await classId();if(!admin&&!id)return Response.json({role:'guest',classes:[],projects:[],files:[]});const d=db();const [classes,projects,files]=await Promise.all([
 admin?d.prepare('SELECT id,label,username FROM school_classes ORDER BY CASE id WHEN \'seconde\' THEN 1 WHEN \'premiere\' THEN 2 WHEN \'terminale\' THEN 3 ELSE 4 END,label').all():d.prepare('SELECT id,label FROM school_classes WHERE id=?').bind(id).all(),
 admin?d.prepare('SELECT id,class_id,title,description,sort FROM class_projects ORDER BY sort,title').all():d.prepare('SELECT id,class_id,title,description,sort FROM class_projects WHERE class_id=? ORDER BY sort,title').bind(id).all(),
 admin?d.prepare('SELECT id,project_id,class_id,name,size FROM class_files').all():d.prepare('SELECT id,project_id,class_id,name,size FROM class_files WHERE class_id=?').bind(id).all()]);return Response.json({role:admin?'admin':'student',classes:classes.results,projects:projects.results,files:files.results})}

export async function POST(request:Request){
 if(!await isAdmin())return jsonError('Accès réservé à l’administration.',403);
 const body=await request.json() as Record<string,unknown>,label=typeof body.label==='string'?body.label.trim().replace(/\s+/g,' '):'';
 if(!label||label.length>60)return jsonError('Saisis un nom de classe de 1 à 60 caractères.');
 await seedClasses();
 const existing=await db().prepare('SELECT label FROM school_classes').all<{label:string}>();
 if(existing.results.some(row=>row.label.toLocaleLowerCase('fr')===label.toLocaleLowerCase('fr')))return jsonError('Cette classe existe déjà.',409);
 const id=crypto.randomUUID();await db().prepare('INSERT INTO school_classes(id,label) VALUES (?,?)').bind(id,label).run();
 return Response.json({id,label}, {status:201});
}

export async function DELETE(request:Request){
 if(!await isAdmin())return jsonError('Accès réservé à l’administration.',403);
 const id=new URL(request.url).searchParams.get('id');if(!id)return jsonError('Classe manquante.');await seedClasses();const d=db();
 if(!await d.prepare('SELECT id FROM school_classes WHERE id=?').bind(id).first())return jsonError('Classe inconnue.',404);
 await ensureLearning();
 const result=await d.prepare('DELETE FROM school_classes WHERE id=? AND NOT EXISTS(SELECT 1 FROM students WHERE class_id=?) AND NOT EXISTS(SELECT 1 FROM class_projects WHERE class_id=?) AND NOT EXISTS(SELECT 1 FROM document_folders WHERE class_id=?) AND NOT EXISTS(SELECT 1 FROM learning_tasks WHERE class_id=?)').bind(id,id,id,id,id).run();
 if(!result.meta.changes)return jsonError('Déplace ou supprime les élèves, les projets, les activités pédagogiques et les dossiers de cette classe avant de la supprimer.',409);
 return Response.json({ok:true});
}
