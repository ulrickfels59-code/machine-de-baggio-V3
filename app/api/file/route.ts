import { isAdmin } from '@/lib/auth';
import { classId } from '@/lib/classes';
import { bucket, db, jsonError } from '@/lib/data';
export async function GET(request:Request){
 if(!await isAdmin()&&!await classId())return jsonError('Accès réservé aux utilisateurs connectés.',401);
 const id=new URL(request.url).searchParams.get('id');if(!id)return jsonError('Document manquant.');
 const row=await db().prepare('SELECT key,name FROM documents WHERE id=?').bind(id).first<{key:string,name:string}>();if(!row)return jsonError('Document introuvable.',404);
 const file=await bucket().get(row.key);if(!file)return jsonError('Fichier indisponible.',404);
 return new Response(file.body,{headers:{'Content-Type':'application/pdf','Content-Disposition':`inline; filename="document.pdf"`,'Cache-Control':'private, max-age=60','X-Content-Type-Options':'nosniff'}});
}
