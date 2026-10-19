import { isAdmin } from '@/lib/auth';
import { seedClasses } from '@/lib/classes';
import { db, jsonError } from '@/lib/data';
import { saveStudent } from '@/lib/students';
export async function GET(){if(!await isAdmin())return jsonError('Accès refusé.',403);await seedClasses();const rows=await db().prepare('SELECT id,username,class_id,active,must_change_password FROM students ORDER BY class_id,username').all();const classes=await db().prepare("SELECT id,label FROM school_classes ORDER BY CASE id WHEN 'seconde' THEN 1 WHEN 'premiere' THEN 2 WHEN 'terminale' THEN 3 ELSE 4 END,label").all();return Response.json({students:rows.results,classes:classes.results})}
export async function POST(request:Request){if(!await isAdmin())return jsonError('Accès refusé.',403);const b=await request.json() as Record<string,unknown>,id=typeof b.id==='string'?b.id:null,username=typeof b.username==='string'?b.username.trim():'',classId=typeof b.classId==='string'?b.classId:'',password=typeof b.password==='string'?b.password:'';if(!/^[a-zA-Z0-9_.-]{3,30}$/.test(username)||!classId||(!id&&password.length!==6)||(password&&password.length!==6))return jsonError('Identifiant valide, classe et mot de passe provisoire de 6 caractères requis.');if(!await db().prepare('SELECT id FROM school_classes WHERE id=?').bind(classId).first())return jsonError('Classe inconnue.');if(id&&!await db().prepare('SELECT id FROM students WHERE id=?').bind(id).first())return jsonError('Compte inconnu.',404);try{const saved=await saveStudent(id,username,classId,password);return Response.json({id:saved})}catch(e){console.error(e);return jsonError('Identifiant déjà utilisé ou enregistrement impossible.',409)}}
export async function PATCH(request:Request){if(!await isAdmin())return jsonError('Accès refusé.',403);const b=await request.json() as Record<string,unknown>,id=typeof b.id==='string'?b.id:'',active=b.active===true?1:0;if(!id)return jsonError('Compte manquant.');await db().prepare('UPDATE students SET active=? WHERE id=?').bind(active,id).run();if(!active)await db().prepare('DELETE FROM student_sessions WHERE student_id=?').bind(id).run();return Response.json({ok:true})}

export async function DELETE(request:Request){
 if(!await isAdmin())return jsonError('Accès réservé à l’administration.',403);
 const id=new URL(request.url).searchParams.get('id');if(!id)return jsonError('Compte manquant.');
 const database=db();if(!await database.prepare('SELECT id FROM students WHERE id=?').bind(id).first())return jsonError('Compte élève inconnu.',404);
 await database.batch([database.prepare('DELETE FROM student_sessions WHERE student_id=?').bind(id),database.prepare('DELETE FROM students WHERE id=?').bind(id)]);
 return Response.json({ok:true});
}
