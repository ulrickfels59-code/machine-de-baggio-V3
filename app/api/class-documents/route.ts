import { isAdmin } from '@/lib/auth';
import { classId, seedClasses } from '@/lib/classes';
import { db, jsonError } from '@/lib/data';
export async function GET(){await seedClasses();const admin=await isAdmin(),id=admin?null:await classId();if(!admin&&!id)return Response.json({role:'guest',classes:[],folders:[],files:[]});const d=db();const [classes,projects,files]=await Promise.all([
 admin?d.prepare('SELECT id,label,username FROM school_classes ORDER BY CASE id WHEN \'seconde\' THEN 1 WHEN \'premiere\' THEN 2 WHEN \'terminale\' THEN 3 ELSE 4 END,label').all():d.prepare('SELECT id,label FROM school_classes WHERE id=?').bind(id).all(),
 admin?d.prepare('SELECT id,class_id,title,description,sort FROM document_folders ORDER BY sort,title').all():d.prepare('SELECT id,class_id,title,description,sort FROM document_folders WHERE class_id=? ORDER BY sort,title').bind(id).all(),
 admin?d.prepare('SELECT id,folder_id,class_id,name,size FROM folder_files').all():d.prepare('SELECT id,folder_id,class_id,name,size FROM folder_files WHERE class_id=?').bind(id).all()]);return Response.json({role:admin?'admin':'student',classes:classes.results,folders:projects.results,files:files.results})}

