import { isOwnerAdmin, hex, passwordHash } from '@/lib/auth';
import { db, jsonError } from '@/lib/data';
export async function GET(){
 if(!await isOwnerAdmin())return jsonError('Accès réservé au compte administrateur principal.',403);
 const rows=await db().prepare("SELECT username FROM admin_accounts WHERE role='colleague' ORDER BY username").all<{username:string}>();
 return Response.json({admins:rows.results},{headers:{'Cache-Control':'private, no-store'}});
}
export async function POST(request:Request){
 if(!await isOwnerAdmin())return jsonError('Accès réservé au compte administrateur principal.',403);
 const body=await request.json() as Record<string,unknown>;
 const username=typeof body.username==='string'?body.username.trim():'',password=typeof body.password==='string'?body.password:'',originalUsername=typeof body.originalUsername==='string'?body.originalUsername:'';
 if(!/^[a-zA-Z0-9_.-]{3,30}$/.test(username)||password.length>128||(!originalUsername&&password.length<4)||(password&&password.length<4))return jsonError('Identifiant de 3 à 30 caractères et mot de passe de 4 caractères minimum requis.');
 const d=db();
 if(originalUsername&&!await d.prepare("SELECT username FROM admin_accounts WHERE username=? AND role='colleague'").bind(originalUsername).first())return jsonError('Compte administrateur inconnu.',404);
 if((!originalUsername||originalUsername!==username)&&await d.prepare('SELECT username FROM admin_accounts WHERE username=?').bind(username).first())return jsonError('Cet identifiant est déjà utilisé.',409);
 let salt='',hash='';if(password){salt=hex(crypto.getRandomValues(new Uint8Array(24)));hash=await passwordHash(password,salt)}
 try{
  if(originalUsername){
   await d.batch([d.prepare('DELETE FROM admin_sessions WHERE username=?').bind(originalUsername),password?d.prepare("UPDATE admin_accounts SET username=?,salt=?,hash=?,failed=0,locked_until=0 WHERE username=? AND role='colleague'").bind(username,salt,hash,originalUsername):d.prepare("UPDATE admin_accounts SET username=? WHERE username=? AND role='colleague'").bind(username,originalUsername)]);
  }else await d.prepare("INSERT INTO admin_accounts(username,salt,hash,role) VALUES (?,?,?,'colleague')").bind(username,salt,hash).run();
 }catch(e){console.error(e);return jsonError('Identifiant déjà utilisé ou enregistrement impossible.',409)}
 return Response.json({ok:true});
}
export async function DELETE(request:Request){
 if(!await isOwnerAdmin())return jsonError('Accès réservé au compte administrateur principal.',403);
 const username=new URL(request.url).searchParams.get('username');if(!username)return jsonError('Compte administrateur manquant.');
 const d=db();if(!await d.prepare("SELECT username FROM admin_accounts WHERE username=? AND role='colleague'").bind(username).first())return jsonError('Ce compte ne peut pas être retiré.',404);
 await d.batch([d.prepare("DELETE FROM admin_sessions WHERE username=? AND EXISTS(SELECT 1 FROM admin_accounts WHERE username=? AND role='colleague')").bind(username,username),d.prepare("DELETE FROM admin_accounts WHERE username=? AND role='colleague'").bind(username)]);
 return Response.json({ok:true});
}
