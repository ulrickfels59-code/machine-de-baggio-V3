import { account, createAccount, ownerCanSetup, startSession, adminCookie } from '@/lib/auth';
import { jsonError } from '@/lib/data';
export async function POST(request:Request){
 if(!await ownerCanSetup())return jsonError('Configuration réservée au propriétaire.',403);
 if(await account())return jsonError('Le compte administrateur existe déjà.',409);
 const body=await request.json() as Record<string,unknown>;
 const username=typeof body.username==='string'?body.username.trim():'';
 const password=typeof body.password==='string'?body.password:'';
 if(!/^[a-zA-Z0-9_.-]{3,30}$/.test(username))return jsonError('Identifiant de 3 à 30 caractères (lettres, chiffres, point ou tiret).');
 if(password.length<4||password.length>128)return jsonError('Choisis un mot de passe de 4 caractères minimum.');
 try{await createAccount(username,password)}catch(e){console.error(e);return jsonError('Impossible de créer le compte pour le moment. Réessaie.',503)}
 const token=await startSession(username);return Response.json({ok:true,token},{headers:{'Set-Cookie':adminCookie(token)}});
}
