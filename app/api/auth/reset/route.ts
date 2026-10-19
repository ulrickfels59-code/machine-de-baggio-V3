import { ownerCanSetup, resetAccount, startSession, adminCookie } from '@/lib/auth';
import { jsonError } from '@/lib/data';
export async function POST(request:Request){
 if(!await ownerCanSetup())return jsonError('Réinitialisation réservée au propriétaire du site.',403);
 const b=await request.json() as Record<string,unknown>,username=typeof b.username==='string'?b.username.trim():'',password=typeof b.password==='string'?b.password:'';
 if(!/^[a-zA-Z0-9_.-]{3,30}$/.test(username)||password.length<4||password.length>128)return jsonError('Identifiant de 3 à 30 caractères et mot de passe de 4 caractères minimum requis.');
 try{await resetAccount(username,password);await startSession(username);return Response.json({ok:true})}catch(e){console.error(e);return jsonError('Réinitialisation impossible pour le moment.',503)}
}
